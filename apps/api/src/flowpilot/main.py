from typing import Literal

from fastapi import APIRouter, FastAPI

from flowpilot.cases import router as case_router
from flowpilot.demo import DemoScenario, load_scenario
from flowpilot.golden import GoldenScenario, load_golden_scenario
from flowpilot.ingestion.industry_event_log import parse_industry_event_log
from flowpilot.ingestion.models import IngestionResult, LogPreviewRequest
from flowpilot.intake import LogContext, LogContextRequest, log_context
from flowpilot.investigations.models import Contract
from flowpilot.vision import router as vision_router


class Health(Contract):
    status: Literal["ok"] = "ok"
    service: Literal["flowpilot-api"] = "flowpilot-api"
    version: Literal["0.1.0"] = "0.1.0"


router = APIRouter(prefix="/api")


@router.get(
    "/demo/golden-scenario",
    response_model=GoldenScenario,
    response_model_exclude_unset=True,
    tags=["demo"],
)
def golden_scenario() -> GoldenScenario:
    """Read-only, validated M0 storyboard; no workflow or database side effects."""
    return load_golden_scenario()


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


@router.post("/logs/context", response_model=LogContext, tags=["ingestion"])
def preview_context(request: LogContextRequest):
    return log_context(request)


def create_app() -> FastAPI:
    app = FastAPI(title="FlowPilot API", version="0.1.0")
    app.include_router(router)
    app.include_router(case_router)
    app.include_router(vision_router)
    return app


app = create_app()
