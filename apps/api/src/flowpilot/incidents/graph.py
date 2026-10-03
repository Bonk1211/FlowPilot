"""Saved investigation turns. Layout belongs to the client; assessment belongs to diagnostic."""

from uuid import uuid4

from fastapi import HTTPException

from flowpilot.incidents import diagnostic
from flowpilot.incidents.decision import (
    DecisionOption,
    check_answer_readiness,
    choose_next_step,
)
from flowpilot.incidents.models import (
    AnswerChoice,
    IncidentObservation,
    InvestigationAnswer,
    InvestigationExpansion,
    InvestigationGeneration,
    InvestigationNode,
    InvestigationQuestion,
    InvestigationSelection,
)
from flowpilot.incidents.question_types import classify_question
from flowpilot.settings import Settings

# Bounded, record-only facts within the three existing mechanisms. No operating procedures.
FACTS = {
    "frequency": (
        "Is the defect progressive, intermittent, continuous or sudden?",
        ["progressive", "intermittent", "continuous", "sudden"],
        "Timing distinguishes a persistent change from variable delivery.",
    ),
    "material": (
        "Which material is identified in the available records?",
        ["flux", "other"],
        "Material identity limits which explanations are applicable; batch may remain unknown.",
    ),
    "coverage": (
        "What coverage do the available images show?",
        ["insufficient", "uniform"],
        "Establish the observed defect before interpreting its cause.",
    ),
    "recent_changes": (
        "What recent change is identified in the available records?",
        ["material_changed", "setup_changed", "maintenance_changed", "none"],
        "A recorded change suggests a comparison, not a confirmed cause.",
    ),
    "location": (
        "Where do the available records locate the defect?",
        ["dispense_area", "one_lane", "multiple_lanes"],
        "The affected extent helps judge whether records describe the same incident.",
    ),
    "pressure_trend": (
        "Do existing pressure records show stable or variable delivery?",
        ["stable", "unstable"],
        "Variable pressure raises delivery for review; sampled stability can miss transients.",
    ),
    "mass_trend": (
        "What mass trend is present in the existing records?",
        ["falling", "stable"],
        "Falling mass is compatible with all three mechanisms and does not identify a cause.",
    ),
    "material_condition": (
        "Do available material records identify a condition change?",
        ["changed", "unchanged"],
        "A material change warrants comparison with timing and coverage response.",
    ),
    "timing": (
        "Do existing records align the delivery change with the affected samples?",
        ["aligned", "not_aligned"],
        "Unaligned clocks or samples limit causal comparisons even when trends look similar.",
    ),
    "comparability": (
        "Are the available before/after records comparable in setup and conditions?",
        ["comparable", "not_comparable"],
        "Incomparable records cannot establish that a condition caused the coverage change.",
    ),
    "idle_history": (
        "Do existing records show an idle interval before the coverage change?",
        ["idle", "no_idle"],
        "An idle association leaves material condition open; association is not causation.",
    ),
}
FACT_HYPOTHESES = {
    "pressure_trend": ["unstable_delivery"],
    "material_condition": ["material_condition"],
    "idle_history": ["material_condition"],
    "mass_trend": ["restriction", "unstable_delivery", "material_condition"],
}
GRAPH_ACTIONS = {
    "answer_investigation",
    "confirm_investigation",
    "select_investigation",
    "retry_investigation",
}


def current_answers(incident):
    graph = incident.investigation
    replaced = {answer.supersedes_id for answer in graph.answers}
    valid = {node.id for node in graph.nodes if node.status != "superseded"}
    return [
        answer for answer in graph.answers if answer.id not in replaced and answer.node_id in valid
    ]


def excluded_observations(incident):
    current = {answer.id for answer in current_answers(incident)}
    return {
        answer.observation_id
        for answer in incident.investigation.answers
        if answer.id not in current
    }


def facts(incident):
    from flowpilot.incidents.service import active_evidence, active_observations

    values = {}
    for item in active_evidence(incident):
        if item.status == "collected":
            values.update({key: value for key, value in item.values.items() if value is not None})
    for item in active_observations(incident):
        values[item.check_id.removeprefix("question_")] = item.result
    return values


