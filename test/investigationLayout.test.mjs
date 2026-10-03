import test from "node:test";
import assert from "node:assert/strict";
import { investigationLayout } from "../apps/web/src/incidents/investigationLayout.ts";

test("flowchart aligns the followed path and separates branches from different parents", () => {
  const nodes = [
    { id: "flow-start", status: "start", height: 111 },
    { id: "root", status: "answered", height: 228 },
    // Put descendants before their parents to verify that topology controls placement.
    { id: "active", parent_id: "right", status: "active", height: 228 },
    { id: "left-a", parent_id: "left", status: "proposed", height: 156 },
    { id: "left-b", parent_id: "left", status: "proposed", height: 228 },
    { id: "left-c", parent_id: "left", status: "blocked", height: 176 },
    { id: "next-a", parent_id: "right", status: "proposed", height: 156 },
    { id: "next-b", parent_id: "right", status: "proposed", height: 228 },
    { id: "left", parent_id: "root", status: "answered", height: 156 },
    { id: "right", parent_id: "root", status: "answered", height: 228 },
    { id: "unused", parent_id: "root", status: "proposed", height: 176 },
  ];
  const layout = investigationLayout(
    nodes,
    "active",
    new Set(["left", "left-b"]),
  );
  for (const id of ["flow-start", "root", "right", "active"])
    assert.equal(layout.get(id).x, 0);
  for (const node of nodes) {
    const parent = layout.get(node.parent_id ?? "flow-start");
    if (node.id === "flow-start") continue;
    assert.ok(layout.get(node.id).y + 28 > parent.junctionY);
    const parentNode = nodes.find(
      (item) => item.id === (node.parent_id ?? "flow-start"),
    );
    assert.ok(parent.junctionY > parent.y + parentNode.height);
  }
  const rows = new Map();
  for (const { x, y } of layout.values()) {
    const row = rows.get(y) ?? [];
    row.push(x);
    rows.set(y, row);
  }
  for (const row of rows.values()) {
    row.sort((a, b) => a - b);
    for (let i = 1; i < row.length; i++) assert.ok(row[i] - row[i - 1] >= 336);
  }
  assert.equal(layout.get("left").y, layout.get("right").y);
  assert.equal(layout.get("left").junctionY, layout.get("right").junctionY);
  assert.deepEqual(
    layout,
    investigationLayout(nodes, "active", new Set(["left", "left-b"])),
  );
});

test("leaf alternatives reuse side columns as the investigation grows", () => {
  const nodes = [{ id: "flow-start", status: "start", height: 111 }];
  for (let i = 0; i < 12; i++) {
    const parent_id = i === 0 ? "flow-start" : `step-${i - 1}`;
    nodes.push(
      { id: `step-${i}`, parent_id, status: "answered", height: 228 },
      { id: `left-${i}`, parent_id, status: "proposed", height: 176 },
      { id: `right-${i}`, parent_id, status: "proposed", height: 176 },
    );
  }
  const layout = investigationLayout(nodes, "step-11", new Set());
  assert.ok([...layout.values()].every(({ x }) => Math.abs(x) <= 336));
});
