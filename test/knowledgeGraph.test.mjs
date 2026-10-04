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

const { incidentKnowledgeGraph } =
  await import("../apps/web/src/incidents/incidentKnowledgeGraph.ts");
const { knowledgeArrivalConnections } =
  await import("../apps/web/src/knowledgeGraph.ts");
const library = {
  nodes: [
    {
      id: "reference:s932",
      kind: "Reference document",
      label: "S-932 reference",
      sources: [{ id: "SRC:1", configurations: ["S932"] }],
    },
    {
      id: "reference:s932:1",
      kind: "Reference section",
      label: "Coverage troubleshooting",
    },
    {
      id: "Symptom:s932:coverage",
      kind: "Symptom",
      label: "Incomplete coverage",
      detail: "reported symptom · S-932 / DJ-2200 atomized flux spraying",
    },
    {
      id: "Component:s932:nozzle",
      kind: "Component",
      label: "DJ-2200 nozzle",
      detail: "investigation scope · S-932 / DJ-2200 atomized flux spraying",
    },
    { id: "case:older", kind: "Case", label: "Earlier investigation" },
    {
      id: "reference:other",
      kind: "Reference document",
      label: "Other equipment",
      sources: [{ id: "OTHER:1", configurations: ["S9320"] }],
    },
  ],
  edges: [
    {
      id: "reference:contains",
      source: "reference:s932",
      target: "reference:s932:1",
      relation: "contains reference passages",
    },
    {
      id: "case:symptom",
      source: "case:older",
      target: "Symptom:s932:coverage",
      relation: "reported symptom",
    },
    {
      id: "section:symptom",
      source: "reference:s932:1",
      target: "Symptom:s932:coverage",
      relation: "mentions topic",
    },
  ],
};
const incident = {
  id: "INC-new",
  revision: 5,
  mode: "replay",
  status: "investigating",
  configuration: "S932 / DJ-2200 / BFS",
  symptom: "Progressively insufficient flux coverage",
  captured_knowledge: [
    {
      id: "KN-one",
      title: "Coverage finding",
      summary: "Retain the before/after evidence.",
      evidence_ids: ["E-1"],
      source_revision: 4,
    },
  ],
};
const findingId = "knowledge:INC-new:KN-one";

test("a captured finding joins existing main-library topics across equipment aliases", () => {
  const original = structuredClone(library);
  const graph = incidentKnowledgeGraph([incident], library);
  const links = graph.edges.filter((edge) => edge.source === findingId);
  for (const id of [
    "reference:s932",
    "Symptom:s932:coverage",
    "Component:s932:nozzle",
  ]) {
    const link = links.find((edge) => edge.target === id);
    assert.ok(link, `missing real library connection to ${id}`);
    assert.equal(link.status, "topic_match");
    assert.ok(link.matched_text);
    assert.deepEqual(link.evidence_ids, []); // Context is not claimed as evidence.
  }
  assert.ok(!links.some((edge) => edge.target === "reference:other"));
  assert.deepEqual(library, original);
  assert.equal(
    new Set(graph.edges.map((edge) => edge.id)).size,
    graph.edges.length,
  );
});

test("unrelated equipment and symptoms do not receive fabricated topic connections", () => {
  const unrelated = incidentKnowledgeGraph(
    [
      {
        ...incident,
        configuration: "S9320 / DJ-9000",
        symptom: "Alignment failure",
      },
    ],
    library,
  );
  assert.equal(
    unrelated.edges.filter((edge) => edge.status === "topic_match").length,
    0,
  );
  const otherSymptom = incidentKnowledgeGraph(
    [{ ...incident, symptom: "Alignment failure" }],
    library,
  );
  assert.ok(
    !otherSymptom.edges.some(
      (edge) =>
        edge.source === findingId && edge.target === "Symptom:s932:coverage",
    ),
  );
});

test("connection animation follows real edges outward into reference sections and past cases", () => {
  const graph = incidentKnowledgeGraph([incident], library);
  const links = knowledgeArrivalConnections(graph, findingId);
  const direct = links.filter((link) => link.wave === "direct");
  const spread = links.filter((link) => link.wave === "library");
  assert.equal(direct.length, 6);
  assert.deepEqual(
    new Set(spread.map((link) => link.to)),
    new Set(["reference:s932:1", "case:older"]),
  );
  assert.ok(
    spread[0].delay >
      Math.max(...direct.map((link) => link.delay + link.duration)),
  );
  assert.ok(
    direct.every(
      (link, index) => index === 0 || link.delay > direct[index - 1].delay,
    ),
  );
  for (const link of links) {
    assert.ok(graph.edges.includes(link.edge));
    assert.deepEqual(
      new Set([link.from, link.to]),
      new Set([link.edge.source, link.edge.target]),
    );
  }
  assert.deepEqual(knowledgeArrivalConnections(graph, "missing"), []);
});
