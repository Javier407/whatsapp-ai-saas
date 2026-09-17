import type { ConfigFormProps } from "./shared";

// Terminal node: no configurable fields.
export function EndForm(_props: ConfigFormProps) {
  return (
    <p className="text-sm text-muted-foreground">
      Este nodo termina el flujo. No tiene configuración.
    </p>
  );
}
