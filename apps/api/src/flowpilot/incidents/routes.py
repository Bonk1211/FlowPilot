from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response

from flowpilot.incidents.access import Actor, identify, require_permission
from flowpilot.incidents.coordinator import schedule_incident
from flowpilot.incidents.models import CreateIncident, Incident, IncidentAction, ReplayRequest
from flowpilot.incidents.replay import replay_request
from flowpilot.incidents.service import (
    act,
    create_incident,
    get_incident,
    list_incidents,
    report_markdown,
)
from flowpilot.settings import Settings

router = APIRouter(
    prefix="/api/incidents", tags=["incidents"], dependencies=[Depends(require_permission("view"))]
)


@router.get("", response_model=list[Incident])
def listing(limit: int = Query(default=30, ge=1, le=100)):
    return list_incidents(limit)


@router.post("", response_model=Incident, status_code=201)
def create(request: CreateIncident, actor: Actor = Depends(require_permission("edit"))):
    if request.mode == "live" and actor.mode != "configured":
        raise HTTPException(403, "Live incident imports require configured site access.")
    incident = create_incident(request, owner=actor.subject)
    if Settings().incident_auto_process:
        schedule_incident(incident)
    return incident


@router.post("/replay", response_model=Incident, status_code=201)
def replay(request: ReplayRequest, actor: Actor = Depends(require_permission("edit"))):
    incident = create_incident(replay_request(request.trigger_id), owner=actor.subject)
    if Settings().incident_auto_process:
        schedule_incident(incident)
    return incident


@router.get("/{incident_id}", response_model=Incident)
def get(incident_id: str):
    return get_incident(incident_id)


@router.post("/{incident_id}/actions", response_model=Incident)
def action(
    incident_id: str,
    request: IncidentAction,
    actor: Actor = Depends(identify),
):
    from fastapi import HTTPException

    permission = {"close": "close", "review_learning": "publish_knowledge"}.get(
        request.action, "edit"
    )
    if permission not in actor.permissions:
        raise HTTPException(403, f"Permission required: {permission}.")
    if actor.mode == "configured" and request.action in {"close", "review_learning"}:
        request = request.model_copy(update={"reviewer": actor.subject})
    incident = act(incident_id, request, actor=actor.subject)
    if Settings().incident_auto_process:
        schedule_incident(incident)
    return incident


@router.get("/{incident_id}/report.md")
def report(incident_id: str):
    from flowpilot.incidents.communication import list_communications
    from flowpilot.incidents.experiments import list_plans

    incident = get_incident(incident_id)
    return Response(
        report_markdown(
            incident, list_communications(incident_id, None), list_plans(incident_id, None)
        ),
        media_type="text/markdown; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{incident.id}-r{incident.revision}.md"'
        },
    )
