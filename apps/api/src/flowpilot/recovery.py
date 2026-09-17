"""Explicit simulated recovery attestations; no production limits are invented."""

from typing import Literal

from pydantic import Field

from flowpilot.investigations.models import Contract

Check = Literal["pass", "fail", "unknown"]


class LaneCheck(Contract):
    lane: str = Field(min_length=1, max_length=80)
    all_units_accepted: Check = "unknown"


class RecoveryChecks(Contract):
    profile: Literal["synthetic_demo"] = "synthetic_demo"
    prompted_setup: Check = "unknown"
    calibration: Check = "unknown"
    weight_within_limits: Check = "unknown"
    pressure_within_limits: Check = "unknown"
    limits_reference: str = Field(default="", max_length=200)
    expected_lanes: list[str] = Field(default_factory=list, max_length=8)
    first_carriers: list[LaneCheck] = Field(default_factory=list, max_length=8)
    subsequent_required: Literal["yes", "no", "unknown"] = "unknown"
    subsequent_trays_accepted: int = Field(default=0, ge=0, le=100)
    confirmed: bool = False

    def complete(self) -> bool:
        lanes = self.expected_lanes
        checks = self.first_carriers
        return (
            self.confirmed
            and all(
                v == "pass"
                for v in (
                    self.prompted_setup,
                    self.calibration,
                    self.weight_within_limits,
                    self.pressure_within_limits,
                )
            )
            and bool(self.limits_reference.strip())
            and set(lanes) == {"A", "B"}
            and all(lane.strip() for lane in lanes)
            and len(set(lanes)) == len(lanes)
            and len(checks) == len(lanes)
            and {c.lane for c in checks} == set(lanes)
            and all(c.all_units_accepted == "pass" for c in checks)
            and (
                self.subsequent_required == "no"
                or (self.subsequent_required == "yes" and self.subsequent_trays_accepted >= 5)
            )
        )
