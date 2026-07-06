import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Search } from "lucide-react";
import { conversations, type ConversationLog } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function messageText(log: ConversationLog): string {
  const c = log.content as { text?: string; body?: string };
  return c?.text ?? c?.body ?? JSON.stringify(log.content).slice(0, 80);
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
}

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString("es", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

type Contact = { waId: string; lastMessage: ConversationLog };

function deriveContacts(logs: ConversationLog[] | undefined): Contact[] {
  if (!logs) return [];
  const latestByWaId = new Map<string, ConversationLog>();
  for (const log of logs) {
    const existing = latestByWaId.get(log.wa_id);
    if (!existing || new Date(log.created_at) > new Date(existing.created_at)) {
      latestByWaId.set(log.wa_id, log);
    }
  }
  return [...latestByWaId.entries()]
    .map(([waId, lastMessage]) => ({ waId, lastMessage }))
    .sort(
      (a, b) =>
        new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime(),
    );
}

export function ConversationsPage() {
  const [search, setSearch] = useState("");
  const [selectedWaId, setSelectedWaId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: contactsData, isLoading: contactsLoading } = useQuery({
    queryKey: ["conversations", "contacts", search],
    queryFn: () => conversations.list({ wa_id: search || undefined, limit: 200 }),
  });

  const {
    data: threadData,
    isLoading: threadLoading,
    refetch: refetchThread,
  } = useQuery({
    queryKey: ["conversations", "thread", selectedWaId],
    queryFn: () => conversations.list({ wa_id: selectedWaId!, limit: 200 }),
    enabled: !!selectedWaId,
  });

  const stateQuery = useQuery({
    queryKey: ["conv-state", selectedWaId],
    queryFn: () => conversations.getState(selectedWaId!),
    enabled: !!selectedWaId,
  });

  const contacts = useMemo(() => deriveContacts(contactsData), [contactsData]);

  const thread = useMemo(
    () =>
      [...(threadData ?? [])].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      ),
    [threadData],
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [thread]);

  const handoff = stateQuery.data?.handoff ?? false;

  async function runAction(fn: () => Promise<unknown>) {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
      await refetchThread();
      await stateQuery.refetch();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full gap-4">
      {/* Contacts pane */}
      <div
        className={cn(
          "flex flex-col rounded-md border overflow-hidden",
          selectedWaId ? "hidden md:flex md:w-80 shrink-0" : "flex w-full md:w-80 md:shrink-0",
        )}
      >
        <div className="p-3 border-b shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por número…"
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {contactsLoading && <p className="p-4 text-sm text-muted-foreground">Cargando…</p>}
          {!contactsLoading && contacts.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">No se encontraron conversaciones.</p>
          )}
          {contacts.map((contact) => (
            <button
              key={contact.waId}
              type="button"
              onClick={() => {
                setSelectedWaId(contact.waId);
                setReplyText("");
                setActionError(null);
              }}
              className={cn(
                "w-full text-left px-3 py-3 border-b transition-colors hover:bg-muted/50",
                selectedWaId === contact.waId && "bg-primary/10",
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-sm font-medium truncate">{contact.waId}</span>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {formatDay(contact.lastMessage.created_at)}
                </span>
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {messageText(contact.lastMessage)}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Thread pane */}
      <div
        className={cn(
          "flex-1 flex flex-col rounded-md border overflow-hidden min-w-0",
          selectedWaId ? "flex" : "hidden md:flex",
        )}
      >
        {!selectedWaId && (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            Seleccioná una conversación para ver el historial.
          </div>
        )}

        {selectedWaId && (
          <>
            <div className="h-14 flex items-center gap-2 border-b px-3 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setSelectedWaId(null)}
                aria-label="Volver"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <span className="font-mono text-sm font-medium">{selectedWaId}</span>
              <span className="ml-auto">
                {stateQuery.isLoading ? (
                  <span className="text-xs text-muted-foreground">…</span>
                ) : handoff ? (
                  <Badge variant="destructive">En atención humana</Badge>
                ) : (
                  <Badge variant="secondary">Bot activo</Badge>
                )}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-muted/20">
              {threadLoading && <p className="text-sm text-muted-foreground">Cargando historial…</p>}
              {!threadLoading &&
                thread.map((log) => {
                  const isOutbound = log.direction === "outbound";
                  const isAgent = log.node_key === "human_agent";
                  return (
                    <div key={log.id} className={cn("flex", isOutbound ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                          isOutbound
                            ? "bg-primary text-primary-foreground rounded-br-sm"
                            : "bg-card border rounded-bl-sm",
                        )}
                      >
                        {isAgent && (
                          <p className="text-[10px] font-medium opacity-80 mb-0.5">Agente</p>
                        )}
                        <p className="whitespace-pre-wrap break-words">{messageText(log)}</p>
                        <p
                          className={cn(
                            "mt-1 text-[10px] opacity-70",
                            isOutbound ? "text-right" : "text-left",
                          )}
                        >
                          {formatTime(log.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              <div ref={bottomRef} />
            </div>

            {/* Agent controls — a person can reply in any chat, any time */}
            <div className="border-t p-3 shrink-0 space-y-2">
              {actionError && <p className="text-xs text-destructive">{actionError}</p>}
              <Textarea
                placeholder="Escribí una respuesta manual para el cliente…"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={2}
              />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  disabled={busy || !replyText.trim()}
                  onClick={() =>
                    runAction(async () => {
                      await conversations.reply(selectedWaId, replyText.trim());
                      setReplyText("");
                    })
                  }
                >
                  Enviar respuesta
                </Button>
                {handoff ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => runAction(() => conversations.resume(selectedWaId))}
                  >
                    Reanudar bot
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => runAction(() => conversations.takeover(selectedWaId))}
                  >
                    Tomar control
                  </Button>
                )}
                <p className="text-[11px] text-muted-foreground ml-auto">
                  {handoff
                    ? "El bot está en pausa: solo responde el equipo."
                    : "El bot sigue activo; tu mensaje se suma a la conversación."}
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