def question_for(fact, assessment):
    prompt, values, why = FACTS[fact]
    hypotheses = FACT_HYPOTHESES.get(fact, list(diagnostic.HYPOTHESES))
    return InvestigationQuestion(
        id=f"question_{fact}",
        target_fact=fact,
        prompt=prompt,
        why=why,
        choices=[
            AnswerChoice(
                value=value, label=value.replace("_", " ").capitalize(), interpretation=why
            )
            for value in values
        ]
        + [
            AnswerChoice(
                value="unknown",
                label="Unknown",
                interpretation="No fact is established. Seek other evidence or review.",
            )
        ],
        hypothesis_ids=hypotheses,
        component_ids=list(
            dict.fromkeys(
                component for key in hypotheses for component in diagnostic.HYPOTHESES[key][2]
            )
        ),
        source_refs=[source.id for source in assessment.sources if source.applicable][:3],
    )


def baseline_candidates(incident):
    from flowpilot.incidents.service import active_evidence

    assessment = incident.assessment
    step = assessment.next_step
    terminal = InvestigationQuestion(
        id=step.id,
        kind=step.kind,
        target_fact=step.id,
        prompt=step.title,
        why=step.reason,
        evidence_ids=step.evidence_ids,
    )
    if step.kind in {"review", "escalate"} or incident.escalated:
        if incident.escalated:
            terminal = InvestigationQuestion(
                id="engineer_review",
                kind="review",
                target_fact="engineer_review",
                prompt="Review the investigation with engineering",
                why="Engineer review was explicitly requested; unresolved causes remain open.",
            )
        return [terminal]
    known = facts(incident)
    missing = [key for key, _, _ in diagnostic.DISCOVERY if key not in known]
    order = (["frequency"] if "frequency" in missing else []) + missing
    # A recorded timing answer opens a useful record question beyond the five discovery fields.
    answered = current_answers(incident)
    if answered:
        last = answered[-1]
        parent = next(node for node in incident.investigation.nodes if node.id == last.node_id)
        if parent.target_fact == "frequency":
            preferred = {"intermittent": "pressure_trend", "sudden": "material_condition"}.get(
                last.confirmed_value, "mass_trend"
            )
            order = [preferred, "comparability"] + order
    candidates = [question_for(key, assessment) for key in dict.fromkeys(order) if key not in known]
    for check in sorted(
        assessment.checks,
        key=lambda item: (
            item.id != step.id,
            next(h.rank for h in assessment.hypotheses if h.id == item.hypothesis_id),
        ),
    ):
        if check.eligible and incident.mode != "live" and check.id not in known:
            candidates.append(
                InvestigationQuestion(
                    id=check.id,
                    kind="check",
                    target_fact=check.id,
                    prompt=check.title,
                    why=check.purpose,
                    choices=[
                        AnswerChoice(
                            value=item.value, label=item.label, interpretation=item.interpretation
                        )
                        for item in check.expected_outcomes
                    ]
                    + [
                        AnswerChoice(
                            value="unknown",
                            label="Unknown",
                            interpretation="No result is established; seek other evidence.",
                        )
                    ],
                    hypothesis_ids=[check.hypothesis_id],
                    component_ids=diagnostic.HYPOTHESES[check.hypothesis_id][2],
                    source_refs=check.source_refs,
                )
            )
    review = InvestigationQuestion(
        id="inconclusive_review",
        kind="escalate",
        target_fact="inconclusive_review",
        prompt="Escalate the unresolved investigation",
        why="Request engineering review with the remaining causes and missing evidence.",
    )
    references = [item.id for item in active_evidence(incident) if item.status == "collected"][:100]
    for candidate in candidates:
        candidate.evidence_ids = references
    return candidates + [review]


def eligible(incident, node, correcting=False):
    if not diagnostic.is_s932(incident.configuration) or incident.escalated:
        return node.kind in {"review", "escalate"}
    if node.kind in {"review", "escalate"}:
        return True
    if node.kind == "check" and incident.mode == "live":
        return False
    known = facts(incident)
    if not correcting and not node.clarification_for and node.target_fact in known:
        return False
    return all(
        key in known and str(known[key]).casefold() not in diagnostic.UNKNOWN
        for key in node.prerequisites
    )


