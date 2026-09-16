import json
from typing import Literal

from flowpilot.ingestion.models import LogPreviewRequest
from flowpilot.investigations.models import Contract, Investigation
from flowpilot.settings import fixture_path


class DemoLogMetadata(Contract):
    label: str
    source: str
    format_profile: Literal["industry_event_log_v1"]
    assumed_timezone_offset: str
    limitations: list[str]


class DemoScenario(Contract):
    schema_version: Literal["1.0"]
    investigation: Investigation
    sample_log: LogPreviewRequest
    log_metadata: DemoLogMetadata


def load_scenario() -> DemoScenario:
    investigation = Investigation.model_validate_json(
        fixture_path("v1/reported-investigation.json").read_text(encoding="utf-8")
    )
    metadata = json.loads(fixture_path("demo-industry-machine.metadata.json").read_bytes())
    return DemoScenario(
        schema_version="1.0",
        investigation=investigation,
        sample_log=LogPreviewRequest(
            text=fixture_path("demo-industry-machine.log").read_bytes().decode("utf-8"),
            sourceName="demo-industry-machine.log",
            timezoneOffset=metadata["assumed_timezone_offset"],
        ),
        log_metadata=DemoLogMetadata.model_validate(metadata),
    )
