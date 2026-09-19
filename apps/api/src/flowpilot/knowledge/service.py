"""Evidence-backed experience, immutable versions and explainable retrieval."""

import hashlib
import json
from datetime import UTC, datetime
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError

from flowpilot.knowledge.models import (
    CitationStatus,
    DraftGeneration,
    KnowledgeContent,
    KnowledgeEntry,
    KnowledgeEvent,
    KnowledgeSource,
    KnowledgeVersion,
    PastExperience,
    RetrievalSnapshot,
)
from flowpilot.knowledge.storage import KnowledgeRecord, LibraryRevision

CONDITIONS = {
    "frequency": "Symptom frequency",
    "continuous": "Falling weight",
    "intermittent": "Stable weight with blobs",
    "change": "Pressure change",
    "temperature": "Material / idle concern",
    "service": "Setup / collision concern",
}
SYMPTOMS = ("incomplete_coverage", "coarse_deposits", "shifted_pattern", "overspray")
CHECKS = {
    "nozzle_inspection": (
        "Focus the authorized nozzle inspection on obstruction; confirm the finding."
    ),
    "air_supply_review": "Include air-cap and pressure-supply review in the maintenance handoff.",
    "material_review": "Review material condition and idle-purge history with maintenance.",
}


def now():
    return datetime.now(UTC).isoformat()


def require(condition, message, status=409):
    if not condition:
        raise HTTPException(status, message)


def conditions(case):
    # Only active pre-inspection features, never ranking, outcomes or file/report names.
    active = {e.key: e for e in case.investigation.evidence if e.verification_state != "rejected"}
    result = {key: "unknown" for key in CONDITIONS}
    for key in CONDITIONS:
        item = active.get(key)
        if item and item.verification_state == "verified":
            result[key] = str(item.value)
    for key in SYMPTOMS:
        item = active.get(key)
        result[key] = str(item.value).lower() if item else "unknown"
    return result


def source_signature(case):
    # Diagnostic refreshes do not alter the facts supporting published knowledge.
    payload = {
        key: getattr(case, key)
        for key in (
            "investigation",
            "answers",
            "measurement",
            "verification",
            "recovery",
            "corrective_action",
            "summary",
            "calibration_failures",
            "log",
        )
    }
    encoded = json.dumps(
        payload, sort_keys=True, default=lambda value: value.model_dump(mode="json")
    )
    return hashlib.sha256(encoded.encode()).hexdigest()


def extract_source(case):
    require(case.scenario_version == "2.0", "Legacy cases cannot publish new experience.")
    active = [e for e in case.investigation.evidence if e.verification_state != "rejected"]
    inspected = [e for e in active if e.key == "inspection" and e.verification_state == "verified"]
    require(bool(inspected), "Confirm an inspection before drafting experience.")
    finding = inspected[-1].value
    checks = [
        e for e in active if e.key == "verification_passed" and e.verification_state == "verified"
    ]
    outcome = (
        "recovered"
        if case.summary and case.investigation.state == "resolved"
        else "not_recovered"
        if checks and checks[-1].value is False
        else "unresolved"
    )
    features = conditions(case)
    fingerprint = hashlib.sha256(
        json.dumps(
            {
                "process": case.investigation.process,
                "conditions": features,
                "finding": finding,
                "outcome": outcome,
                "action": case.corrective_action,
            },
            sort_keys=True,
        ).encode()
    ).hexdigest()
    # Take candidate causes before the inspection, never present the outcome as a query feature.
    prior = next((s.ranking for s in case.diagnostic_history if s.trigger == "diagnose"), [])
    return KnowledgeSource(
        case_id=case.investigation.id,
        revision=case.revision,
        signature=source_signature(case),
        problem=case.investigation.title,
        process=case.investigation.process,
        simulated=case.investigation.simulated,
        recorded_at=max(
            [e.timestamp for e in active if e.timestamp != "unknown"]
            + [
                t.timestamp
                for t in case.timeline
                if not t.description.startswith("Refreshed published")
            ]
        ),
        conditions=features,
        possible_causes=[c.label for c in prior],
        actual_finding=finding,
        actual_outcome=outcome,
        action=case.corrective_action,
        evidence=[e.model_copy(deep=True) for e in active],
        image_url=case.measurement.image_url,
        verification_image_url=case.verification.image_url if case.verification else None,
        log_digest=case.log.sourceDigest if case.log else None,
        fingerprint=fingerprint,
    )


