import { Capacitor } from "@capacitor/core";
import { abrirPdfConVisor } from "../services/pdf-opener";
import type { CotizacionPdf } from "../services/cotizacion-pdf";

/**
 * Abre el PDF: en el celular muestra el selector "Abrir con" de Android con
 * los visores instalados; en web abre el PDF en una pestaña nueva.
 */
export async function openPdfViewer(pdf: CotizacionPdf): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await abrirPdfConVisor(pdf);
  } else {
    window.open(pdf.url, "_blank", "noopener,noreferrer");
  }
}

/** Cierra (no-op mantenido por compatibilidad con la API anterior). */
export function closePdfViewer(): void {
  // No hay visor integrado: la navegación externa no necesita cerrarse.
}

export { liberarPdf } from "../services/cotizacion-pdf";
