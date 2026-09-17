import { describe, it, expect } from "vitest";
import type { Node, Edge } from "@xyflow/react";
import { autoLayout } from "./autoLayout";
import type { NodeData } from "./mapping";

function n(id: string): Node<NodeData> {
  return {
    id,
    type: "message",
    position: { x: 0, y: 0 },
    data: { nodeKey: id, type: "message", config: {}, isEntry: false, hasError: false },
  };
}

function e(source: string, target: string): Edge {
  return { id: `${source}->${target}`, source, target };
}

function posOf(nodes: Node<NodeData>[], id: string) {
  return nodes.find((x) => x.id === id)!.position;
}

describe("autoLayout", () => {
  it("places a linear chain in successive columns at row 0", () => {
    const out = autoLayout([n("A"), n("B"), n("C")], [e("A", "B"), e("B", "C")], "A");
    expect(posOf(out, "A")).toEqual({ x: 0, y: 0 });
    expect(posOf(out, "B")).toEqual({ x: 280, y: 0 });
    expect(posOf(out, "C")).toEqual({ x: 560, y: 0 });
  });

  it("stacks siblings vertically in a diamond", () => {
    const out = autoLayout(
      [n("A"), n("B"), n("C"), n("D")],
      [e("A", "B"), e("A", "C"), e("B", "D"), e("C", "D")],
      "A",
    );
    expect(posOf(out, "A").x).toBe(0);
    expect(posOf(out, "B").x).toBe(280);
    expect(posOf(out, "C").x).toBe(280);
    expect(posOf(out, "D").x).toBe(560);
    // B and C are stacked (different rows)
    expect(posOf(out, "B").y).not.toBe(posOf(out, "C").y);
  });

  it("appends an unreachable node to the right without throwing", () => {
    const out = autoLayout([n("A"), n("B"), n("X")], [e("A", "B")], "A");
    expect(out).toHaveLength(3);
    // X is unreachable → column after the rightmost rank (B at col 1 → X at col 2)
    expect(posOf(out, "X").x).toBe(560);
  });

  it("treats every node as unreachable when entry is empty", () => {
    const out = autoLayout([n("A"), n("B")], [e("A", "B")], "");
    expect(out).toHaveLength(2);
    // all unreachable → all placed in the maxRank+1 (=1) column
    expect(posOf(out, "A").x).toBe(280);
    expect(posOf(out, "B").x).toBe(280);
  });
});
