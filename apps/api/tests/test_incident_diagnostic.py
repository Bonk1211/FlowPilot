import asyncio
from pathlib import Path

from flowpilot.incidents.diagnostic import SOURCE_SEEDS, analyze, enrich_assessment, search_sources
from flowpilot.settings import Settings


def evidence(**values):
    return [
        {
            "id": "context-1",
            "synthetic": True,
            "status": "collected",
            "values": {
                "material": "Synthetic material A",
                "coverage": "progressively insufficient",
                "frequency": "progressive",
                "recent_changes": "container changed",
                "location": "S932 lane A",
                "mass_trend": "falling",
                **values,
            },
        }
    ]


def result(check_id, outcome, **overrides):
    return {
        "id": f"{check_id}-{outcome}",
        "check_id": check_id,
        "result": outcome,
        "synthetic": True,
        "evidence_ids": ["context-1"],
        **overrides,
    }


def test_opposite_replay_results_change_rank_and_next_step():
    before = analyze(evidence(), [], "S932 / DJ-2200 / BFS")
    assert before.next_step.id == "delivery_review"
    assert all(item.status == "possible" for item in before.hypotheses)
    positive = analyze(evidence(), [result("delivery_review", "supported")], "S932")
    negative = analyze(evidence(), [result("delivery_review", "contradicted")], "S932")
    assert positive.hypotheses[0].id == "unstable_delivery"
    assert positive.hypotheses[0].status == "supported"
    assert positive.next_step.kind == "review"
    assert negative.next_step.id == "restriction_review"
    assert negative.hypotheses[-1].id == "unstable_delivery"
    assert negative.hypotheses[-1].conflicting_evidence[0].evidence_id.endswith("contradicted")
    assert positive.fallback and positive.provider == "deterministic"


def test_inconclusive_and_conflicting_results_do_not_confirm_a_cause():
    outcomes = [
        result(check, "inconclusive")
        for check in ("delivery_review", "restriction_review", "material_review")
    ]
    assessment = analyze(evidence(), outcomes, "S932")
    assert assessment.next_step.id == "inconclusive_review"
    assert all(item.status == "inconclusive" for item in assessment.hypotheses)
    contradictory = analyze(
        evidence(),
        [result("delivery_review", "supported"), result("delivery_review", "contradicted")],
        "S932",
    )
    delivery = next(item for item in contradictory.hypotheses if item.id == "unstable_delivery")
    assert delivery.status == "inconclusive"
    assert delivery.supporting_evidence and delivery.conflicting_evidence
    assert contradictory.next_step.id == "restriction_review"


def test_unknown_answers_advance_without_fabricating_measurements():
    first = analyze([], [], "S932")
    assert first.next_step.id == "question_material"
    unknown = result("question_material", "unknown", evidence_ids=[])
    second = analyze([], [unknown], "S932")
    assert second.discovery[0].status == "unknown"
    assert second.next_step.id == "question_coverage"
    assert not any(item.supporting_evidence for item in second.hypotheses)
    assert second.hypotheses[0].why_chain[-1].status == "unsupported"


def test_source_authority_configuration_and_physical_result_gates():
    sources = search_sources("pressure", "S932")
    assert sources and all(item.applicable and not item.operational_allowed for item in sources)
    assert all(item.approval_status == "unverified" for item in sources)
    wrong = analyze(evidence(), [result("delivery_review", "supported")], "TCB bonder")
    assert wrong.next_step.id == "configuration_review"
    assert all(not item.eligible for item in wrong.checks)
    assert all(not item.applicable for item in wrong.sources)
    physical = analyze(
        evidence(), [result("delivery_review", "supported", synthetic=False)], "S932"
    )
    assert physical.warnings and not any(item.status == "supported" for item in physical.hypotheses)
    forged = analyze(
        evidence(), [result("delivery_review", "supported", evidence_ids=["invented"])], "S932"
    )
    assert forged.warnings and forged.next_step.id == "delivery_review"


