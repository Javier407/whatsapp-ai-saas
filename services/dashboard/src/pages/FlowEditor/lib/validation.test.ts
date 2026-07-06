import { describe, it, expect } from "vitest";
import { clientValidate } from "./validation";

describe("clientValidate", () => {
  it("flags a missing entry node", () => {
    const r = clientValidate({ entryNode: "", nodes: [{ id: "a", nodeKey: "a" }] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.messages.join(" ")).toContain("entrada");
  });

  it("flags duplicate node keys", () => {
    const r = clientValidate({
      entryNode: "x",
      nodes: [
        { id: "n1", nodeKey: "x" },
        { id: "n2", nodeKey: "x" },
      ],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.messages.some((m) => m.includes("x"))).toBe(true);
  });

  it("flags an entry node that is not in the node list", () => {
    const r = clientValidate({ entryNode: "ghost", nodes: [{ id: "a", nodeKey: "a" }] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.messages.some((m) => m.includes("ghost"))).toBe(true);
  });

  it("passes a valid graph", () => {
    const r = clientValidate({ entryNode: "a", nodes: [{ id: "a", nodeKey: "a" }] });
    expect(r.ok).toBe(true);
  });

  it("reports multiple violations at once (dups + missing entry)", () => {
    const r = clientValidate({
      entryNode: "ghost",
      nodes: [
        { id: "n1", nodeKey: "dup" },
        { id: "n2", nodeKey: "dup" },
      ],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.messages.some((m) => m.includes("dup"))).toBe(true);
      expect(r.messages.some((m) => m.includes("ghost"))).toBe(true);
    }
  });
});
