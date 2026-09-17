import json

import pytest
from flowpilot.cases import (
    Answer,
    AttachLog,
    Case,
    CaseRecord,
    CreateCase,
    Diagnose,
    apply_action,
    create_case,
    normalize_case,
    rank,
)
from flowpilot.demo import load_scenario
from flowpilot.investigations.models import Evidence
from flowpilot.persistence.database import make_engine
from flowpilot.settings import fixture_path
from sqlalchemy.orm import Session
from test_cases import act, client, create  # noqa: F401


def with_log():
    case = create_case(CreateCase(report="Incomplete coverage"))
    return apply_action(
        case, AttachLog(action="attach_log", revision=0, log=load_scenario().sample_log)
    )


def intermittent_case(value="yes"):
    case = create_case(CreateCase(report="Incomplete coverage"))
    for answer in ["intermittent", value, "no", "unknown", "unknown"]:
        case = apply_action(
            case,
            Answer(
                action="answer",
                revision=case.revision,
                question_id=case.next_question.id,
                value=answer,
            ),
        )
    return apply_action(case, Diagnose(action="diagnose", revision=case.revision))


def test_compound_and_scalar_units_match_parser_and_round_trip(client):  # noqa: F811
    case = create(client)
    saved = act(client, case, "attach_log", log=load_scenario().sample_log.model_dump())
    restored = client.get(f"/api/investigations/{saved['investigation']['id']}").json()
    assert restored == saved
    for candidate in saved["log"]["evidenceCandidates"]:
        item = next(
            e
            for e in saved["investigation"]["evidence"]
            if e["key"] == candidate["key"] and e["source_ref"] == candidate["sourceRef"]
        )
        assert item["unit"] == candidate["unit"]


@pytest.mark.parametrize(
    "example", json.loads(fixture_path("v1/evidence-units.json").read_text(encoding="utf-8"))
)
def test_evidence_unit_contract_preserves_values_and_missing_data(example):
    item = Evidence(
        id="EV-test",
        key="measurement",
        value=example["value"],
        unit=example["unit"],
        source_type="machine_log",
        source_ref="sample#L1",
        quality="high",
        verification_state="provisional",
        timestamp="unknown",
    )
    restored = Evidence.model_validate_json(item.model_dump_json())
    assert restored.value == example["value"]
    assert restored.unit == example["unit"]


@pytest.mark.parametrize(
    "answer,verification,missing",
    [
        ("yes", "verified", False),
        ("unknown", "verified", True),
        ("yes", "rejected", True),
        ("yes", "provisional", True),
    ],
)
def test_missing_recovery_matches_verified_observation(answer, verification, missing):
    case = intermittent_case(answer)
    next(
        e for e in case.investigation.evidence if e.key == "intermittent"
    ).verification_state = verification
    rank(case)
    normalize_case(case)
    cause = next(c for c in case.ranking if c.hypothesis_id == "atomization_fault")
    finding = next(
        f
        for f in case.findings
        if f.hypothesis_id == "atomization_fault" and f.agent != "diagnostic_critic"
    )
    assert ("Weight versus pattern" in cause.missing_evidence) == missing
    assert finding.missing_evidence == cause.missing_evidence


def test_absent_recovery_remains_missing():
    case = create_case(CreateCase(report="Incomplete coverage"))
    rank(case)
    cause = next(c for c in case.ranking if c.hypothesis_id == "atomization_fault")
    assert cause.missing_evidence == ["Weight versus pattern", "Air-cap and coaxial-air inspection"]


@pytest.mark.parametrize("mismatch", ["duplicate", "key", "source", "value", "existing"])
def test_unit_recovery_requires_unique_exact_match_and_preserves_existing(mismatch):
    case = with_log()
    item = next(e for e in case.investigation.evidence if isinstance(e.unit, dict))
    candidate = next(
        c
        for c in case.log.evidenceCandidates
        if c.key == item.key and c.sourceRef == item.source_ref
    )
    item.unit = "original" if mismatch == "existing" else None
    if mismatch == "duplicate":
        case.log.evidenceCandidates.append(candidate.model_copy(deep=True))
    elif mismatch == "key":
        item.key = "different"
    elif mismatch == "source":
        item.source_ref = "different"
    elif mismatch == "value":
        item.value = {"x": 99}
    normalize_case(case)
    assert item.unit == ("original" if mismatch == "existing" else None)


def test_legacy_read_repairs_presentation_without_writing_and_next_action_persists(client):  # noqa: F811
    case = with_log()
    for answer in ["intermittent", "yes", "no", "unknown", "unknown"]:
        case = apply_action(
            case,
            Answer(
                action="answer",
                revision=case.revision,
                question_id=case.next_question.id,
                value=answer,
            ),
        )
    case = apply_action(case, Diagnose(action="diagnose", revision=case.revision))
    for item in case.investigation.evidence:
        if isinstance(item.unit, dict):
            item.unit = None
    for cause in case.ranking:
        if cause.hypothesis_id == "atomization_fault":
            cause.missing_evidence = ["Weight versus pattern"]
    for finding in case.findings:
        if finding.hypothesis_id == "atomization_fault" and finding.agent != "diagnostic_critic":
            finding.missing_evidence = ["Weight versus pattern"]
    legacy = case.model_dump(mode="json")
    engine = make_engine()
    try:
        with Session(engine) as session, session.begin():
            session.add(
                CaseRecord(id=case.investigation.id, revision=case.revision, payload=legacy)
            )
        path = f"/api/investigations/{case.investigation.id}"
        loaded = client.get(path).json()
        assert any(isinstance(e["unit"], dict) for e in loaded["investigation"]["evidence"])
        assert next(c for c in loaded["ranking"] if c["hypothesis_id"] == "atomization_fault")[
            "missing_evidence"
        ] == ["Air-cap and coaxial-air inspection"]
        assert loaded["revision"] == legacy["revision"]
        assert loaded["timeline"] == legacy["timeline"]
        assert loaded["investigation"]["state"] == legacy["investigation"]["state"]
        assert [(c["score"], c["confirmed"]) for c in loaded["ranking"]] == [
            (c["score"], c["confirmed"]) for c in legacy["ranking"]
        ]
        with Session(engine) as session:
            assert session.get(CaseRecord, case.investigation.id).payload == legacy
        updated = act(client, loaded, "inspect", outcome="no_obstruction_found")
        with Session(engine) as session:
            assert session.get(CaseRecord, case.investigation.id).payload == updated
        assert Case.model_validate(updated).revision == case.revision + 1
    finally:
        engine.dispose()
