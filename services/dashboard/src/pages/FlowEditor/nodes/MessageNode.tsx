import type { NodeProps, Node } from "@xyflow/react";
import { MessageSquare } from "lucide-react";
import { BaseNode } from "./BaseNode";
import type { NodeData } from "../lib/mapping";

export function MessageNode({ data, selected }: NodeProps<Node<NodeData>>) {
  const content = (data.config.content as string) || "Sin mensaje";
  return (
    <BaseNode data={data} selected={selected} icon={MessageSquare} color="text-blue-500">
      {content.slice(0, 60)}
    </BaseNode>
  );
}
