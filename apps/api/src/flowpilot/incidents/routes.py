from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from starlette.concurrency import run_in_threadpool

from flowpilot.incidents.access import Actor, identify, require_permission
from flowpilot.incidents.conversation import ConversationRequest, VoiceToken, converse, voice_token
from flowpilot.incidents.coordinator import process_next_job, schedule_incident
from flowpilot.incidents.graph import GRAPH_ACTIONS
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
    elif request.action in GRAPH_ACTIONS:
        # Manual mode still saves the answer before doing any provider work.
        schedule_incident(incident)
        process_next_job("analysis", incident_id=incident.id)
        incident = get_incident(incident.id)
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


@router.post("/{incident_id}/conversation", response_model=Incident)
async def conversation(
    incident_id: str,
    request: ConversationRequest,
    actor: Actor = Depends(require_permission("edit")),
):
    incident = await converse(incident_id, request, actor.subject)
    turn = incident.conversation[-1]
    if turn.status == "recorded" or (turn.intent == "switch" and turn.status == "discussed"):
        schedule_incident(incident)
        if not Settings().incident_auto_process:
            await run_in_threadpool(process_next_job, "analysis", incident_id=incident.id)
            incident = get_incident(incident.id)
    return incident


@router.post("/{incident_id}/voice-token", response_model=VoiceToken)
async def create_voice_token(
    incident_id: str,
    actor: Actor = Depends(require_permission("edit")),
):
    token = await voice_token(incident_id)
    return Response(
        token.model_dump_json(),
        media_type="application/json",
        headers={"Cache-Control": "no-store"},
    )
