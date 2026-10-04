import test from "node:test";
import assert from "node:assert/strict";
import {
  suggestInvestigationExperiment,
  suggestInvestigationExperiments,
} from "../apps/web/src/incidents/investigationExperiment.ts";

function incident() {
  return {
    status: "investigating",
    investigation: {
      active_node_id: "q3",
      nodes: [1, 2, 3].map((n) => ({
        id: `q${n}`,
        kind: "question",
        target_fact: `fact${n}`,
        status: n === 3 ? "active" : "answered",
      })),
      answers: [1, 2].map((n) => ({
        id: `a${n}`,
        node_id: `q${n}`,
        status: "confirmed",
      })),
    },
    assessment: {
      next_step: { kind: "question" },
      hypotheses: [
        { id: "delivery", status: "possible", rank: 2 },
        { id: "restriction", status: "possible", rank: 1 },
      ],
      checks: [
        { id: "delivery-check", hypothesis_id: "delivery", eligible: true },
        {
          id: "restriction-check",
          hypothesis_id: "restriction",
          eligible: true,
        },
      ],
    },
  };
}

test("a mini experiment branches from a confirmed response before questioning is complete", () => {
  const value = incident();
  const suggestion = suggestInvestigationExperiment(value);
  assert.equal(suggestion.answer.id, "a2");
  assert.equal(suggestion.check.id, "restriction-check");
  assert.equal(value.investigation.active_node_id, "q3");
  value.investigation.answers.pop();
  assert.equal(suggestInvestigationExperiment(value), null);
});

test("unconfirmed or corrected responses and completed investigations do not propose experiments", () => {
  for (const status of ["pending", "clarification", "unknown"]) {
    const value = incident();
    value.investigation.answers[1].status = status;
    assert.equal(suggestInvestigationExperiment(value), null);
  }
  const value = incident();
  value.investigation.nodes[0].status = "superseded";
  assert.equal(suggestInvestigationExperiment(value), null);
  value.investigation.nodes[0].status = "answered";
  value.investigation.answers.push({
    id: "a2-new",
    node_id: "q2",
    status: "confirmed",
    supersedes_id: "a2",
  });
  assert.equal(suggestInvestigationExperiment(value).answer.id, "a2-new");
  value.status = "closed";
  assert.equal(suggestInvestigationExperiment(value), null);
});

test("the current check takes priority and only eligible checks are suggested", () => {
  const value = incident();
  value.investigation.nodes[2].target_fact = "delivery-check";
  assert.equal(
    suggestInvestigationExperiment(value).check.id,
    "delivery-check",
  );
  value.assessment.checks.forEach((check) => {
    check.eligible = false;
  });
  assert.equal(suggestInvestigationExperiment(value), null);
});

test("one experiment per explanation is offered under the same conditions as a single suggestion", () => {
  const value = incident();
  value.assessment.hypotheses.push({
    id: "material",
    status: "inconclusive",
    rank: 3,
  });
  value.assessment.checks.push({
    id: "material-check",
    hypothesis_id: "material",
    eligible: true,
  });
  const offer = suggestInvestigationExperiments(value);
  assert.deepEqual(
    offer.items.map((item) => [item.hypothesis.id, item.check.id]),
    [
      ["restriction", "restriction-check"],
      ["delivery", "delivery-check"],
      ["material", "material-check"],
    ],
  );
  assert.equal(offer.lead.id, "restriction-check");
  assert.equal(offer.answer.id, "a2");
  value.investigation.answers.pop();
  assert.equal(suggestInvestigationExperiments(value), null);
});

test("ineligible checks and closed or escalated incidents offer no experiments", () => {
  const value = incident();
  value.assessment.checks[0].eligible = false;
  assert.equal(suggestInvestigationExperiments(value), null);
  for (const change of [{ status: "closed" }, { escalated: true }]) {
    assert.equal(
      suggestInvestigationExperiments({ ...incident(), ...change }),
      null,
    );
  }
  const review = incident();
  review.assessment.next_step.kind = "review";
  assert.equal(suggestInvestigationExperiments(review), null);
});
