from typing import Literal

from fastapi import APIRouter, FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

from flowpilot.cases import router as case_router
from flowpilot.demo import DemoScenario, load_scenario
from flowpilot.golden import GoldenScenario, load_golden_scenario
from flowpilot.incidents.access import audit_access, identify, require_permission
from flowpilot.incidents.access import router as incident_access_router
from flowpilot.incidents.artifacts import router as incident_artifact_router
from flowpilot.incidents.communication import router as incident_communication_router
from flowpilot.incidents.coordinator import incident_workers
from flowpilot.incidents.coordinator import router as incident_coordinator_router
from flowpilot.incidents.coordinator import status_router as incident_jobs_status_router
from flowpilot.incidents.experience import router as incident_experience_router
from flowpilot.incidents.experiments import router as incident_experiments_router
from flowpilot.incidents.knowledge import router as incident_knowledge_router
from flowpilot.incidents.rag import router as incident_rag_router
from flowpilot.incidents.routes import router as incident_router
from flowpilot.incidents.simulation import router as incident_simulation_router
from flowpilot.ingestion.industry_event_log import parse_industry_event_log
from flowpilot.ingestion.models import IngestionResult, LogPreviewRequest
from flowpilot.intake import LogContext, LogContextRequest, log_context
from flowpilot.investigations.models import Contract
from flowpilot.knowledge.routes import router as knowledge_router
from flowpilot.question_plan import router as question_plan_router
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
    app = FastAPI(title="FlowPilot API", version="0.1.0", lifespan=lambda app: incident_workers())

    @app.middleware("http")
    async def configured_access(request: Request, call_next):
        path = request.url.path
        if not path.startswith("/api/") or path in {"/api/health", "/api/incident-access"}:
            return await call_next(request)
        actor = identify(request)
        if actor.mode == "demo":
            return await call_next(request)
        try:
            if not actor.authenticated:
                raise HTTPException(
                    401,
                    "Incident authentication required.",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            # Legacy routes have no incident-specific authorization dependencies.
            if not path.startswith(("/api/incidents", "/api/incident-")):
                require_permission("view" if request.method in {"GET", "HEAD"} else "edit")(request)
            response = await call_next(request)
        except HTTPException as error:
            response = JSONResponse(
                {"detail": error.detail}, status_code=error.status_code, headers=error.headers
            )
        try:
            await run_in_threadpool(audit_access, request, response.status_code)
        except HTTPException:
            return JSONResponse({"detail": "Access audit storage unavailable."}, status_code=503)
        return response

    app.include_router(router)
    app.include_router(case_router)
    app.include_router(vision_router)
    app.include_router(knowledge_router)
    app.include_router(question_plan_router)
    app.include_router(incident_router)
    app.include_router(incident_experience_router)
    app.include_router(incident_access_router)
    app.include_router(incident_artifact_router)
    app.include_router(incident_knowledge_router)
    app.include_router(incident_rag_router)
    app.include_router(incident_communication_router)
    app.include_router(incident_coordinator_router)
    app.include_router(incident_jobs_status_router)
    app.include_router(incident_simulation_router)
    app.include_router(incident_experiments_router)
    return app


app = create_app()
