import asyncio
from concurrent.futures import ThreadPoolExecutor
from threading import Event
from time import monotonic, sleep

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from flowpilot.incidents import coordinator, diagnostic, service
from flowpilot.incidents.models import AddEvidenceAction, EditHandoffAction, EvidenceInput
from flowpilot.incidents.replay import replay_request
from flowpilot.main import create_app
from flowpilot.settings import ROOT, Settings
from sqlalchemy import update


@pytest.fixture
def incident(tmp_path, monkeypatch):
    url = f"sqlite:///{tmp_path / 'jobs.db'}"
    monkeypatch.setenv("FLOWPILOT_DATABASE_URL", url)
    monkeypatch.setenv("FLOWPILOT_REASONING_ENABLED", "false")
    monkeypatch.setenv("FLOWPILOT_INCIDENT_AUTO_PROCESS", "false")
    config = Config(str(ROOT / "apps/api/alembic.ini"))
    config.set_main_option("sqlalchemy.url", url)
    command.upgrade(config, "head")
    return service.create_incident(replay_request("jobs-replay"))


def baseline(incident):
    incident.assessment = diagnostic.analyze(
        [item.model_dump(mode="json") for item in service.active_evidence(incident)],
        [item.model_dump(mode="json") for item in service.active_observations(incident)],
        incident.configuration,
    )


def test_jobs_are_idempotent_and_handoff_finishes_while_analysis_waits(incident):
    jobs = coordinator.schedule_incident(incident)
    assert len(jobs) == 2 and {job.kind for job in jobs} == {"analysis", "handoff"}
    assert [job.id for job in coordinator.schedule_incident(incident)] == [job.id for job in jobs]
    started, release = Event(), Event()

    def slow_analysis(item):
        started.set()
        assert release.wait(3)
        baseline(item)

    with ThreadPoolExecutor(max_workers=2) as pool:
        future = pool.submit(coordinator.process_next_job, "analysis", slow_analysis)
        assert started.wait(3)
        draft_job = coordinator.process_next_job("handoff", handoff_fn=service.draft_for)
        assert draft_job.state == "succeeded"
        assert service.get_incident(incident.id).assessment is None
        release.set()
        assert future.result(timeout=3).state == "succeeded"
    current = service.get_incident(incident.id)
    assert current.assessment is not None
    assert "Assessment:" in current.handoff.body
    assert len(coordinator.schedule_incident(current)) == 2
    assert all(job.state == "succeeded" for job in coordinator.list_jobs(incident.id))


def test_late_evidence_supersedes_running_result(incident):
    coordinator.schedule_incident(incident)

    def changed_during_analysis(item):
        current = service.get_incident(item.id)
        service.act(
            item.id,
            AddEvidenceAction(
                action="add_evidence",
                revision=current.revision,
                evidence=EvidenceInput(
                    id="late",
                    kind="context",
                    role="context",
                    label="Late note",
                    source_ref="test:late",
                    values={"material": "changed"},
                ),
            ),
        )
        baseline(item)

    job = coordinator.process_next_job("analysis", analyze_fn=changed_during_analysis)
    assert job.state == "superseded"
    current = service.get_incident(incident.id)
    assert current.assessment is None
    jobs = coordinator.schedule_incident(current)
    assert len(jobs) == 4
    assert len([item for item in jobs if item.state == "pending"]) == 2


def test_human_edit_is_preserved_and_old_analysis_draft_cannot_replace_current(incident):
    coordinator.schedule_incident(incident)

    def concurrent_edit(item):
        current = service.get_incident(item.id)
        service.act(
            item.id,
            EditHandoffAction(
                action="edit_handoff",
                revision=current.revision,
                body="Engineer authored this draft.",
            ),
        )
        return service.draft_for(item)

    assert coordinator.process_next_job("handoff", handoff_fn=concurrent_edit).state == "succeeded"
    current = service.get_incident(incident.id)
    assert current.handoff.human_edited and current.handoff.body == "Engineer authored this draft."
    assert current.handoff_history[-1].body != current.handoff.body
    assert coordinator.process_next_job("analysis", analyze_fn=baseline).state == "succeeded"
    assert service.get_incident(incident.id).handoff.body == "Engineer authored this draft."


