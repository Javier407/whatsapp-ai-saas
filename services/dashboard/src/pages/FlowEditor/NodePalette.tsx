import { cn } from "@/lib/utils";
import { NODE_REGISTRY } from "./lib/node-registry";
import type { NodeType } from "./lib/types";

type Props = { onAddNode: (type: NodeType) => void };

const DRAG_MIME = "application/x-flow-node-type";

export function NodePalette({ onAddNode }: Props) {
  const entries = Object.entries(NODE_REGISTRY) as Array<
    [NodeType, (typeof NODE_REGISTRY)[NodeType]]
  >;
  return (
    <aside className="w-48 shrink-0 overflow-y-auto border-r bg-card p-2">
      <h2 className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Nodos
      </h2>
      <div className="space-y-1">
        {entries.map(([type, { label, icon: Icon, color }]) => (
          <button
            key={type}
            type="button"
            draggable
            onDragStart={(e) => e.dataTransfer.setData(DRAG_MIME, type)}
            onClick={() => onAddNode(type)}
            className="flex w-full items-center gap-2 rounded-md border px-2 py-2 text-left text-sm transition-colors hover:bg-accent"
            title={`Agregar ${label}`}
          >
            <Icon className={cn("h-4 w-4 shrink-0", color)} />
            <span className="truncate">{label}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}

export { DRAG_MIME };
