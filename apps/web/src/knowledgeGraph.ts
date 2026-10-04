import type { KnowledgeGraph } from "@flowpilot/contracts";

export function knowledgeArrivalConnections(graph: KnowledgeGraph, id: string) {
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  const direct = graph.edges
    .filter((edge) => edge.source === id || edge.target === id)
    .map((edge, index) => ({
      edge,
      from: id,
      to: edge.source === id ? edge.target : edge.source,
      wave: "direct" as const,
      delay: 700 + index * 320,
      duration: 950,
    }));
  const linked = new Set(direct.map((link) => link.to));
  const visited = new Set([id, ...linked]);
  const spread: {
    edge: KnowledgeGraph["edges"][number];
    from: string;
    to: string;
    wave: "library";
    delay: number;
    duration: number;
  }[] = [];
  const spreadStart =
    Math.max(700, ...direct.map((link) => link.delay + link.duration)) + 200;
  // Follow real existing edges into reference sections and past cases. One
  // arrival per destination keeps the animation readable in a dense library.
  for (const edge of graph.edges) {
    const from = linked.has(edge.source) ? edge.source : edge.target;
    const to = from === edge.source ? edge.target : edge.source;
    const node = nodes.get(to);
    if (!linked.has(from) || visited.has(to) || !node || spread.length >= 12)
      continue;
    if (
      node.kind !== "Reference section" &&
      !(node.kind === "Case" && node.id.startsWith("case:"))
    )
      continue;
    visited.add(to);
    spread.push({
      edge,
      from,
      to,
      wave: "library",
      delay: spreadStart + spread.length * 90,
      duration: 1100,
    });
  }
  return [...direct, ...spread];
}

export function graphConnectivity(graph: KnowledgeGraph) {
  const neighbors = new Map(
    graph.nodes.map((node) => [node.id, new Set<string>()]),
  );
  for (const edge of graph.edges) {
    if (
      edge.source === edge.target ||
      !neighbors.has(edge.source) ||
      !neighbors.has(edge.target)
    )
      continue;
    neighbors.get(edge.source)!.add(edge.target);
    neighbors.get(edge.target)!.add(edge.source);
  }
  const maximum = Math.max(
    1,
    ...[...neighbors.values()].map((items) => items.size),
  );
  return new Map(
    [...neighbors].map(([id, items]) => [
      id,
      {
        connections: items.size,
        // Scale area rather than diameter, bounded so hubs do not overwhelm the map.
        size: Math.sqrt(
          34 ** 2 +
            ((84 ** 2 - 34 ** 2) * Math.max(0, items.size - 1)) /
              Math.max(1, maximum - 1),
        ),
      },
    ]),
  );
}
