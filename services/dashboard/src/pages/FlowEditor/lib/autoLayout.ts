import type { Node, Edge } from "@xyflow/react";
import type { NodeData } from "./mapping";

const X_STEP = 280;
const Y_STEP = 140;

/**
 * Assigns positions to every node using BFS from the entry node.
 * Nodes at depth d sit in column d; siblings stack vertically.
 * Deterministic for a given (nodes, edges, entry) triple.
 * Unreachable nodes are appended to the right (the backend validator rejects
 * them on save anyway).
 */
export function autoLayout(
  nodes: Node<NodeData>[],
  edges: Edge[],
  entry: string,
): Node<NodeData>[] {
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    const list = adj.get(e.source) ?? [];
    list.push(e.target);
    adj.set(e.source, list);
  }

  const rank = new Map<string, number>(); // node id -> column
  const queue: string[] = entry ? [entry] : [];
  if (entry) rank.set(entry, 0);

  while (queue.length) {
    const cur = queue.shift()!;
    const d = rank.get(cur)!;
    for (const next of adj.get(cur) ?? []) {
      if (!rank.has(next)) {
        rank.set(next, d + 1);
        queue.push(next);
      }
    }
  }

  // Group by rank; stable order = original node order.
  const buckets = new Map<number, Node<NodeData>[]>();
  const unreachable: Node<NodeData>[] = [];
  for (const n of nodes) {
    const r = rank.get(n.id);
    if (r === undefined) {
      unreachable.push(n);
    } else {
      const b = buckets.get(r) ?? [];
      b.push(n);
      buckets.set(r, b);
    }
  }
  const maxRank = Math.max(0, ...buckets.keys());

  const out: Node<NodeData>[] = [];
  for (const [r, list] of buckets) {
    list.forEach((n, i) => out.push({ ...n, position: { x: r * X_STEP, y: i * Y_STEP } }));
  }
  unreachable.forEach((n, i) =>
    out.push({ ...n, position: { x: (maxRank + 1) * X_STEP, y: i * Y_STEP } }),
  );
  return out;
}
