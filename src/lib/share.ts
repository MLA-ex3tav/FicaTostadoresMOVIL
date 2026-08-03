import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import type { CotizacionPdf } from "../services/cotizacion-pdf";

/** Escribe el PDF en el almacenamiento de la app (Android) y devuelve el URI. */
async function persistPdf(pdf: CotizacionPdf): Promise<string> {
  const base64 = await blobToBase64(pdf.blob);
  const saved = await Filesystem.writeFile({
    path: pdf.fileName,
    directory: Directory.Cache,
    data: base64,
  });
  return saved.uri;
}

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

function pdfToFile(pdf: CotizacionPdf): File | null {
  try {
    return new File([pdf.blob], pdf.fileName, { type: "application/pdf" });
  } catch {
    return null;
  }
}

function canWebShareFiles(file: File | null): boolean {
  return (
    file !== null &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] })
  );
}

function baseText(pdf: CotizacionPdf): string {
  return `Hola, te comparto la cotización ${pdf.fileName} de Tostadores Fica.`;
}

/**
 * Comparte el PDF usando la hoja nativa del sistema con el archivo adjunto.
 * En Android usa @capacitor/share (garantiza el envío como archivo a
 * WhatsApp/Gmail); en web usa la Web Share API y, si no hay soporte de
 * archivos, hace fallback al método wa.me/mailto.
 */
async function sharePdfNative(
  pdf: CotizacionPdf,
  text: string,
  dialogTitle: string,
): Promise<"shared" | "cancelled" | "unsupported"> {
  try {
    if (Capacitor.isNativePlatform()) {
      const uri = await persistPdf(pdf);
      await Share.share({
        title: pdf.fileName,
        text,
        url: uri,
        dialogTitle,
      });
      return "shared";
    }

    const file = pdfToFile(pdf);

    if (canWebShareFiles(file)) {
      await navigator.share({
        files: [file as File],
        title: pdf.fileName,
        text,
      });
      return "shared";
    }

    return "unsupported";
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return "cancelled";
    }
    return "unsupported";
  }
}

/**
 * Comparte el PDF con la hoja nativa del sistema (WhatsApp, Gmail, etc.)
 * usando archivos adjuntos. Retorna true si se compartió o si el usuario
 * canceló la hoja (no es un fallo real).
 */
export async function compartirPdf(pdf: CotizacionPdf): Promise<boolean> {
  const result = await sharePdfNative(pdf, baseText(pdf), "Compartir cotización");
  return result === "shared" || result === "cancelled";
}

/** Abre la hoja de compartir para enviar el PDF por WhatsApp (como archivo). */
export async function abrirWhatsApp(pdf: CotizacionPdf): Promise<void> {
  const result = await sharePdfNative(pdf, baseText(pdf), "Enviar por WhatsApp");

  if (result === "unsupported" && !Capacitor.isNativePlatform()) {
    const text = encodeURIComponent(baseText(pdf));
    window.open(`https://wa.me/?text=${text}`, "_blank");
  }
}

/** Abre la hoja de compartir para enviar el PDF por correo (adjunto). */
export async function abrirGmail(pdf: CotizacionPdf): Promise<void> {
  const result = await sharePdfNative(pdf, baseText(pdf), "Enviar por correo");

  if (result === "unsupported" && !Capacitor.isNativePlatform()) {
    const subject = encodeURIComponent(`Cotización ${pdf.fileName} · Tostadores Fica`);
    const body = encodeURIComponent(
      `Adjunto la cotización ${pdf.fileName}.\n\nTostadores Fica Ltda.\nSan Ramón Pc. 39 Lt. 12-19, Padre Las Casas, Chile\nwww.tostadoresfica.cl`,
    );
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
  }
}

/** Descarga el PDF. En Android guarda en Descargas y abre el archivo. */
export async function descargarPdf(pdf: CotizacionPdf): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const base64 = await blobToBase64(pdf.blob);
    const saved = await Filesystem.writeFile({
      path: pdf.fileName,
      directory: Directory.Documents,
      data: base64,
      recursive: true,
    });

    await Share.share({
      title: pdf.fileName,
      url: saved.uri,
      dialogTitle: "Guardar o compartir PDF",
    });
    return;
  }

  const anchor = document.createElement("a");
  anchor.href = pdf.url;
  anchor.download = pdf.fileName;
  anchor.click();
}
