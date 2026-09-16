import pytest


@pytest.fixture(autouse=True)
def offline_reasoning(monkeypatch):
    # Never consume a developer's key during regression tests.
    monkeypatch.setenv("FLOWPILOT_REASONING_ENABLED", "false")
