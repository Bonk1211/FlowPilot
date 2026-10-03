"""Synthetic graph replay + optional live generation/selection. Never writes the incident DB.

uv run python scripts/evaluate-investigation.py --output /tmp/s932-evaluation.json
Add --live to call configured providers with the same synthetic context and catalogue.
"""

import argparse
import asyncio
import json
from pathlib import Path
from time import perf_counter

from flowpilot.incidents import coordinator, diagnostic, graph, service
from flowpilot.incidents.decision import DecisionOption, choose_next_step
from flowpilot.incidents.models import AnswerInvestigationAction, HandoffDraft, Incident
from flowpilot.incidents.replay import replay_arrivals, replay_request
from flowpilot.settings import ROOT, Settings


def assess(incident):
    incident.assessment = diagnostic.analyze(
        [item.model_dump(mode="json") for item in service.active_evidence(incident)],
        [item.model_dump(mode="json") for item in service.active_observations(incident)],
        incident.configuration,
    )


def example(scenario):
    request = replay_request(f"evaluation-{scenario['id']}")
    timestamp = "2026-10-03T00:00:00+00:00"
    incident = Incident(
        id="INC-000000000001",
        trigger_id=request.trigger_id,
        trigger_fingerprint=service.digest(request.model_dump(mode="json")),
        trigger_origin="replay",
        trigger_time=timestamp,
        tool_id=request.tool_id,
        configuration=request.configuration,
        symptom=request.symptom,
        mode="replay",
        created_at=timestamp,
        updated_at=timestamp,
        status="investigating",
        handoff=HandoffDraft(
            subject="Synthetic evaluation",
            body="",
            version=1,
            source_revision=0,
            created_at=timestamp,
        ),
        evidence=[service.evidence_record(item) for item in request.evidence],
    )
    if scenario["arrivals"]:
        incident.evidence = [item for item in incident.evidence if item.id != "machine-log-pending"]
        incident.evidence.extend(service.evidence_record(item) for item in replay_arrivals())
    return incident


async def evaluate(live):
    fixture = json.loads((ROOT / "fixtures/s932-investigation-evaluation.json").read_text())
    offline = Settings(reasoning_enabled=False, incident_jev_enabled=False)
    settings = Settings()
    rows = []
    exported_example = None
    for scenario in fixture["scenarios"]:
        incident = example(scenario)
        assess(incident)
        await graph.advance(incident, coordinator.input_fingerprint(incident), offline)
        node_id = incident.investigation.active_node_id
        service.apply_action(
            incident,
            AnswerInvestigationAction(
                action="answer_investigation",
                revision=0,
                answer_id=f"ANS-{scenario['id']}",
                node_id=node_id,
                choice=scenario["answer"],
            ),
            "synthetic-evaluation",
        )
        assess(incident)
        fingerprint = coordinator.input_fingerprint(incident)
        baseline = graph.baseline_candidates(incident)
        start = perf_counter()
        await graph.advance(incident, fingerprint, offline)
        chosen = next(
            item
            for item in incident.investigation.nodes
            if item.id == incident.investigation.expansions[-1].recommended_id
        )
        if scenario["id"] == "intermittent":
            exported_example = incident.investigation.model_dump(mode="json")
        row = {
            "scenario": scenario["id"],
            "expected_baseline": scenario["expected_next"],
            "baseline": chosen.target_fact,
            "baseline_matches": chosen.target_fact == scenario["expected_next"],
            "offline_seconds": round(perf_counter() - start, 4),
            "gemini_generation": {
                "status": "not_run",
                "reason": "Use --live for configured providers.",
            },
            "gemini_only_selection": {"status": "not_run"},
            "gemini_jev_selection": {
                "status": "not_run",
                "reason": "Live evaluation deferred; enable Jev and use --live when ready.",
            },
        }
        if live and baseline[0].kind not in {"review", "escalate"}:
            start = perf_counter()
            # The expected_next field is deliberately absent from this provider input.
            generated, preferred, run = await diagnostic.generate_questions(
                incident, baseline[0], fingerprint, settings=settings
            )
            catalogue, preferred = graph.merge_candidates(baseline, generated, preferred)
            row["gemini_generation"] = {
                **run.model_dump(mode="json"),
                "seconds": round(perf_counter() - start, 3),
                "accepted_count": len(generated),
                "candidates": [item.model_dump(mode="json") for item in generated],
                "source_support_review": "not_run; technician/domain review required",
            }
            row["selection_catalogue"] = [item.model_dump(mode="json") for item in catalogue]
            row["gemini_only_selection"] = {
                "status": "selected" if preferred else "not_run",
                "selected_id": preferred,
                "baseline_id": baseline[0].id,
            }
            if settings.incident_jev_enabled and settings.jev_key:
                decision = await choose_next_step(
                    {
                        "confirmed_facts": graph.facts(incident),
                        "candidates": row["selection_catalogue"],
                        "hypotheses": [
                            item.model_dump(mode="json") for item in incident.assessment.hypotheses
                        ],
                    },
                    [
                        DecisionOption(
                            id=item.id,
                            kind=item.kind,
                            description=(item.prompt + " " + item.why)[:1500],
                            eligible=True,
                        )
                        for item in catalogue
                    ],
                    baseline[0].id,
                    api_key=settings.jev_key,
                    gateway=settings.jev_gateway,
                    model=settings.jev_model,
                    timeout_seconds=settings.jev_timeout_seconds,
                    min_probability=settings.jev_min_probability,
                )
                row["gemini_jev_selection"] = decision.model_dump(mode="json", exclude={"request"})
        elif live:
            row["gemini_generation"] = {
                "status": "not_needed",
                "reason": "Required review stop; providers cannot override it.",
            }
        rows.append(row)
    return {
        "fixture": fixture["version"],
        "limitation": fixture["limitation"],
        "live_requested": live,
        "technician_review": "not_run; no reviewers supplied",
        "comparative_benefit_established": False,
        "scenarios": rows,
        "contract_example": exported_example,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--live", action="store_true")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    result = asyncio.run(evaluate(args.live))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + "\n")
    passed = sum(item["baseline_matches"] for item in result["scenarios"])
    print(f"Baseline expectations: {passed}/{len(result['scenarios'])}; output: {args.output}")
    raise SystemExit(0 if passed == len(result["scenarios"]) else 1)
