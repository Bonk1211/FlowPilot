"""Demo roles or configured opaque credentials; never trust a role header in pilot."""

import hashlib
import hmac
from datetime import UTC, datetime
from typing import Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import Integer, String, select
from sqlalchemy.orm import Mapped, mapped_column

from flowpilot.investigations.models import Contract
from flowpilot.persistence.database import Base
from flowpilot.settings import Permission, Settings


class Actor(Contract):
    mode: Literal["demo", "configured"]
    subject: str | None
    permissions: list[Permission]
    authenticated: bool


class AccessAudit(Contract):
    id: str
    timestamp: str
    subject: str | None
    method: str
    resource: str
    status_code: int


class AccessAuditRecord(Base):
    __tablename__ = "incident_access_audit"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    timestamp: Mapped[str] = mapped_column(String, nullable=False)
    subject: Mapped[str | None] = mapped_column(String)
    method: Mapped[str] = mapped_column(String, nullable=False)
    resource: Mapped[str] = mapped_column(String, nullable=False)
    status_code: Mapped[int] = mapped_column(Integer, nullable=False)


def identify(request: Request) -> Actor:
    cached = getattr(request.state, "incident_actor", None)
    if cached is not None:
        return cached
    settings = Settings()
    if settings.incident_auth_mode == "demo":
        role = request.headers.get("X-Incident-Role", "technician")
        roles: dict[str, list[Permission]] = {
            "viewer": ["view"],
            "technician": ["view", "edit"],
            "engineer": ["view", "edit", "authorize_test", "close", "publish_knowledge"],
        }
        actor = Actor(
            mode="demo",
            subject=f"demo:{role}" if role in roles else None,
            permissions=roles.get(role, []),
            authenticated=role in roles,
        )
    else:
        actor = Actor(mode="configured", subject=None, permissions=[], authenticated=False)
        scheme, _, token = request.headers.get("Authorization", "").partition(" ")
        if scheme.casefold() == "bearer" and 32 <= len(token) <= 4096:
            digest = hashlib.sha256(token.encode()).hexdigest()
            for principal in settings.incident_principals:
                if hmac.compare_digest(digest, principal.token_sha256):
                    actor = Actor(
                        mode="configured",
                        subject=principal.subject,
                        permissions=principal.permissions,
                        authenticated=True,
                    )
                    break
    request.state.incident_actor = actor
    return actor


def require_permission(permission: Permission):
    def authorized(request: Request) -> Actor:
        actor = identify(request)
        if not actor.authenticated:
            raise HTTPException(
                401, "Incident authentication required.", headers={"WWW-Authenticate": "Bearer"}
            )
        if permission not in actor.permissions:
            raise HTTPException(403, f"Permission required: {permission}.")
        return actor

    return authorized


def audit_access(request: Request, status_code: int):
    from flowpilot.incidents.service import database_operation

    actor = identify(request)
    record = AccessAuditRecord(
        id=uuid4().hex,
        timestamp=datetime.now(UTC).isoformat(),
        subject=actor.subject,
        method=request.method,
        resource=request.url.path[:500],
        status_code=status_code,
    )
    database_operation(lambda session: session.add(record))


router = APIRouter(prefix="/api/incident-access", tags=["incident access"])


@router.get("", response_model=Actor)
def access(request: Request):
    return identify(request)


@router.get("/audit", response_model=list[AccessAudit])
def access_history(
    limit: int = Query(default=100, ge=1, le=1000),
    actor: Actor = Depends(require_permission("manage_data")),
):
    from flowpilot.incidents.service import database_operation

    def read(session):
        rows = session.scalars(
            select(AccessAuditRecord).order_by(AccessAuditRecord.timestamp.desc()).limit(limit)
        )
        return [AccessAudit.model_validate(row, from_attributes=True) for row in rows]

    return database_operation(read)