def merge_candidates(baseline, generated, preferred):
    catalogue = {item.target_fact: item for item in generated}
    for candidate in baseline:
        catalogue.setdefault(candidate.target_fact, candidate)
    preferred_fact = next((item.target_fact for item in generated if item.id == preferred), None)
    fallback = catalogue[baseline[0].target_fact]
    candidates = [fallback, *(item for item in catalogue.values() if item.id != fallback.id)]
    return candidates, catalogue[preferred_fact].id if preferred_fact else None


def supersede_after(incident, node_id):
    graph = incident.investigation
    descendants = {node_id}
    cutoff = next(
        (
            answer.recorded_revision
            for answer in reversed(current_answers(incident))
            if answer.node_id == node_id
        ),
        incident.revision,
    )
    for node in graph.nodes:
        # Later sibling branches also consumed this answer's evidence snapshot.
        if node.id != node_id and (node.parent_id in descendants or node.source_revision >= cutoff):
            descendants.add(node.id)
            node.status = "superseded"
    for expansion in graph.expansions:
        if any(child in descendants - {node_id} for child in expansion.child_ids):
            expansion.superseded = True
    if graph.active_node_id in descendants:
        graph.active_node_id = None


def invalidate_evidence(incident):
    """Retain history without reusing questions or answers tied to replaced/expired records."""
    from flowpilot.incidents.service import active_evidence, active_observations

    evidence_ids = {item.id for item in active_evidence(incident) if item.status == "collected"}
    observations = {item.id for item in active_observations(incident)}
    stale_answers = {
        answer.node_id
        for answer in current_answers(incident)
        if answer.observation_id and answer.observation_id not in observations
    }
    for node in incident.investigation.nodes:
        if node.status != "superseded" and (
            not set(node.evidence_ids) <= evidence_ids | observations or node.id in stale_answers
        ):
            supersede_after(incident, node.id)
            node.status = "superseded"
            for expansion in incident.investigation.expansions:
                if node.id in expansion.child_ids:
                    expansion.superseded = True


def confirm_value(incident, node, answer, value):
    from flowpilot.incidents.service import active_evidence, now

    if value not in {choice.value for choice in node.choices}:
        raise HTTPException(422, "Use a value from the saved question definition.")
    answer.confirmed_value = value
    answer.confirmed_at = now()
    answer.status = "unknown" if value == "unknown" else "confirmed"
    answer.observation_id = f"OBS-{uuid4().hex[:12]}"
    evidence_ids = [item.id for item in active_evidence(incident) if item.status == "collected"]
    incident.observations.append(
        IncidentObservation(
            id=answer.observation_id,
            check_id=node.target_fact if node.kind == "check" else f"question_{node.target_fact}",
            result="inconclusive" if value == "unknown" and node.kind == "check" else value,
            notes=answer.notes,
            evidence_ids=evidence_ids,
            synthetic=incident.mode != "live",
            author=answer.author,
            recorded_at=answer.confirmed_at,
        )
    )


