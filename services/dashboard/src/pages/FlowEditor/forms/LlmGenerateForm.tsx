import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useConfigForm, type ConfigFormProps } from "./shared";

export function LlmGenerateForm({ data, onChange }: ConfigFormProps) {
  const { register } = useConfigForm(
    {
      system_prompt: (data.config.system_prompt as string) ?? "",
      user_prompt_template: (data.config.user_prompt_template as string) ?? "",
      max_tokens: (data.config.max_tokens as number) ?? 256,
      temperature: (data.config.temperature as number) ?? 0.2,
    },
    onChange,
  );
  return (
    <form className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="system_prompt">Prompt de sistema</Label>
        <Textarea id="system_prompt" rows={3} {...register("system_prompt")} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="user_prompt_template">Plantilla del usuario</Label>
        <Textarea id="user_prompt_template" rows={2} {...register("user_prompt_template")} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="max_tokens">Máx. tokens (≤1000)</Label>
          <Input id="max_tokens" type="number" min={1} max={1000} {...register("max_tokens", { valueAsNumber: true })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="temperature">Temperatura (0–1)</Label>
          <Input id="temperature" type="number" min={0} max={1} step={0.01} {...register("temperature", { valueAsNumber: true })} />
        </div>
      </div>
    </form>
  );
}
