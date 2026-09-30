"""Illustrative evidence package: never represents a real S932 experiment."""

from flowpilot.incidents.models import CreateIncident, EvidenceInput


def replay_request(trigger_id: str) -> CreateIncident:
    common = {
        "event_timezone": "Asia/Kuala_Lumpur",
        "time_uncertain": True,
        "tool_id": "S932-DEMO-01",
        "configuration": "S932 / DJ-2200 / BFS",
        "lot_id": "REPLAY-LOT-01",
        "synthetic": True,
        "provenance": "Illustrative development fixture, not real-machine evidence",
    }
    return CreateIncident(
        trigger_id=trigger_id,
        trigger_origin="replay",
        trigger_time="2026-09-30T09:08:00+08:00",
        mode="replay",
        evidence=[
            EvidenceInput(
                **common,
                id="image-good",
                kind="image",
                role="last_good",
                label="Last-known-good coverage (illustrative)",
                source_ref="replay:v1/image-good",
                event_time="2026-09-30T09:00:00+08:00",
                tray_id="TRAY-101",
                image_url="/api/vision/examples/normal/image",
                values={"coverage": "uniform", "location": "dispense area"},
            ),
            EvidenceInput(
                **common,
                id="image-bad",
                kind="image",
                role="first_bad",
                label="First-known-bad coverage (illustrative)",
                source_ref="replay:v1/image-bad",
                event_time="2026-09-30T09:08:00+08:00",
                tray_id="TRAY-104",
                image_url="/api/vision/examples/incomplete/image",
                values={"coverage": "progressively insufficient", "location": "dispense area"},
            ),
            EvidenceInput(
                **common,
                id="machine-log-pending",
                kind="log",
                role="machine_log",
                label="Pressure and mass export pending",
                source_ref="replay:v1/machine-log",
                status="pending",
            ),
            EvidenceInput(
                **common,
                id="pm-unavailable",
                kind="maintenance",
                role="pm",
                label="PM record unavailable",
                source_ref="replay:v1/pm",
                status="unavailable",
                values={"reason": "The replay package contains no complete PM record."},
            ),
        ],
    )


def replay_arrivals() -> list[EvidenceInput]:
    return [
        EvidenceInput(
            id="machine-log-collected",
            kind="log",
            role="machine_log",
            label="Falling mass with a stable recorded pressure trend",
            source_ref="replay:v1/machine-log",
            event_time="2026-09-30T09:07:45+08:00",
            event_timezone="Asia/Kuala_Lumpur",
            time_uncertain=True,
            tool_id="S932-DEMO-01",
            configuration="S932 / DJ-2200 / BFS",
            lot_id="REPLAY-LOT-01",
            provenance="Synthetic log fixture; image/control-PC clocks are not aligned",
            values={
                "mass_trend": "falling",
                "pressure_trend": "stable",
                "frequency": "progressive across consecutive trays",
                "samples": [
                    {"tray": "TRAY-101", "mass_mg": 12.0, "fluid_pressure_bar": 1.1},
                    {"tray": "TRAY-102", "mass_mg": 11.1, "fluid_pressure_bar": 1.1},
                    {"tray": "TRAY-103", "mass_mg": 10.3, "fluid_pressure_bar": 1.1},
                    {"tray": "TRAY-104", "mass_mg": 9.2, "fluid_pressure_bar": 1.1},
                ],
                "units": {"mass": "mg", "fluid_pressure": "bar"},
                "limitation": "Sampled pressure does not establish instantaneous nozzle flow.",
            },
        ),
        EvidenceInput(
            id="recent-change",
            kind="context",
            role="context",
            label="Material container changed before the observed decline",
            source_ref="replay:v1/change-note",
            event_time="2026-09-30T08:55:00+08:00",
            event_timezone="Asia/Kuala_Lumpur",
            tool_id="S932-DEMO-01",
            configuration="S932 / DJ-2200 / BFS",
            provenance="Synthetic technician note; PM association not independently verified",
            values={
                "material": "flux; batch and age unknown",
                "recent_changes": "Material container changed; PM details unavailable",
            },
        ),
    ]
