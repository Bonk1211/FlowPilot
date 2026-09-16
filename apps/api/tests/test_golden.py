import json
from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from flowpilot.demo import load_scenario
from flowpilot.golden import GoldenScenario, load_golden_scenario
from flowpilot.ingestion.industry_event_log import parse_industry_event_log
from flowpilot.main import create_app
from flowpilot.settings import fixture_path
from pydantic import ValidationError


def test_golden_api_matches_shared_fixture_without_database(tmp_path, monkeypatch):
    database = tmp_path / "unused.db"
    monkeypatch.setenv("FLOWPILOT_DATABASE_URL", f"sqlite:///{database.as_posix()}")
    raw = json.loads(fixture_path("v1/golden-scenario.json").read_text(encoding="utf-8"))
    with TestClient(create_app()) as client:
        response = client.get("/api/demo/golden-scenario")
    assert response.status_code == 200
    assert response.json() == raw
    assert not database.exists()


def test_golden_log_is_real_parser_output():
    sample = load_scenario().sample_log
    assert load_golden_scenario().log_preview.model_dump(exclude_unset=True) == (
        parse_industry_event_log(
            sample.text, source_name=sample.sourceName, timezone_offset=sample.timezoneOffset
        )
    )


def test_positive_and_negative_outcomes_are_distinct_and_verification_is_separate():
    scenario = load_golden_scenario()
    snapshots = {s.id: s for s in scenario.snapshots}
    assert snapshots["found"].state == "inspection_completed"
    assert not any(c.confirmed for c in snapshots["found"].ranking)
    assert snapshots["corrective"].state == "cause_confirmed"
    assert snapshots["verification"].state == "corrective_action_completed"
    assert snapshots["verified"].state == "verification_passed"
    assert snapshots["summary"].state == "resolved"
    negative = snapshots["negative"]
    assert negative.state == "diagnosing"
    assert not any(c.confirmed for c in negative.ranking)
    assert negative.ranking[0].hypothesis_id == "material_viscosity_change"
    assert negative.recommendation_id == "material"


def test_negative_inspection_is_recorded_before_reassessment():
    scenario = load_golden_scenario()
    negative = next(s for s in scenario.snapshots if s.id == "negative")
    completed, reassessed = negative.timeline[-2:]
    assert [completed.state, reassessed.state] == ["inspection_completed", "diagnosing"]
    timestamps = [datetime.fromisoformat(entry.timestamp) for entry in negative.timeline]
    assert timestamps == sorted(timestamps)
    assert timestamps[-2] < timestamps[-1]
    observation = next(e for e in scenario.investigation.evidence if e.id == "EV-CLEAR")
    assert timestamps[-2] == datetime.fromisoformat(observation.timestamp)
    assert "EV-CLEAR" in negative.evidence_ids
    assert "EV-FOUND" not in negative.evidence_ids


@pytest.mark.parametrize("kind", ["evidence", "transition", "question", "score", "node"])
def test_rejects_broken_fixture_references(kind):
    data = load_golden_scenario().model_dump()
    if kind == "evidence":
        data["findings"][0]["supporting_evidence_ids"] = ["missing"]
    elif kind == "transition":
        data["snapshots"][0]["next_snapshot_id"] = "missing"
    elif kind == "question":
        data["questions"][0]["options"][0]["next_question_id"] = "missing"
    elif kind == "score":
        data["snapshots"][3]["ranking"][0]["score"] = 999
    else:
        data["procedure_steps"][0]["model_node_id"] = "missing"
    with pytest.raises(ValidationError):
        GoldenScenario.model_validate(data)
