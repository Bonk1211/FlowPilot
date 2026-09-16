from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, JsonValue


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid")


InvestigationState = Literal[
    "reported",
    "diagnosing",
    "inspection_recommended",
    "inspection_completed",
    "cause_confirmed",
    "corrective_action_completed",
    "verification_passed",
    "resolved",
]


class Evidence(Contract):
    id: str
    key: str
    value: JsonValue
    unit: str | None = None
    source_type: Literal[
        "synthetic_image_measurement", "machine_log", "technician_input", "heuristic_inference"
    ]
    source_ref: str
    quality: Literal["high", "medium", "low"]
    verification_state: Literal["provisional", "verified", "rejected"]
    timestamp: str


class Investigation(Contract):
    schema_version: Literal["1.0"] = "1.0"
    id: str
    title: str
    process: str
    state: InvestigationState
    simulated: bool
    reported_at: str
    evidence: list[Evidence] = Field(default_factory=list)
