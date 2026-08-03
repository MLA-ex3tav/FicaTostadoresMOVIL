import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import type { CotizacionPdf } from "../services/cotizacion-pdf";

/** Abre el PDF en el navegador del sistema (nativo) o en una pestaña (web). */
export async function openPdfViewer(pdf: CotizacionPdf): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await Browser.open({ url: pdf.url, presentationStyle: "fullscreen" });
  } else {
    window.open(pdf.url, "_blank", "noopener,noreferrer");
  }
}

/** Cierra (no-op mantenido por compatibilidad con la API anterior). */
export function closePdfViewer(): void {
  // No hay visor integrado: la navegación externa no necesita cerrarse.
}

export { liberarPdf } from "../services/cotizacion-pdf";
