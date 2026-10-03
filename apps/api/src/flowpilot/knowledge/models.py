from typing import Literal

from pydantic import Field

from flowpilot.incidents.diagnostic import SourcePassage
from flowpilot.investigations.models import Contract, Evidence

KnowledgeState = Literal["draft", "published", "disputed", "archived"]
Finding = Literal["obstruction_found", "no_obstruction_found", "uncertain"]
Outcome = Literal["recovered", "not_recovered", "unresolved"]
CheckFocus = Literal["nozzle_inspection", "air_supply_review", "material_review"]


class KnowledgeContent(Contract):
    title: str = Field(min_length=1, max_length=160)
    lesson: str = Field(min_length=1, max_length=1200)
    finding: Finding
    outcome: Outcome
    check_focus: CheckFocus
    supporting_evidence_ids: list[str] = Field(min_length=1, max_length=100)


class KnowledgeSource(Contract):
    case_id: str
    revision: int
    signature: str
    process: str
    simulated: bool
    recorded_at: str
    conditions: dict[str, str]
    problem: str
    possible_causes: list[str]
    actual_finding: Finding
    actual_outcome: Outcome
    action: str | None
    evidence: list[Evidence]
    image_url: str
    verification_image_url: str | None
    log_digest: str | None
    fingerprint: str


class KnowledgeVersion(Contract):
    version: int
    created_at: str
    actor: str
    reason: str
    source: KnowledgeSource
    content: KnowledgeContent


class KnowledgeEvent(Contract):
    revision: int
    version: int
    state: KnowledgeState
    actor: str
    reason: str
    timestamp: str


class DraftGeneration(Contract):
    mode: Literal["pending", "live", "cached", "manual"] = "cached"
    model: str | None = None
    reason: str | None = None
    timestamp: str | None = None


class KnowledgeEntry(Contract):
    id: str
    source_case_id: str
    revision: int
    status: KnowledgeState
    versions: list[KnowledgeVersion]
    events: list[KnowledgeEvent]
    generation: DraftGeneration = Field(default_factory=DraftGeneration)


class KnowledgeCreate(Contract):
    source_revision: int = Field(ge=0)
    actor: str = Field(min_length=1, max_length=100)


class KnowledgeCommand(Contract):
    revision: int = Field(ge=1)
    action: Literal["revise", "publish", "dispute", "archive"]
    actor: str = Field(min_length=1, max_length=100)
    reason: str = Field(min_length=1, max_length=1000)
    confirmed: Literal[True]
    content: KnowledgeContent | None = None


class PastExperience(Contract):
    knowledge_id: str
    version: int
    citation: str
    source_case_id: str
    source_revision: int
    simulated: bool
    matched_conditions: list[str]
    unknown_conditions: list[str]
    content: KnowledgeContent
    historical_action: str | None
    source_refs: list[str]


class RetrievalSnapshot(Contract):
    library_revision: int = 0
    retrieved_at: str | None = None
    matches: list[PastExperience] = Field(default_factory=list)
    explanation: str = "Past experience has not been retrieved."
    suggested_check: str | None = None


class CitationStatus(Contract):
    citation: str
    current: bool
    status: str
    latest_version: int | None


class KnowledgeNode(Contract):
    id: str
    kind: str
    label: str
    detail: str
    case_ids: list[str] = Field(default_factory=list)
    href: str | None = None
    source_type: Literal["experience", "reference", "shared"] = "shared"
    sources: list[SourcePassage] = Field(default_factory=list)
    indexed_passages: int = 0


class KnowledgeEdge(Contract):
    id: str
    source: str
    target: str
    relation: str
    citation: str
    evidence_ids: list[str]
    status: str
    case_id: str
    source_type: Literal["experience", "reference"] = "experience"
    matched_text: str | None = None


class KnowledgeGraph(Contract):
    nodes: list[KnowledgeNode]
    edges: list[KnowledgeEdge]


class LearningCase(Contract):
    id: str
    title: str
    process: str
    state: str
    updated_at: str
    symptoms: list[str]
    knowledge_id: str | None
    knowledge_status: str
    version: int | None
    simulated: bool
    group_size: int = 1
    group_case_ids: list[str] = Field(default_factory=list)


class LibraryOverview(Contract):
    saved_cases: int
    reusable_experiences: int
    pending_review: int
    processes: list[str]
    cases: list[LearningCase]
    graph: KnowledgeGraph
    total_matching: int
    truncated: bool
    reference_documents: int = 0
    reference_passages: int = 0
