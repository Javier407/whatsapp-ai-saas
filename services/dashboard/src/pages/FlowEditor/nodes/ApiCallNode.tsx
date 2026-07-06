import type { NodeProps, Node } from "@xyflow/react";
import { Globe } from "lucide-react";
import { BaseNode } from "./BaseNode";
import type { NodeData } from "../lib/mapping";

export function ApiCallNode({ data, selected }: NodeProps<Node<NodeData>>) {
  const method = (data.config.method as string) || "GET";
  const url = (data.config.url as string) || "(sin URL)";
  return (
    <BaseNode data={data} selected={selected} icon={Globe} color="text-orange-500">
      {method} {url.slice(0, 40)}
    </BaseNode>
  );
}
