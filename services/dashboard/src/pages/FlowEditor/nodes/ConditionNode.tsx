import type { NodeProps, Node } from "@xyflow/react";
import { GitBranch } from "lucide-react";
import { BaseNode } from "./BaseNode";
import type { NodeData } from "../lib/mapping";

// NOTE: branching uses one default source handle for now; per-branch source
// handles (one per transition) are a visual refinement deferred to a later task.
export function ConditionNode({ data, selected }: NodeProps<Node<NodeData>>) {
  const expr = (data.config.expr as string) || "sin condición";
  return (
    <BaseNode data={data} selected={selected} icon={GitBranch} color="text-purple-500">
      <code className="font-mono">{expr.slice(0, 50)}</code>
    </BaseNode>
  );
}
