import type { NodeProps, Node } from "@xyflow/react";
import { StopCircle } from "lucide-react";
import { BaseNode } from "./BaseNode";
import type { NodeData } from "../lib/mapping";

export function EndNode({ data, selected }: NodeProps<Node<NodeData>>) {
  // Terminal node: target handle only, no outgoing source handle.
  return (
    <BaseNode data={data} selected={selected} icon={StopCircle} color="text-slate-500" terminal>
      Fin del flujo
    </BaseNode>
  );
}
