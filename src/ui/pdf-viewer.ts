import type { CotizacionPdf } from "../services/cotizacion-pdf";

type PdfViewerListener = (pdf: CotizacionPdf | null) => void;

let activePdf: CotizacionPdf | null = null;
let currentUrl: string | null = null;
const listeners = new Set<PdfViewerListener>();

function emit(): void {
  listeners.forEach((listener) => listener(activePdf));
}

export function subscribePdfViewer(listener: PdfViewerListener): () => void {
  listeners.add(listener);
  listener(activePdf);
  return () => {
    listeners.delete(listener);
  };
}

/** Libera la URL temporal del PDF activo si existe. */
function revokeIfNeeded(): void {
  if (currentUrl) {
    URL.revokeObjectURL(currentUrl);
    currentUrl = null;
  }
}

/** Cierra el visor PDF y libera la URL temporal. */
export function closePdfViewer(): void {
  if (!activePdf) return;
  revokeIfNeeded();
  activePdf = null;
  emit();
}

/** Abre el PDF generado en el visor integrado (compatible con la API heredada). */
export function openPdfViewer(pdf: CotizacionPdf): void {
  closePdfViewer();
  currentUrl = pdf.url;
  activePdf = pdf;
  emit();
}

export { liberarPdf } from "../services/cotizacion-pdf";
