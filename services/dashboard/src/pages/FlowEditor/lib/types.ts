export type NodeType =
  | "message"
  | "interactive"
  | "collect_input"
  | "condition"
  | "rag_lookup"
  | "llm_generate"
  | "api_call"
  | "book_appointment"
  | "end";

/** What the Inspector is currently editing. */
export type Selection =
  | { kind: "flow" }
  | { kind: "node"; id: string }
  | { kind: "edge"; id: string };