def test_unavailable_measurements_are_not_normal_and_known_fields_are_prefilled():
    records = evidence()
    records.append(
        {"id": "missing-log", "status": "unavailable", "values": {"pressure_trend": "stable"}}
    )
    assessment = analyze(records, [], "S932")
    assert all(item.status == "prefilled" for item in assessment.discovery)
    assert all(not item.conflicting_evidence for item in assessment.hypotheses)
    assert all(item.missing_evidence for item in assessment.hypotheses)


def test_mini_experiments_are_suggested_comparisons_and_survive_saved_snapshots():
    from flowpilot.incidents.diagnostic import DiagnosticAssessment

    assessment = analyze(evidence(), [], "S932")
    restored = DiagnosticAssessment.model_validate_json(assessment.model_dump_json())
    assert len(restored.checks) == 3
    for check in restored.checks:
        plan = check.mini_experiment
        assert plan.baseline and plan.comparison and plan.factor and plan.repeat_plan
        assert len(plan.held_constant) == 3
        assert check.operational_allowed is False
        assert {item.value for item in check.expected_outcomes} == {
            "supported",
            "contradicted",
            "inconclusive",
        }
    legacy = assessment.model_dump()
    for check in legacy["checks"]:
        check.pop("mini_experiment")
    assert all(
        check.mini_experiment is None
        for check in DiagnosticAssessment.model_validate(legacy).checks
    )


def test_material_branch_can_lead_without_claiming_repair_or_release():
    outcomes = [
        result("delivery_review", "contradicted"),
        result("restriction_review", "contradicted"),
        result("material_review", "supported"),
    ]
    assessment = analyze(evidence(), outcomes, "S932")
    assert assessment.hypotheses[0].id == "material_condition"
    assert assessment.next_step.kind == "review"
    assert "confirmed" not in {item.status for item in assessment.hypotheses}


def test_structured_evidence_changes_selected_check_with_same_history():
    delivery = analyze(evidence(pressure_trend="unstable"), [], "S932")
    material = analyze(evidence(material_condition="changed"), [], "S932")
    restriction = analyze(evidence(fluid_path_finding="restriction_observed"), [], "S932")
    assert delivery.next_step.id == "delivery_review"
    assert material.next_step.id == "material_review"
    assert restriction.next_step.id == "restriction_review"
    for assessment in (delivery, material, restriction):
        assert assessment.next_step.evidence_ids == ["context-1"]
        assert all(item.status == "possible" for item in assessment.hypotheses)


def test_searchable_passages_are_exact_excerpts_of_the_referenced_files():
    root = Path(__file__).resolve().parents[3]
    for source in SOURCE_SEEDS:
        assert source.passage in (root / source.file_path).read_text()


def test_optional_explanation_cannot_change_decisions_and_rejects_invented_citations():
    assessment = analyze(evidence(), [], "S932")
    before = assessment.model_dump(exclude={"explanation"})
    settings = Settings(_env_file=None, reasoning_enabled=True, gemini_api_key=None)

    async def generate(payload, schema):
        return {
            "text": "The synthetic replay remains ambiguous; review delivery evidence next.",
            "evidence_ids": ["context-1"],
            "source_refs": ["s932-defects"],
            "uncertainties": [payload["known_gaps"][0]],
        }

    asyncio.run(enrich_assessment(assessment, evidence(), [], "S932", generate, settings))
    assert assessment.explanation.mode == "live"
    assert assessment.model_dump(exclude={"explanation"}) == before

    async def forged(payload, schema):
        result = await generate(payload, schema)
        result["evidence_ids"] = ["nonexistent-sensor"]
        return result

    asyncio.run(enrich_assessment(assessment, evidence(), [], "S932", forged, settings))
    assert assessment.explanation.mode == "unavailable"
    assert assessment.explanation.result is None
    assert "validation" in assessment.explanation.fallback_reason
    assert assessment.model_dump(exclude={"explanation"}) == before


def test_optional_explanation_timeout_and_disabled_mode_keep_baseline():
    assessment = analyze(evidence(), [], "S932")

    async def slow(payload, schema):
        await asyncio.sleep(1)

    settings = Settings(_env_file=None, reasoning_enabled=True, reasoning_timeout_seconds=0.001)
    asyncio.run(enrich_assessment(assessment, evidence(), [], "S932", slow, settings))
    assert assessment.explanation.mode == "unavailable"
    assert "timed out" in assessment.explanation.fallback_reason
    settings.reasoning_enabled = False
    asyncio.run(enrich_assessment(assessment, evidence(), [], "S932", slow, settings))
    assert "disabled" in assessment.explanation.fallback_reason
    assert assessment.next_step.id == "delivery_review"


