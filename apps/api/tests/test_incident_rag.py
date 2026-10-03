"""Reference retrieval preserves provenance, provider policy and confirmed observations."""

import asyncio
from types import SimpleNamespace
from uuid import uuid4

import pytest
from flowpilot.incidents import (
    conversation,
    coordinator,
    diagnostic,
    graph,
    knowledge,
    rag,
    service,
)
from flowpilot.settings import Settings
from google.genai import types
from test_incidents import act, replay
from test_incidents import client as incident_client

client = incident_client


def enabled(**overrides):
    return Settings(
        _env_file=None,
        reasoning_enabled=True,
        incident_rag_enabled=True,
        gemini_api_key="test-key",
        **overrides,
    )


class Provider:
    def __init__(self):
        self.file_search_stores = self
        self.operations = self
        self.models = self
        self.uploads = []
        self.stores = 0
        self.response = types.GenerateContentResponse(candidates=[])

    async def create(self, **kwargs):
        self.stores += 1
        return SimpleNamespace(name="fileSearchStores/test")

    async def upload_to_file_search_store(self, **kwargs):
        self.uploads.append(kwargs)
        passage_id = kwargs["config"].display_name
        return SimpleNamespace(
            done=True,
            error=None,
            response=SimpleNamespace(document_name=f"fileSearchStores/test/documents/{passage_id}"),
        )

    async def generate_content(self, **kwargs):
        self.request = kwargs
        return self.response


def indexed(client):
    api = Provider()
    index = asyncio.run(rag.index_reference(enabled(), allow_reference_upload=True, client=api))
    return index, api


def grounded(index, passage_id="section-2.4-1", *, source_id=None):
    return types.GenerateContentResponse(
        candidates=[
            types.Candidate(
                grounding_metadata=types.GroundingMetadata(
                    grounding_chunks=[
                        types.GroundingChunk(
                            retrieved_context=types.GroundingChunkRetrievedContext(
                                custom_metadata=[
                                    types.GroundingChunkCustomMetadata(
                                        key="source_id",
                                        string_value=source_id or index["source_id"],
                                    ),
                                    types.GroundingChunkCustomMetadata(
                                        key="passage_id", string_value=passage_id
                                    ),
                                ],
                                text="Provider text must not replace the original passage.",
                            )
                        )
                    ]
                )
            )
        ]
    )


def test_exact_sections_machine_separation_and_idempotent_import(client):
    content = rag.reference_content()
    original = rag.REFERENCE.read_text()
    assert len(content.passages) == 61
    assert all(p.text in original and len(p.text) <= 5500 for p in content.passages)
    assert not any(p.section.startswith("17.") for p in content.passages)
    assert any(p.section.startswith("18.") for p in content.passages)
    index, api = indexed(client)
    assert index["status"] == "ready" and len(api.uploads) == len(content.passages)
    assert all(upload["config"].mime_type == "text/markdown" for upload in api.uploads)
    assert all(b"unverified" in upload["file"].getvalue().lower() for upload in api.uploads)
    again = asyncio.run(rag.index_reference(enabled(), allow_reference_upload=True, client=api))
    assert again == index and api.stores == 1 and len(api.uploads) == 61
    document = service.database_operation(
        lambda session: knowledge.load_document(session, index["source_id"])
    )
    assert document.status == "draft" and document.content.authority == "secondary_summary"


def test_upload_requires_document_permission_and_resumes(client):
    api = Provider()
    with pytest.raises(ValueError, match="Reference upload"):
        asyncio.run(rag.index_reference(enabled(), client=api))
    with pytest.raises(ValueError, match="Reference upload"):
        asyncio.run(
            rag.index_reference(
                enabled(incident_external_data_policy="disabled"),
                allow_reference_upload=True,
                client=api,
            )
        )
    assert api.stores == 0
    index, api = indexed(client)
    index["status"] = "indexing"
    del index["documents"]["section-2.4-1"]
    rag.save_index(index)
    api.uploads.clear()
    resumed = asyncio.run(rag.index_reference(enabled(), allow_reference_upload=True, client=api))
    assert resumed["status"] == "ready" and len(api.uploads) == 1 and api.stores == 1


def test_retrieval_uses_exact_current_citations_and_rejects_forged_withdrawn_sources(client):
    index, api = indexed(client)
    incident = service.get_incident(act(client, replay(client), "analyze")["id"])
    api.response = grounded(index)
    passages, run = asyncio.run(
        rag.retrieve(incident, "Mass is stable but coverage is poor", enabled(), api)
    )
    assert run.status == "retrieved" and len(passages) == 1
    assert passages[0].passage in rag.REFERENCE.read_text()
    assert passages[0].applicable and not passages[0].operational_allowed
    assert passages[0].approval_status == "unverified"
    assert api.request["config"].tools[0].file_search.metadata_filter.startswith('machine="S932"')
    assert rag.passages_from_response(grounded(index, source_id="forged"), index, "S932") == []
    document = service.database_operation(
        lambda session: knowledge.load_document(session, index["source_id"])
    )
    knowledge.review_document(
        document.id,
        knowledge.SourceReviewRequest(
            revision=document.revision, decision="withdraw", notes="Withdrawn fixture"
        ),
        "test",
    )
    assert rag.passages_from_response(api.response, index, "S932") == []


