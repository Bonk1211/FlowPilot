import hashlib
import json
from datetime import UTC, datetime, timedelta

import pytest
from alembic import command
from alembic.config import Config
from fastapi import HTTPException
from flowpilot.incidents.artifacts import ArtifactRecord
from flowpilot.incidents.gateway import GatewayEventRecord, read_under_root, run_once
from flowpilot.incidents.service import (
    active_evidence,
    database_operation,
    get_incident,
    list_incidents,
)
from flowpilot.settings import ROOT, Settings
from sqlalchemy import select


@pytest.fixture
def setup(tmp_path, monkeypatch):
    url = f"sqlite:///{tmp_path / 'gateway.db'}"
    monkeypatch.setenv("FLOWPILOT_DATABASE_URL", url)
    monkeypatch.setenv("FLOWPILOT_INCIDENT_AUTH_MODE", "demo")
    config = Config(str(ROOT / "apps/api/alembic.ini"))
    config.set_main_option("sqlalchemy.url", url)
    command.upgrade(config, "head")
    root = tmp_path / "exports"
    root.mkdir()
    settings = Settings(incident_gateway_pre_seconds=300, incident_gateway_post_seconds=60)
    return root, settings


def event(
    identifier,
    when,
    *,
    tool="S932-TEST",
    configuration="S932 / DJ-2200 / BFS",
    role="machine_log",
    synthetic=True,
):
    return {
        "event_id": identifier,
        "kind": "evidence",
        "tool_id": tool,
        "configuration": configuration,
        "exported_at": when.isoformat(),
        "evidence": {
            "id": identifier,
            "kind": "log",
            "role": role,
            "label": "Synthetic test evidence",
            "source_ref": "export:log",
            "tool_id": tool,
            "configuration": configuration,
            "event_time": (when - timedelta(seconds=17)).isoformat(),
            "event_timezone": "UTC",
            "time_uncertain": True,
            "clock_offset_seconds": 17,
            "synthetic": synthetic,
            "values": {"mass_trend": "falling", "units": {"mass": "mg"}},
        },
    }


def trigger(when):
    return {
        "event_id": "trigger-01",
        "kind": "trigger",
        "tool_id": "S932-TEST",
        "configuration": "S932 / DJ-2200 / BFS",
        "exported_at": when.isoformat(),
        "symptom": "Test coverage decline",
        "trigger_origin": "image_quality",
        "expected_sources": [
            {
                "kind": "log",
                "role": "machine_log",
                "label": "Expected log",
                "source_ref": "export:log",
            },
            {
                "kind": "maintenance",
                "role": "pm",
                "label": "Expected PM",
                "source_ref": "export:pm",
            },
        ],
    }


def write(root, records, append=False):
    with (root / "events.jsonl").open("a" if append else "w") as stream:
        stream.write("".join(json.dumps(item) + "\n" for item in records))


def test_bundled_mock_needs_no_machine_credentials_and_archives_original_bytes(setup):
    _, settings = setup
    result = run_once(mock=True, settings=settings)
    assert len(result.incidents) == 1 and result.failed == 0
    incident = get_incident(result.incidents[0])
    assert incident.mode == "synthetic"
    evidence = active_evidence(incident)
    assert all(item.synthetic for item in evidence)
    assert {item.role for item in evidence} == {
        "last_good",
        "first_bad",
        "machine_log",
        "pm",
        "context",
    }
    assert next(item for item in evidence if item.role == "pm").status == "unavailable"
    good = next(item for item in evidence if item.role == "last_good")
    assert good.tray_id == "TRAY-101" and good.lot_id == "MOCK-LOT-01"
    assert (
        good.raw_integrity_ref
        == hashlib.sha256((ROOT / "fixtures/s932-gateway/good.png").read_bytes()).hexdigest()
    )
    archived = database_operation(
        lambda session: session.get(ArtifactRecord, good.artifact_id).content
    )
    assert archived == (ROOT / "fixtures/s932-gateway/good.png").read_bytes()
    repeated = run_once(mock=True, settings=settings)
    assert repeated.incidents == result.incidents
    assert repeated.attached == 0 and repeated.buffered == 0
    assert len(list_incidents()) == 1


def test_pre_and_post_buffer_survive_restarts_keep_clock_and_missing_sources(setup):
    root, settings = setup
    now = datetime.now(UTC)
    before = event("before-01", now - timedelta(seconds=10))
    write(root, [before])
    assert run_once(mock=True, mock_root=root, settings=settings, now=now).incidents == []
    write(root, [trigger(now)], append=True)
    opened = run_once(mock=True, mock_root=root, settings=settings, now=now)
    incident = get_incident(opened.incidents[0])
    log = next(item for item in active_evidence(incident) if item.role == "machine_log")
    assert log.event_time == before["evidence"]["event_time"]
    assert log.clock_offset_seconds == 17 and log.time_uncertain
    assert next(item for item in active_evidence(incident) if item.role == "pm").status == "pending"
    write(root, [event("after-01", now + timedelta(seconds=20))], append=True)
    continued = run_once(
        mock=True, mock_root=root, settings=settings, now=now + timedelta(seconds=30)
    )
    assert continued.attached == 1
    ended = run_once(mock=True, mock_root=root, settings=settings, now=now + timedelta(seconds=61))
    incident = get_incident(ended.incidents[0])
    pm = next(item for item in active_evidence(incident) if item.role == "pm")
    assert pm.status == "unavailable" and pm.supersedes_id
    assert any(item.id == "pending-1" for item in incident.evidence)


