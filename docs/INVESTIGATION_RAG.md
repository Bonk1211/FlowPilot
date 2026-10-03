# Investigation reference RAG

FlowPilot uses Gemini File Search for managed semantic retrieval. The existing
`google-genai` SDK handles ingestion and search; no separate vector database or
RAG framework is required. Exact original passages and source revision history
remain in the SQLite knowledge registry.

## Setup

Configure `GEMINI_API_KEY` and `FLOWPILOT_REASONING_ENABLED=true` in the ignored
root `.env`, then run:

```sh
npm run db:migrate
npm run rag:index -- --dry-run
npm run rag:index -- --allow-reference-upload
```

The last command uploads only
`docs/Asymtek_S932_Consolidated_Reference.md` to Google's File Search service.
`--allow-reference-upload` permits that document import when incident policy is
`synthetic_only`; it does not permit sending live incident data. `disabled`
blocks both import and retrieval. Under `permitted`, the upload flag is optional.

After indexing, enable retrieval and restart with `npm run dev`:

```dotenv
FLOWPILOT_INCIDENT_RAG_ENABLED=true
FLOWPILOT_INCIDENT_RAG_TIMEOUT_SECONDS=12
```

`npm run dev:mock` disables external reasoning and retrieval. For live incidents,
the existing `FLOWPILOT_INCIDENT_EXTERNAL_DATA_POLICY=permitted` is required.
`GET /api/incident-rag/status` reports whether indexing is ready.

## Import and provenance

The importer makes section-aware passages, excludes section 17's separate ASM
bonder cases, keeps complete table rows, and includes table headers and the
reference's evidence limitations in uploaded pieces. Google further chunks and
embeds these pieces. Passage metadata identifies the S932 machine family, local
source revision and passage ID. Exact configuration details remain in the text;
the agent must establish BFS/syringe and CAM/TCB/SLAM applicability with the user.

The source remains a **draft, unverified secondary summary**, never an approved
maintenance procedure. Unchanged imports reuse the store; interrupted imports
resume completed sections. Changed content creates an immutable new local source
revision and a new store. Old stores are retained, not automatically deleted.
Re-run the index command after reference changes. Retrieval refuses a stale index.

## Conversation and questions

For conversation and follow-up generation, the backend searches using the message,
symptom, configuration, confirmed facts and active question. It resolves provider
citations to at most four exact local passages. Forged, withdrawn and conflicted
sources are excluded. Provider-generated summaries are not accepted as source text.

Retrieved passages accompany the existing investigation evidence in Gemini's
structured generation request. Replies preserve passage citations, which the user
can inspect in the explanation sidebar and the Markdown incident report.

The generator can propose record-only questions beyond the original fact catalogue
with stable `reference_*` fact names and canonical Observed / Not observed / Unknown
choices. They must cite a retrieved passage, reference existing records, obey
prerequisites and pass the existing local grounding and action checks. These answers
provide investigation context; they do not change the three existing mechanisms'
rule scores or confirm a cause. Conversation routing still identifies which saved
node was answered and requires confirmation before recording an observation.

Unavailable retrieval, policy blocks, missing keys, timeouts and unsupported provider
settings preserve the existing investigation. Each generation records retrieval
status separately. Old retrieved excerpts remain available for historical nodes,
but are excluded from subsequent model inputs until retrieved again.

## Mixed knowledge map

The Learning Database at `/knowledge` combines registered reference documents and
sections with saved case experience. References use teal nodes; shared components,
symptoms and possible causes connect them to case records. The layer filter shows
both sources together, reference knowledge, or case experience.

Node area grows with the number of distinct connected nodes in the current search,
bounded to keep hubs readable. Duplicate relationships do not increase size. The
sidebar shows the count, and switching layers preserves sizes from the combined
graph. This expresses connectivity, not source authority or diagnostic confidence.

Dotted links indicate a phrase in the cited passage matching an existing case
topic, within a compatible configuration. These are text associations, not
embedding distances, inferred causality, or confirmed findings. Selecting a node
or link shows exact passages, source revision, authority, review status, index
counts where available, and related cases in the right inspector. Keyboard users
can use the node and relationship lists beneath the graph.

The map groups subsections under major sections and displays the latest registered
revision per document. Withdrawn or conflicted references remain visible with
their status for inspection; their presence never makes them eligible for retrieval
or operational use. Filtering and viewing the map do not alter incident evidence.

Provider API reference: [Gemini File Search](https://ai.google.dev/gemini-api/docs/file-search).
