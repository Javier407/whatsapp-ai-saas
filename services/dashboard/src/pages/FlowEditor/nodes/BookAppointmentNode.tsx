import type { NodeProps, Node } from "@xyflow/react";
import { CalendarDays } from "lucide-react";
import { BaseNode } from "./BaseNode";
import type { NodeData } from "../lib/mapping";

export function BookAppointmentNode({ data, selected }: NodeProps<Node<NodeData>>) {
  const service = (data.config.service_slot as string) || "service";
  const date = (data.config.date_slot as string) || "appointment_date";
  return (
    <BaseNode data={data} selected={selected} icon={CalendarDays} color="text-rose-500">
      slots: {service} · {date}
    </BaseNode>
  );
}
