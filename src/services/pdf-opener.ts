import { Capacitor, registerPlugin } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { Directory, Filesystem } from "@capacitor/filesystem";
import type { CotizacionPdf } from "./cotizacion-pdf";

interface PdfOpenerPlugin {
  open(options: { filePath: string }): Promise<{ ok: boolean }>;
}

const PdfOpener = registerPlugin<PdfOpenerPlugin>("PdfOpener");

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      resolve(typeof result === "string" ? result.split(",")[1] ?? result : "");
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Guarda el PDF en el caché y abre el selector "Abrir con" de Android. */
async function openWithAndroidViewer(pdf: CotizacionPdf): Promise<void> {
  const base64 = await blobToBase64(pdf.blob);
  const safeName = pdf.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");

  await Filesystem.writeFile({
    path: safeName,
    directory: Directory.Cache,
    data: base64,
  });

  const uri = await Filesystem.getUri({ path: safeName, directory: Directory.Cache });
  await PdfOpener.open({ filePath: uri.uri.replace(/^file:\/\//, "") });
}

/**
 * Abre el PDF en un visor externo instalado en el celular (Android muestra el
 * selector "Abrir con"). En web abre el PDF en una pestaña nueva. Si falla el
 * visor nativo, hace fallback al navegador del sistema.
 */
export async function abrirPdfConVisor(pdf: CotizacionPdf): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await openWithAndroidViewer(pdf);
    } catch (error) {
      console.error("[pdf-opener] no se pudo abrir con visor:", error);
      await Browser.open({ url: pdf.url, presentationStyle: "fullscreen" });
    }
    return;
  }

  window.open(pdf.url, "_blank", "noopener,noreferrer");
}
