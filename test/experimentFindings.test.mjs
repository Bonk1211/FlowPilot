import test from "node:test";
import assert from "node:assert/strict";
import {
  findingOf,
  findingState,
  returnedFindings,
} from "../apps/web/src/incidents/experimentFindings.ts";

const finding = (hypothesis_id, outcome = "consistent") => ({
  hypothesis_id,
  outcome,
  summary: `${hypothesis_id} summary`,
});
const handback = (hypothesis_id, decision, timestamp) => ({
  hypothesis_id,
  decision,
  timestamp,
});
const plan = (id, findings, handbacks, extra = {}) => ({
  id,
  status: "completed",
  source_current: true,
  analysis: { findings },
  handbacks,
  ...extra,
});

test("the latest decision on a finding wins", () => {
  const item = plan(
    "A",
    [finding("restriction")],
    [
      handback("restriction", "return", "2026-10-04T01:00:00Z"),
      handback("restriction", "set_aside", "2026-10-04T02:00:00Z"),
    ],
  );
  assert.equal(findingState(item, "restriction"), "set_aside");
  assert.equal(findingState(item, "material_condition"), "open");
  assert.equal(findingOf(item, "restriction").outcome, "consistent");
  assert.equal(findingOf(item, "material_condition"), null);
});

test("only returned findings of finished plans reach the investigation, newest per mechanism", () => {
  const older = plan(
    "OLD",
    [finding("restriction")],
    [handback("restriction", "return", "2026-10-04T01:00:00Z")],
  );
  const newer = plan(
    "NEW",
    [finding("restriction")],
    [handback("restriction", "return", "2026-10-04T03:00:00Z")],
    { source_current: false },
  );
  const asideOnly = plan(
    "ASIDE",
    [finding("unstable_delivery")],
    [handback("unstable_delivery", "set_aside", "2026-10-04T04:00:00Z")],
  );
  const running = plan(
    "RUN",
    [finding("material_condition")],
    [handback("material_condition", "return", "2026-10-04T05:00:00Z")],
    { status: "running" },
  );
  const result = returnedFindings([older, newer, asideOnly, running]);
  assert.deepEqual(
    result.map((item) => [
      item.plan.id,
      item.finding.hypothesis_id,
      item.outdated,
    ]),
    [["NEW", "restriction", true]],
  );
  assert.deepEqual(returnedFindings([]), []);
});