def default_content(source):
    lesson = (
        "Nozzle obstruction was observed. Recorded recovery followed the action and verification; "
        "a similar symptom still requires a new inspection."
        if source.actual_outcome == "recovered"
        else "Nozzle inspection found no obstruction. Upstream restriction remains possible; "
        "air-cap and supply checks are a maintenance handoff, not a confirmed repair."
        if source.actual_finding == "no_obstruction_found"
        else "Nozzle obstruction was observed, but successful recovery has not been established."
    )
    return KnowledgeContent(
        title="Nozzle inspection experience",
        lesson=lesson,
        finding=source.actual_finding,
        outcome=source.actual_outcome,
        check_focus="air_supply_review"
        if source.actual_finding == "no_obstruction_found"
        else "nozzle_inspection",
        supporting_evidence_ids=[
            e.id for e in source.evidence if e.verification_state == "verified"
        ],
    )


def validate_content(content, source):
    require(
        bool(content.title.strip()) and bool(content.lesson.strip()),
        "Enter a title and lesson.",
        422,
    )
    cited = set(content.supporting_evidence_ids)
    active = {e.id: e for e in source.evidence}
    require(cited <= active.keys(), "Knowledge cites evidence outside its source revision.", 422)
    require(
        content.finding in (source.actual_finding, "uncertain"),
        "The source does not support this inspection finding.",
        422,
    )
    require(
        content.outcome in (source.actual_outcome, "unresolved"),
        "The source does not support this outcome.",
        422,
    )
    if content.finding != "uncertain":
        require(
            any(
                e.id in cited
                and e.key == "inspection"
                and e.value == content.finding
                and e.verification_state == "verified"
                for e in source.evidence
            ),
            "Cite the confirmed inspection supporting this finding.",
            422,
        )
    if content.outcome == "recovered":
        require(
            content.finding == "obstruction_found",
            "An uncertain finding cannot claim a successful solution.",
            422,
        )
        require(
            all(
                any(
                    e.id in cited
                    and e.key == key
                    and e.verification_state == "verified"
                    and (key != "verification_passed" or e.value is True)
                    for e in source.evidence
                )
                for key in ("corrective_action", "recovery_checks", "verification_passed")
            ),
            "Cite the action and complete recovery evidence.",
            422,
        )
    if content.outcome == "not_recovered":
        require(
            any(
                e.id in cited
                and e.key == "verification_passed"
                and e.value is False
                and e.verification_state == "verified"
                for e in source.evidence
            ),
            "Cite the unsuccessful verification.",
            422,
        )


def load_source_case(session, case_id):
    from flowpilot.cases import Case, CaseRecord

    record = session.get(CaseRecord, case_id)
    require(record is not None, "Source case not found.", 404)
    return Case.model_validate(record.payload)


def load_entry(session, entry_id):
    record = session.get(KnowledgeRecord, entry_id)
    require(record is not None, "Knowledge entry not found.", 404)
    return KnowledgeEntry.model_validate(record.payload)


def library_revision(session):
    return session.scalar(select(LibraryRevision.revision).where(LibraryRevision.id == 1))


def lock_library(session):
    session.execute(
        update(LibraryRevision)
        .where(LibraryRevision.id == 1)
        .values(revision=LibraryRevision.revision)
    )


def bump_library(session):
    session.execute(
        update(LibraryRevision)
        .where(LibraryRevision.id == 1)
        .values(revision=LibraryRevision.revision + 1)
    )


def event(entry, actor, reason):
    entry.events.append(
        KnowledgeEvent(
            revision=entry.revision,
            version=entry.versions[-1].version,
            state=entry.status,
            actor=actor.strip(),
            reason=reason.strip(),
            timestamp=now(),
        )
    )


def persist(session, entry, expected):
    previous_status = session.scalar(
        select(KnowledgeRecord.status).where(
            KnowledgeRecord.id == entry.id, KnowledgeRecord.revision == expected
        )
    )
    result = session.execute(
        update(KnowledgeRecord)
        .where(KnowledgeRecord.id == entry.id, KnowledgeRecord.revision == expected)
        .values(revision=entry.revision, status=entry.status, payload=entry.model_dump(mode="json"))
    )
    require(result.rowcount == 1, "Knowledge changed. Reload before trying again.")
    # Draft preparation changes the review queue, not the published retrieval corpus.
    if previous_status == "published" or entry.status == "published":
        bump_library(session)


def draft_generation():
    from flowpilot.settings import Settings

    settings = Settings()
    enabled = settings.reasoning_enabled and bool(settings.gemini_api_key)
    return DraftGeneration(
        mode="pending" if enabled else "cached",
        model=settings.gemini_model,
        reason=None
        if enabled
        else "Gemini unavailable or disabled; evidence template ready for review.",
        timestamp=now(),
    )


