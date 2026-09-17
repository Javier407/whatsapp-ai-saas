import { describe, it, expect } from "vitest";
import type { FlowWithNodes } from "@/lib/api";
import { flowToRF, rfToFlow, renameNodeKey } from "./mapping";

function makeFlow(): FlowWithNodes {
  return {
    id: "f1",
    name: "Greeting",
    description: null,
    trigger: { type: "keyword" },
    entry_node: "a",
    is_active: false,
    version: 1,
    created_at: "",
    updated_at: "",
    nodes: [
      { id: "n1", node_key: "a", type: "message", config: { content: "hi" }, transitions: [{ next: "b" }], meta: { position: { x: 10, y: 20 } } },
      { id: "n2", node_key: "b", type: "condition", config: {}, transitions: [{ next: "c", condition: "x == 1" }, { next: "a" }], meta: {} },
      { id: "n3", node_key: "c", type: "end", config: {}, transitions: [], meta: { position: { x: 50, y: 60 } } },
    ],
  };
}

describe("flowToRF", () => {
  it("maps nodes with ids = node_key, positions, and the entry flag", () => {
    const { nodes } = flowToRF(makeFlow());
    expect(nodes.map((n) => n.id)).toEqual(["a", "b", "c"]);
    expect(nodes[0]!.data.isEntry).toBe(true);
    expect(nodes[1]!.data.isEntry).toBe(false);
    expect(nodes[0]!.position).toEqual({ x: 10, y: 20 });
    // legacy node with empty meta defaults to {0,0}
    expect(nodes[1]!.position).toEqual({ x: 0, y: 0 });
  });

  it("maps transitions to edges with condition labels", () => {
    const { edges } = flowToRF(makeFlow());
    expect(edges).toHaveLength(3);
    const ab = edges.find((e) => e.source === "a" && e.target === "b")!;
    expect(ab.data?.condition).toBeUndefined();
    expect(ab.label).toBe("always");
    const bc = edges.find((e) => e.source === "b" && e.target === "c")!;
    expect(bc.data?.condition).toBe("x == 1");
    expect(bc.label).toBe("x == 1");
  });
});

describe("rfToFlow", () => {
  it("groups transitions by source and carries meta.position", () => {
    const { nodes, edges } = flowToRF(makeFlow());
    const dto = rfToFlow({ name: "Greeting", trigger: { type: "keyword" }, entryNode: "a" }, nodes, edges);

    const a = dto.nodes!.find((n) => n.node_key === "a")!;
    expect(a.transitions).toEqual([{ next: "b" }]); // no `condition` key when absent
    expect("condition" in a.transitions[0]!).toBe(false);
    expect(a.meta).toEqual({ position: { x: 10, y: 20 } });

    const b = dto.nodes!.find((n) => n.node_key === "b")!;
    expect(b.transitions).toEqual([{ next: "c", condition: "x == 1" }, { next: "a" }]);
  });

  it("round-trips transitions and positions through flowToRF → rfToFlow", () => {
    const { nodes, edges } = flowToRF(makeFlow());
    const dto = rfToFlow({ name: "Greeting", trigger: {}, entryNode: "a" }, nodes, edges);
    const c = dto.nodes!.find((n) => n.node_key === "c")!;
    expect(c.transitions).toEqual([]);
    expect(c.meta).toEqual({ position: { x: 50, y: 60 } });
  });
});

describe("renameNodeKey", () => {
  it("propagates a rename to the node id, data.nodeKey, and edge endpoints", () => {
    const { nodes, edges } = flowToRF(makeFlow());
    const renamed = renameNodeKey(nodes, edges, "b", "branch");

    expect(renamed.nodes.find((n) => n.id === "b")).toBeUndefined();
    const branch = renamed.nodes.find((n) => n.id === "branch")!;
    expect(branch.data.nodeKey).toBe("branch");
    // a→b becomes a→branch; b→c becomes branch→c
    expect(renamed.edges.find((e) => e.source === "a")!.target).toBe("branch");
    expect(renamed.edges.some((e) => e.source === "branch" && e.target === "c")).toBe(true);
  });
});
