type LayoutNode = {
  id: string;
  parent_id?: string | null;
  status: string;
  height: number;
  gapAfter?: number;
};
type Bounds = { left: number; right: number };
const startId = "flow-start";
const nodeWidth = 240;
const columnGap = 96;
const rowGap = 104;

export function investigationLayout(
  nodes: LayoutNode[],
  currentId: string | null,
  recommendedIds: Set<string>,
) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const followed = new Set<string>();
  let current = currentId ? byId.get(currentId) : undefined;
  while (current && !followed.has(current.id)) {
    followed.add(current.id);
    current = current.parent_id ? byId.get(current.parent_id) : undefined;
  }
  const children = new Map<string, LayoutNode[]>();
  for (const node of nodes) {
    if (node.id === startId) continue;
    const parent = byId.has(node.parent_id ?? "") ? node.parent_id! : startId;
    const siblings = children.get(parent) ?? [];
    siblings.push(node);
    children.set(parent, siblings);
  }
  const priority = (node: LayoutNode) =>
    followed.has(node.id)
      ? 3
      : node.status === "answered"
        ? 2
        : recommendedIds.has(node.id)
          ? 1
          : 0;
  for (const siblings of children.values())
    siblings.sort((a, b) => priority(b) - priority(a));

  const offsets = new Map<string, number>();
  // Compare occupied space at each depth so short alternatives can reuse columns.
  function measure(id: string): Bounds[] {
    const contour: Bounds[] = [{ left: -nodeWidth / 2, right: nodeWidth / 2 }];
    for (const [index, child] of (children.get(id) ?? []).entries()) {
      const branch = measure(child.id);
      let offset = 0;
      for (const [depth, bounds] of branch.entries()) {
        const occupied = contour[depth + 1];
        if (!occupied || index === 0) continue;
        offset =
          index % 2
            ? Math.min(offset, occupied.left - columnGap - bounds.right)
            : Math.max(offset, occupied.right + columnGap - bounds.left);
      }
      offsets.set(child.id, offset);
      for (const [depth, bounds] of branch.entries()) {
        const occupied = contour[depth + 1];
        contour[depth + 1] = {
          left: Math.min(occupied?.left ?? Infinity, bounds.left + offset),
          right: Math.max(occupied?.right ?? -Infinity, bounds.right + offset),
        };
      }
    }
    return contour;
  }
  measure(startId);
  const columns = new Map<string, { x: number; depth: number }>();
  const rowHeights: number[] = [];
  const rowGaps: number[] = [];
  function place(id: string, x: number, depth: number) {
    columns.set(id, { x, depth });
    rowHeights[depth] = Math.max(rowHeights[depth] ?? 0, byId.get(id)!.height);
    rowGaps[depth] = Math.max(
      rowGaps[depth] ?? 0,
      byId.get(id)!.gapAfter ?? rowGap,
    );
    for (const child of children.get(id) ?? [])
      place(child.id, x + offsets.get(child.id)!, depth + 1);
  }
  place(startId, 0, 0);
  const rowTops = [0];
  for (let depth = 1; depth < rowHeights.length; depth++)
    rowTops[depth] =
      rowTops[depth - 1] + rowHeights[depth - 1] + rowGaps[depth - 1];
  return new Map(
    [...columns].map(([id, { x, depth }]) => [
      id,
      {
        x,
        y: rowTops[depth],
        // Every connector from this row shares one junction in the clear gutter.
        junctionY: rowTops[depth] + rowHeights[depth] + rowGaps[depth] / 2,
      },
    ]),
  );
}
