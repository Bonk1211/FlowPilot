"""Mixed graph links source text to case topics without changing incident evidence."""

from flowpilot.incidents.knowledge import (
    SourceDocumentInput,
    SourcePassageInput,
    SourceReviewRequest,
    create_document,
    review_document,
)
from test_cases import client as case_client
from test_cases import diagnose

client = case_client


def reference(configuration, revision="r1"):
    return create_document(
        SourceDocumentInput(
            document_id="TEST-REFERENCE",
            document_revision=revision,
            title="Synthetic nozzle reference",
            configurations=[configuration],
            authority="secondary_summary",
            original_ref="test-fixture:reference",
            passages=[
                SourcePassageInput(
                    id="nozzle",
                    section="2.1 Nozzle observations",
                    text="Existing nozzle records can describe poor coverage or restriction.",
                )
            ],
        ),
        "test",
    )


def test_mixed_graph_has_exact_citations_shared_topics_and_keeps_cases_unchanged(client):
    case = diagnose(client)
    before = client.get("/api/knowledge/graph").json()["graph"]
    source = reference(case["investigation"]["process"])
    overview = client.get("/api/knowledge/graph").json()
    graph = overview["graph"]
    assert overview["reference_documents"] == overview["reference_passages"] == 1
    section = next(n for n in graph["nodes"] if n["kind"] == "Reference section")
    assert section["sources"][0]["passage"] == source.content.passages[0].text
    assert section["sources"][0]["approval_status"] == "unverified"
    assert not section["sources"][0]["operational_allowed"]
    links = [e for e in graph["edges"] if e["status"] == "topic_match"]
    assert links and all(e["matched_text"] in source.content.passages[0].text for e in links)
    assert all(e["citation"] == f"{source.id}:nozzle" and not e["evidence_ids"] for e in links)
    assert section["case_ids"] == [case["investigation"]["id"]]
    assert [e for e in graph["edges"] if e["source_type"] == "experience"] == before["edges"]
    assert client.get(f"/api/investigations/{case['investigation']['id']}").json() == case
    searched = client.get("/api/knowledge/graph?q=nozzle").json()
    assert searched["cases"] and any(
        n["kind"] == "Reference section" for n in searched["graph"]["nodes"]
    )


def test_wrong_configuration_latest_revision_and_withdrawal_remain_visible(client):
    case = diagnose(client)
    old = reference("ASM bonder")
    graph = client.get("/api/knowledge/graph").json()["graph"]
    assert any(n["kind"] == "Reference section" for n in graph["nodes"])
    assert not any(e["status"] == "topic_match" for e in graph["edges"])
    new = reference(case["investigation"]["process"], "r2")
    review_document(
        new.id,
        SourceReviewRequest(
            revision=new.revision, decision="withdraw", notes="Withdraw synthetic reference"
        ),
        "test",
    )
    view = client.get("/api/knowledge/graph").json()
    documents = [n for n in view["graph"]["nodes"] if n["kind"] == "Reference document"]
    assert len(documents) == 1 and old.id not in documents[0]["id"]
    assert documents[0]["sources"][0]["approval_status"] == "withdrawn"
    assert not documents[0]["sources"][0]["operational_allowed"]
