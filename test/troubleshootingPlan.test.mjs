import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTroubleshootingMap,
  troubleshootingHandoff,
  troubleshootingSvg,
} from "../apps/web/src/incidents/troubleshootingPlan.ts";

function incident() {
  return {
    id: "INC-map",
    revision: 4,
    symptom: 'Low coverage <script>alert("x")</script>',
    configuration: "S932",
    mode: "replay",
    evidence: [{ id: "trace", status: "collected" }],
    observations: [],
    investigation: {
      nodes: Array.from({ length: 6 }, (_, i) => ({
        id: `q${i}`,
        prompt: `Question ${i}`,
        status: "answered",
        choices: [],
      })),
      answers: Array.from({ length: 6 }, (_, i) => ({
        id: `a${i}`,
        node_id: `q${i}`,
        status: "confirmed",
        confirmed_value: `Response ${i}`,
        notes: "",
        recorded_at: "2026-10-03",
      })),
    },
    assessment: {
      hypotheses: [
        {
          id: "a",
          rank: 1,
          title: "Delivery",
          status: "possible",
          mechanism: "Supply variation",
          component_ids: ["bottle", "pickup"],
        },
        {
          id: "b",
          rank: 2,
          title: "Restriction",
          status: "possible",
          mechanism: "Path restriction",
          component_ids: ["pickup", "nozzle"],
        },
      ],
      next_step: { id: "check-a" },
      sources: [],
      unresolved: ["No confirmed cause"],
      checks: ["a", "b"].map((id) => ({
        id: `check-${id}`,
        title: `Compare ${id}`,
        hypothesis_id: id,
        eligible: true,
        purpose: "Distinguish two possibilities",
        method: "Review records",
        measured_response: "Coverage",
        source_refs: ["source"],
        prerequisites: ["Matched records"],
        stopping_conditions: ["Incomparable records"],
        blocked_reason: "No equipment method supplied",
        expected_outcomes: [
          { value: "supported", interpretation: "Raises candidate for review" },
          { value: "inconclusive", interpretation: "Keep possibilities open" },
        ],
        mini_experiment: {
          factor: "Condition",
          baseline: "Known-good",
          comparison: "Suspect",
          held_constant: ["Recipe"],
          repeat_plan: "Second independent matched pair",
        },
      })),
    },
  };
}

test("map folds responses left and right, converges shared components and separates outcomes", () => {
  const value = incident();
  const map = buildTroubleshootingMap(value);
  const card = (id) => map.cards.find((card) => card.id === id);
  assert.ok(card("a0").x < card("a1").x);
  assert.ok(card("a3").x > card("a4").x);
  assert.ok(card("shared-area").body[0].includes("pickup"));
  assert.ok(!card("shared-area").body[0].includes("nozzle"));
  assert.equal(map.links.filter((link) => link.to === "shared-area").length, 2);
  assert.ok(card("unknown-check-a").x < card("test-check-a").x);
  assert.ok(card("supports-check-a").x > card("test-check-a").x);
  assert.ok(
    map.links.some(
      (link) => link.from === "comparison-gate" && link.to === "handoff",
    ),
  );
  for (const [index, a] of map.cards.entries())
    for (const b of map.cards.slice(index + 1)) {
      assert.ok(
        a.x + a.width <= b.x ||
          b.x + b.width <= a.x ||
          a.y + a.height <= b.y ||
          b.y + b.height <= a.y,
        `${a.id} overlaps ${b.id}`,
      );
    }
});

test("corrected answers, invalid evidence and physical results cannot appear as current test results", () => {
  const value = incident();
  value.investigation.answers[0].observation_id = "old";
  value.investigation.answers.push({
    ...value.investigation.answers[0],
    id: "new-answer",
    supersedes_id: "a0",
    observation_id: "new",
  });
  value.investigation.nodes[1].status = "superseded";
  value.observations = [
    {
      id: "old",
      check_id: "check-a",
      result: "supported",
      synthetic: true,
      evidence_ids: ["trace"],
    },
    {
      id: "physical",
      check_id: "check-b",
      result: "supported",
      synthetic: false,
      evidence_ids: ["trace"],
    },
  ];
  let map = buildTroubleshootingMap(value);
  assert.ok(!map.cards.some((card) => card.id === "a0" || card.id === "a1"));
  assert.ok(
    map.cards
      .filter((card) => card.tone === "test")
      .every((card) => card.label.includes("not run")),
  );
  value.observations.push({
    id: "valid",
    check_id: "check-a",
    result: "contradicted",
    synthetic: true,
    evidence_ids: ["trace"],
  });
  map = buildTroubleshootingMap(value);
  assert.ok(
    map.cards
      .find((card) => card.id === "test-check-a")
      .label.includes("recorded: contradicted"),
  );
  value.evidence.push({
    id: "new-trace",
    status: "collected",
    supersedes_id: "trace",
  });
  assert.ok(
    buildTroubleshootingMap(value)
      .cards.find((card) => card.id === "test-check-a")
      .label.includes("not run"),
  );
});

test("export is self-contained, escapes supplied text, retains controls, sources and revision", () => {
  const value = incident();
  const map = buildTroubleshootingMap(value);
  const svg = troubleshootingSvg(map);
  const html = troubleshootingHandoff(value, map);
  assert.ok(!svg.includes("<script>"));
  assert.ok(svg.includes("&lt;script&gt;"));
  assert.ok(html.includes("INC-map · r4"));
  assert.ok(html.includes("Second independent matched pair"));
  assert.ok(html.includes("Source references:"));
  assert.ok(html.includes("Hold: Recipe"));
  assert.ok(!html.includes('src="http'));
  assert.equal((html.match(/<svg /g) ?? []).length, map.pages.length);
});

test("legacy snapshots and unavailable checks remain readable without invented tests", () => {
  const value = incident();
  value.investigation = {};
  value.observations = undefined;
  value.assessment.checks.forEach((check) => {
    delete check.mini_experiment;
    check.eligible = false;
  });
  const map = buildTroubleshootingMap(value);
  assert.equal(map.checks.length, 0);
  assert.ok(map.cards.some((card) => card.id === "handoff"));
});