def create_entry(session, case_id, request):
    require(bool(request.actor.strip()), "Enter the reviewer's name.", 422)
    # Serialize publication and source changes before taking a source snapshot.
    lock_library(session)
    existing = session.scalar(
        select(KnowledgeRecord).where(KnowledgeRecord.source_case_id == case_id)
    )
    if existing:
        return KnowledgeEntry.model_validate(existing.payload)
    case = load_source_case(session, case_id)
    require(
        case.revision == request.source_revision, "Source case changed. Reload before drafting."
    )
    source = extract_source(case)
    content = default_content(source)
    validate_content(content, source)
    entry = KnowledgeEntry(
        id=f"KB-{uuid4().hex[:12]}",
        source_case_id=case_id,
        revision=1,
        status="draft",
        generation=draft_generation(),
        versions=[
            KnowledgeVersion(
                version=1,
                created_at=now(),
                actor=request.actor.strip(),
                reason="Drafted from confirmed case evidence",
                source=source,
                content=content,
            )
        ],
        events=[],
    )
    event(entry, request.actor, "Drafted from confirmed case evidence")
    session.add(
        KnowledgeRecord(
            id=entry.id,
            source_case_id=case_id,
            revision=1,
            status="draft",
            payload=entry.model_dump(mode="json"),
        )
    )
    try:
        session.flush()
    except IntegrityError as error:
        raise HTTPException(
            409, "Experience already exists for this source. Reload the library."
        ) from error
    return entry


def change_entry(session, entry_id, command):
    require(
        bool(command.actor.strip()) and bool(command.reason.strip()),
        "Enter reviewer and reason.",
        422,
    )
    lock_library(session)
    entry = load_entry(session, entry_id)
    require(entry.revision == command.revision, "Knowledge changed. Reload before trying again.")
    source_case = load_source_case(session, entry.source_case_id)
    if command.action == "revise":
        require(command.content is not None, "A revision requires corrected content.", 422)
        source = extract_source(source_case)
        validate_content(command.content, source)
        entry.versions.append(
            KnowledgeVersion(
                version=entry.versions[-1].version + 1,
                created_at=now(),
                actor=command.actor.strip(),
                reason=command.reason.strip(),
                source=source,
                content=command.content,
            )
        )
        entry.status = "draft"
        entry.generation = DraftGeneration(mode="manual", timestamp=now())
    else:
        require(command.content is None, "Content changes require a new revision.", 422)
        if command.action == "publish":
            require(
                entry.status == "draft",
                "Only a reviewed draft can be published. Create a revision first.",
            )
            require(
                entry.generation.mode != "pending",
                "Wait for experience preparation or save a manual revision.",
            )
            current = entry.versions[-1]
            require(
                current.source.signature == source_signature(source_case),
                "Source changed. Create a new revision before publication.",
            )
            validate_content(current.content, current.source)
            entry.status = "published"
        elif command.action == "dispute":
            require(entry.status in ("draft", "published"), "This entry is already inactive.")
            entry.status = "disputed"
        else:
            require(entry.status != "archived", "This entry is already archived.")
            entry.status = "archived"
    entry.revision += 1
    event(entry, command.actor, command.reason)
    persist(session, entry, command.revision)
    return entry


def invalidate_source(session, case_id):
    record = session.scalar(
        select(KnowledgeRecord).where(KnowledgeRecord.source_case_id == case_id)
    )
    if record and record.status in ("draft", "published"):
        entry = KnowledgeEntry.model_validate(record.payload)
        if entry.versions[-1].source.signature == source_signature(
            load_source_case(session, case_id)
        ):
            return
        old = entry.revision
        entry.revision += 1
        entry.status = "disputed"
        event(entry, "system", "Source case changed; review a new version before reuse.")
        persist(session, entry, old)


