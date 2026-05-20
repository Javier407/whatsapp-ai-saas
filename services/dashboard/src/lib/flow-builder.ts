export type SimpleFlowInput = {
  name: string;
  description?: string;
  keywords: string[];
  welcomeMessage: string;
};

export function buildSimpleFlowPayload(input: SimpleFlowInput) {
  const keywords = input.keywords.map((k) => k.trim()).filter(Boolean);
  return {
    name: input.name.trim(),
    description: input.description?.trim() ?? "",
    trigger: { type: "keyword_match", keywords: keywords.length > 0 ? keywords : ["hola"] },
    entry_node: "inicio",
    nodes: [
      {
        node_key: "inicio",
        type: "message",
        config: { content: input.welcomeMessage.trim() },
        transitions: [{ condition: { type: "always" }, next: "fin" }],
      },
      { node_key: "fin", type: "end", config: {}, transitions: [] },
    ],
  };
}

export function parseKeywords(raw: string): string[] {
  return raw
    .split(/[,;\n]+/)
    .map((k) => k.trim())
    .filter(Boolean);
}

export function flowSummary(flow: {
  name: string;
  description: string | null;
  trigger: Record<string, unknown>;
  entry_node: string;
}) {
  const trigger = flow.trigger as { type?: string; keywords?: string[] };
  const keywords = trigger.keywords?.join(", ") ?? "—";
  return {
    triggerType: trigger.type ?? "—",
    keywords,
    entryNode: flow.entry_node,
  };
}
