import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { appointments, type Appointment } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const STATUSES = ["pendiente", "confirmada", "completada", "cancelada"] as const;

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "confirmada":
      return "default";
    case "completada":
      return "secondary";
    case "cancelada":
      return "destructive";
    default:
      return "outline";
  }
}

export function AppointmentsPage() {
  const [filter, setFilter] = useState<string>("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["appointments", filter],
    queryFn: () => appointments.list({ status: filter || undefined, limit: 200 }),
  });

  async function changeStatus(a: Appointment, status: string) {
    if (status === a.status) return;
    setBusyId(a.id);
    try {
      await appointments.updateStatus(a.id, status);
      await refetch();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setFilter("")}
          className={`text-sm px-3 py-1.5 rounded-md border transition-colors ${filter === "" ? "bg-primary text-primary-foreground" : "hover:bg-muted/50"}`}
        >
          Todas
        </button>
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`text-sm px-3 py-1.5 rounded-md border transition-colors capitalize ${filter === s ? "bg-primary text-primary-foreground" : "hover:bg-muted/50"}`}
          >
            {s}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-muted-foreground">Cargando citas…</p>}

      {!isLoading && (data?.length ?? 0) === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No hay citas{filter ? ` en estado "${filter}"` : ""}. Cuando un cliente agende por
            WhatsApp, aparecerá aquí.
          </CardContent>
        </Card>
      )}

      {(data?.length ?? 0) > 0 && (
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Cliente</th>
                <th className="px-4 py-3 text-left font-medium">Número</th>
                <th className="px-4 py-3 text-left font-medium">Servicio</th>
                <th className="px-4 py-3 text-left font-medium">Fecha pedida</th>
                <th className="px-4 py-3 text-left font-medium">Estado</th>
                <th className="px-4 py-3 text-left font-medium">Creada</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((a) => (
                <tr key={a.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">{a.customer_name ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs">{a.wa_id}</td>
                  <td className="px-4 py-3">{a.service ?? "—"}</td>
                  <td className="px-4 py-3">{a.appointment_date ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Badge variant={statusVariant(a.status)} className="capitalize">
                        {a.status}
                      </Badge>
                      <select
                        className="text-xs border rounded px-1 py-0.5 bg-background"
                        value={a.status}
                        disabled={busyId === a.id}
                        onChange={(e) => changeStatus(a, e.target.value)}
                        aria-label="Cambiar estado"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {new Date(a.created_at).toLocaleString("es")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
