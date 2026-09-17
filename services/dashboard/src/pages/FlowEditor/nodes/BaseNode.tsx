import { Handle, Position } from "@xyflow/react";
import type { ComponentType, ReactNode } from "react";
import { Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NodeData } from "../lib/mapping";

/**
 * Shared chrome for every node renderer: target handle (left), header with the
 * type icon + node key (+ entry flag), an optional body preview, and a source
 * handle (right) unless `terminal`. The component owns its box; xyflow's default
 * node chrome is neutralized in index.css.
 */
export function BaseNode({
  data,
  selected,
  icon: Icon,
  color,
  terminal = false,
  children,
}: {
  data: NodeData;
  selected?: boolean;
  icon: ComponentType<{ className?: string }>;
  color: string;
  terminal?: boolean;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "min-w-[180px] max-w-[240px] rounded-md border bg-card text-card-foreground shadow-sm",
        selected && "ring-2 ring-ring",
        data.isEntry && "ring-2 ring-green-500",
        data.hasError && "border-destructive ring-2 ring-destructive",
      )}
    >
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground" />
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <Icon className={cn("h-4 w-4 shrink-0", color)} />
        <span className="flex-1 truncate text-sm font-medium">{data.nodeKey}</span>
        {data.isEntry && <Flag className="h-3.5 w-3.5 shrink-0 text-green-500" />}
      </header>
      {children != null && (
        <div className="px-3 py-2 text-xs text-muted-foreground line-clamp-2">{children}</div>
      )}
      {!terminal && (
        <Handle type="source" position={Position.Right} className="!bg-muted-foreground" />
      )}
    </div>
  );
}