def test_experiment_briefs_predict_from_the_model_equations_and_read_shapes():
    from flowpilot.incidents import simulation

    records = evidence(
        samples=[{"mass_mg": value} for value in (12.0, 11.1, 10.3, 9.2)],
        units={"mass": "mg"},
    )
    assessment = analyze(records, [], "S932 / DJ-2200 / BFS")
    briefs = {check.hypothesis_id: check.brief for check in assessment.checks}
    assert {key: brief.prediction.signature for key, brief in briefs.items()} == {
        "restriction": "steady_fall",
        "unstable_delivery": "oscillation",
        "material_condition": "decelerating_fall",
    }
    restriction = briefs["restriction"].prediction
    mass, _ = simulation.predicted_response("restriction", 0.8)
    assert restriction.relative_mass == [float(value) for value in mass]
    assert restriction.tested_severity == 0.8 and restriction.control_severity == 0.7
    assert "from 1.00 to 0.48" in restriction.if_holds
    material = briefs["material_condition"].prediction
    steps = [b - a for a, b in zip(material.relative_mass, material.relative_mass[1:])]
    assert all(step < 0 for step in steps) and steps[0] < steps[-1]  # a fall that slows down
    assert "quickly at first and then more slowly" in material.if_holds
    assert "three cycles" in briefs["unstable_delivery"].prediction.if_holds
    # The recorded mass samples are one monotonic shape fact, cited in every brief.
    facts = briefs["restriction"].shape_facts
    assert [(fact.evidence_id, fact.shape) for fact in facts] == [("context-1", "monotonic")]
    assert (
        facts[0].description
        == "The record shows mass across 4 samples: 12.0 → 11.1 → 10.3 → 9.2 mg."
    )
    assert briefs["material_condition"].why[0].startswith("Falling coverage fits all 3")
    for brief in briefs.values():
        assert brief.prediction.basis.endswith("not a measurement.")
        assert [rule.outcome for rule in brief.reading] == [
            "consistent",
            "conflicts",
            "not_distinguishable",
        ]
        assert any("cannot confirm a cause" in limit for limit in brief.limits)
        text = " ".join([*brief.why, brief.verifies, brief.prediction.if_holds]).casefold()
        assert "most likely" not in text and "confirmed cause" not in text


def test_confirmed_answers_describe_shape_and_unmodelled_changes_are_marked():
    answers = [
        result("question_frequency", "intermittent", id="ANS-1"),
        result("question_pressure_trend", "unstable", id="ANS-2"),
    ]
    facts = analyze(evidence(frequency=None), answers, "S932").checks[0].brief.shape_facts
    assert [(fact.evidence_id, fact.source, fact.shape) for fact in facts] == [
        ("ANS-1", "confirmed_answer", "oscillating"),
        ("ANS-2", "confirmed_answer", "oscillating"),
    ]
    sudden = (
        analyze(evidence(frequency=None), [result("question_frequency", "sudden")], "S932")
        .checks[0]
        .brief
    )
    assert [fact.shape for fact in sudden.shape_facts] == ["not_modelled"]
    assert sudden.why[1] == "1 record supports it and none conflict with it."


def test_model_payloads_leave_out_the_display_only_experiment_briefs():
    import json

    from flowpilot.incidents.diagnostic import model_payload

    assessment = analyze(
        evidence(samples=[{"mass_mg": value} for value in (12.0, 11.1, 10.3, 9.2)]),
        [],
        "S932 / DJ-2200 / BFS",
    )
    assert all(check.brief for check in assessment.checks)
    payload = model_payload(assessment)
    assert all("brief" not in check for check in payload["checks"])
    assert [check["id"] for check in payload["checks"]] == [check.id for check in assessment.checks]
    # The briefs alone would take a large share of the 50 KB adaptive input limit.
    full = len(json.dumps(assessment.model_dump(mode="json")))
    assert len(json.dumps(payload)) < full - 10_000
