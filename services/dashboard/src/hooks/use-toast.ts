import { useEffect, useState } from "react";

const TOAST_LIMIT = 3;
const TOAST_REMOVE_DELAY = 4000;

export type ToastProps = {
  id: string;
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
};

type ToastInput = Omit<ToastProps, "id">;

let count = 0;
const listeners = new Set<(toasts: ToastProps[]) => void>();
let memoryState: ToastProps[] = [];

function dispatch(toasts: ToastProps[]) {
  memoryState = toasts;
  listeners.forEach((l) => l(toasts));
}

function addToast(input: ToastInput) {
  const id = String(++count);
  const toast: ToastProps = { ...input, id };
  dispatch([toast, ...memoryState].slice(0, TOAST_LIMIT));
  return id;
}

function dismissToast(id: string) {
  dispatch(memoryState.filter((t) => t.id !== id));
}

export const toast = {
  success: (title: string, description?: string) =>
    addToast({ title, description, variant: "default" }),
  error: (title: string, description?: string) =>
    addToast({ title, description, variant: "destructive" }),
  dismiss: dismissToast,
};

export function useToast() {
  const [state, setState] = useState<ToastProps[]>(memoryState);

  useEffect(() => {
    listeners.add(setState);
    return () => {
      listeners.delete(setState);
    };
  }, []);

  useEffect(() => {
    if (state.length === 0) return;
    const timers = state.map((t) =>
      window.setTimeout(() => dismissToast(t.id), TOAST_REMOVE_DELAY),
    );
    return () => timers.forEach(clearTimeout);
  }, [state]);

  return { toasts: state, dismiss: dismissToast };
}