def apply_graph_action(incident, action, actor):
    from flowpilot.incidents.service import digest, now

    graph = incident.investigation
    if incident.status == "closed":
        raise HTTPException(
            409, "Reopen the incident with evidence before continuing the investigation."
        )
    if len(graph.answers) >= 500 or len(graph.nodes) >= 1500:
        raise HTTPException(
            422, "Investigation history limit reached; retain this incident for review."
        )
    if action.action == "retry_investigation":
        graph.input_version += 1
        graph.retry_requested = True
        return
    if action.action == "confirm_investigation":
        from flowpilot.incidents.coordinator import input_fingerprint

        answer = next(
            (item for item in current_answers(incident) if item.id == action.answer_id), None
        )
        if answer is None or answer.status not in {"pending", "clarification"}:
            raise HTTPException(409, "This answer is no longer awaiting confirmation.")
        node = next(item for item in graph.nodes if item.id == answer.node_id)
        if (
            answer.interpretation_run is None
            or answer.interpretation_run.input_fingerprint != input_fingerprint(incident)
        ):
            raise HTTPException(
                409, "The interpretation is stale; recheck it against current inputs."
            )
        if (
            answer.proposed is None
            or action.value != answer.proposed.value
            or answer.status != "pending"
            or answer.proposed.ambiguities
            or answer.readiness is None
            or answer.readiness.selected_id != "ready"
        ):
            raise HTTPException(
                422, "Confirm the proposed meaning or answer the clarification question."
            )
        supersede_after(incident, node.id)
        confirm_value(incident, node, answer, action.value)
    else:
        node = next((item for item in graph.nodes if item.id == action.node_id), None)
        if node is None or node.status in {"blocked", "superseded"}:
            raise HTTPException(409, "Choose a current eligible investigation node.")
        if action.action == "select_investigation":
            if incident.assessment is None:
                raise HTTPException(
                    409, "Wait for the current assessment before selecting a branch."
                )
            if node.status not in {"proposed", "active"} or not eligible(incident, node):
                raise HTTPException(409, "This branch is no longer eligible.")
            if any(
                item.status in {"pending", "clarification"}
                and not any(
                    current.clarification_for == item.id and current.status == "answered"
                    for current in graph.nodes
                )
                and node.clarification_for != item.id
                for item in current_answers(incident)
            ):
                raise HTTPException(409, "Resolve the pending answer before switching branches.")
            activate(incident, node)
            graph.selections.append(
                InvestigationSelection(node_id=node.id, revision=incident.revision, timestamp=now())
            )
        else:
            previous = next(
                (item for item in reversed(current_answers(incident)) if item.node_id == node.id),
                None,
            )
            if action.supersedes_id:
                if previous is None or previous.id != action.supersedes_id:
                    raise HTTPException(
                        409, "Correct the current answer; earlier answers remain in history."
                    )
                supersede_after(incident, node.id)
            elif graph.active_node_id != node.id or node.status != "active" or previous:
                raise HTTPException(
                    409, "Answer the active node, or explicitly correct an earlier answer."
                )
            if node.kind not in {"question", "check"} or not eligible(
                incident, node, correcting=bool(previous)
            ):
                raise HTTPException(
                    422, "This question is no longer applicable to the current evidence."
                )
            if action.choice and action.choice not in {choice.value for choice in node.choices}:
                raise HTTPException(422, "Choose a saved answer option.")
            answer = InvestigationAnswer(
                id=action.answer_id,
                node_id=node.id,
                choice=action.choice,
                text=action.text,
                notes=action.notes,
                recorded_at=now(),
                recorded_revision=incident.revision,
                supersedes_id=action.supersedes_id,
                author=actor,
                request_fingerprint=digest(action.model_dump(exclude={"revision"})),
            )
            graph.answers.append(answer)
            if action.choice == "unknown" or (
                action.choice and not (action.text.strip() or action.notes.strip())
            ):
                confirm_value(incident, node, answer, action.choice)
            node.status = "answered"
            graph.active_node_id = None
    graph.input_version += 1


def activate(incident, selected):
    graph = incident.investigation
    for node in graph.nodes:
        if node.status == "active":
            node.status = "proposed"
    graph.active_node_id = selected.id if selected.kind in {"question", "check"} else None
    selected.status = "active" if graph.active_node_id else "proposed"
    set_next_step(incident, selected)


def set_next_step(incident, node):
    incident.assessment.next_step = diagnostic.DiagnosticNextStep(
        id=node.id,
        kind=node.kind,
        title=node.prompt,
        reason=node.why,
        evidence_ids=node.evidence_ids,
    )
    if node.kind in {"review", "escalate"}:
        incident.assessment.status = "review_required"
    expansion = next(
        (
            item
            for item in reversed(incident.investigation.expansions)
            if node.id in item.child_ids and not item.superseded
        ),
        None,
    )
    if expansion and expansion.decision:
        run = expansion.decision
        incident.assessment.decision = run
        incident.assessment.provider = run.provider
        incident.assessment.provider_status = run.reason
        incident.assessment.fallback = run.provider != "jev"
        if node.id != expansion.recommended_id:
            incident.assessment.provider = "deterministic"
            incident.assessment.provider_status = (
                "Technician selected this eligible branch; the recommendation remains in history."
            )


