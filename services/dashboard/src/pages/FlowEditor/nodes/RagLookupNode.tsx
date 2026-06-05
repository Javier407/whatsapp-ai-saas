import type { NodeProps, Node } from "@xyflow/react";
import { Database } from "lucide-react";
import { BaseNode } from "./BaseNode";
import type { NodeData } from "../lib/mapping";

export function RagLookupNode({ data, selected }: NodeProps<Node<NodeData>>) {
  const query = (data.config.query_template as string) || "";
  const topK = data.config.top_k ?? "";
  return (
    <BaseNode data={data} selected={selected} icon={Database} color="text-teal-500">
      {query.slice(0, 40)} · top_k {String(topK)}
    </BaseNode>
  );
}
