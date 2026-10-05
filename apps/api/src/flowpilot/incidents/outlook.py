"""Browser-bound Microsoft sign-in and explicit draft creation; no send permission."""

import base64
import hashlib
import json
import secrets
import time
from dataclasses import dataclass, field
from threading import Lock
from typing import Annotated
from urllib.parse import urlencode, urlsplit

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import HTMLResponse
from pydantic import Field, field_validator

from flowpilot.incidents.access import Actor, require_permission
from flowpilot.incidents.communication import CommunicationApprovalRequest, ensure_current_draft
from flowpilot.incidents.diagnostic import external_data_allowed
from flowpilot.incidents.service import (
    active_evidence,
    active_observations,
    database_operation,
    load_incident,
)
from flowpilot.investigations.models import Contract
from flowpilot.settings import Settings

COOKIE = "flowpilot_outlook"
SCOPE = "https://graph.microsoft.com/User.Read https://graph.microsoft.com/Mail.ReadWrite"
GRAPH = "https://graph.microsoft.com/v1.0"
router = APIRouter(prefix="/api/incident-outlook", tags=["Outlook drafts"])
EditActor = Annotated[Actor, Depends(require_permission("edit"))]
ViewActor = Annotated[Actor, Depends(require_permission("view"))]


class OutlookStatus(Contract):
    configured: bool
    connected: bool = False
    email: str | None = None


class OutlookAuthorization(Contract):
    authorization_url: str


class OutlookDraftRequest(Contract):
    incident_revision: int = Field(ge=0)
    draft_version: int = Field(ge=1)
    recipients: list[str] = Field(default_factory=list, max_length=20)

    @field_validator("recipients")
    @classmethod
    def valid_recipients(cls, values):
        return CommunicationApprovalRequest.valid_recipients(values)


class OutlookDraft(Contract):
    id: str
    web_link: str
    draft_version: int


@dataclass
class OutlookSession:
    subject: str
    state: str
    verifier: str
    expires_at: float
    token: str = field(default="", repr=False)
    email: str = ""
    drafts: dict[str, OutlookDraft | None] = field(default_factory=dict)


# ponytail: single-process, short-lived sessions; use a shared encrypted token store for workers.
sessions: dict[str, OutlookSession] = {}
session_lock = Lock()


def configured(settings: Settings):
    uri = urlsplit(settings.outlook_redirect_uri)
    return bool(
        settings.outlook_client_id
        and settings.outlook_client_secret
        and uri.path == "/api/incident-outlook/callback"
        and not uri.query
        and not uri.fragment
        and not uri.username
        and uri.hostname
        and (uri.scheme == "https" or (uri.scheme == "http" and uri.hostname == "localhost"))
    )


def get_session(request: Request, actor: Actor):
    with session_lock:
        session = sessions.get(request.cookies.get(COOKIE, ""))
        if session and session.subject == actor.subject and session.expires_at > time.time():
            return session
    return None


def microsoft_request(method: str, url: str, **kwargs):
    try:
        return httpx.request(method, url, timeout=15, **kwargs)
    except httpx.HTTPError:
        raise HTTPException(502, "Microsoft could not be reached. Try connecting Outlook again.")


@router.get("", response_model=OutlookStatus)
def status(request: Request, actor: ViewActor):
    session = get_session(request, actor)
    return OutlookStatus(
        configured=configured(Settings()),
        connected=bool(session and session.token),
        email=session.email if session and session.token else None,
    )


@router.post("/connect", response_model=OutlookAuthorization)
def connect(request: Request, response: Response, actor: EditActor):
    settings = Settings()
    if not configured(settings):
        raise HTTPException(503, "Outlook app registration is not configured. See docs/OUTLOOK.md.")
    session_id = secrets.token_urlsafe(32)
    session = OutlookSession(
        subject=actor.subject,
        state=secrets.token_urlsafe(32),
        verifier=secrets.token_urlsafe(64),
        expires_at=time.time() + 600,
    )
    with session_lock:
        for key in list(sessions):
            if sessions[key].expires_at <= time.time():
                del sessions[key]
        sessions.pop(request.cookies.get(COOKIE, ""), None)
        sessions[session_id] = session
    response.set_cookie(
        COOKIE,
        session_id,
        httponly=True,
        secure=settings.outlook_redirect_uri.startswith("https:"),
        samesite="lax",
        max_age=7200,
        path="/api/incident-outlook",
    )
    challenge = base64.urlsafe_b64encode(hashlib.sha256(session.verifier.encode()).digest())
    query = urlencode(
        {
            "client_id": settings.outlook_client_id,
            "response_type": "code",
            "redirect_uri": settings.outlook_redirect_uri,
            "response_mode": "query",
            "scope": SCOPE,
            "state": session.state,
            "code_challenge": challenge.decode().rstrip("="),
            "code_challenge_method": "S256",
            "prompt": "select_account",
        }
    )
    return OutlookAuthorization(
        authorization_url=f"https://login.microsoftonline.com/{settings.outlook_tenant}"
        f"/oauth2/v2.0/authorize?{query}"
    )