def append_expansion(
    incident,
    candidates,
    parent,
    generation,
    selected_id=None,
    decision=None,
    clarification_for=None,
):
    from flowpilot.incidents.service import digest

    graph = incident.investigation
    selected_id = selected_id or candidates[0].id
    selected = next(item for item in candidates if item.id == selected_id)
    # Retain the selected option and the baseline before other useful alternatives.
    kept = list({item.id: item for item in [selected, candidates[0], *candidates]}.values())[:3]
    if parent is None:
        kept = [selected]
    expansion_id = (
        "EXP-"
        + digest([generation.input_fingerprint, parent.id if parent else None, clarification_for])[
            :20
        ]
    )
    if any(item.id == expansion_id and not item.superseded for item in graph.expansions):
        return []
    child_ids = []
    recommended = None
    for candidate in kept:
        node_id = "NODE-" + digest([expansion_id, candidate.id])[:20]
        existing = next(
            (
                node
                for node in graph.nodes
                if node.parent_answer_id == (parent.id if parent else None)
                and node.target_fact == candidate.target_fact
                and not any(answer.node_id == node.id for answer in graph.answers)
            ),
            None,
        )
        if existing:
            node_id = existing.id
        node = InvestigationNode(
            **candidate.model_dump(exclude={"id"}),
            id=node_id,
            parent_id=parent.node_id if parent else None,
            parent_answer_id=parent.id if parent else None,
            source_revision=generation.input_revision,
            source_versions={
                source.id: f"{source.revision}; {source.approval_status}"
                for source in incident.assessment.sources
                if source.id in candidate.source_refs
            },
            clarification_for=clarification_for,
        )
        if parent and not clarification_for:
            node.why = (
                f"After the recorded answer ‘{(parent.confirmed_value or 'Unknown')[:100]}’: "
                + node.why
            )
        if existing:
            graph.nodes[graph.nodes.index(existing)] = node
        else:
            graph.nodes.append(node)
        child_ids.append(node_id)
        if candidate.id == selected_id:
            recommended = node
    activate(incident, recommended)
    graph.expansions.append(
        InvestigationExpansion(
            id=expansion_id,
            parent_answer_id=parent.id if parent else None,
            child_ids=child_ids,
            recommended_id=recommended.id,
            generation=generation,
            decision=decision,
        )
    )
    return [node for node in graph.nodes if node.id in child_ids]