def test_retries_are_bounded_and_expired_leases_recover_without_duplicate_commit(incident):
    coordinator.schedule_incident(incident)

    def broken(item):
        raise RuntimeError("private provider detail must not be stored")

    for expected in ("pending", "pending", "failed"):
        job = coordinator.process_next_job("analysis", analyze_fn=broken)
        assert job.state == expected
        assert "private" not in job.error
    assert coordinator.process_next_job("analysis", analyze_fn=baseline) is None
    coordinator.schedule_incident(incident, retry_failed=True)
    job = coordinator.process_next_job("analysis", analyze_fn=baseline)
    assert job.state == "succeeded" and job.attempts == 4
    revision = service.get_incident(incident.id).revision

    # Simulate a crash after saving the result but before marking its durable job succeeded.
    service.database_operation(
        lambda session: session.execute(
            update(coordinator.IncidentJobRecord)
            .where(coordinator.IncidentJobRecord.id == job.id)
            .values(
                state="running", lease_until="2000-01-01T00:00:00+00:00", worker_token="crashed"
            )
        )
    )
    assert coordinator.recover_expired_jobs() == 1
    recovered = coordinator.process_next_job("analysis", analyze_fn=broken)
    assert recovered.state == "succeeded"
    assert service.get_incident(incident.id).revision == revision


def test_closed_incident_cannot_be_reopened_by_queued_analysis(incident):
    coordinator.schedule_incident(incident)
    current = service.get_incident(incident.id)
    current.status = "closed"
    current.revision += 1
    service.save_incident(current, incident.revision)
    jobs = coordinator.schedule_incident(current)
    assert all(job.state == "superseded" for job in jobs)
    assert coordinator.process_next_job("analysis", analyze_fn=baseline) is None
    assert service.get_incident(incident.id).status == "closed"


def test_llm_draft_validates_refs_and_external_data_policy(incident):
    calls = []

    async def generate(payload, schema):
        calls.append(payload)
        return {
            "body": f"Draft only: {incident.id}, {incident.tool_id}. Review missing PM data.",
            "evidence_ids": ["image-good"],
            "source_refs": ["replay:v1/image-good"],
            "unknowns": [payload["unknowns"][0]],
        }

    settings = Settings(
        _env_file=None,
        reasoning_enabled=True,
        gemini_api_key=None,
        incident_external_data_policy="synthetic_only",
    )
    draft = asyncio.run(coordinator.generate_handoff(incident, settings, generate))
    assert draft.generation_mode == "gemini"
    assert draft.status == "draft" and "Recorded incident manifest" in draft.body
    assert "No email has been sent" in draft.body
    incident.evidence[0].synthetic = False
    real = asyncio.run(coordinator.generate_handoff(incident, settings, generate))
    assert real.generation_mode == "template" and len(calls) == 1
    assert "synthetic data only" in real.fallback_reason
    settings.incident_external_data_policy = "disabled"
    disabled = asyncio.run(coordinator.generate_handoff(incident, settings, generate))
    assert disabled.generation_mode == "template" and len(calls) == 1
    assert "External processing disabled" in disabled.fallback_reason
    settings.incident_external_data_policy = "permitted"

    async def forged(payload, schema):
        result = await generate(payload, schema)
        result["evidence_ids"] = ["invented"]
        return result

    rejected = asyncio.run(coordinator.generate_handoff(incident, settings, forged))
    assert rejected.generation_mode == "template"
    assert "validation" in rejected.fallback_reason
    assert "Draft only" in rejected.body and "invented" not in rejected.body


