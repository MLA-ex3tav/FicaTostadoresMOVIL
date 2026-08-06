import type { SolicitudRemota } from "../lib/web-api";
import type { PillVariant } from "../components/StatusPill";
import { getProductColorById } from "../lib/product-colors";

export interface ProductoColorResumen {
  colorId: string | null;
  color: string | null;
  hex: string | null;
}

export const ESTADO_LABELS: Record<string, string> = {
  pendiente: "Pendiente",
  en_revision: "En revisión",
  en_cotizacion: "En cotización",
  aprobada_ot: "Aprobada (OT)",
  rechazada: "Rechazada",
  completada: "Completada",
  abierta: "Abierta",
  en_curso: "En curso",
  resuelta: "Resuelta",
  cerrada: "Cerrada",
  en_produccion: "En producción",
  terminada: "Terminada",
  entregada: "Entregada",
};

export const OT_ESTADO_LABELS: Record<string, string> = {
  aprobada_ot: "Por iniciar",
  en_produccion: "En producción",
  terminada: "Terminada",
  entregada: "Entregada",
};

export const OT_ESTADOS = ["aprobada_ot", "en_produccion", "terminada", "entregada"];

export function getEstado(item: SolicitudRemota, fallback: string): string {
  return typeof item.estado === "string" && item.estado.trim()
    ? item.estado
    : fallback;
}

export function formatFecha(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDate(
  dateInput: string | Date | null | undefined,
  options: { withTime?: boolean } = {},
): string {
  if (!dateInput) return "—";
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (Number.isNaN(date.getTime())) return "—";

  const opts: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "short",
    year: "numeric",
  };
  if (options.withTime) {
    opts.hour = "2-digit";
    opts.minute = "2-digit";
  }

  return date.toLocaleDateString("es-MX", opts);
}

export function formatBytes(bytes: number | undefined | null): string {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes <= 0) {
    return "—";
  }
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  const decimals = unitIndex === 0 ? 0 : value >= 10 ? 0 : 1;
  return `${value.toFixed(decimals)} ${units[unitIndex]}`;
}

export function resumirProductos(item: SolicitudRemota): string {
  if (!Array.isArray(item.products) || item.products.length === 0) {
    return "—";
  }

  const names = item.products
    .map((product) =>
      product && typeof product === "object" && "name" in product
        ? String((product as { name?: unknown }).name ?? "")
        : "",
    )
    .filter((name) => name.trim());

  if (names.length === 0) {
    return `${item.products.length} producto(s)`;
  }

  const extra = names.length - 1;
  return extra > 0 ? `${names[0]} +${extra}` : names[0];
}

/** Extrae los colores seleccionados de los productos de una cotización (desde la web). */
export function coloresProductos(item: SolicitudRemota): ProductoColorResumen[] {
  if (!Array.isArray(item.products)) return [];

  return item.products
    .map((product) => {
      if (!product || typeof product !== "object") return null;
      const record = product as Record<string, unknown>;
      const colorId =
        typeof record.selectedColorId === "string" && record.selectedColorId.trim()
          ? record.selectedColorId.trim()
          : null;
      const color =
        typeof record.selectedColor === "string" && record.selectedColor.trim()
          ? record.selectedColor.trim()
          : null;
      const defined = getProductColorById(colorId);
      return {
        colorId,
        color,
        hex: defined?.hex ?? null,
      };
    })
    .filter((entry): entry is ProductoColorResumen => entry !== null)
    .filter((entry) => entry.colorId !== null || entry.color !== null);
}

export function estadoLabel(estado: string): string {
  return ESTADO_LABELS[estado] ?? estado;
}

export function estadoPillVariant(estado: string): PillVariant {
  switch (estado) {
    case "aprobada_ot":
    case "completada":
    case "resuelta":
    case "cerrada":
    case "entregada":
      return "done";
    case "en_cotizacion":
    case "en_curso":
    case "en_produccion":
    case "terminada":
      return "progress";
    case "rechazada":
      return "error";
    default:
      return "pending";
  }
}

export function isToday(date: Date | null): boolean {
  if (!date) return false;
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

export function isThisWeek(date: Date | null): boolean {
  if (!date) return false;
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const time = date.getTime();
  return time <= now && now - time <= weekMs;
}

export function isThisMonth(date: Date | null): boolean {
  if (!date) return false;
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  );
}