def retrieve(session, case):
    snapshot = RetrievalSnapshot(
        library_revision=library_revision(session),
        retrieved_at=now(),
        explanation="No compatible published experience. Continue with current-case evidence.",
    )
    if not case.diagnosis_supported or not case.ranking:
        return snapshot
    query = conditions(case)
    ranked = []
    for record in session.scalars(
        select(KnowledgeRecord).where(KnowledgeRecord.status == "published")
    ):
        entry = KnowledgeEntry.model_validate(record.payload)
        version = entry.versions[-1]
        source = version.source
        if (
            source.case_id == case.investigation.id
            or source.process != case.investigation.process
            or source.simulated != case.investigation.simulated
            or source.recorded_at > case.investigation.reported_at
        ):
            continue
        current = load_source_case(session, source.case_id)
        if source.signature != source_signature(current):
            continue
        known = {
            key
            for key in query
            if query[key] != "unknown" and source.conditions.get(key, "unknown") != "unknown"
        }
        # Branch-specific questions absent in both cases are unknown, never evidence of similarity.
        if any(query[k] != source.conditions[k] for k in known):
            continue
        symptoms = [k for k in SYMPTOMS if k in known and query[k] == "true"]
        matching = [k for k in CONDITIONS if k in known]
        if not symptoms or not any(k != "frequency" for k in matching):
            continue
        unknown = [
            CONDITIONS[k]
            for k in CONDITIONS
            if k not in known
            and not (k == "intermittent" and query["frequency"] == "continuous")
            and not (k == "continuous" and query["frequency"] == "intermittent")
        ]
        unknown += ["Material batch / recipe", "Physical equipment instance"]
        match = PastExperience(
            knowledge_id=entry.id,
            version=version.version,
            citation=f"{entry.id}@v{version.version}",
            source_case_id=source.case_id,
            source_revision=source.revision,
            simulated=source.simulated,
            matched_conditions=[f"{k.replace('_', ' ').capitalize()}: {query[k]}" for k in symptoms]
            + [f"{CONDITIONS[k]}: {query[k]}" for k in matching],
            unknown_conditions=unknown,
            content=version.content.model_copy(deep=True),
            historical_action=source.action,
            source_refs=sorted(
                {
                    e.source_ref
                    for e in source.evidence
                    if e.id in version.content.supporting_evidence_ids
                }
            ),
        )
        group = source.fingerprint if source.simulated else source.case_id
        ranked.append(
            (len(symptoms) + len(matching), entry.events[-1].timestamp, entry.id, group, match)
        )
    seen = set()
    for _, _, _, group, match in sorted(ranked, key=lambda r: r[:3], reverse=True):
        if group in seen:
            continue
        seen.add(group)
        snapshot.matches.append(match)
        if len(snapshot.matches) == 3:
            break
    if snapshot.matches:
        lead = snapshot.matches[0]
        snapshot.suggested_check = CHECKS[lead.content.check_focus]
        snapshot.explanation = (
            f"Past experience {lead.citation}: {lead.content.finding.replace('_', ' ')}; "
            f"{lead.content.outcome.replace('_', ' ')}. "
            "This is historical context, not evidence of the current cause."
        )
    return snapshot


def ensure_library_unchanged(session, snapshot):
    if snapshot.retrieved_at:
        require(
            library_revision(session) == snapshot.library_revision,
            "Knowledge changed during diagnosis. Retry to use current published versions.",
        )


def citation_statuses(session, case):
    matches = [
        *case.past_experience.matches,
        *(m for s in case.diagnostic_history for m in s.past_experience.matches),
    ]
    results = {}
    for match in matches:
        record = session.get(KnowledgeRecord, match.knowledge_id)
        status, latest = "unavailable", None
        if record:
            entry = KnowledgeEntry.model_validate(record.payload)
            version = entry.versions[-1]
            latest = version.version
            source = load_source_case(session, entry.source_case_id)
            status = "superseded" if match.version != latest else entry.status
            if version.source.signature != source_signature(source):
                status = "source_changed"
        results[match.citation] = CitationStatus(
            citation=match.citation,
            current=status == "published",
            status=status,
            latest_version=latest,
        )
    return list(results.values())


def prepare_case_experience(session, case):
    """Atomic template draft on a factual case update; never publish automatically."""
    from flowpilot.knowledge.models import KnowledgeCreate

    if case.scenario_version != "2.0" or not any(
        e.key == "inspection" and e.verification_state == "verified"
        for e in case.investigation.evidence
    ):
        return
    record = session.scalar(
        select(KnowledgeRecord).where(KnowledgeRecord.source_case_id == case.investigation.id)
    )
    if record:
        entry = KnowledgeEntry.model_validate(record.payload)
        if entry.status == "archived" or entry.versions[-1].source.signature == source_signature(
            case
        ):
            return
        expected = entry.revision
        source = extract_source(case)
        entry.versions.append(
            KnowledgeVersion(
                version=entry.versions[-1].version + 1,
                created_at=now(),
                actor="system",
                reason="Source evidence updated; review required",
                source=source,
                content=default_content(source),
            )
        )
        entry.status = "draft"
    else:
        entry = create_entry(
            session,
            case.investigation.id,
            KnowledgeCreate(source_revision=case.revision, actor="system"),
        )
        expected = entry.revision
    entry.generation = draft_generation()
    entry.revision += 1
    event(entry, "system", "Experience prepared; technician review required")
    persist(session, entry, expected)
