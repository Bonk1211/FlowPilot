import type { KnowledgeGraph } from "@flowpilot/contracts";

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