def test_wrong_tool_configuration_and_lot_are_never_assigned(setup):
    root, settings = setup
    now = datetime.now(UTC)
    other_tool = event("other-tool", now, tool="S932-OTHER")
    other_configuration = event("other-config", now, configuration="S932 / syringe")
    other_lot = event("other-lot", now)
    other_lot["evidence"]["lot_id"] = "OTHER-LOT"
    signal = trigger(now)
    signal["lot_id"] = "TARGET-LOT"
    write(root, [other_tool, other_configuration, other_lot, signal])
    result = run_once(mock=True, mock_root=root, settings=settings, now=now)
    assert result.unmatched == 3
    assert all(item.status == "pending" for item in get_incident(result.incidents[0]).evidence)


def test_malformed_complete_lines_checkpoint_but_partial_final_line_waits(setup):
    root, settings = setup
    now = datetime.now(UTC)
    signal = json.dumps(trigger(now)).encode()
    path = root / "events.jsonl"
    path.write_bytes(b"not-json\n" + signal[:30])
    first = run_once(mock=True, mock_root=root, settings=settings, now=now)
    assert first.failed == 1 and first.offset == len(b"not-json\n")
    with path.open("ab") as stream:
        stream.write(signal[30:] + b"\n")
    second = run_once(mock=True, mock_root=root, settings=settings, now=now)
    assert len(second.incidents) == 1 and second.failed == 0
    assert run_once(mock=True, mock_root=root, settings=settings, now=now).buffered == 0
    # Replaced exports are safely reread through persistent event IDs.
    path.write_bytes(signal + b"\n")
    assert (
        run_once(mock=True, mock_root=root, settings=settings, now=now).incidents
        == second.incidents
    )
    assert len(list_incidents()) == 1


def test_traversal_symlinks_and_hash_mismatch_become_failed_sources(setup, tmp_path):
    root, settings = setup
    now = datetime.now(UTC)
    secret = tmp_path / "outside.txt"
    secret.write_bytes(b"outside-export-root")
    (root / "escape.txt").symlink_to(secret)
    for path in ["../outside.txt", "escape.txt", str(secret)]:
        with pytest.raises((ValueError, OSError)):
            read_under_root(root, path, 1000)
    (root / "original.txt").write_bytes(b"test original")
    evidence = event("bad-hash", now)
    evidence["artifact"] = {
        "relative_path": "original.txt",
        "sha256": "0" * 64,
        "media_type": "text/plain",
    }
    write(root, [evidence, trigger(now)])
    result = run_once(mock=True, mock_root=root, settings=settings, now=now)
    assert result.failed == 1
    collected = next(
        item
        for item in active_evidence(get_incident(result.incidents[0]))
        if item.role == "machine_log"
    )
    assert collected.status == "failed"
    assert collected.artifact_id is None and collected.raw_integrity_ref is None


def test_mock_refuses_actual_evidence_and_live_requires_explicit_deployment(setup):
    root, settings = setup
    now = datetime.now(UTC)
    write(root, [event("actual-data", now, synthetic=False), trigger(now)])
    with pytest.raises(HTTPException, match="Mock gateway refuses"):
        run_once(mock=True, mock_root=root, settings=settings, now=now)
    assert list_incidents() == []
    with pytest.raises(ValueError, match="configured access"):
        run_once(settings=settings)
    configured = settings.model_copy(
        update={"incident_auth_mode": "configured", "incident_gateway_root": root}
    )
    result = run_once(settings=configured, now=now)
    assert get_incident(result.incidents[0]).mode == "live"
    assert (
        next(
            item
            for item in active_evidence(get_incident(result.incidents[0]))
            if item.role == "machine_log"
        ).synthetic
        is False
    )
    with pytest.raises(HTTPException, match="buffered non-synthetic"):
        run_once(mock=True, mock_root=root, settings=settings, now=now)


def test_old_buffer_bytes_are_pruned_without_erasing_incident_originals(setup):
    root, settings = setup
    now = datetime.now(UTC)
    write(root, [event("original-01", now), trigger(now)])
    result = run_once(mock=True, mock_root=root, settings=settings, now=now)
    incident = get_incident(result.incidents[0])
    original = next(item for item in active_evidence(incident) if item.artifact_id)
    run_once(mock=True, mock_root=root, settings=settings, now=now + timedelta(hours=2))
    assert (
        database_operation(lambda session: list(session.scalars(select(GatewayEventRecord)))) == []
    )
    assert database_operation(
        lambda session: session.get(ArtifactRecord, original.artifact_id).content
    )
