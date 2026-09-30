import os
import runpy
from pathlib import Path

import httpx
from flowpilot.settings import ROOT


def test_offline_benchmark_uses_temporary_database_and_no_network(tmp_path, monkeypatch):
    protected = tmp_path / "existing.db"
    protected.write_bytes(b"Do not touch the configured database")
    configured = f"sqlite:///{protected}"
    monkeypatch.setenv("FLOWPILOT_DATABASE_URL", configured)
    monkeypatch.setenv("FLOWPILOT_REASONING_ENABLED", "true")

    def forbidden(*args, **kwargs):
        raise AssertionError("The default benchmark must not call a provider")

    monkeypatch.setattr(httpx.Client, "send", forbidden)
    monkeypatch.setattr(httpx.AsyncClient, "send", forbidden)
    script = runpy.run_path(str(ROOT / "scripts/benchmark-incidents.py"))
    report = script["benchmark"](samples=2)
    assert protected.read_bytes() == b"Do not touch the configured database"
    assert os.environ["FLOWPILOT_DATABASE_URL"] == configured
    assert os.environ["FLOWPILOT_REASONING_ENABLED"] == "true"
    assert report["capture_latency"]["acknowledgement"]["samples"] == 2
    assert not report["isolation"]["default_database_modified"]
    providers = report["decision_workflow"]["providers"]
    assert all(item["status"] == "not_run" for item in providers.values())
    cases = report["decision_workflow"]["cases"]
    assert len({item["incident_id"] for item in cases}) == 10
    assert all(item["matches_authored_workflow_expectation"] for item in cases)
    assert any(item["inconclusive_hypotheses"] for item in cases)
    assert any(item["unknown_discovery_fields"] for item in cases)
    assert all(item["unverified_sources_block_operational_instructions"] for item in cases)
    assert not report["real_machine_validated"]
    assert not report["simulation"]["evaluation"]["real_machine_validated"]


def test_evaluation_fixtures_are_immutable_and_use_separate_incident_ids():
    from dataclasses import FrozenInstanceError

    import pytest

    script = runpy.run_path(str(Path(ROOT) / "scripts/benchmark-incidents.py"))
    fixtures = script["heldout_cases"]()
    with pytest.raises(FrozenInstanceError):
        fixtures[0].expected_next_id = "invented"
    assert all(item.incident_id.startswith("HELDOUT-") for item in fixtures)
    assert len({item.incident_id for item in fixtures}) == len(fixtures)
