import type { ViewId } from "../types";

const state: Partial<Record<ViewId, number>> = {};

type BadgeListener = (badges: Partial<Record<ViewId, number>>) => void;

const listeners = new Set<BadgeListener>();

function emit(): void {
  listeners.forEach((listener) => listener({ ...state }));
}

export function setNavBadge(viewId: ViewId, count: number): void {
  const next = count > 0 ? count : undefined;
  if (state[viewId] === next) return;
  state[viewId] = next;
  emit();
}

export function subscribeNavBadges(listener: BadgeListener): () => void {
  listeners.add(listener);
  listener({ ...state });
  return () => {
    listeners.delete(listener);
  };
}
