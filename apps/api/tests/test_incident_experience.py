from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from flowpilot.main import create_app
from flowpilot.settings import ROOT


def test_experience_requires_compatible_earlier_reviewed_source_and_honors_withdrawal(
    tmp_path, monkeypatch
):
    url = f"sqlite:///{tmp_path / 'experience.db'}"
    monkeypatch.setenv("FLOWPILOT_DATABASE_URL", url)
    config = Config(str(ROOT / "apps/api/alembic.ini"))
    config.set_main_option("sqlalchemy.url", url)
    command.upgrade(config, "head")
    with TestClient(create_app()) as client:

        def create(trigger, configuration="S932 / DJ-2200 / BFS"):
            response = client.post(
                "/api/incidents",
                json={"trigger_id": trigger, "configuration": configuration},
            )
            assert response.status_code == 201, response.text
            return response.json()

        def act(incident, action, **values):
            response = client.post(
                f"/api/incidents/{incident['id']}/actions",
                headers={"X-Incident-Role": "engineer"},
                json={"revision": incident["revision"], "action": action, **values},
            )
            assert response.status_code == 200, response.text
            return response.json()

        source = create("source")
        too_early = create("before-source-closure")
        source = act(
            source,
            "close",
            outcome="inconclusive",
            notes="PM record absent; no physical cause established.",
            reviewer="Demo engineer",
        )
        current = create("current")
        endpoint = f"/api/incidents/{current['id']}/experience"
        assert client.get(endpoint).json() == []
        source = act(
            source,
            "review_learning",
            decision="approve",
            reviewer="Demo knowledge reviewer",
            notes="Reviewed unresolved findings for replay reuse only.",
        )
        matches = client.get(endpoint).json()
        assert len(matches) == 1
        assert matches[0]["incident_id"] == source["id"]
        assert matches[0]["outcome"] == "inconclusive"
        assert "not an approved" in matches[0]["limitation"]
        assert client.get(endpoint, params={"q": "PM"}).json() == matches
        assert client.get(endpoint, params={"q": "unrelated finding"}).json() == []
        assert client.get(f"/api/incidents/{source['id']}/experience").json() == []
        assert client.get(f"/api/incidents/{too_early['id']}/experience").json() == []
        other_configuration = create("other-configuration", "TCB bonder")
        assert client.get(f"/api/incidents/{other_configuration['id']}/experience").json() == []
        replay = client.post("/api/incidents/replay", json={"trigger_id": "other-mode"}).json()
        assert client.get(f"/api/incidents/{replay['id']}/experience").json() == []
        source = act(
            source,
            "review_learning",
            decision="withdraw",
            reviewer="Demo knowledge reviewer",
            notes="Withdraw while additional evidence is reviewed.",
        )
        assert source["learning"]["status"] == "withdrawn"
        assert client.get(endpoint).json() == []
        assert client.get("/api/incidents/missing/experience").status_code == 404
