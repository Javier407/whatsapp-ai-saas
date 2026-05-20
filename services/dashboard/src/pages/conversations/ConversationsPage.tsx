import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { conversations, type ConversationLog } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function messageText(log: ConversationLog): string {
  const c = log.content as { text?: string; body?: string };
  return c?.text ?? c?.body ?? JSON.stringify(log.content).slice(0, 80);
}

function directionLabel(direction: string) {
  return direction === "inbound" ? "Entrante" : "Saliente";
}

export function ConversationsPage() {
  const [waId, setWaId] = useState("");
  const [selected, setSelected] = useState<ConversationLog | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["conversations", waId],
    queryFn: () => conversations.list({ wa_id: waId || undefined, limit: 100 }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <div className="flex gap-2 w-full sm:w-auto">
          <Input
            placeholder="Buscar por número de WhatsApp…"
            className="flex-1 sm:w-64"
            value={waId}
            onChange={(e) => setWaId(e.target.value)}
          />
          <Button variant="outline" size="icon" onClick={() => refetch()} aria-label="Buscar">
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading && <p className="text-muted-foreground">Cargando conversaciones…</p>}

      {!isLoading && data?.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No se encontraron conversaciones.
          </CardContent>
        </Card>
      )}

      <div className="md:hidden space-y-2">
        {data?.map((log) => (
          <Card
            key={log.id}
            className="cursor-pointer hover:bg-muted/30 transition-colors"
            onClick={() => setSelected(log)}
          >
            <CardContent className="p-4 space-y-2">
              <div className="flex justify-between items-start gap-2">
                <span className="font-mono text-xs truncate">{log.wa_id}</span>
                <Badge variant={log.direction === "inbound" ? "secondary" : "default"}>
                  {directionLabel(log.direction)}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">{messageText(log)}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(log.created_at).toLocaleString("es")}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="hidden md:block rounded-md border overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">Número</th>
              <th className="px-4 py-3 text-left font-medium">Dirección</th>
              <th className="px-4 py-3 text-left font-medium">Mensaje</th>
              <th className="px-4 py-3 text-left font-medium">Tokens</th>
              <th className="px-4 py-3 text-left font-medium">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((log) => (
              <tr
                key={log.id}
                className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                onClick={() => setSelected(log)}
              >
                <td className="px-4 py-3 font-mono text-xs">{log.wa_id}</td>
                <td className="px-4 py-3">
                  <Badge variant={log.direction === "inbound" ? "secondary" : "default"}>
                    {directionLabel(log.direction)}
                  </Badge>
                </td>
                <td className="px-4 py-3 max-w-xs truncate text-muted-foreground">
                  {messageText(log)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{log.llm_tokens ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">
                  {new Date(log.created_at).toLocaleString("es")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalle del mensaje</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <p>
                <span className="text-muted-foreground">Número: </span>
                <span className="font-mono">{selected.wa_id}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Dirección: </span>
                {directionLabel(selected.direction)}
              </p>
              <p>
                <span className="text-muted-foreground">Mensaje: </span>
                {messageText(selected)}
              </p>
              <pre className="text-xs bg-muted rounded p-4 overflow-auto max-h-48">
                {JSON.stringify(selected.content, null, 2)}
              </pre>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
