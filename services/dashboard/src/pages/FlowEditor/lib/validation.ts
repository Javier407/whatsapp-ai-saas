export type ClientValidationResult = { ok: true } | { ok: false; messages: string[] };

/**
 * Cheap client-side pre-checks before a Save round-trip. Anything heavier
 * (reachability, JMESPath safety, SSRF, max nodes) is enforced by the backend
 * validator, which remains the single source of truth.
 */
export function clientValidate(input: {
  entryNode: string;
  nodes: Array<{ id: string; nodeKey: string }>;
}): ClientValidationResult {
  const messages: string[] = [];

  if (!input.entryNode) messages.push("Selecciona un nodo de entrada.");

  const keys = new Set<string>();
  const dups = new Set<string>();
  for (const n of input.nodes) {
    if (keys.has(n.nodeKey)) dups.add(n.nodeKey);
    keys.add(n.nodeKey);
  }
  if (dups.size) messages.push(`Claves duplicadas: ${[...dups].join(", ")}`);

  if (input.entryNode && !keys.has(input.entryNode)) {
    messages.push(`El nodo de entrada '${input.entryNode}' no existe.`);
  }

  return messages.length === 0 ? { ok: true } : { ok: false, messages };
}
