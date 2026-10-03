import test from "node:test";
import assert from "node:assert/strict";
import { graphConnectivity } from "../apps/web/src/knowledgeGraph.ts";

test("node sizes reflect unique neighbors without duplicate or self-link inflation", () => {
  const graph = {
    nodes: ["hub", "branch", "leaf", "other", "isolated"].map((id) => ({ id })),
    edges: [
      ["hub", "branch"],
      ["hub", "leaf"],
      ["hub", "other"],
      ["branch", "leaf"],
      ["hub", "leaf"],
      ["leaf", "hub"],
      ["hub", "hub"],
      ["hub", "missing"],
    ].map(([source, target]) => ({ source, target })),
  };
  const metrics = graphConnectivity(graph);
  assert.equal(metrics.get("hub").connections, 3);
  assert.equal(metrics.get("branch").connections, 2);
  assert.equal(metrics.get("hub").size, 84);
  assert.equal(metrics.get("other").size, 34);
  assert.equal(metrics.get("isolated").connections, 0);
  assert.equal(metrics.get("isolated").size, 34);
  assert.ok(metrics.get("branch").size > metrics.get("other").size);
  assert.ok(metrics.get("branch").size < metrics.get("hub").size);
  assert.equal(metrics.get("branch").size, metrics.get("leaf").size);
  assert.deepEqual(graphConnectivity({ nodes: [], edges: [] }), new Map());
});
