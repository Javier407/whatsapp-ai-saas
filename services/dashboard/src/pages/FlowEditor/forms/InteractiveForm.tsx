import { useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { ConfigFormProps } from "./shared";

type Values = {
  header: string;
  body: string;
  footer: string;
  buttons: Array<{ id: string; title: string }>;
};

export function InteractiveForm({ data, onChange }: ConfigFormProps) {
  const form = useForm<Values>({
    defaultValues: {
      header: (data.config.header as string) ?? "",
      body: (data.config.body as string) ?? "",
      footer: (data.config.footer as string) ?? "",
      buttons: (data.config.buttons as Values["buttons"]) ?? [],
    },
  });
  const { register, control, watch } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "buttons" });

  useEffect(() => {
    const sub = watch((v) => onChange(v as Record<string, unknown>));
    return () => sub.unsubscribe();
  }, [watch, onChange]);

  return (
    <form className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="header">Encabezado</Label>
        <Input id="header" {...register("header")} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="body">Cuerpo</Label>
        <Textarea id="body" rows={2} {...register("body")} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="footer">Pie (opcional)</Label>
        <Input id="footer" {...register("footer")} />
      </div>
      <div className="space-y-2">
        <Label>Botones</Label>
        {fields.map((f, i) => (
          <div key={f.id} className="flex gap-2">
            <Input placeholder="id" {...register(`buttons.${i}.id`)} />
            <Input placeholder="título" {...register(`buttons.${i}.title`)} />
            <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)} aria-label="Quitar botón">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => append({ id: "", title: "" })}>
          <Plus className="mr-1 h-4 w-4" />
          Agregar botón
        </Button>
      </div>
    </form>
  );
}
