import json
from datetime import datetime
from typing import Annotated, Literal

from pydantic import Field, JsonValue, field_validator, model_validator

from flowpilot.incidents.decision import DecisionRun
from flowpilot.incidents.diagnostic import DiagnosticAssessment
from flowpilot.incidents.question_types import QuestionType, default_question_type
from flowpilot.incidents.simulation import SimulationRun
from flowpilot.investigations.models import Contract


class EvidenceInput(Contract):
    id: str = Field(min_length=1, max_length=100, pattern=r"^[A-Za-z0-9_.:-]+$")
    kind: Literal["image", "log", "maintenance", "context"]
    role: Literal["last_good", "first_bad", "machine_log", "pm", "context"]
    label: str = Field(min_length=1, max_length=200)
    source_ref: str = Field(min_length=1, max_length=500)
    event_time: str | None = Field(default=None, max_length=100)
    event_timezone: str | None = Field(default=None, max_length=100)
    time_uncertain: bool = True
    clock_offset_seconds: float | None = Field(default=None, allow_inf_nan=False)
    tool_id: str | None = Field(default=None, max_length=100)
    configuration: str | None = Field(default=None, max_length=150)
    lot_id: str | None = Field(default=None, max_length=100)
    tray_id: str | None = Field(default=None, max_length=100)
    unit_id: str | None = Field(default=None, max_length=100)
    synthetic: bool = True
    provenance: str = Field(default="User-supplied development evidence", max_length=1000)
    status: Literal["pending", "collected", "unavailable", "failed"] = "collected"
    image_url: str | None = Field(default=None, max_length=500)
    artifact_id: str | None = Field(default=None, pattern=r"^ART-[a-f0-9]{32}$")
    values: dict[str, JsonValue] = Field(default_factory=dict)

    @field_validator("values")
    @classmethod
    def bounded_values(cls, value):
        if len(json.dumps(value, allow_nan=False)) > 32000:
            raise ValueError(
                "Evidence metadata must be at most 32 KB; retain large files separately."
            )
        return value

    @field_validator("event_time")
    @classmethod
    def valid_timestamp(cls, value):
        if value is not None:
            datetime.fromisoformat(value.replace("Z", "+00:00"))
        return value

    @field_validator("image_url")
    @classmethod
    def local_image(cls, value):
        import re

        artifact = value and re.fullmatch(
            r"/api/incidents/INC-[a-f0-9]{12}/artifacts/ART-[a-f0-9]{32}", value
        )
        if value and not artifact and not value.startswith(("/api/vision/", "/api/demo/images/")):
            raise ValueError("Use a local FlowPilot image reference.")
        return value

    @model_validator(mode="after")
    def unknown_clock(self):
        if self.event_time is None or self.event_timezone is None:
            self.time_uncertain = True
        return self


class IncidentEvidence(EvidenceInput):
    ingested_at: str
    integrity_ref: str
    supersedes_id: str | None = None
    correction_reason: str | None = None
    raw_integrity_ref: str | None = None


class IncidentObservation(Contract):
    id: str
    check_id: str
    result: str
    notes: str = ""
    evidence_ids: list[str] = Field(default_factory=list)
    synthetic: bool = True
    recorded_at: str
    supersedes_id: str | None = None
    author: str | None = None
    extraction_confidence: float | None = Field(default=None, ge=0, le=1, allow_inf_nan=False)


class HandoffDraft(Contract):
    subject: str
    body: str
    status: Literal["draft"] = "draft"
    version: int
    source_revision: int
    created_at: str
    human_edited: bool = False
    generation_mode: Literal["template", "gemini"] = "template"
    model: str | None = None
    prompt_version: str | None = None
    evidence_ids: list[str] = Field(default_factory=list)
    source_refs: list[str] = Field(default_factory=list)
    fallback_reason: str | None = None


class AssessmentSnapshot(Contract):
    incident_revision: int
    created_at: str
    assessment: DiagnosticAssessment


class IncidentEvent(Contract):
    revision: int
    action: str
    timestamp: str
    detail: str
    actor: str | None = None


