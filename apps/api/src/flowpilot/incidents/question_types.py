"""Question purpose, separate from flowchart shape, workflow status and fault certainty."""

from typing import Literal

from flowpilot.incidents.decision import DecisionOption, choose_next_step

QuestionType = Literal[
    "what",
    "where",
    "when",
    "which",
    "why_impact",
    "how_detected",
    "how_many",
    "why_cause",
    "verification",
    "unclassified",
]

QUESTION_TYPES = {
    "what": "What: describe the observed defect, symptom, condition or change.",
    "where": "Where: locate the defect on the machine, lane, area or product.",
    "when": "When: onset, frequency, duration, sequence, idle intervals or time alignment.",
    "which": "Who/Which: identify the person, tool, product, recipe, material or component.",
    "why_impact": "Why it matters: consequences, severity or impact. Not the cause of a failure.",
    "how_detected": "How detected: the inspection, method or signal that revealed the problem.",
    "how_many": "How many/much: affected quantity, extent, measured amount or magnitude.",
    "why_cause": "5 Whys: ask WHY a physical, occurrence, escape or systemic cause arose.",
    "verification": (
        "Hypothesis test: verify a proposed explanation or the comparability of evidence."
    ),
    "unclassified": "Unclassified: no single purpose fits, or the prompt is too ambiguous.",
}

FACT_QUESTION_TYPES: dict[str, QuestionType] = {
    "recipe_change": "what",
    "controller_events": "what",
    "frequency": "when",
    "material": "which",
    "coverage": "what",
    "recent_changes": "what",
    "location": "where",
    "pressure_trend": "what",
    "mass_trend": "how_many",
    "material_condition": "what",
    "timing": "when",
    "comparability": "verification",
    "idle_history": "when",
}


def default_question_type(kind, target_fact) -> QuestionType:
    if kind == "check":
        return "verification"
    return (
        FACT_QUESTION_TYPES.get(target_fact, "unclassified")
        if kind == "question"
        else "unclassified"
    )


async def classify_question(question, settings, allowed=True, client=None):
    """Only classify purpose; never change the question, answer, branch or assessment."""
    return await choose_next_step(
        {"prompt": question.prompt, "target_fact": question.target_fact},
        [
            DecisionOption(id=key, kind="classification", description=description, eligible=True)
            for key, description in QUESTION_TYPES.items()
        ],
        default_question_type(question.kind, question.target_fact),
        api_key=settings.jev_key if settings.incident_jev_enabled and allowed else None,
        gateway=settings.jev_gateway,
        model=settings.jev_model,
        timeout_seconds=settings.jev_timeout_seconds,
        min_probability=settings.jev_min_probability,
        client=client,
        task="question_type",
    )