def test_startup_reconciles_saved_incidents_without_rescheduling_completed_inputs(incident):
    assert not coordinator.list_jobs(incident.id)
    assert coordinator.reconcile_open_incidents() == 1
    assert len(coordinator.list_jobs(incident.id)) == 2
    coordinator.process_next_job("analysis", analyze_fn=baseline)
    coordinator.process_next_job("handoff", handoff_fn=service.draft_for)
    before = coordinator.list_jobs(incident.id)
    assert coordinator.reconcile_open_incidents() == 1
    assert coordinator.list_jobs(incident.id) == before
    current = service.get_incident(incident.id)
    previous_revision = current.revision
    current.status = "closed"
    current.revision += 1
    service.save_incident(current, previous_revision)
    assert coordinator.reconcile_open_incidents() == 0


def test_mock_app_lifespan_automatically_processes_http_create_and_replay(tmp_path, monkeypatch):
    """Exercise the dev:mock workers and the same HTTP refresh endpoints used by the UI."""
    url = f"sqlite:///{tmp_path / 'mock-lifespan.db'}"
    monkeypatch.setenv("FLOWPILOT_DATABASE_URL", url)
    monkeypatch.setenv("FLOWPILOT_INCIDENT_AUTH_MODE", "demo")
    monkeypatch.setenv("FLOWPILOT_INCIDENT_AUTO_PROCESS", "true")
    monkeypatch.setenv("FLOWPILOT_REASONING_ENABLED", "false")
    monkeypatch.setenv("FLOWPILOT_INCIDENT_JEV_ENABLED", "false")
    config = Config(str(ROOT / "apps/api/alembic.ini"))
    config.set_main_option("sqlalchemy.url", url)
    command.upgrade(config, "head")

    # Enter the actual app lifespan; never invoke or patch either worker manually.
    with TestClient(create_app()) as client:
        status = client.get("/api/incident-jobs/status")
        assert status.status_code == 200 and status.json() == {"enabled": True}
        initial = []
        for endpoint, payload in (
            ("/api/incidents/replay", {"trigger_id": "auto-replay"}),
            (
                "/api/incidents",
                {
                    "trigger_id": "auto-manual",
                    "trigger_origin": "manual",
                    "mode": "synthetic",
                    "symptom": "Synthetic insufficient coverage",
                },
            ),
        ):
            response = client.post(endpoint, json=payload)
            assert response.status_code == 201, response.text
            initial.append(response.json())

        deadline = monotonic() + 8
        while True:
            jobs = {}
            for item in initial:
                response = client.get(f"/api/incidents/{item['id']}/jobs")
                assert response.status_code == 200, response.text
                jobs[item["id"]] = response.json()
            if all(
                len(items) == 2 and all(job["state"] == "succeeded" for job in items)
                for items in jobs.values()
            ):
                break
            assert monotonic() < deadline, jobs
            sleep(0.02)

        for item in initial:
            completed = jobs[item["id"]]
            assert {job["kind"] for job in completed} == {"analysis", "handoff"}
            assert all(job["attempts"] == 1 and job["error"] is None for job in completed)
            refreshed = client.get(f"/api/incidents/{item['id']}")
            assert refreshed.status_code == 200, refreshed.text
            current = refreshed.json()
            assert current["revision"] > item["revision"]
            assert current["assessment"]["provider"] == "deterministic"
            assert current["assessment"]["explanation"]["mode"] == "unavailable"
            assert current["handoff"]["generation_mode"] == "template"
            assert current["handoff"]["status"] == "draft"
            assert "Assessment:" in current["handoff"]["body"]
            assert {"background_analysis", "background_handoff"} <= {
                event["action"] for event in current["history"]
            }
            assert current["owner"] == "demo:technician"
            assert current["waiting_for"] in {"observation", "engineer"}

    # Exiting TestClient also waits for both worker tasks to shut down cleanly.
