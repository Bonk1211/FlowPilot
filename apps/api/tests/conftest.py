import pytest


@pytest.fixture(autouse=True)
def offline_reasoning(monkeypatch):
    # Never consume a developer's key during regression tests.
    monkeypatch.setenv("FLOWPILOT_REASONING_ENABLED", "false")
    monkeypatch.setenv("FLOWPILOT_INCIDENT_RAG_ENABLED", "false")
    monkeypatch.setenv("FLOWPILOT_INCIDENT_JEV_ENABLED", "false")
    monkeypatch.setenv("FLOWPILOT_INCIDENT_QUESTION_SELECTOR", "auto")
    monkeypatch.setenv("FLOWPILOT_INCIDENT_AUTO_PROCESS", "false")
    monkeypatch.setenv("FLOWPILOT_INCIDENT_AUTH_MODE", "demo")
