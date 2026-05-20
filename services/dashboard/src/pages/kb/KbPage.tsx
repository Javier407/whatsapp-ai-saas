import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, Trash2, RefreshCw } from "lucide-react";
import { kb, type KbDocument } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const SOURCE_TYPES = [
  { value: "text", label: "Texto" },
  { value: "pdf", label: "PDF" },
  { value: "faq_json", label: "FAQ (JSON)" },
  { value: "markdown", label: "Markdown" },
] as const;

const STATUS_LABELS: Record<KbDocument["status"], string> = {
  pending: "Pendiente",
  indexing: "Indexando",
  indexed: "Indexado",
  failed: "Error",
};

function statusVariant(status: KbDocument["status"]): BadgeProps["variant"] {
  switch (status) {
    case "indexed":
      return "success";
    case "indexing":
      return "warning";
    case "failed":
      return "destructive";
    default:
      return "secondary";
  }
}

export function KbPage() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [sourceType, setSourceType] = useState<string>("pdf");

  const { data, isLoading } = useQuery({
    queryKey: ["kb"],
    queryFn: kb.list,
    refetchInterval: (query) => {
      const hasPending = query.state.data?.some(
        (d) => d.status === "pending" || d.status === "indexing",
      );
      return hasPending ? 3000 : false;
    },
  });

  const uploadMut = useMutation({
    mutationFn: ({ file, type }: { file: File; type: string }) => kb.upload(file, type),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kb"] });
      if (fileRef.current) fileRef.current.value = "";
      toast.success("Documento subido", "Se indexará en breve.");
    },
    onError: (e) => toast.error("Error al subir", e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => kb.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kb"] });
      toast.success("Documento eliminado");
    },
    onError: (e) => toast.error("No se pudo eliminar", e.message),
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadMut.mutate({ file, type: sourceType });
  }

  function handleDelete(doc: KbDocument) {
    if (!window.confirm(`¿Eliminar «${doc.name}»?`)) return;
    deleteMut.mutate(doc.id);
  }

  if (isLoading) return <p className="text-muted-foreground">Cargando documentos…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Sube PDF, texto o FAQ para que el bot responda con tu información.
        </p>
        <div className="flex flex-wrap gap-2 items-center justify-end">
          <select
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value)}
            aria-label="Tipo de documento"
          >
            {SOURCE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <Button onClick={() => fileRef.current?.click()} disabled={uploadMut.isPending}>
            {uploadMut.isPending ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Subir archivo
          </Button>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept=".txt,.pdf,.json,.md"
            onChange={handleFileChange}
          />
        </div>
      </div>

      {data?.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No hay documentos. Sube el primero para entrenar al bot.
          </CardContent>
        </Card>
      )}

      <div className="md:hidden space-y-3">
        {data?.map((doc) => (
          <Card key={doc.id}>
            <CardContent className="p-4 space-y-2">
              <div className="flex justify-between gap-2">
                <p className="font-medium truncate">{doc.name}</p>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(doc)}
                  aria-label="Eliminar"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <Badge variant={statusVariant(doc.status)}>{STATUS_LABELS[doc.status]}</Badge>
                <span>{doc.source_type}</span>
                <span>{doc.chunk_count ?? "—"} fragmentos</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="hidden md:block rounded-md border overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">Nombre</th>
              <th className="px-4 py-3 text-left font-medium">Tipo</th>
              <th className="px-4 py-3 text-left font-medium">Estado</th>
              <th className="px-4 py-3 text-left font-medium">Fragmentos</th>
              <th className="px-4 py-3 text-left font-medium">Subido</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {data?.map((doc) => (
              <tr key={doc.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-4 py-3 font-medium">{doc.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{doc.source_type}</td>
                <td className="px-4 py-3">
                  <Badge variant={statusVariant(doc.status)}>{STATUS_LABELS[doc.status]}</Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{doc.chunk_count ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(doc.uploaded_at).toLocaleDateString("es")}
                </td>
                <td className="px-4 py-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(doc)}
                    aria-label="Eliminar"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
