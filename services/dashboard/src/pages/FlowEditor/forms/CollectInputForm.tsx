import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useConfigForm, selectClass, type ConfigFormProps } from "./shared";

export function CollectInputForm({ data, onChange }: ConfigFormProps) {
  const { register } = useConfigForm(
    {
      prompt: (data.config.prompt as string) ?? "",
      slot_name: (data.config.slot_name as string) ?? "",
      validator: (data.config.validator as string) ?? "any",
    },
    onChange,
  );
  return (
    <form className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="prompt">Pregunta</Label>
        <Textarea id="prompt" rows={2} {...register("prompt")} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="slot_name">Guardar en (slot)</Label>
        <Input id="slot_name" {...register("slot_name")} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="validator">Validación</Label>
        <select id="validator" className={selectClass} {...register("validator")}>
          <option value="any">Cualquiera</option>
          <option value="email">Email</option>
          <option value="phone">Teléfono</option>
          <option value="number">Número</option>
        </select>
      </div>
    </form>
  );
}
