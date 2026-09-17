import type { NodeProps, Node } from "@xyflow/react";
import { Sparkles } from "lucide-react";
import { BaseNode } from "./BaseNode";
import type { NodeData } from "../lib/mapping";

export function LlmGenerateNode({ data, selected }: NodeProps<Node<NodeData>>) {
  const prompt = (data.config.system_prompt as string) || "Generar respuesta";
  return (
    <BaseNode data={data} selected={selected} icon={Sparkles} color="text-green-600">
      {prompt.slice(0, 60)}
    </BaseNode>
  );
}
