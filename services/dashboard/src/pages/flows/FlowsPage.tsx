import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Play, Trash2, Eye } from "lucide-react";
import { flows, type Flow } from "@/lib/api";
import { buildSimpleFlowPayload, flowSummary, parseKeywords } from "@/lib/flow-builder";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

const FLOW_TEMPLATE = JSON.stringify(
  buildSimpleFlowPayload({
    name: "Mi flujo",
    description: "",
    keywords: ["hola"],
    welcomeMessage: "¡Hola! ¿En qué puedo ayudarte?",
  }),
  null,
  2,
);

export function FlowsPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [createTab, setCreateTab] = useState("assistant");
  const [viewFlow, setViewFlow] = useState<Flow | null>(null);
  const [json, setJson] = useState(FLOW_TEMPLATE);
  const [jsonError, setJsonError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [keywords, setKeywords] = useState("hola, info");
  const [welcomeMessage, setWelcomeMessage] = useState("¡Hola! ¿En qué puedo ayudarte?");
  const [assistantError, setAssistantError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["flows"],
    queryFn: flows.list,
  });

  const createMut = useMutation({
    mutationFn: (payload: unknown) => flows.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["flows"] });
      setCreateOpen(false);
      resetCreateForm();
      toast.success("Flujo creado");
    },
    onError: (e) => toast.error("No se pudo crear el flujo", e.message),
  });

  const activateMut = useMutation({
    mutationFn: (id: string) => flows.activate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["flows"] });
      toast.success("Flujo activado");
    },
    onError: (e) => toast.error("No se pudo activar", e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => flows.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["flows"] });
      toast.success("Flujo eliminado");
    },
    onError: (e) => toast.error("No se pudo eliminar", e.message),
  });

  function resetCreateForm() {
    setJson(FLOW_TEMPLATE);
    setName("");
    setDescription("");
    setKeywords("hola, info");
    setWelcomeMessage("¡Hola! ¿En qué puedo ayudarte?");
    setJsonError(null);
    setAssistantError(null);
    setCreateTab("assistant");
  }

  function openCreate() {
    resetCreateForm();
    setCreateOpen(true);
  }

  function handleCreateJson() {
    setJsonError(null);
    let payload: unknown;
    try {
      payload = JSON.parse(json);
    } catch {
      setJsonError("JSON inválido");
      return;
    }
    createMut.mutate(payload);
  }

  function handleCreateAssistant() {
    setAssistantError(null);
    if (!name.trim()) {
      setAssistantError("El nombre es obligatorio");
      return;
    }
    if (!welcomeMessage.trim()) {
      setAssistantError("El mensaje de bienvenida es obligatorio");
      return;
    }
    const payload = buildSimpleFlowPayload({
      name,
      description,
      keywords: parseKeywords(keywords),
      welcomeMessage,
    });
    createMut.mutate(payload);
  }

  function handleDelete(flow: Flow) {
    if (!window.confirm(`¿Eliminar el flujo «${flow.name}»?`)) return;
    deleteMut.mutate(flow.id);
  }

  function statusBadge(flow: Flow) {
    return flow.is_active ? (
      <Badge variant="success">Activo</Badge>
    ) : (
      <Badge variant="secondary">Inactivo</Badge>
    );
  }

  if (isLoading) return <p className="text-muted-foreground">Cargando flujos…</p>;
  if (error) return <p className="text-destructive">No se pudieron cargar los flujos.</p>;

  const viewSummary = viewFlow ? flowSummary(viewFlow) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground md:hidden">
          Automatiza respuestas cuando los clientes escriben por WhatsApp.
        </p>
        <Button onClick={openCreate} className="shrink-0 self-end sm:self-auto">
          <Plus className="mr-2 h-4 w-4" />
          Nuevo flujo
        </Button>
      </div>

      {data?.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Aún no hay flujos. Crea uno para responder automáticamente a tus clientes.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {data?.map((flow) => (
          <Card key={flow.id}>
            <CardHeader className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3 min-w-0">
                <div className="min-w-0">
                  <CardTitle className="text-base truncate">{flow.name}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    v{flow.version} · {(flow.trigger as { type?: string }).type ?? "trigger"}
                  </p>
                </div>
                {statusBadge(flow)}
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setViewFlow(flow)}
                  aria-label="Ver flujo"
                >
                  <Eye className="h-4 w-4" />
                </Button>
                {!flow.is_active && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => activateMut.mutate(flow.id)}
                    disabled={activateMut.isPending}
                  >
                    <Play className="mr-1 h-3 w-3" />
                    Activar
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(flow)}
                  disabled={deleteMut.isPending}
                  aria-label="Eliminar flujo"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) resetCreateForm();
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo flujo</DialogTitle>
            <DialogDescription>
              Usa el asistente para un flujo simple o el editor avanzado para nodos complejos.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={createTab} onValueChange={setCreateTab}>
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="assistant">Asistente</TabsTrigger>
              <TabsTrigger value="advanced">Avanzado</TabsTrigger>
            </TabsList>

            <TabsContent value="assistant" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="flow-name">Nombre</Label>
                <Input
                  id="flow-name"
                  placeholder="Atención al cliente"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="flow-desc">Descripción (opcional)</Label>
                <Input
                  id="flow-desc"
                  placeholder="Responde consultas frecuentes"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="flow-keywords">Palabras clave</Label>
                <Input
                  id="flow-keywords"
                  placeholder="hola, info, precio"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Separadas por coma. Inician este flujo.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="flow-welcome">Mensaje de bienvenida</Label>
                <Textarea
                  id="flow-welcome"
                  rows={4}
                  value={welcomeMessage}
                  onChange={(e) => setWelcomeMessage(e.target.value)}
                />
              </div>
              {assistantError && <p className="text-xs text-destructive">{assistantError}</p>}
              <DialogFooter className="sm:justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateAssistant} disabled={createMut.isPending}>
                  {createMut.isPending ? "Creando…" : "Crear flujo"}
                </Button>
              </DialogFooter>
            </TabsContent>

            <TabsContent value="advanced" className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Para condiciones, RAG, llamadas API u otros nodos, edita el JSON completo.
              </p>
              <Textarea
                className="font-mono text-xs min-h-[16rem]"
                value={json}
                onChange={(e) => setJson(e.target.value)}
              />
              {jsonError && <p className="text-xs text-destructive">{jsonError}</p>}
              <DialogFooter className="sm:justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateJson} disabled={createMut.isPending}>
                  {createMut.isPending ? "Creando…" : "Crear flujo"}
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewFlow} onOpenChange={() => setViewFlow(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewFlow?.name}</DialogTitle>
          </DialogHeader>
          {viewFlow && viewSummary && (
            <div className="space-y-4 text-sm">
              {viewFlow.description && (
                <p className="text-muted-foreground">{viewFlow.description}</p>
              )}
              <dl className="grid gap-2 rounded-md border p-4 bg-muted/30">
                <div className="flex gap-2">
                  <dt className="text-muted-foreground w-32 shrink-0">Activación</dt>
                  <dd>{viewSummary.triggerType}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-muted-foreground w-32 shrink-0">Palabras clave</dt>
                  <dd>{viewSummary.keywords}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-muted-foreground w-32 shrink-0">Nodo inicial</dt>
                  <dd className="font-mono text-xs">{viewSummary.entryNode}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-muted-foreground w-32 shrink-0">Estado</dt>
                  <dd>{viewFlow.is_active ? "Activo" : "Inactivo"}</dd>
                </div>
              </dl>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Definición (JSON)</p>
                <pre className="text-xs bg-muted rounded p-4 overflow-auto max-h-64">
                  {JSON.stringify(viewFlow, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
