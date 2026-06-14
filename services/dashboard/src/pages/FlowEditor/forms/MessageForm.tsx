import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useConfigForm, type ConfigFormProps } from "./shared";

export function MessageForm({ data, onChange }: ConfigFormProps) {
  const { register } = useConfigForm({ content: (data.config.content as string) ?? "" }, onChange);
  return (
    <form className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="content">Mensaje</Label>
        <Textarea id="content" rows={4} {...register("content")} />
      </div>
    </form>
  );
}