class Closure(Contract):
    outcome: Literal["supported", "inconclusive"]
    notes: str
    reviewer: str
    conclusion: str | None
    closed_at: str
    evidence_revision: int


class LearningReview(Contract):
    version: int
    reviewer: str
    decision: Literal["approve", "withdraw"]
    notes: str
    timestamp: str


class LearningCandidate(Contract):
    status: Literal["candidate", "published", "withdrawn"] = "candidate"
    source_revision: int
    source_fingerprint: str
    outcome: Literal["supported", "inconclusive"]
    summary: str
    source_refs: list[str]
    evidence_ids: list[str]
    source_evidence: list[IncidentEvidence]
    source_observations: list[IncidentObservation]
    source_versions: dict[str, str]
    reviews: list[LearningReview] = Field(default_factory=list)


class AnswerChoice(Contract):
    value: str = Field(min_length=1, max_length=100)
    label: str = Field(min_length=1, max_length=150)
    interpretation: str = Field(min_length=1, max_length=500)


class InvestigationQuestion(Contract):
    id: str = Field(min_length=1, max_length=100, pattern=r"^[A-Za-z0-9_.:-]+$")
    kind: Literal["question", "check", "review", "escalate"] = "question"
    target_fact: str = Field(min_length=1, max_length=100)
    prompt: str = Field(min_length=1, max_length=500)
    why: str = Field(min_length=1, max_length=1500)
    question_type: QuestionType = "unclassified"
    choices: list[AnswerChoice] = Field(default_factory=list, max_length=10)
    hypothesis_ids: list[str] = Field(default_factory=list, max_length=3)
    component_ids: list[str] = Field(default_factory=list, max_length=10)
    evidence_ids: list[str] = Field(default_factory=list, max_length=100)
    source_refs: list[str] = Field(default_factory=list, max_length=10)
    prerequisites: list[str] = Field(default_factory=list, max_length=15)

    @model_validator(mode="after")
    def legacy_question_type(self):
        if "question_type" not in self.model_fields_set:
            self.question_type = default_question_type(self.kind, self.target_fact)
        return self


class InvestigationNode(InvestigationQuestion):
    classification: DecisionRun | None = None
    parent_id: str | None = None
    parent_answer_id: str | None = None
    status: Literal["proposed", "active", "answered", "blocked", "superseded"] = "proposed"
    source_revision: int
    source_versions: dict[str, str] = Field(default_factory=dict)
    blocked_reason: str | None = None
    clarification_for: str | None = None


class AnswerInterpretation(Contract):
    target_fact: str = Field(min_length=1, max_length=100)
    value: str = Field(min_length=1, max_length=100)
    supporting_spans: list[str] = Field(default_factory=list, max_length=10)
    ambiguities: list[str] = Field(default_factory=list, max_length=10)
    clarification: str | None = Field(default=None, max_length=500)


class AdaptiveQuestions(Contract):
    candidates: list[InvestigationQuestion] = Field(min_length=1, max_length=3)
    preferred_id: str = Field(min_length=1, max_length=100)


class InvestigationGeneration(Contract):
    provider: Literal["deterministic", "gemini"] = "deterministic"
    status: Literal["validated", "fallback"] = "fallback"
    model: str | None = None
    model_version: str | None = None
    prompt_version: str = "s932-questions-1"
    thinking: str | None = None
    input_fingerprint: str
    input_revision: int
    fallback_reason: str | None = "Offline baseline; adaptive generation has not run."
    rejected_count: int = 0


class InvestigationAnswer(Contract):
    id: str
    node_id: str
    choice: str | None = None
    text: str = ""
    notes: str = ""
    status: Literal["pending", "clarification", "confirmed", "unknown"] = "pending"
    proposed: AnswerInterpretation | None = None
    confirmed_value: str | None = None
    observation_id: str | None = None
    recorded_at: str
    recorded_revision: int
    confirmed_at: str | None = None
    supersedes_id: str | None = None
    author: str | None = None
    request_fingerprint: str
    interpretation_run: InvestigationGeneration | None = None
    readiness: DecisionRun | None = None


