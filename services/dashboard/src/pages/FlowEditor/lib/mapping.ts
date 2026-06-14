import type { Node, Edge } from "@xyflow/react";
import type { FlowWithNodes, UpdateFlowDto } from "@/lib/api";
import type { NodeType } from "./types";

export type NodeData = {
  nodeKey: string; // user-facing identifier; unique per flow
  type: NodeType;
  config: Record<string, unknown>;
  isEntry: boolean;
  hasError: boolean; // toggled by error mapping after a Save failure
};

export type EdgeData = {
  condition?: string; // JMESPath expression; undefined = always
  hasError: boolean;
};

/**
 * Convert a backend flow into ReactFlow nodes + edges.
 * RF node ids = backend node_key (stable, unique per flow → fits RF requirements).
 * Edge ids = `${source}-${index}` so we can carry edge order and back-edges.
 */
export function flowToRF(flow: FlowWithNodes): {
  nodes: Node<NodeData>[];
  edges: Edge<EdgeData>[];
} {
  const nodes: Node<NodeData>[] = flow.nodes.map((n) => ({
    id: n.node_key,
    type: n.type, // matched in NODE_TYPES_MAP
    position: n.meta?.position ?? { x: 0, y: 0 },
    data: {
      nodeKey: n.node_key,
      type: n.type,
      config: n.config,
      isEntry: n.node_key === flow.entry_node,
      hasError: false,
    },
  }));

  const edges: Edge<EdgeData>[] = [];
  for (const n of flow.nodes) {
    n.transitions.forEach((t, idx) => {
      edges.push({
        id: `${n.node_key}-${idx}`,
        source: n.node_key,
        target: t.next,
        label: t.condition ?? "always",
        data: { condition: t.condition, hasError: false },
      });
    });
  }
  return { nodes, edges };
}

/**
 * Serialize the editor's RF state into the API's UpdateFlowDto.
 * Transitions are derived by grouping edges by source.
 */
export function rfToFlow(
  meta: { name: string; trigger: Record<string, unknown>; entryNode: string },
  nodes: Node<NodeData>[],
  edges: Edge<EdgeData>[],
): UpdateFlowDto {
  const edgesBySource = new Map<string, Edge<EdgeData>[]>();
  for (const e of edges) {
    const list = edgesBySource.get(e.source) ?? [];
    list.push(e);
    edgesBySource.set(e.source, list);
  }

  return {
    name: meta.name,
    trigger: meta.trigger,
    entry_node: meta.entryNode,
    nodes: nodes.map((n) => ({
      node_key: n.data.nodeKey,
      type: n.data.type,
      config: n.data.config,
      transitions: (edgesBySource.get(n.id) ?? []).map((e) => ({
        next: e.target,
        ...(e.data?.condition ? { condition: e.data.condition } : {}),
      })),
      meta: { position: n.position },
    })),
  };
}

/**
 * Destructive rename of a node's key. Propagates the new key to the RF node id,
 * its `data.nodeKey`, and every edge that referenced the old key (source/target).
 * Edge ids are left unchanged — they only need to stay unique, not semantic.
 */
export function renameNodeKey(
  nodes: Node<NodeData>[],
  edges: Edge<EdgeData>[],
  oldKey: string,
  newKey: string,
): { nodes: Node<NodeData>[]; edges: Edge<EdgeData>[] } {
  const nextNodes = nodes.map((n) =>
    n.id === oldKey ? { ...n, id: newKey, data: { ...n.data, nodeKey: newKey } } : n,
  );
  const nextEdges = edges.map((e) => {
    if (e.source !== oldKey && e.target !== oldKey) return e;
    return {
      ...e,
      ...(e.source === oldKey ? { source: newKey } : {}),
      ...(e.target === oldKey ? { target: newKey } : {}),
    };
  });
  return { nodes: nextNodes, edges: nextEdges };
}