def test_wrong_machine_disabled_policy_changed_reference_and_timeout_keep_baseline(
    client, monkeypatch
):
    index, api = indexed(client)
    incident = service.get_incident(act(client, replay(client), "analyze")["id"])
    original = incident.model_dump()
    for settings in [
        enabled(incident_external_data_policy="disabled"),
        enabled().model_copy(update={"incident_rag_enabled": False}),
    ]:
        passages, run = asyncio.run(rag.retrieve(incident, "question", settings, api))
        assert not passages and run.status in {"blocked", "disabled"}
    incident.configuration = "ASM TCB bonder"
    assert asyncio.run(rag.retrieve(incident, "question", enabled(), api))[1].status == "blocked"
    incident.configuration = original["configuration"]
    index["original_sha256"] = "0" * 64
    rag.save_index(index)
    assert "changed" in asyncio.run(rag.retrieve(incident, "question", enabled(), api))[1].reason
    index["original_sha256"] = rag.reference_content().original_sha256
    rag.save_index(index)

    async def slow(**kwargs):
        await asyncio.sleep(1)

    api.generate_content = slow
    settings = enabled(incident_rag_timeout_seconds=0.001)
    assert "timed out" in asyncio.run(rag.retrieve(incident, "question", settings, api))[1].reason
    assert incident.model_dump() == original


def test_reference_question_and_conversation_preserve_citations_and_confirmation(
    client, monkeypatch
):
    index, api = indexed(client)
    incident = service.get_incident(act(client, replay(client), "analyze")["id"])
    sources = rag.passages_from_response(grounded(index), index, incident.configuration)

    async def retrieve(*args, **kwargs):
        return sources, diagnostic.RetrievalRun(
            status="retrieved", source_refs=[s.id for s in sources]
        )

    monkeypatch.setattr(rag, "retrieve", retrieve)
    baseline = graph.question_for("material", incident.assessment)

    async def questions(payload, schema):
        assert payload["retrieved_sources"][0]["passage"] == sources[0].passage
        return {
            "preferred_id": "spray",
            "candidates": [
                {
                    "id": "spray",
                    "target_fact": "reference_atomization_pattern",
                    "prompt": "Do existing inspection images show an uneven spray pattern?",
                    "why": "Normal mass and poor coverage leave atomization open for review.",
                    "choices": payload["reference_choices"],
                    "hypothesis_ids": ["unstable_delivery"],
                    "source_refs": [sources[0].id],
                    "evidence_ids": [payload["evidence"][0]["id"]] if payload["evidence"] else [],
                }
            ],
        }

    candidates, _, run = asyncio.run(
        diagnostic.generate_questions(
            incident, baseline, coordinator.input_fingerprint(incident), questions, enabled()
        )
    )
    assert len(candidates) == 1 and candidates[0].target_fact == "reference_atomization_pattern"
    assert candidates[0].choices[0].value == "observed" and run.retrieval.status == "retrieved"
    service.save_incident(incident, incident.revision, "test")

    async def discussion(payload, schema):
        return {
            "intent": "discuss",
            "reply": "Normal mass can coexist with poor coverage; "
            "atomization remains a possibility, not a confirmed cause.",
            "source_refs": [sources[0].id],
        }

    observed = incident.observations.copy()
    discussed = asyncio.run(
        conversation.converse(
            incident.id,
            conversation.ConversationRequest(
                revision=incident.revision,
                turn_id=f"TURN-{uuid4()}",
                text="Why can mass be normal?",
            ),
            "test",
            enabled(),
            discussion,
        )
    )
    assert discussed.conversation[-1].sources[0].passage == sources[0].passage
    assert discussed.observations == observed
    assert (
        service.get_incident(incident.id).conversation[-1].sources
        == discussed.conversation[-1].sources
    )

    async def forged(payload, schema):
        result = await discussion(payload, schema)
        result["source_refs"] = ["invented"]
        return result

    result = asyncio.run(
        conversation.converse(
            incident.id,
            conversation.ConversationRequest(
                revision=discussed.revision, turn_id=f"TURN-{uuid4()}", text="Explain that again"
            ),
            "test",
            enabled(),
            forged,
        )
    )
    assert result.conversation[-1].status == "clarification" and not result.conversation[-1].sources
