import type { NodeProps, Node } from "@xyflow/react";
import { Type } from "lucide-react";
import { BaseNode } from "./BaseNode";
import type { NodeData } from "../lib/mapping";

export function CollectInputNode({ data, selected }: NodeProps<Node<NodeData>>) {
  const slot = (data.config.slot_name as string) || "slot";
  return (
    <BaseNode data={data} selected={selected} icon={Type} color="text-amber-500">
      Guarda en → {slot}
    </BaseNode>
  );
}