@router.get("/callback", response_class=HTMLResponse, include_in_schema=False)
def callback(request: Request, state: str = "", code: str = "", error: str = ""):
    with session_lock:
        session = sessions.get(request.cookies.get(COOKIE, ""))
        if (
            not session
            or session.expires_at <= time.time()
            or not session.state
            or not secrets.compare_digest(session.state, state)
        ):
            raise HTTPException(
                400, "Outlook sign-in expired or invalid. Connect again from FlowPilot."
            )
        session.state = ""  # Consume state before token exchange; callbacks cannot be replayed.
    if error or not code:
        raise HTTPException(
            400, "Outlook sign-in was cancelled or denied. Close this window and retry."
        )
    settings = Settings()
    if not configured(settings):
        raise HTTPException(503, "Outlook app registration is not configured.")
    result = microsoft_request(
        "POST",
        f"https://login.microsoftonline.com/{settings.outlook_tenant}/oauth2/v2.0/token",
        data={
            "client_id": settings.outlook_client_id,
            "client_secret": settings.outlook_client_secret.get_secret_value(),
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": settings.outlook_redirect_uri,
            "code_verifier": session.verifier,
            "scope": SCOPE,
        },
    )
    if not result.is_success:
        raise HTTPException(502, "Microsoft sign-in failed. Close this window and connect again.")
    try:
        tokens = result.json()
        token = tokens["access_token"]
        lifetime = min(int(tokens["expires_in"]), 7200) - 60
        if not isinstance(token, str) or not token or lifetime <= 0:
            raise ValueError
        profile = microsoft_request(
            "GET",
            f"{GRAPH}/me?$select=mail,userPrincipalName",
            headers={"Authorization": f"Bearer {token}"},
        )
        if not profile.is_success:
            raise ValueError
        person = profile.json()
        if not isinstance(person, dict):
            raise ValueError
        email = person.get("mail") or person["userPrincipalName"]
        if not isinstance(email, str) or not email:
            raise ValueError
    except (ValueError, KeyError, TypeError):
        raise HTTPException(502, "Microsoft returned an incomplete account. Connect again.")
    with session_lock:
        session.token, session.email = token, email
        session.verifier = ""
        session.expires_at = time.time() + lifetime
    return HTMLResponse(
        '<!doctype html><html lang="en"><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        "<title>Outlook connected</title><h1>Outlook connected</h1>"
        "<p>Close this window and return to FlowPilot to save your draft.</p></html>",
        headers={"Cache-Control": "no-store", "Referrer-Policy": "no-referrer"},
    )


@router.post("/disconnect", response_model=OutlookStatus)
def disconnect(request: Request, response: Response, actor: EditActor):
    with session_lock:
        session_id = request.cookies.get(COOKIE, "")
        session = sessions.get(session_id)
        if session and session.subject == actor.subject:
            del sessions[session_id]
    response.delete_cookie(COOKIE, path="/api/incident-outlook")
    return OutlookStatus(configured=configured(Settings()))


@router.post("/drafts/{incident_id}", response_model=OutlookDraft)
def create_draft(incident_id: str, body: OutlookDraftRequest, request: Request, actor: EditActor):
    session = get_session(request, actor)
    if not session or not session.token:
        raise HTTPException(401, "Connect Outlook before saving a draft.")
    incident = database_operation(lambda db: load_incident(db, incident_id))
    ensure_current_draft(incident, body.incident_revision, body.draft_version)
    if not external_data_allowed(
        [item.model_dump() for item in active_evidence(incident)],
        [item.model_dump() for item in active_observations(incident)],
        Settings(),
    ):
        raise HTTPException(
            403, "This workspace's external-data policy blocks this Outlook export."
        )
    if any(character in incident.handoff.subject for character in "\r\n\x00"):
        raise HTTPException(422, "The draft subject must be a single line without control bytes.")
    payload = {
        "subject": incident.handoff.subject,
        "body": {"contentType": "Text", "content": incident.handoff.body},
        "toRecipients": [{"emailAddress": {"address": value}} for value in body.recipients],
    }
    key = hashlib.sha256(
        json.dumps([incident_id, body.model_dump(), payload], sort_keys=True).encode()
    ).hexdigest()
    with session_lock:
        if key in session.drafts:
            if saved := session.drafts[key]:
                return saved
            raise HTTPException(
                409, "Draft creation is pending or uncertain. Check Outlook Drafts first."
            )
        session.drafts[key] = None  # Claim before network I/O; never automatically repeat a POST.
    try:
        result = microsoft_request(
            "POST",
            f"{GRAPH}/me/messages",
            json=payload,
            headers={"Authorization": f"Bearer {session.token}"},
        )
    except HTTPException:
        raise HTTPException(
            502, "Outlook's response is uncertain. Check Drafts before saving again."
        )
    if not result.is_success:
        if 400 <= result.status_code < 500:
            with session_lock:
                session.drafts.pop(key, None)
                if result.status_code == 401:
                    session.token = ""
            raise HTTPException(
                502, "Microsoft rejected the draft. Check mailbox access and connect Outlook again."
            )
        raise HTTPException(
            502, "Outlook's response is uncertain. Check Drafts before saving again."
        )
    try:
        message = result.json()
        link = urlsplit(message["webLink"])
        if (
            link.scheme != "https"
            or link.hostname
            not in {"outlook.office.com", "outlook.office365.com", "outlook.live.com"}
            or link.username
            or message.get("isDraft") is not True
        ):
            raise ValueError
        saved = OutlookDraft(
            id=message["id"], web_link=message["webLink"], draft_version=body.draft_version
        )
    except (ValueError, KeyError, TypeError):
        raise HTTPException(
            502, "Outlook created a draft but its link is unavailable. Check Drafts."
        )
    with session_lock:
        session.drafts[key] = saved
    return saved