class InvestigationExpansion(Contract):
    id: str
    parent_answer_id: str | None = None
    child_ids: list[str]
    recommended_id: str
    generation: InvestigationGeneration
    decision: DecisionRun | None = None
    superseded: bool = False


class InvestigationSelection(Contract):
    node_id: str
    revision: int
    timestamp: str


class InvestigationGraph(Contract):
    version: Literal["s932-graph-1"] = "s932-graph-1"
    nodes: list[InvestigationNode] = Field(default_factory=list)
    answers: list[InvestigationAnswer] = Field(default_factory=list)
    expansions: list[InvestigationExpansion] = Field(default_factory=list)
    selections: list[InvestigationSelection] = Field(default_factory=list)
    active_node_id: str | None = None
    input_version: int = 0
    retry_requested: bool = False


class ConversationMapping(Contract):
    node_id: str = Field(min_length=1, max_length=100)
    choice: str = Field(min_length=1, max_length=100)
    supporting_span: str = Field(min_length=1, max_length=2000)


class InvestigationConversationTurn(Contract):
    id: str
    text: str
    input_mode: Literal["text", "voice"]
    reply: str
    intent: Literal["answer", "switch", "discuss", "clarify", "confirm", "cancel"]
    node_ids: list[str] = Field(default_factory=list)
    mappings: list[ConversationMapping] = Field(default_factory=list)
    status: Literal["pending", "recorded", "clarification", "discussed", "cancelled"]
    input_fingerprint: str
    generation: InvestigationGeneration | None = None
    recorded_at: str
    author: str | None = None


class Incident(Contract):
    schema_version: Literal["3.0"] = "3.0"
    id: str
    revision: int = 0
    trigger_id: str
    trigger_fingerprint: str
    trigger_origin: Literal["manual", "alarm", "image_quality", "replay"]
    trigger_time: str
    tool_id: str
    configuration: str
    symptom: str
    mode: Literal["live", "replay", "synthetic"]
    created_at: str
    updated_at: str
    status: Literal["open", "evidence_collecting", "investigating", "review", "closed"]
    owner: str | None = None
    waiting_for: Literal["observation", "test_authorization", "engineer", "missing_data"] | None = (
        None
    )
    disposition: Literal["not_assessed"] = "not_assessed"
    escalated: bool = False
    replay_stage: int = 0
    evidence: list[IncidentEvidence] = Field(default_factory=list)
    observations: list[IncidentObservation] = Field(default_factory=list)
    assessment: DiagnosticAssessment | None = None
    assessment_history: list[AssessmentSnapshot] = Field(default_factory=list)
    handoff: HandoffDraft
    handoff_history: list[HandoffDraft] = Field(default_factory=list)
    closure: Closure | None = None
    closure_history: list[Closure] = Field(default_factory=list)
    learning: LearningCandidate | None = None
    learning_history: list[LearningCandidate] = Field(default_factory=list)
    history: list[IncidentEvent] = Field(default_factory=list)
    simulations: list[SimulationRun] = Field(default_factory=list)
    investigation: InvestigationGraph = Field(default_factory=InvestigationGraph)
    conversation: list[InvestigationConversationTurn] = Field(default_factory=list)


class CreateIncident(Contract):
    trigger_id: str = Field(min_length=1, max_length=150, pattern=r".*\S.*")
    trigger_origin: Literal["manual", "alarm", "image_quality", "replay"] = "manual"
    trigger_time: str | None = Field(default=None, max_length=100)
    tool_id: str = Field(default="S932-DEMO-01", min_length=1, max_length=100)
    configuration: str = Field(default="S932 / DJ-2200 / BFS", min_length=1, max_length=150)
    symptom: str = Field(
        default="Progressively insufficient flux coverage", min_length=1, max_length=2000
    )
    mode: Literal["live", "replay", "synthetic"] = "synthetic"
    evidence: list[EvidenceInput] = Field(default_factory=list, max_length=100)

    @field_validator("trigger_time")
    @classmethod
    def valid_trigger_time(cls, value):
        if value is not None:
            datetime.fromisoformat(value.replace("Z", "+00:00"))
        return value

    @model_validator(mode="after")
    def unique_evidence(self):
        if len({item.id for item in self.evidence}) != len(self.evidence):
            raise ValueError("Evidence IDs must be unique within an incident.")
        return self


