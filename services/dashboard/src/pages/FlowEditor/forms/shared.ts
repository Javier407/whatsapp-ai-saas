import { useEffect } from "react";
import { useForm } from "react-hook-form";
import type { NodeData } from "../lib/mapping";

export type ConfigFormProps = {
  data: NodeData;
  onChange: (config: Record<string, unknown>) => void;
};

/** Tailwind classes that mirror <Input>, for native <select> elements. */
export const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

const identity = (v: Record<string, unknown>): Record<string, unknown> => v;

/**
 * Wires a react-hook-form to a node's config: seeds from `defaultValues` and
 * pushes every change to `onChange` (optionally transformed). Returns the form
 * so callers can use `register`, `control`, `watch`, etc.
 */
export function useConfigForm(
  defaultValues: Record<string, unknown>,
  onChange: (config: Record<string, unknown>) => void,
  transform: (v: Record<string, unknown>) => Record<string, unknown> = identity,
) {
  const form = useForm({ defaultValues });
  const { watch } = form;
  useEffect(() => {
    const sub = watch((value) => onChange(transform(value as Record<string, unknown>)));
    return () => sub.unsubscribe();
  }, [watch, onChange, transform]);
  return form;
}
