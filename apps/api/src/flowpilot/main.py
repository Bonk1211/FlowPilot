from typing import Literal

from fastapi import APIRouter, FastAPI

from flowpilot.demo import DemoScenario, load_scenario
from flowpilot.ingestion.industry_event_log import parse_industry_event_log
from flowpilot.ingestion.models import IngestionResult, LogPreviewRequest
from flowpilot.investigations.models import Contract


class Health(Contract):
    status: Literal["ok"] = "ok"
    service: Literal["flowpilot-api"] = "flowpilot-api"
    version: Literal["0.1.0"] = "0.1.0"


router = APIRouter(prefix="/api")


@router.get("/health", response_model=Health, tags=["system"])
def health() -> Health:
    """Process liveness only; does not open or initialize the database."""
    return Health()


@router.get("/demo/scenario", response_model=DemoScenario, tags=["demo"])
def scenario() -> DemoScenario:
    return load_scenario()


@router.post(
    "/logs/preview",
    response_model=IngestionResult,
    response_model_exclude_unset=True,
    tags=["ingestion"],
)
def preview_log(request: LogPreviewRequest):
    """Parse text without attaching events or evidence to an investigation."""
    return parse_industry_event_log(
        request.text, source_name=request.sourceName, timezone_offset=request.timezoneOffset
    )


def create_app() -> FastAPI:
    app = FastAPI(title="FlowPilot API", version="0.1.0")
    app.include_router(router)
    return app


app = create_app()
