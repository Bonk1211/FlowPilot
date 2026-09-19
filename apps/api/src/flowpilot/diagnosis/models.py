from typing import Literal

from pydantic import Field

from flowpilot.investigations.models import Contract


class AgentFinding(Contract):
    knowledge_refs: list[str] = Field(default_factory=list)
    agent: Literal["fluid_path_specialist", "material_process_specialist", "diagnostic_critic"]
    hypothesis_id: str
    supporting_evidence_ids: list[str]
    conflicting_evidence_ids: list[str]
    missing_evidence: list[str]
    source_refs: list[str]
    confidence_band: Literal["high", "medium", "low"]
    summary: str
