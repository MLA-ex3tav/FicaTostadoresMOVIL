import type { CotizacionPdf } from "../services/cotizacion-pdf";

function pdfToFile(pdf: CotizacionPdf): File | null {
  try {
    return new File([pdf.blob], pdf.fileName, { type: "application/pdf" });
  } catch {
    return null;
  }
}

/**
 * Comparte el PDF con la hoja nativa del sistema (WhatsApp, Gmail, etc.)
 * usando la Web Share API con archivos adjuntos. Retorna true si se compartió.
 */
export async function compartirPdf(pdf: CotizacionPdf): Promise<boolean> {
  const file = pdfToFile(pdf);

  const canShareFiles =
    file !== null &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] });

  if (!canShareFiles) {
    return false;
  }

  try {
    await navigator.share({
      files: [file as File],
      title: pdf.fileName,
      text: `Cotización ${pdf.fileName} · Tostadores Fica`,
    });
    return true;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return true;
    }
    return false;
  }
}

export function abrirWhatsApp(pdf: CotizacionPdf): void {
  const text = encodeURIComponent(
    `Hola, te comparto la cotización ${pdf.fileName} de Tostadores Fica.`,
  );
  window.open(`https://wa.me/?text=${text}`, "_blank");
}

export function abrirGmail(pdf: CotizacionPdf): void {
  const subject = encodeURIComponent(`Cotización ${pdf.fileName} · Tostadores Fica`);
  const body = encodeURIComponent(
    `Adjunto la cotización ${pdf.fileName}.\n\nTostadores Fica Ltda.\nSan Ramón Pc. 39 Lt. 12-19, Padre Las Casas, Chile\nwww.tostadoresfica.cl`,
  );
  window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
}

export function descargarPdf(pdf: CotizacionPdf): void {
  const anchor = document.createElement("a");
  anchor.href = pdf.url;
  anchor.download = pdf.fileName;
  anchor.click();
}
