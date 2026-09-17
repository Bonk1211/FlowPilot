import json
import struct
import zlib
from datetime import datetime

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from flowpilot.demo import load_scenario
from flowpilot.golden import load_golden_scenario
from flowpilot.imaging import HEIGHT, WIDTH, generate_raster, measure, png, sample_measurement
from flowpilot.ingestion.models import IngestionResult
from flowpilot.main import create_app
from flowpilot.settings import ROOT


@pytest.fixture
def client(tmp_path, monkeypatch):
    url = f"sqlite:///{(tmp_path / 'cases.db').as_posix()}"
    monkeypatch.setenv("FLOWPILOT_DATABASE_URL", url)
    config = Config(str(ROOT / "apps/api/alembic.ini"))
    config.set_main_option("sqlalchemy.url", url)
    command.upgrade(config, "head")
    command.upgrade(config, "head")
    with TestClient(create_app()) as result:
        yield result


def create(client, sample="incomplete"):
    response = client.post(
        "/api/investigations", json={"report": "Declining flux coverage", "sample_id": sample}
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_demo_reset_retains_previous_case_and_starts_clean(client):
    original = diagnose(client)
    original_id = original["investigation"]["id"]
    response = client.post("/api/demo/reset", json={"report": "New simulated report"})
    assert response.status_code == 201
    fresh = response.json()
    assert fresh["investigation"]["id"] != original_id
    assert fresh["scenario_version"] == "2.0"
    assert fresh["revision"] == 0
    assert fresh["investigation"]["state"] == "reported"
    assert fresh["answers"] == {}
    assert fresh["ranking"] == []
    assert fresh["pending_outcome"] is None
    assert fresh["recovery"] is None
    assert fresh["summary"] is None
    assert client.get(f"/api/investigations/{original_id}").json() == original
    assert client.post("/api/demo/reset", json={"report": ""}).status_code == 422
    assert client.get(f"/api/investigations/{original_id}").json() == original


def act(client, case, action, **values):
    if action == "verify" and "checks" not in values:
        values["checks"] = load_golden_scenario().recovery_checks.model_dump()
    response = client.post(
        f"/api/investigations/{case['investigation']['id']}/actions",
        json={
            "revision": case["revision"],
            "action": action,
            **values,
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


def diagnose(client, intermittent=False):
    case = create(client)
    for value in [
        "intermittent" if intermittent else "continuous",
        "yes",
        "no",
        "unknown",
        "unknown",
    ]:
        case = act(client, case, "answer", question_id=case["next_question"]["id"], value=value)
    return act(client, case, "diagnose")


@pytest.mark.parametrize("sample", ["normal", "incomplete", "coarse", "shifted", "overspray"])
def test_raster_measurements(sample):
    result = sample_measurement(sample)
    assert result.passed == (sample == "normal")
    assert result.coverage_pct == (
        70.83 if sample == "incomplete" else 87.5 if sample == "shifted" else 100
    )
    assert (result.coarse_area_px > 0) == (sample == "coarse")
    assert (result.outside_keep_out_px > 0) == (sample in ("overspray", "shifted"))


def test_empty_raster_never_passes():
    result = measure(bytes([255] * WIDTH * HEIGHT), "normal")
    assert result.coverage_pct == 0
    assert not result.passed


def test_measurement_uses_pixels_not_sample_label_and_png_contains_same_raster():
    pixels = generate_raster("normal")
    assert measure(pixels, "incomplete").passed
    encoded = png(pixels)
    assert encoded[:8] == b"\x89PNG\r\n\x1a\n"
    offset, compressed = 8, b""
    while offset < len(encoded):
        size = struct.unpack(">I", encoded[offset : offset + 4])[0]
        if encoded[offset + 4 : offset + 8] == b"IDAT":
            compressed += encoded[offset + 8 : offset + 8 + size]
        offset += size + 12
    rows = zlib.decompress(compressed)
    assert (
        b"".join(rows[y * (WIDTH + 1) + 1 : (y + 1) * (WIDTH + 1)] for y in range(HEIGHT)) == pixels
    )


def test_complete_persisted_journey_and_golden_score_parity(client):
    case = diagnose(client)
    golden = next(s for s in load_golden_scenario().snapshots if s.id == "diagnosis")
    assert [(c["hypothesis_id"], c["score"]) for c in case["ranking"]] == [
        (c.hypothesis_id, c.score) for c in golden.ranking
    ]
    assert not any(c["confirmed"] for c in case["ranking"])
    case = act(client, case, "inspect", outcome="obstruction_found")
    assert case["investigation"]["state"] == "inspection_recommended"
    assert not any(e["key"] == "inspection" for e in case["investigation"]["evidence"])
    case = act(client, case, "confirm_observation", confirmed=True)
    assert [e["state"] for e in case["timeline"][-2:]] == [
        "inspection_completed",
        "cause_confirmed",
    ]
    case = act(client, case, "complete_action", confirmed=True)
    case = act(client, case, "verify", sample_id="normal")
    assert case["summary"] is None
    case = act(client, case, "resolve", confirmed=True)
    assert case["investigation"]["state"] == "resolved"
    assert case["summary"]["evidence_ids"]
    restored = client.get(f"/api/investigations/{case['investigation']['id']}").json()
    assert restored == case
    assert [datetime.fromisoformat(e["timestamp"]) for e in case["timeline"]] == sorted(
        datetime.fromisoformat(e["timestamp"]) for e in case["timeline"]
    )


def test_negative_confirmation_changes_scores_and_preserves_inspection_history(client):
    case = diagnose(client)
    case = act(client, case, "inspect", outcome="no_obstruction_found")
    case = act(client, case, "confirm_observation", confirmed=True)
    assert [e["state"] for e in case["timeline"][-2:]] == ["inspection_completed", "diagnosing"]
    assert case["ranking"][0]["hypothesis_id"] == "fluid_supply_fault"
    assert case["recommendation"]["id"] == "air_supply"
    assert not any(c["confirmed"] for c in case["ranking"])
    evidence = case["investigation"]["evidence"]
    assert [e["value"] for e in evidence if e["key"] == "inspection"] == ["no_obstruction_found"]
    evidence_ids = {e["id"] for e in evidence}
    for finding in case["findings"]:
        assert (
            set(finding["supporting_evidence_ids"] + finding["conflicting_evidence_ids"])
            <= evidence_ids
        )
    assert case["findings_mode"] == "cached_templates"


def test_adaptive_question_and_intermittent_ranking(client):
    case = create(client)
    case = act(client, case, "answer", question_id="frequency", value="intermittent")
    assert case["next_question"]["id"] == "intermittent"
    assert "flux weight pass" in case["next_question"]["prompt"]
    ranked = diagnose(client, intermittent=True)
    assert ranked["ranking"][0]["hypothesis_id"] == "atomization_fault"
    keys = {e["key"] for e in ranked["investigation"]["evidence"]}
    assert "material_temperature" not in keys


def test_attached_log_keeps_parser_provenance_unknowns_and_missing_timezone(client):
    case = create(client)
    log = load_scenario().sample_log.model_dump()
    log["text"] += "\n2026-09-13,01:20:00.000,Unrecognized status,payload"
    log["timezoneOffset"] = None
    preview = client.post("/api/logs/preview", json=log).json()
    case = act(client, case, "attach_log", log=log)
    assert case["log"]["events"] == preview["events"]
    assert case["log"]["sourceDigest"] == preview["sourceDigest"]
    assert IngestionResult.model_validate(case["log"]) == IngestionResult.model_validate(preview)
    evidence = [e for e in case["investigation"]["evidence"] if e["source_type"] == "machine_log"]
    assert evidence
    for item in evidence:
        assert item["verification_state"] == "provisional"
        assert item["source_ref"] in {c["sourceRef"] for c in preview["evidenceCandidates"]}
    assert "dispense_pressure" not in json.dumps(evidence)


@pytest.mark.parametrize(
    "action,extra",
    [
        ("diagnose", {}),
        ("complete_action", {"confirmed": True}),
        ("verify", {"sample_id": "normal"}),
        ("resolve", {"confirmed": True}),
        ("confirm_observation", {"confirmed": True}),
    ],
)
def test_premature_transitions_do_not_mutate_case(client, action, extra):
    case = create(client)
    path = f"/api/investigations/{case['investigation']['id']}"
    response = client.post(path + "/actions", json={"revision": 0, "action": action, **extra})
    assert response.status_code == 409
    assert client.get(path).json() == case


def test_failed_verification_retry_and_stale_revision(client):
    case = diagnose(client)
    case = act(client, case, "inspect", outcome="obstruction_found")
    case = act(client, case, "confirm_observation", confirmed=True)
    case = act(client, case, "complete_action", confirmed=True)
    stale = case["revision"]
    case = act(client, case, "verify", sample_id="coarse")
    path = f"/api/investigations/{case['investigation']['id']}"
    assert case["investigation"]["state"] == "corrective_action_completed"
    assert (
        client.post(
            path + "/actions",
            json={"revision": case["revision"], "action": "resolve", "confirmed": True},
        ).status_code
        == 409
    )
    assert (
        client.post(
            path + "/actions", json={"revision": stale, "action": "verify", "sample_id": "normal"}
        ).status_code
        == 409
    )
    assert client.get(path).json() == case
    case = act(client, case, "verify", sample_id="normal")
    assert case["verification"]["passed"]


def test_bad_answers_missing_confirmation_and_unsupported_diagnosis(client):
    case = create(client)
    path = f"/api/investigations/{case['investigation']['id']}/actions"
    assert (
        client.post(
            path,
            json={"revision": 0, "action": "answer", "question_id": "frequency", "value": "bad"},
        ).status_code
        == 422
    )
    assert (
        client.post(path, json={"revision": 0, "action": "resolve", "confirmed": False}).status_code
        == 422
    )
    for sample in ("normal",):
        unsupported = create(client, sample)
        assert not unsupported["diagnosis_supported"]
        assert unsupported["ranking"] == []
    assert client.get("/api/investigations/missing").status_code == 404
