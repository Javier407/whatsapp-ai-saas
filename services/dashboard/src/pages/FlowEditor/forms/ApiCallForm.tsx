import { useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { selectClass, type ConfigFormProps } from "./shared";

type Values = {
  url: string;
  method: string;
  headerPairs: Array<{ key: string; value: string }>;
  body_template: string;
  slot_name: string;
};

// Cheap client-side hint only; the backend validator is the real SSRF guard.
const PRIVATE_HOST = /^https?:\/\/(10\.|127\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|localhost|metadata)/i;

export function ApiCallForm({ data, onChange }: ConfigFormProps) {
  const headersObj = (data.config.headers as Record<string, string>) ?? {};
  const form = useForm<Values>({
    defaultValues: {
      url: (data.config.url as string) ?? "",
      method: (data.config.method as string) ?? "GET",
      headerPairs: Object.entries(headersObj).map(([key, value]) => ({ key, value })),
      body_template: (data.config.body_template as string) ?? "",
      slot_name: (data.config.slot_name as string) ?? "",
    },
  });
  const { register, control, watch } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "headerPairs" });

  useEffect(() => {
    const sub = watch((v) => {
      const pairs = (v.headerPairs ?? []) as Array<{ key?: string; value?: string }>;
      const headers = Object.fromEntries(
        pairs.filter((p) => p?.key).map((p) => [p.key as string, p.value ?? ""]),
      );
      onChange({
        url: v.url ?? "",
        method: v.method ?? "GET",
        body_template: v.body_template ?? "",
        slot_name: v.slot_name ?? "",
        headers,
      });
    });
    return () => sub.unsubscribe();
  }, [watch, onChange]);

  const url = watch("url");
  const privateWarning = Boolean(url) && PRIVATE_HOST.test(url);

  return (
    <form className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="url">URL</Label>
        <Input id="url" {...register("url")} />
        {privateWarning && (
          <p className="text-xs text-destructive">
            Apunta a una dirección privada/reservada; el backend la rechazará (SSRF).
          </p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="method">Método</Label>
        <select id="method" className={selectClass} {...register("method")}>
          <option value="GET">GET</option>
          <option value="POST">POST</option>
        </select>
      </div>
      <div className="space-y-2">
        <Label>Headers</Label>
        {fields.map((f, i) => (
          <div key={f.id} className="flex gap-2">
            <Input placeholder="clave" {...register(`headerPairs.${i}.key`)} />
            <Input placeholder="valor" {...register(`headerPairs.${i}.value`)} />
            <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)} aria-label="Quitar header">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => append({ key: "", value: "" })}>
          <Plus className="mr-1 h-4 w-4" />
          Agregar header
        </Button>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="body_template">Cuerpo (opcional)</Label>
        <Textarea id="body_template" rows={2} {...register("body_template")} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="api_slot">Guardar respuesta en (slot, opcional)</Label>
        <Input id="api_slot" {...register("slot_name")} />
      </div>
    </form>
  );
}
