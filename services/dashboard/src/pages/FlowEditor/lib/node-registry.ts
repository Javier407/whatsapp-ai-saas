import type { ComponentType } from "react";
import {
  MessageSquare,
  MousePointer2,
  Type,
  GitBranch,
  Database,
  Sparkles,
  Globe,
  StopCircle,
} from "lucide-react";
import type { NodeType } from "./types";
import { MessageNode } from "../nodes/MessageNode";
import { InteractiveNode } from "../nodes/InteractiveNode";
import { CollectInputNode } from "../nodes/CollectInputNode";
import { ConditionNode } from "../nodes/ConditionNode";
import { RagLookupNode } from "../nodes/RagLookupNode";
import { LlmGenerateNode } from "../nodes/LlmGenerateNode";
import { ApiCallNode } from "../nodes/ApiCallNode";
import { EndNode } from "../nodes/EndNode";

/** Per-node-type metadata: palette label, icon, accent color, and the default
 *  config used when a new node of this type is created. */
export const NODE_REGISTRY: Record<
  NodeType,
  { label: string; icon: ComponentType<{ className?: string }>; color: string; defaultConfig: Record<string, unknown> }
> = {
  message: { label: "Mensaje", icon: MessageSquare, color: "text-blue-500", defaultConfig: { content: "" } },
  interactive: { label: "Interactivo", icon: MousePointer2, color: "text-indigo-500", defaultConfig: { header: "", body: "", buttons: [] } },
  collect_input: { label: "Pedir dato", icon: Type, color: "text-amber-500", defaultConfig: { prompt: "", slot_name: "", validator: "any" } },
  condition: { label: "Condición", icon: GitBranch, color: "text-purple-500", defaultConfig: { expr: "" } },
  rag_lookup: { label: "Buscar en KB", icon: Database, color: "text-teal-500", defaultConfig: { query_template: "{{message}}", top_k: 3, slot_name: "context" } },
  llm_generate: { label: "Generar con IA", icon: Sparkles, color: "text-green-600", defaultConfig: { system_prompt: "", user_prompt_template: "", max_tokens: 256, temperature: 0.2 } },
  api_call: { label: "Llamada API", icon: Globe, color: "text-orange-500", defaultConfig: { url: "", method: "GET", headers: {} } },
  end: { label: "Fin", icon: StopCircle, color: "text-slate-500", defaultConfig: {} },
};

/** Maps a node type to its custom xyflow renderer (passed to <ReactFlow nodeTypes>). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const NODE_TYPES_MAP: Record<string, ComponentType<any>> = {
  message: MessageNode,
  interactive: InteractiveNode,
  collect_input: CollectInputNode,
  condition: ConditionNode,
  rag_lookup: RagLookupNode,
  llm_generate: LlmGenerateNode,
  api_call: ApiCallNode,
  end: EndNode,
};
