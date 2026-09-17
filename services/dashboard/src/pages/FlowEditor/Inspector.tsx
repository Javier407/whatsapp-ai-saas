import type { ComponentType } from "react";
import type { Node, Edge } from "@xyflow/react";
import { Flag, Trash2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { selectClass, type ConfigFormProps } from "./forms/shared";
import { MessageForm } from "./forms/MessageForm";
import { InteractiveForm } from "./forms/InteractiveForm";
import { CollectInputForm } from "./forms/CollectInputForm";
import { ConditionForm } from "./forms/ConditionForm";
import { RagLookupForm } from "./forms/RagLookupForm";
import { LlmGenerateForm } from "./forms/LlmGenerateForm";
import { ApiCallForm } from "./forms/ApiCallForm";
import { BookAppointmentForm } from "./forms/BookAppointmentForm";
import { EndForm } from "./forms/EndForm";
import { NODE_REGISTRY } from "./lib/node-registry";
import type { NodeData, EdgeData } from "./lib/mapping";
import type { NodeType, Selection } from "./lib/types";

const FORM_MAP: Record<NodeType, ComponentType<ConfigFormProps>> = {
  message: MessageForm,
  interactive: InteractiveForm,
  collect_input: CollectInputForm,
  condition: ConditionForm,
  rag_lookup: RagLookupForm,
  llm_generate: LlmGenerateForm,
  api_call: ApiCallForm,
  book_appointment: BookAppointmentForm,
  end: EndForm,
};

type Props = {
  selected: Selection;
  nodes: Node<NodeData>[];
  edges: Edge<EdgeData>[];
  name: string;
  trigger: Record<string, unknown>;
  entryNode: string;
  onUpdateNode: (id: string, patch: Partial<NodeData>) => void;
  onUpdateEdge: (id: string, patch: Partial<EdgeData>) => void;
  onRenameNode: (id: string, newKey: string) => void;
  onDelete: () => void;
  onSetEntry: (id: string) => void;
  onUpdateFlowMeta: (patch: { name?: string; trigger?: Record<string, unknown> }) => void;
  errors: { nodes: Set<string>; edges: Set<string>; details: Record<string, string[]> };
};

function ErrorList({ messages }: { messages?: string[] }) {
  if (!messages || messages.length === 0) return null;
  return (
    <ul className="rounded-md border border-destructive bg-destructive/5 p-2 text-xs text-destructive">
      {messages.map((m, i) => (
        <li key={i}>{m}</li>
      ))}
    </ul>
  );
}

export function Inspector(props: Props) {
  const { selected } = props;
  return (
    <aside className="w-80 shrink-0 space-y-3 overflow-y-auto border-l bg-card p-3">
      {selected.kind === "flow" && <FlowPanel {...props} />}
      {selected.kind === "node" && <NodePanel {...props} id={selected.id} />}
      {selected.kind === "edge" && <EdgePanel {...props} id={selected.id} />}
    </aside>
  );
}

function FlowPanel({ name, trigger, entryNode, nodes, onUpdateFlowMeta, onSetEntry }: Props) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold">Flujo</h2>
      <div className="space-y-1.5">
        <Label htmlFor="flow-name">Nombre</Label>
        <Input id="flow-name" value={name} onChange={(e) => onUpdateFlowMeta({ name: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="entry-node">Nodo de entrada</Label>
        <select
          id="entry-node"
          className={selectClass}
          value={entryNode}
          onChange={(e) => onSetEntry(e.target.value)}
        >
          <option value="">(sin asignar)</option>
          {nodes.map((n) => (
            <option key={n.id} value={n.id}>
              {n.data.nodeKey}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label>Disparador (solo lectura)</Label>
        <pre className="overflow-x-auto rounded-md border bg-muted/50 p-2 text-xs">
          {JSON.stringify(trigger, null, 2)}
        </pre>
      </div>
    </div>
  );
}

function NodePanel({
  id,
  nodes,
  entryNode,
  onUpdateNode,
  onRenameNode,
  onSetEntry,
  onDelete,
  errors,
}: Props & { id: string }) {
  const node = nodes.find((n) => n.id === id);
  if (!node) return <p className="text-sm text-muted-foreground">Nodo no encontrado.</p>;

  const Form = FORM_MAP[node.data.type];
  const isEntry = entryNode === node.id;

  return (
    <div className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        {NODE_REGISTRY[node.data.type].label}
        {isEntry && <Flag className="h-3.5 w-3.5 text-green-500" />}
      </h2>

      <div className="space-y-1.5">
        <Label htmlFor="node-key">Clave del nodo</Label>
        <Input
          id="node-key"
          defaultValue={node.data.nodeKey}
          onBlur={(e) => {
            const next = e.target.value.trim();
            if (next && next !== node.data.nodeKey) onRenameNode(node.id, next);
          }}
        />
      </div>

      <ErrorList messages={errors.details[node.id]} />

      {/* key={node.id} forces a fresh form (and react-hook-form state) per node */}
      <Form
        key={node.id}
        data={node.data}
        onChange={(config) => onUpdateNode(node.id, { config })}
      />

      <div className="flex gap-2 border-t pt-3">
        <Button type="button" variant="outline" size="sm" disabled={isEntry} onClick={() => onSetEntry(node.id)}>
          <Flag className="mr-1 h-4 w-4" />
          {isEntry ? "Es la entrada" : "Marcar como entrada"}
        </Button>
        <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={onDelete}>
          <Trash2 className="mr-1 h-4 w-4" />
          Eliminar
        </Button>
      </div>
    </div>
  );
}

function EdgePanel({ id, edges, onUpdateEdge, onDelete, errors }: Props & { id: string }) {
  const edge = edges.find((e) => e.id === id);
  if (!edge) return <p className="text-sm text-muted-foreground">Conexión no encontrada.</p>;

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold">Conexión</h2>
      <p className="text-xs text-muted-foreground">
        {edge.source} → {edge.target}
      </p>

      <div className="space-y-1.5">
        <Label htmlFor="edge-condition">Condición (JMESPath)</Label>
        <Textarea
          id="edge-condition"
          rows={3}
          className="font-mono text-xs"
          defaultValue={edge.data?.condition ?? ""}
          onChange={(e) => onUpdateEdge(edge.id, { condition: e.target.value || undefined })}
        />
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none">Ejemplos</summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            <li>
              <code>slots.email != null</code>
            </li>
            <li>
              <code>intent == 'support'</code>
            </li>
          </ul>
        </details>
        <p className="text-xs text-muted-foreground">Vacío = siempre (transición por defecto).</p>
      </div>

      <ErrorList messages={errors.details[edge.id]} />

      <div className="border-t pt-3">
        <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={onDelete}>
          <Trash2 className="mr-1 h-4 w-4" />
          Eliminar conexión
        </Button>
      </div>
    </div>
  );
}
