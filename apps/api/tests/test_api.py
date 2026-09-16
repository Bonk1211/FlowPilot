import pytest
from fastapi.testclient import TestClient
from flowpilot.demo import DemoScenario
from flowpilot.ingestion.industry_event_log import parse_industry_event_log
from flowpilot.main import create_app


@pytest.fixture
def client():
    with TestClient(create_app()) as client:
        yield client


def test_health(client):
    assert client.get("/api/health").json() == {
        "status": "ok",
        "service": "flowpilot-api",
        "version": "0.1.0",
    }


def test_scenario_and_preview_have_no_database_side_effects(client, tmp_path, monkeypatch):
    database = tmp_path / "must-not-exist.db"
    monkeypatch.setenv("FLOWPILOT_DATABASE_URL", f"sqlite:///{database.as_posix()}")
    response = client.get("/api/demo/scenario")
    assert response.status_code == 200
    scenario = DemoScenario.model_validate(response.json())
    assert scenario.investigation.simulated
    assert scenario.investigation.state == "reported"
    assert scenario.log_metadata.limitations
    request = scenario.sample_log
    response = client.post("/api/logs/preview", json=request.model_dump())
    assert response.status_code == 200
    assert response.json() == parse_industry_event_log(
        request.text,
        source_name=request.sourceName,
        timezone_offset=request.timezoneOffset,
    )
    assert not database.exists()


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"text": 42},
        {"text": "", "sourceName": ""},
        {"text": "", "timezoneOffset": "+24:00"},
        {"text": "", "unexpected": True},
        {"text": "x" * 2_000_001},
    ],
)
def test_invalid_preview_requests(client, body):
    assert client.post("/api/logs/preview", json=body).status_code == 422


def test_empty_preview_is_valid(client):
    response = client.post("/api/logs/preview", json={"text": ""})
    assert response.status_code == 200
    assert response.json()["stats"]["eventCount"] == 0


def test_unknown_routes_do_not_pretend_to_implement_workflows(client):
    assert client.post("/api/investigations").status_code == 404