async def advance(incident, fingerprint, settings=None, generate=None, client=None, selector=None):
    """One immediate expansion per turn; callers commit only against the same input fingerprint."""
    graph = incident.investigation
    settings = settings or Settings()
    selector = selector or settings.incident_question_selector
    if selector == "auto":
        selector = "jev" if settings.incident_jev_enabled else "gemini"
    generation = InvestigationGeneration(
        input_fingerprint=fingerprint, input_revision=incident.revision
    )
    answered_nodes = {
        answer.node_id
        for answer in current_answers(incident)
        if answer.status in {"confirmed", "unknown"}
    }
    clarified = {node.clarification_for for node in graph.nodes if node.id in answered_nodes}
    pending = next(
        (
            answer
            for answer in reversed(current_answers(incident))
            if answer.status in {"pending", "clarification"} and answer.id not in clarified
        ),
        None,
    )
    if pending:
        parent = next(node for node in graph.nodes if node.id == pending.node_id)
        if (
            pending.interpretation_run is None
            or pending.interpretation_run.input_fingerprint != fingerprint
        ):
            interpretation, run = await diagnostic.interpret_answer(
                incident, parent, pending, fingerprint, generate, settings
            )
            pending.proposed, pending.interpretation_run = interpretation, run
            pending.readiness = None
            pending.status = "clarification"
            if interpretation is not None and not interpretation.ambiguities:
                pending.readiness = await check_answer_readiness(
                    {
                        "question": parent.model_dump(mode="json"),
                        "original_answer": {
                            "choice": pending.choice,
                            "text": pending.text,
                            "notes": pending.notes,
                        },
                        "proposed": interpretation.model_dump(mode="json"),
                    },
                    settings,
                    client=client,
                )
                if pending.readiness.selected_id == "ready":
                    pending.status = "pending"
        if pending.status == "pending":
            supersede_after(incident, parent.id)
            incident.assessment.next_step = diagnostic.DiagnosticNextStep(
                id=f"confirm_{pending.id}",
                kind="question",
                title="Confirm the saved answer's meaning",
                reason=(
                    "The proposed interpretation has not changed the assessment. "
                    "Technician confirmation is required."
                ),
            )
            graph.retry_requested = False
            return  # Human confirmation is a new revision, never a worker wait.
        if not any(
            node.clarification_for == pending.id and node.status != "superseded"
            for node in graph.nodes
        ):
            candidate = InvestigationQuestion.model_validate(
                parent.model_dump(include=set(InvestigationQuestion.model_fields))
            )
            candidate.id = f"clarify_{parent.target_fact}"
            candidate.prompt = f"Clarify the saved answer: {parent.prompt}"[:500]
            candidate.why = (
                "The original text is saved but has not changed the assessment. "
                "Choose the intended meaning, or Unknown."
            )
            append_expansion(
                incident, [candidate], pending, generation, clarification_for=pending.id
            )
        clarification = next(
            (node for node in graph.nodes if node.id == graph.active_node_id), None
        )
        if clarification:
            set_next_step(incident, clarification)
        graph.retry_requested = False
        return
    mandatory_stop = (
        incident.assessment.next_step.kind in {"review", "escalate"} or incident.escalated
    )
    for node in graph.nodes:
        if node.status in {"active", "proposed"} and (
            not eligible(incident, node) or (mandatory_stop and node.kind in {"question", "check"})
        ):
            node.status = "blocked"
            node.blocked_reason = (
                "Current evidence, configuration or required review makes this step ineligible."
            )
            if graph.active_node_id == node.id:
                graph.active_node_id = None
    active = next((node for node in graph.nodes if node.id == graph.active_node_id), None)
    manually_selected = bool(
        active and graph.selections and graph.selections[-1].node_id == active.id
    )
    if active and (not graph.retry_requested or manually_selected):
        set_next_step(incident, active)
        graph.retry_requested = False
        return
    if graph.selections:
        selection = graph.selections[-1]
        selected = next(node for node in graph.nodes if node.id == selection.node_id)
        if selected.kind in {"review", "escalate"} and selected.status == "proposed":
            set_next_step(incident, selected)
            graph.retry_requested = False
            return
    if (
        graph.expansions
        and graph.expansions[-1].generation.input_fingerprint == fingerprint
        and not graph.expansions[-1].superseded
    ):
        recommended = next(
            node for node in graph.nodes if node.id == graph.expansions[-1].recommended_id
        )
        set_next_step(incident, recommended)
        return
    answers = current_answers(incident)
    parent = answers[-1] if answers else None
    if graph.retry_requested:
        for expansion in graph.expansions:
            if expansion.parent_answer_id == (parent.id if parent else None):
                expansion.superseded = True
                for node in graph.nodes:
                    if node.id in expansion.child_ids and node.status in {"active", "proposed"}:
                        node.status = "superseded"
        graph.active_node_id = None
    candidates = baseline_candidates(incident)
    preferred = None
    generated = []
    if len(candidates) > 1:
        generated, preferred, generation = await diagnostic.generate_questions(
            incident, candidates[0], fingerprint, generate, settings
        )
        candidates, preferred = merge_candidates(candidates, generated, preferred)
    from flowpilot.incidents.service import active_evidence, active_observations

    evidence = [item.model_dump(mode="json") for item in active_evidence(incident)]
    observations = [item.model_dump(mode="json") for item in active_observations(incident)]
    allowed = diagnostic.external_data_allowed(evidence, observations, settings)
    run = await choose_next_step(
        {
            "configuration": incident.configuration,
            "confirmed_facts": facts(incident),
            "hypotheses": [item.model_dump(mode="json") for item in incident.assessment.hypotheses],
            "candidates": [item.model_dump(mode="json") for item in candidates],
            "gemini_preferred_id": preferred,
        },
        [
            DecisionOption(
                id=item.id,
                kind=item.kind,
                description=(item.prompt + " " + item.why)[:1500],
                eligible=True,
            )
            for item in candidates
        ],
        candidates[0].id,
        api_key=settings.jev_key
        if allowed and settings.incident_jev_enabled and selector == "jev"
        else None,
        gateway=settings.jev_gateway,
        model=settings.jev_model,
        timeout_seconds=settings.jev_timeout_seconds,
        min_probability=settings.jev_min_probability,
        client=client,
    )
    selected_id = run.selected_id
    if selector == "gemini" and preferred in {item.id for item in candidates}:
        selected_id = preferred
        run.provider, run.status = "gemini", "selected"
        run.gateway, run.adapter_version = "gemini", "s932-gemini-questions-2"
        run.requested_model = generation.model or settings.incident_question_model
        run.model_version = generation.model_version
        run.request, run.input_sha256 = None, generation.input_fingerprint
        run.minimum_probability = 0
        run.reason = "Gemini selected a validated, grounded question from the eligible candidates."
        run.limitation = "Question selection is advisory; it does not establish a machine fault."
        run.selected_id = preferred
    elif selector == "gemini":
        run.reason = (
            generation.fallback_reason or "No validated Gemini preference; baseline retained."
        )
    elif selector == "baseline":
        run.reason = "Deterministic next-step selection is configured."
    added = append_expansion(incident, candidates, parent, generation, selected_id, run)
    for node in added:
        if any(
            node.target_fact == item.target_fact and node.prompt == item.prompt
            for item in generated
        ):
            node.classification = await classify_question(
                node, settings, allowed and selector != "gemini", client
            )
            node.question_type = node.classification.selected_id
    graph.retry_requested = False
    if graph.nodes:
        set_next_step(
            incident,
            next(node for node in graph.nodes if node.id == graph.expansions[-1].recommended_id),
        )


