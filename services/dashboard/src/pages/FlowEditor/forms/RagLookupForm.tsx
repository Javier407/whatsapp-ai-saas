import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useConfigForm, type ConfigFormProps } from "./shared";

export function RagLookupForm({ data, onChange }: ConfigFormProps) {
  const { register } = useConfigForm(
    {
      query_template: (data.config.query_template as string) ?? "{{message}}",
      top_k: (data.config.top_k as number) ?? 3,
      slot_name: (data.config.slot_name as string) ?? "context",
    },
    onChange,
  );
  return (
    <form className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="query_template">Consulta</Label>
        <Textarea id="query_template" rows={2} {...register("query_template")} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="top_k">Resultados (top_k, máx. 10)</Label>
        <Input id="top_k" type="number" min={1} max={10} {...register("top_k", { valueAsNumber: true })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="rag_slot">Guardar en (slot)</Label>
        <Input id="rag_slot" {...register("slot_name")} />
      </div>
    </form>
  );
}