class ReplayRequest(Contract):
    trigger_id: str = Field(min_length=1, max_length=150, pattern=r".*\S.*")


class RevisionAction(Contract):
    revision: int = Field(ge=0)


class SimpleAction(RevisionAction):
    action: Literal["advance_replay", "analyze", "refresh_handoff"]


class AddEvidenceAction(RevisionAction):
    action: Literal["add_evidence"]
    evidence: EvidenceInput


class CorrectEvidenceAction(RevisionAction):
    action: Literal["correct_evidence"]
    evidence_id: str
    replacement: EvidenceInput
    reason: str = Field(min_length=1, max_length=1000, pattern=r".*\S.*")


class RecordResultAction(RevisionAction):
    action: Literal["record_result"]
    check_id: str = Field(min_length=1, max_length=100)
    result: str = Field(min_length=1, max_length=1000, pattern=r".*\S.*")
    notes: str = Field(default="", max_length=2000)
    evidence_ids: list[str] = Field(default_factory=list, max_length=100)
    synthetic: bool = True
    extraction_confidence: float | None = Field(default=None, ge=0, le=1, allow_inf_nan=False)


class AnswerInvestigationAction(RevisionAction):
    action: Literal["answer_investigation"]
    answer_id: str = Field(pattern=r"^ANS-[A-Za-z0-9-]{1,64}$")
    node_id: str = Field(min_length=1, max_length=100)
    choice: str | None = Field(default=None, min_length=1, max_length=100)
    text: str = Field(default="", max_length=2000)
    notes: str = Field(default="", max_length=2000)
    supersedes_id: str | None = Field(default=None, max_length=100)

    @model_validator(mode="after")
    def has_answer(self):
        if not self.choice and not self.text.strip():
            raise ValueError("Choose an answer, Unknown, or enter your answer in text.")
        return self


class ConfirmInvestigationAction(RevisionAction):
    action: Literal["confirm_investigation"]
    answer_id: str = Field(min_length=1, max_length=100)
    value: str = Field(min_length=1, max_length=100)


class SelectInvestigationAction(RevisionAction):
    action: Literal["select_investigation"]
    node_id: str = Field(min_length=1, max_length=100)


class RetryInvestigationAction(RevisionAction):
    action: Literal["retry_investigation"]


class EditHandoffAction(RevisionAction):
    action: Literal["edit_handoff"]
    body: str = Field(min_length=1, max_length=20000, pattern=r".*\S.*")


class EscalateAction(RevisionAction):
    action: Literal["escalate"]
    notes: str = Field(default="", max_length=2000)


class CloseIncidentAction(RevisionAction):
    action: Literal["close"]
    outcome: Literal["supported", "inconclusive"]
    notes: str = Field(min_length=1, max_length=2000, pattern=r".*\S.*")
    reviewer: str = Field(min_length=1, max_length=100, pattern=r".*\S.*")
    conclusion: str | None = Field(default=None, max_length=2000)


class ReviewLearningAction(RevisionAction):
    action: Literal["review_learning"]
    reviewer: str = Field(min_length=1, max_length=100, pattern=r".*\S.*")
    decision: Literal["approve", "withdraw"]
    notes: str = Field(min_length=1, max_length=2000, pattern=r".*\S.*")


IncidentAction = Annotated[
    SimpleAction
    | AddEvidenceAction
    | CorrectEvidenceAction
    | RecordResultAction
    | AnswerInvestigationAction
    | ConfirmInvestigationAction
    | SelectInvestigationAction
    | RetryInvestigationAction
    | EditHandoffAction
    | EscalateAction
    | CloseIncidentAction
    | ReviewLearningAction,
    Field(discriminator="action"),
]