def report_lines(incident):
    import json

    graph = incident.investigation
    if not graph.nodes:
        return []
    lines = [
        "",
        "## Saved investigation path",
        "",
        f"Graph: {graph.version}; active question: {graph.active_node_id or 'none / review'}. ",
    ]
    for node in graph.nodes:
        lines.extend(
            [
                f"- **{node.id} — {node.status}**: {node.prompt}",
                f"  Parent: {node.parent_id or 'root'}; answer: {node.parent_answer_id or 'none'}; "
                f"source incident revision: {node.source_revision}.",
                f"  Why: {node.why}",
                f"  Question type: {node.question_type}; target fact: {node.target_fact}; "
                f"evidence: {', '.join(node.evidence_ids) or 'none'}.",
                "  Source versions: " + json.dumps(node.source_versions, ensure_ascii=False),
            ]
        )
        for answer in (item for item in graph.answers if item.node_id == node.id):
            lines.extend(
                [
                    f"  Answer {answer.id} ({answer.status}) at {answer.recorded_at}; "
                    f"author: {answer.author}.",
                    f"  Original choice: {answer.choice or 'none'}; "
                    f"original text: {answer.text}; notes: {answer.notes}",
                    f"  Confirmed meaning: {answer.confirmed_value or 'not confirmed'}; "
                    f"observation: {answer.observation_id or 'none'}; "
                    f"supersedes: {answer.supersedes_id or 'none'}.",
                ]
            )
            if answer.proposed:
                lines.append(
                    "  Proposed interpretation (not an independent fact): "
                    + answer.proposed.model_dump_json()
                )
            if answer.interpretation_run:
                lines.append(
                    "  Interpretation provenance: " + answer.interpretation_run.model_dump_json()
                )
            if answer.readiness:
                lines.append(
                    "  Answer-readiness decision: "
                    + answer.readiness.model_dump_json(exclude={"request"})
                )
    for expansion in graph.expansions:
        lines.extend(
            [
                f"- Expansion {expansion.id}; recommended: {expansion.recommended_id}; "
                f"superseded: {expansion.superseded}.",
                "  Generation provenance: " + expansion.generation.model_dump_json(),
            ]
        )
        if expansion.decision:
            lines.append(
                "  Next-step decision (not a fault probability): "
                + expansion.decision.model_dump_json(exclude={"request"})
            )
    lines.extend(
        f"- Technician selected {item.node_id} at revision {item.revision} ({item.timestamp})."
        for item in graph.selections
    )
    if incident.assessment:
        lines.extend(
            [
                "",
                "Unresolved at this revision:",
                *[f"- {item}" for item in incident.assessment.unresolved],
            ]
        )
    return lines
