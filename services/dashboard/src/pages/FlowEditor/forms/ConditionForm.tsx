import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useConfigForm, type ConfigFormProps } from "./shared";

export function ConditionForm({ data, onChange }: ConfigFormProps) {
  const { register } = useConfigForm({ expr: (data.config.expr as string) ?? "" }, onChange);
  return (
    <form className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="expr">Condición (JMESPath)</Label>
        <Textarea id="expr" rows={3} className="font-mono text-xs" {...register("expr")} />
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none">Ejemplos</summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            <li>
              <code>slots.email != null</code>
            </li>
            <li>
              <code>intent == 'support'</code>
            </li>
            <li>
              <code>contains(text, 'precio')</code>
            </li>
          </ul>
        </details>
      </div>
    </form>
  );
}
