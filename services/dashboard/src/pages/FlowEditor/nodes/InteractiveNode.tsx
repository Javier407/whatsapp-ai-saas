import type { NodeProps, Node } from "@xyflow/react";
import { MousePointer2 } from "lucide-react";
import { BaseNode } from "./BaseNode";
import type { NodeData } from "../lib/mapping";

export function InteractiveNode({ data, selected }: NodeProps<Node<NodeData>>) {
  const header = (data.config.header as string) || "Interactivo";
  const count = Array.isArray(data.config.buttons) ? data.config.buttons.length : 0;
  return (
    <BaseNode data={data} selected={selected} icon={MousePointer2} color="text-indigo-500">
      {header} · {count} {count === 1 ? "botón" : "botones"}
    </BaseNode>
  );
}
