"""Knowledge commands use the same bounded database transaction as case persistence."""

from fastapi import APIRouter, BackgroundTasks, Query
from sqlalchemy import select

from flowpilot.cases import database_operation
from flowpilot.knowledge.graph import overview
from flowpilot.knowledge.models import (
    CitationStatus,
    KnowledgeCommand,
    KnowledgeCreate,
    KnowledgeEdge,
    KnowledgeEntry,
    KnowledgeGraph,
    KnowledgeNode,
    LibraryOverview,
)
from flowpilot.knowledge.service import (
    change_entry,
    citation_statuses,
    create_entry,
    load_entry,
    load_source_case,
    require,
)
from flowpilot.knowledge.storage import KnowledgeRecord
from flowpilot.knowledge.summarizer import summarize_pending

router = APIRouter(prefix="/api", tags=["knowledge"])


@router.post("/knowledge/from-case/{case_id}", response_model=KnowledgeEntry)
def draft(case_id: str, request: KnowledgeCreate, background_tasks: BackgroundTasks):
    entry = database_operation(lambda session: create_entry(session, case_id, request))
    background_tasks.add_task(summarize_pending, case_id)
    return entry


@router.get("/knowledge", response_model=list[KnowledgeEntry])
def entries(q: str = Query(default="", max_length=200), status: str | None = None):
    def read(session):
        records = session.scalars(select(KnowledgeRecord)).all()
        result = [KnowledgeEntry.model_validate(r.payload) for r in records]
        return sorted(
            [
                e
                for e in result
                if (status is None or e.status == status)
                and q.casefold()
                in (
                    e.versions[-1].content.title
                    + " "
                    + e.versions[-1].content.lesson
                    + " "
                    + e.source_case_id
                ).casefold()
            ],
            key=lambda e: e.events[-1].timestamp,
            reverse=True,
        )

    return database_operation(read)


@router.get("/knowledge/graph", response_model=LibraryOverview)
def library_graph(
    q: str = Query(default="", max_length=200),
    status: str = "all",
    process: str = "",
    symptom: str = "",
    limit: int = Query(default=40, ge=1, le=100),
):
    return database_operation(lambda session: overview(session, q, status, process, symptom, limit))


@router.post("/knowledge/{entry_id}/prepare", response_model=KnowledgeEntry)
def retry_preparation(entry_id: str, request: KnowledgeCreate, background_tasks: BackgroundTasks):
    def read(session):
        entry = load_entry(session, entry_id)
        require(
            entry.versions[-1].source.revision == request.source_revision,
            "Source changed. Reload before retrying.",
        )
        require(entry.status == "draft", "Only draft preparation can be retried.")
        return entry

    entry = database_operation(read)
    background_tasks.add_task(summarize_pending, entry.source_case_id)
    return entry


@router.get("/knowledge/by-source/{case_id}", response_model=KnowledgeEntry | None)
def by_source(case_id: str):
    def read(session):
        record = session.scalar(
            select(KnowledgeRecord).where(KnowledgeRecord.source_case_id == case_id)
        )
        return KnowledgeEntry.model_validate(record.payload) if record else None

    return database_operation(read)


@router.get("/knowledge/{entry_id}", response_model=KnowledgeEntry)
def detail(entry_id: str):
    return database_operation(lambda session: load_entry(session, entry_id))


@router.post("/knowledge/{entry_id}/actions", response_model=KnowledgeEntry)
def command(entry_id: str, request: KnowledgeCommand):
    return database_operation(lambda session: change_entry(session, entry_id, request))


@router.get("/investigations/{case_id}/knowledge-status", response_model=list[CitationStatus])
def reference_status(case_id: str):
    return database_operation(
        lambda session: citation_statuses(session, load_source_case(session, case_id))
    )


@router.get("/knowledge/{entry_id}/graph", response_model=KnowledgeGraph)
def graph(entry_id: str, version: int | None = Query(default=None, ge=1)):
    def read(session):
        entry = load_entry(session, entry_id)
        number = version or entry.versions[-1].version
        selected = next((v for v in entry.versions if v.version == number), None)
        require(selected is not None, "Knowledge version not found.", 404)
        source, content = selected.source, selected.content
        citation = f"{entry.id}@v{number}"
        state = entry.status if number == entry.versions[-1].version else "superseded"
        nodes = [
            KnowledgeNode(
                id="experience",
                kind="Experience",
                label=content.title,
                detail=f"{citation} · {state}",
            ),
            KnowledgeNode(
                id="case",
                kind="Case",
                label="Source investigation",
                detail=f"{source.case_id} · revision {source.revision}",
                href=f"/?case={source.case_id}",
            ),
            KnowledgeNode(
                id="symptom",
                kind="Symptom",
                label=", ".join(
                    k.replace("_", " ") for k, v in source.conditions.items() if v == "true"
                )
                or "Unknown symptom",
                detail="Recorded symptom; not a cause.",
            ),
            KnowledgeNode(
                id="finding",
                kind="Finding",
                label=content.finding.replace("_", " "),
                detail="Nozzle-only inspection scope. Upstream faults are not excluded.",
            ),
            KnowledgeNode(
                id="component", kind="Component", label="DJ-2200 nozzle", detail=source.process
            ),
            KnowledgeNode(
                id="action",
                kind="Action",
                label=(source.action or "No repair recorded").replace("_", " "),
                detail="Actual recorded action, separate from the suggested next check.",
            ),
            KnowledgeNode(
                id="outcome",
                kind="Outcome",
                label=content.outcome.replace("_", " "),
                detail=content.lesson,
            ),
        ]
        edges = [
            KnowledgeEdge(
                id=f"{a}:{b}",
                case_id=source.case_id,
                source=a,
                target=b,
                relation=relation,
                citation=citation,
                evidence_ids=content.supporting_evidence_ids,
                status=state,
            )
            for a, b, relation in (
                ("experience", "case", "derived from"),
                ("case", "symptom", "reported"),
                ("case", "finding", "inspection recorded"),
                ("finding", "component", "scoped to"),
                ("case", "action", "action recorded"),
                ("action", "outcome", "followed by"),
            )
        ]
        return KnowledgeGraph(nodes=nodes, edges=edges)

    return database_operation(read)
