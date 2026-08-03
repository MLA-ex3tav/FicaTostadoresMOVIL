import type { IconName } from "./icons";

export interface ToastAction {
  label: string;
  onClick: () => void;
  primary?: boolean;
}

export interface ToastOptions {
  title: string;
  message?: string;
  icon?: IconName;
  tone?: "success" | "error" | "info" | "warning";
  /** ms antes de autocerrar; 0 = persistente. Default 10000. */
  durationMs?: number;
  actions?: ToastAction[];
}

export interface ToastItem extends ToastOptions {
  id: number;
}

type ToastListener = (toasts: ToastItem[]) => void;

let toasts: ToastItem[] = [];
let idSeq = 0;
const listeners = new Set<ToastListener>();

function emit(): void {
  listeners.forEach((listener) => listener([...toasts]));
}

export function subscribeToasts(listener: ToastListener): () => void {
  listeners.add(listener);
  listener([...toasts]);
  return () => {
    listeners.delete(listener);
  };
}

export function dismissToast(id: number): void {
  const index = toasts.findIndex((toast) => toast.id === id);
  if (index < 0) return;
  toasts = toasts.filter((toast) => toast.id !== id);
  emit();
}

/** Muestra una notificación toast (compatible con la API heredada). */
export function showToast(options: ToastOptions): () => void {
  const id = ++idSeq;
  toasts = [...toasts, { id, ...options }];
  emit();

  const duration = options.durationMs ?? 10_000;
  let timer: number | null = null;

  if (duration > 0) {
    timer = window.setTimeout(() => dismissToast(id), duration);
  }

  return () => {
    if (timer !== null) {
      window.clearTimeout(timer);
    }
    dismissToast(id);
  };
}
