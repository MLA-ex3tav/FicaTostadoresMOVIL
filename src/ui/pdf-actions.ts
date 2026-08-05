import type { SolicitudRemota } from "../lib/web-api";

/** Forma estructural de un PDF generado (cotización u OT). */
export interface PdfFile {
  blob: Blob;
  fileName: string;
  url: string;
  item: SolicitudRemota;
}

let current: PdfFile | null = null;
const listeners = new Set<(pdf: PdfFile | null) => void>();

function emit(): void {
  listeners.forEach((listener) => listener(current));
}

export function subscribePdfActions(
  listener: (pdf: PdfFile | null) => void,
): () => void {
  listeners.add(listener);
  listener(current);
  return () => {
    listeners.delete(listener);
  };
}

/** Abre la hoja inferior de acciones (compartir, WhatsApp, correo, descargar). */
export function openPdfActions(pdf: PdfFile): void {
  current = pdf;
  emit();
}

export function closePdfActions(): void {
  current = null;
  emit();
}
