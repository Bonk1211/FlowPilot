import copy

import pytest
from flowpilot.cases import Case, CaseRecord, database_operation
from flowpilot.knowledge.service import library_revision
from test_cases import act, client, create, diagnose  # noqa: F401


def completed(client):  # noqa: F811
    case = diagnose(client)
    case = act(client, case, "inspect", outcome="obstruction_found")
    case = act(client, case, "confirm_observation", confirmed=True)
    case = act(client, case, "complete_action", confirmed=True)
    case = act(client, case, "verify", sample_id="normal")
    return act(client, case, "resolve", confirmed=True)


def draft(client, case):  # noqa: F811
    response = client.post(
        f"/api/knowledge/from-case/{case['investigation']['id']}",
        json={"source_revision": case["revision"], "actor": "Technician Lee"},
    )
    assert response.status_code == 200, response.text
    return response.json()


def command(client, entry, action, **values):  # noqa: F811
    response = client.post(
        f"/api/knowledge/{entry['id']}/actions",
        json={
            "revision": entry["revision"],
            "action": action,
            "actor": "Reviewer Tan",
            "reason": "Checked the recorded evidence",
            "confirmed": True,
            **values,
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


def matches(case):
    return case["past_experience"]["matches"]


def test_publish_retrieve_correct_retains_old_diagnosis(client):  # noqa: F811
    source = completed(client)
    entry = draft(client, source)
    assert matches(diagnose(client)) == []
    entry = command(client, entry, "publish")
    case_b = diagnose(client)
    before = copy.deepcopy(case_b)
    match = matches(case_b)[0]
    assert match["source_case_id"] == source["investigation"]["id"]
    published_version = entry["versions"][-1]["version"]
    assert match["version"] == published_version and match["matched_conditions"]
    assert "Material batch / recipe" in match["unknown_conditions"]
    assert case_b["findings"][-1]["knowledge_refs"] == [match["citation"]]
    assert case_b["past_experience"]["suggested_check"].startswith("Focus")
    assert not any(c["confirmed"] for c in case_b["ranking"])
    assert case_b["corrective_action"] is None and case_b["summary"] is None
    assert [(r["hypothesis_id"], r["score"]) for r in case_b["ranking"]] == [
        (r["hypothesis_id"], r["score"]) for r in source["diagnostic_history"][0]["ranking"]
    ]
    entry = command(
        client, entry, "dispute", reason="The original interpretation overstates the lesson"
    )
    assert not matches(diagnose(client))
    content = {
        **entry["versions"][-1]["content"],
        "finding": "uncertain",
        "outcome": "unresolved",
        "check_focus": "material_review",
        "lesson": "Restriction was observed; its relevance needs review. Check material history.",
    }
    old = copy.deepcopy(entry["versions"][0])
    entry = command(client, entry, "revise", content=content)
    assert not matches(diagnose(client))
    entry = command(client, entry, "publish")
    case_c = diagnose(client)
    assert matches(case_c)[0]["version"] == published_version + 1
    assert "material condition" in case_c["past_experience"]["suggested_check"]
    assert entry["versions"][0] == old
    path = f"/api/investigations/{case_b['investigation']['id']}"
    assert client.get(path).json() == before
    assert client.get(path + "/knowledge-status").json()[0]["status"] == "superseded"
    refreshed = act(client, case_b, "refresh_knowledge")
    assert refreshed["diagnostic_history"][0] == before["diagnostic_history"][0]
    assert matches(refreshed)[0]["version"] == published_version + 1
    assert refreshed["ranking"] == before["ranking"]
    assert refreshed["investigation"]["state"] == before["investigation"]["state"]
    command(client, entry, "archive")
    assert not matches(diagnose(client))


def test_one_entry_per_source_and_simulated_experience_dedup(client):  # noqa: F811
    source = completed(client)
    first = draft(client, source)
    assert draft(client, source) == first
    command(client, first, "publish")
    command(client, draft(client, completed(client)), "publish")
    assert len(client.get("/api/knowledge").json()) == 2
    assert len(matches(diagnose(client))) == 1


def test_negative_nozzle_finding_and_failed_recovery_are_not_success(client):  # noqa: F811
    case = diagnose(client, intermittent=True)
    case = act(client, case, "inspect", outcome="no_obstruction_found")
    case = act(client, case, "confirm_observation", confirmed=True)
    entry = command(client, draft(client, case), "publish")
    content = entry["versions"][0]["content"]
    assert content["finding"] == "no_obstruction_found"
    assert content["outcome"] == "unresolved"
    assert entry["versions"][0]["source"]["action"] is None
    found = matches(diagnose(client, intermittent=True))
    assert found[0]["content"]["check_focus"] == "air_supply_review"
    bad = {**content, "outcome": "recovered"}
    response = client.post(
        f"/api/knowledge/{entry['id']}/actions",
        json={
            "revision": entry["revision"],
            "action": "revise",
            "actor": "Lee",
            "reason": "Try unsupported success",
            "confirmed": True,
            "content": bad,
        },
    )
    assert response.status_code == 422
    failed = diagnose(client)
    failed = act(client, failed, "inspect", outcome="obstruction_found")
    failed = act(client, failed, "confirm_observation", confirmed=True)
    failed = act(client, failed, "complete_action", confirmed=True)
    failed = act(client, failed, "verify", sample_id="coarse")
    assert draft(client, failed)["versions"][-1]["content"]["outcome"] == "not_recovered"


def test_scope_unknown_incompatible_self_and_future_exclusion(client):  # noqa: F811
    future_target = diagnose(client)
    source = completed(client)
    entry = command(client, draft(client, source), "publish")
    # Source result didn't exist at this case's report time.
    assert not matches(act(client, future_target, "refresh_knowledge"))
    assert not matches(act(client, source, "refresh_knowledge"))
    # Diagnostic-only refresh preserves the supporting source facts.
    entry = client.get(f"/api/knowledge/{entry['id']}").json()
    assert entry["status"] == "published"
    source = client.get(f"/api/investigations/{source['investigation']['id']}").json()
    entry = command(client, entry, "revise", content=entry["versions"][-1]["content"])
    command(client, entry, "publish")
    assert not matches(diagnose(client, intermittent=True))
    unknown = create(client)
    while unknown["next_question"]:
        unknown = act(
            client, unknown, "answer", question_id=unknown["next_question"]["id"], value="unknown"
        )
    assert not matches(act(client, unknown, "diagnose"))
    other = diagnose(client)

    def change_scope(session):
        record = session.get(CaseRecord, other["investigation"]["id"])
        payload = copy.deepcopy(record.payload)
        payload["investigation"]["process"] = "Different equipment process"
        record.payload = payload

    database_operation(change_scope)
    assert not matches(act(client, other, "refresh_knowledge"))


def test_publish_requires_draft_evidence_and_review_and_cas(client):  # noqa: F811
    case = diagnose(client)
    response = client.post(
        f"/api/knowledge/from-case/{case['investigation']['id']}",
        json={"source_revision": case["revision"], "actor": "Lee"},
    )
    assert response.status_code == 409
    entry = draft(client, completed(client))
    published = command(client, entry, "publish")
    base = {
        "revision": entry["revision"],
        "action": "archive",
        "actor": "Lee",
        "reason": "Stale write",
        "confirmed": True,
    }
    path = f"/api/knowledge/{entry['id']}"
    assert client.post(path + "/actions", json=base).status_code == 409
    assert client.get(path).json() == published
    base["revision"] = published["revision"]
    for field, value in [("actor", "  "), ("reason", "  "), ("confirmed", False)]:
        assert client.post(path + "/actions", json={**base, field: value}).status_code == 422
    assert (
        client.post(
            path + "/actions",
            json={
                **base,
                "action": "revise",
                "content": {
                    **published["versions"][0]["content"],
                    "supporting_evidence_ids": ["invented"],
                },
            },
        ).status_code
        == 422
    )
    disputed = command(client, published, "dispute")
    assert (
        client.post(
            path + "/actions", json={**base, "revision": disputed["revision"], "action": "publish"}
        ).status_code
        == 409
    )


def test_source_update_invalidates_and_publish_old_source_rolls_back(client):  # noqa: F811
    case = diagnose(client)
    case = act(client, case, "inspect", outcome="obstruction_found")
    case = act(client, case, "confirm_observation", confirmed=True)
    entry = command(client, draft(client, case), "publish")
    act(client, case, "complete_action", confirmed=True)
    assert client.get(f"/api/knowledge/{entry['id']}").json()["status"] == "draft"
    assert not matches(diagnose(client))


def test_transaction_failure_rolls_back_entry_audit_and_library(client, monkeypatch):  # noqa: F811
    entry = draft(client, completed(client))
    epoch = database_operation(library_revision)
    import flowpilot.knowledge.service as service

    original = service.persist

    def failed(session, value, expected):
        original(session, value, expected)
        raise RuntimeError("deliberate failure after update")

    monkeypatch.setattr(service, "persist", failed)
    with pytest.raises(RuntimeError, match="deliberate failure"):
        command(client, entry, "publish")
    assert client.get(f"/api/knowledge/{entry['id']}").json() == entry
    assert database_operation(library_revision) == epoch


def test_publication_during_reasoning_rejects_stale_diagnosis(client, monkeypatch):  # noqa: F811
    entry = command(client, draft(client, completed(client)), "publish")
    target = diagnose(client)

    async def concurrent_edit(_):
        command(client, entry, "dispute")

    monkeypatch.setattr("flowpilot.cases.enrich", concurrent_edit)
    path = f"/api/investigations/{target['investigation']['id']}"
    response = client.post(
        path + "/actions", json={"revision": target["revision"], "action": "refresh_knowledge"}
    )
    assert response.status_code == 409
    assert client.get(path).json() == target


def test_version_graph_and_search_retain_provenance(client):  # noqa: F811
    entry = command(client, draft(client, completed(client)), "publish")
    graph = client.get(f"/api/knowledge/{entry['id']}/graph").json()
    assert len(graph["nodes"]) == 7
    assert all(
        e["citation"] == entry["id"] + f"@v{entry['versions'][-1]['version']}"
        for e in graph["edges"]
    )
    assert all(e["evidence_ids"] for e in graph["edges"])
    assert not any("caused" in e["relation"] for e in graph["edges"])
    assert client.get("/api/knowledge?q=nozzle&status=published").json()[0]["id"] == entry["id"]
    assert client.get("/api/knowledge?q=unmatched").json() == []


@pytest.mark.parametrize("mode", ["valid", "wrong_version", "historical_evidence"])
def test_model_receives_history_but_cannot_launder_its_citations(client, mode):  # noqa: F811
    import asyncio

    from flowpilot.diagnosis.reasoning import enrich
    from flowpilot.settings import Settings
    from test_reasoning import result

    entry = command(client, draft(client, completed(client)), "publish")
    case = Case.model_validate(diagnose(client))
    observed = []

    async def generate(role, payload, schema):
        observed.append(payload["historical_experience"])
        response = result(role, payload)
        citation = payload["historical_experience"][0]["citation"]
        findings = [response["assessment"]] if role == "diagnostic_critic" else response["findings"]
        for finding in findings:
            finding["knowledge_refs"] = [citation]
            if mode == "wrong_version":
                finding["knowledge_refs"] = [entry["id"] + "@v99"]
            if mode == "historical_evidence":
                finding["supporting_evidence_ids"] = entry["versions"][-1]["content"][
                    "supporting_evidence_ids"
                ]
        return response

    original = case.model_dump()
    asyncio.run(enrich(case, Settings(reasoning_enabled=True), generate))
    assert observed[0][0]["citation"] == entry["id"] + f"@v{entry['versions'][-1]['version']}"
    assert case.past_experience.matches
    assert case.model_dump()["ranking"] == original["ranking"]
    assert case.model_dump()["investigation"] == original["investigation"]
    if mode == "valid":
        assert case.findings_mode == "live"
        assert all(f.knowledge_refs == [observed[0][0]["citation"]] for f in case.findings)
    else:
        assert case.reasoning.fallback_reason == "Gemini output failed validation"


def test_graph_reflects_recording_publication_and_version_changes(client):  # noqa: F811
    source = create(client)
    view = client.get("/api/knowledge/graph").json()
    assert view["saved_cases"] == 1 and view["pending_review"] == 0
    assert view["cases"][0]["knowledge_status"] == "recorded"
    assert any(n["id"] == "case:" + source["investigation"]["id"] for n in view["graph"]["nodes"])
    completed_case = completed(client)
    entry = draft(client, completed_case)
    view = client.get("/api/knowledge/graph?status=draft").json()
    assert view["saved_cases"] == 2 and view["pending_review"] == 1
    assert view["cases"][0]["id"] == completed_case["investigation"]["id"]
    command(client, entry, "publish")
    view = client.get("/api/knowledge/graph?status=published").json()
    assert view["reusable_experiences"] == 1 and view["pending_review"] == 0
    assert any(e["status"] == "hypothesis" for e in view["graph"]["edges"])
    assert client.get("/api/knowledge/graph?q=impossible-match").json()["graph"]["nodes"] == []
    assert client.get("/api/knowledge/graph?process=different").json()["cases"] == []


@pytest.mark.parametrize("mode", ["valid", "invented_id", "invented_success", "failure", "late"])
def test_gemini_draft_is_validated_fallback_and_late_result_safe(client, mode):  # noqa: F811
    from flowpilot.knowledge.models import KnowledgeEntry
    from flowpilot.knowledge.storage import KnowledgeRecord
    from flowpilot.knowledge.summarizer import summarize_pending

    case = diagnose(client, intermittent=True)
    case = act(client, case, "inspect", outcome="no_obstruction_found")
    case = act(client, case, "confirm_observation", confirmed=True)
    entry = draft(client, case)

    def pending(session):
        record = session.get(KnowledgeRecord, entry["id"])
        value = KnowledgeEntry.model_validate(record.payload)
        value.generation.mode = "pending"
        record.payload = value.model_dump(mode="json")

    database_operation(pending)

    async def generate(source):
        if mode == "failure":
            raise RuntimeError("private provider token must never persist")
        if mode == "late":
            command(client, entry, "revise", content=entry["versions"][-1]["content"])
        content = {
            **entry["versions"][-1]["content"],
            "lesson": "No obstruction was found; supply remains unverified.",
        }
        if mode == "invented_id":
            content["supporting_evidence_ids"] = ["another-case-id"]
        if mode == "invented_success":
            content["outcome"] = "recovered"
        return content

    summarize_pending(case["investigation"]["id"], generate)
    updated = client.get(f"/api/knowledge/{entry['id']}").json()
    assert updated["status"] == "draft"
    assert updated["versions"][0] == entry["versions"][0]
    assert updated["generation"]["mode"] == (
        "live" if mode == "valid" else "manual" if mode == "late" else "cached"
    )
    assert "private provider token" not in str(updated)
    assert not matches(diagnose(client, intermittent=True))


def test_no_match_when_only_the_symptom_is_known(client):  # noqa: F811
    command(client, draft(client, completed(client)), "publish")
    case = create(client)
    for answer in ["continuous", "unknown", "unknown", "unknown", "unknown"]:
        case = act(client, case, "answer", question_id=case["next_question"]["id"], value=answer)
    assert not matches(act(client, case, "diagnose"))


def test_simulated_and_recorded_cases_cannot_cross_retrieve(client):  # noqa: F811
    command(client, draft(client, completed(client)), "publish")
    case = diagnose(client)

    def set_real(session):
        record = session.get(CaseRecord, case["investigation"]["id"])
        payload = copy.deepcopy(record.payload)
        payload["investigation"]["simulated"] = False
        record.payload = payload

    database_operation(set_real)
    assert not matches(act(client, case, "refresh_knowledge"))


def test_source_and_draft_changes_roll_back_together(client, monkeypatch):  # noqa: F811
    import flowpilot.knowledge.service as service

    case = diagnose(client)
    case = act(client, case, "inspect", outcome="obstruction_found")
    case = act(client, case, "confirm_observation", confirmed=True)
    entry = command(client, draft(client, case), "publish")
    epoch = database_operation(library_revision)
    original = service.persist

    def fail_after_update(session, value, expected):
        original(session, value, expected)
        raise RuntimeError("failure during source invalidation")

    monkeypatch.setattr(service, "persist", fail_after_update)
    with pytest.raises(RuntimeError, match="failure during source invalidation"):
        act(client, case, "complete_action", confirmed=True)
    assert client.get(f"/api/investigations/{case['investigation']['id']}").json() == case
    assert client.get(f"/api/knowledge/{entry['id']}").json() == entry
    assert database_operation(library_revision) == epoch


def test_draft_changes_during_reasoning_do_not_invalidate_retrieval(client, monkeypatch):  # noqa: F811
    entry = draft(client, completed(client))
    target = diagnose(client)
    epoch = database_operation(library_revision)

    async def concurrent_draft_edit(_):
        command(client, entry, "revise", content=entry["versions"][-1]["content"])

    monkeypatch.setattr("flowpilot.cases.enrich", concurrent_draft_edit)
    refreshed = act(client, target, "refresh_knowledge")
    assert not matches(refreshed)
    assert refreshed["revision"] == target["revision"] + 1
    assert database_operation(library_revision) == epoch
