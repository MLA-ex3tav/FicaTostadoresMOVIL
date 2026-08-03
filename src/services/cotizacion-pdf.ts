import { jsPDF } from "jspdf";
import type { SolicitudRemota } from "../lib/web-api";
import {
  findProducto,
  getPrecioLocal,
  getCatalogo,
  loadCatalogo,
} from "./catalog";
import { showToast } from "../ui/toast";
import { openPdfViewer } from "../ui/pdf-viewer";
import { getCompanyData } from "../lib/company";

type RGB = [number, number, number];

const COLOR_PRIMARY: RGB = [232, 93, 4];
const COLOR_DARK: RGB = [31, 31, 37];
const COLOR_LIGHT_BG: RGB = [248, 248, 250];
const COLOR_BORDER: RGB = [220, 218, 212];
const COLOR_TEXT_DARK: RGB = [30, 30, 35];
const COLOR_TEXT_MUTED: RGB = [105, 100, 95];
const COLOR_WHITE: RGB = [255, 255, 255];

function text(value: unknown, fallback = "-"): string {
  const result = String(value ?? "").trim();
  return result || fallback;
}

function money(value: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value);
}

function dateLabel(date = new Date()): string {
  return date.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function numberFrom(...values: unknown[]): number {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value.replace(/[^0-9.-]/g, ""));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return 0;
}

async function imageDataUrl(src: string): Promise<string | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      canvas.getContext("2d")?.drawImage(image, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function lineItem(item: unknown): {
  code: string;
  name: string;
  quantity: number;
  unitPrice: number;
} {
  const record = item && typeof item === "object" ? item as Record<string, unknown> : {};
  const product = findProducto(record.productId, record.name) ?? undefined;
  const quantity = Math.max(1, numberFrom(record.quantity, record.cantidad, 1));
  const unitPrice = product ? getPrecioLocal(product) : numberFrom(record.price, record.precio, 0);

  return {
    code: text(record.productId ?? product?.id),
    name: text(record.name ?? product?.name),
    quantity,
    unitPrice,
  };
}

export interface CotizacionPdf {
  blob: Blob;
  fileName: string;
  url: string;
  item: SolicitudRemota;
}

/** Genera el PDF profesional de la orden aprobada. */
export async function generarCotizacionPdf(item: SolicitudRemota): Promise<CotizacionPdf> {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth(); // 297mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 210mm
  const margin = 12;

  let catalog = getCatalogo();
  if (catalog.length === 0) {
    try {
      catalog = await loadCatalogo();
    } catch {
      catalog = [];
    }
  }

  const products = Array.isArray(item.products)
    ? item.products.map((product) => lineItem(product))
    : [];
  const subtotal = products.reduce((sum, product) => sum + product.quantity * product.unitPrice, 0);

  // 1. Header principal
  const logo = await imageDataUrl("/assets/logo.webp");
  if (logo) {
    doc.addImage(logo, "PNG", margin, 10, 32, 32);
  }

  const company = getCompanyData();
  const companyName = text(company?.name, "TOSTADORES FICA LTDA");
  const companyAddress = text(
    company ? [company.address, company.city, company.region].filter(Boolean).join(", ") : "",
    "San Ramón Pc. 39 Lt. 12-19, Padre Las Casas, Chile",
  );
  const companyPhone = text(company?.phone, "+56 9 85088171");
  const companyEmail = text(company?.email, "tostadoresfica@gmail.com");
  const companyWebsite = text(company?.website, "www.tostadoresfica.cl");

  // Info Empresa (Izquierda)
  doc.setTextColor(...COLOR_DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(companyName.toUpperCase().slice(0, 40), margin + 36, 17);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLOR_TEXT_MUTED);
  doc.text("FÁBRICA DE MAQUINARIAS · FRUTOS SECOS & PROCESAMIENTO", margin + 36, 22);
  doc.text(companyAddress.slice(0, 60), margin + 36, 26);
  doc.text(`Teléfono: ${companyPhone}  |  Email: ${companyEmail}`.slice(0, 72), margin + 36, 30);
  doc.text(`Sitio Web: ${companyWebsite}`.slice(0, 60), margin + 36, 34);

  // Banner Documento (Derecha)
  const headerCardX = 182;
  const headerCardW = 103;
  doc.setFillColor(...COLOR_DARK);
  doc.roundedRect(headerCardX, 10, headerCardW, 30, 3, 3, "F");

  doc.setTextColor(...COLOR_PRIMARY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("COTIZACIÓN DE COMPRA", headerCardX + 8, 17);

  doc.setTextColor(...COLOR_WHITE);
  doc.setFontSize(9);
  doc.text(`N° DOCUMENTO: ${text(item.id).slice(0, 16)}`, headerCardX + 8, 23);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`FECHA EMISIÓN: ${dateLabel()}`, headerCardX + 8, 29);
  doc.text("VALIDEZ: 10 DÍAS HÁBILES", headerCardX + 8, 34);

  // 2. Tarjetas de Información (Cliente / Envío)
  const cardY = 44;
  const cardW = 133;
  const cardH = 38;

  // Tarjeta Cliente
  doc.setFillColor(...COLOR_LIGHT_BG);
  doc.setDrawColor(...COLOR_BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, cardY, cardW, cardH, 2, 2, "FD");

  doc.setFillColor(...COLOR_PRIMARY);
  doc.rect(margin, cardY, 3, cardH, "F");

  doc.setTextColor(...COLOR_PRIMARY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("INFORMACIÓN DEL CLIENTE", margin + 7, cardY + 6);

  const clientName = text(item.clientName, "Sin cliente registrado");
  const shipping = item.shipping && typeof item.shipping === "object"
    ? item.shipping as Record<string, unknown>
    : {};

  doc.setFontSize(8);
  doc.setTextColor(...COLOR_TEXT_DARK);
  doc.setFont("helvetica", "bold");
  doc.text("Nombre / Razón Social:", margin + 7, cardY + 13);
  doc.setFont("helvetica", "normal");
  doc.text(clientName.slice(0, 42), margin + 44, cardY + 13);

  doc.setFont("helvetica", "bold");
  doc.text("RUT / DNI / Tax ID:", margin + 7, cardY + 19);
  doc.setFont("helvetica", "normal");
  doc.text(text(item.clientTaxId, "N/A"), margin + 44, cardY + 19);

  doc.setFont("helvetica", "bold");
  doc.text("Contacto / Email:", margin + 7, cardY + 25);
  doc.setFont("helvetica", "normal");
  doc.text(`${text(item.clientEmail)} · ${text(item.clientPhone)}`.slice(0, 45), margin + 44, cardY + 25);

  doc.setFont("helvetica", "bold");
  doc.text("Dirección / País:", margin + 7, cardY + 31);
  doc.setFont("helvetica", "normal");
  doc.text(`${text(shipping.address ?? item.clientAddress)}, ${text(item.clientCountry)}`.slice(0, 45), margin + 44, cardY + 31);

  // Tarjeta Logística y Envío
  const card2X = margin + cardW + 7;
  doc.setFillColor(...COLOR_LIGHT_BG);
  doc.setDrawColor(...COLOR_BORDER);
  doc.roundedRect(card2X, cardY, cardW, cardH, 2, 2, "FD");

  doc.setFillColor(...COLOR_DARK);
  doc.rect(card2X, cardY, 3, cardH, "F");

  doc.setTextColor(...COLOR_DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("DATOS DE RUTA Y LOGÍSTICA DE ENVÍO", card2X + 7, cardY + 6);

  doc.setFontSize(8);
  doc.setTextColor(...COLOR_TEXT_DARK);
  doc.setFont("helvetica", "bold");
  doc.text("Origen de Carga:", card2X + 7, cardY + 13);
  doc.setFont("helvetica", "normal");
  doc.text(`${text(shipping.origin, companyAddress)} (ZIP: ${text(shipping.originZip, company.zip)})`, card2X + 38, cardY + 13);

  doc.setFont("helvetica", "bold");
  doc.text("Destino de Entrega:", card2X + 7, cardY + 19);
  doc.setFont("helvetica", "normal");
  doc.text(`${text(shipping.destination, "Por acordar con cliente")} (ZIP: ${text(shipping.destinationZip, "N/A")})`, card2X + 38, cardY + 19);

  doc.setFont("helvetica", "bold");
  doc.text("Modalidad Despacho:", card2X + 7, cardY + 25);
  doc.setFont("helvetica", "normal");
  doc.text("Flete Terrestre / Marítimo Internacional", card2X + 38, cardY + 25);

  doc.setFont("helvetica", "bold");
  doc.text("Estado de Solicitud:", card2X + 7, cardY + 31);
  doc.setFont("helvetica", "normal");
  doc.text(text(item.estado, "Aprobada para Producción").toUpperCase(), card2X + 38, cardY + 31);

  // 3. Tabla de Productos
  const tableY = 86;
  const colX = [margin, 46, 172, 205, 237];
  const colW = [34, 126, 33, 32, 48];
  const tableW = pageWidth - margin * 2;

  // Cabecera Tabla
  doc.setFillColor(...COLOR_DARK);
  doc.roundedRect(margin, tableY, tableW, 8, 1, 1, "F");
  doc.setTextColor(...COLOR_WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);

  doc.text("CÓDIGO", colX[0] + 3, tableY + 5.5);
  doc.text("DESCRIPCIÓN DEL PRODUCTO", colX[1] + 3, tableY + 5.5);
  doc.text("PRECIO UNIT.", colX[2] + colW[2] - 3, tableY + 5.5, { align: "right" });
  doc.text("CANTIDAD", colX[3] + colW[3] / 2, tableY + 5.5, { align: "center" });
  doc.text("TOTAL CLP", colX[4] + colW[4] - 3, tableY + 5.5, { align: "right" });

  // Filas Tabla
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLOR_TEXT_DARK);

  const displayRows = products.length > 0
    ? products
    : [{ code: "FT-GEN", name: "Servicio de Fabricación de Maquinaria", quantity: 1, unitPrice: subtotal || 0 }];

  displayRows.slice(0, 5).forEach((product, index) => {
    const rowY = tableY + 8 + index * 9;
    const bg: RGB = index % 2 === 0 ? COLOR_WHITE : COLOR_LIGHT_BG;

    doc.setFillColor(...bg);
    doc.rect(margin, rowY, tableW, 9, "F");
    doc.setDrawColor(...COLOR_BORDER);
    doc.line(margin, rowY + 9, margin + tableW, rowY + 9);

    doc.text(product.code.slice(0, 16), colX[0] + 3, rowY + 6);
    doc.text(product.name.slice(0, 56), colX[1] + 3, rowY + 6);
    doc.text(money(product.unitPrice), colX[2] + colW[2] - 3, rowY + 6, { align: "right" });
    doc.text(String(product.quantity), colX[3] + colW[3] / 2, rowY + 6, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.text(money(product.unitPrice * product.quantity), colX[4] + colW[4] - 3, rowY + 6, { align: "right" });
    doc.setFont("helvetica", "normal");
  });

  // 4. Bloque Inferior: Observaciones + Totales
  const summaryY = tableY + 8 + Math.min(displayRows.length, 5) * 9 + 4;
  const obsW = 160;
  const totalsW = tableW - obsW - 6;
  const totalsX = margin + obsW + 6;

  // Box Observaciones
  doc.setFillColor(...COLOR_LIGHT_BG);
  doc.setDrawColor(...COLOR_BORDER);
  doc.roundedRect(margin, summaryY, obsW, 26, 2, 2, "FD");

  doc.setTextColor(...COLOR_PRIMARY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("OBSERVACIONES Y NOTAS DE FABRICACIÓN:", margin + 4, summaryY + 6);
  doc.setTextColor(...COLOR_TEXT_MUTED);
  doc.setFont("helvetica", "normal");
  doc.text(text(item.message, "Sin observaciones adicionales registradas para este pedido."), margin + 4, summaryY + 12, { maxWidth: obsW - 8 });

  // Tabla Totales
  const tRowH = 8;

  // Subtotal
  doc.setFillColor(...COLOR_WHITE);
  doc.rect(totalsX, summaryY, totalsW, tRowH, "FD");
  doc.setTextColor(...COLOR_TEXT_MUTED);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("SUBTOTAL:", totalsX + 4, summaryY + 5.5);
  doc.setTextColor(...COLOR_TEXT_DARK);
  doc.text(money(subtotal), totalsX + totalsW - 4, summaryY + 5.5, { align: "right" });

  // Descuento
  doc.setFillColor(...COLOR_LIGHT_BG);
  doc.rect(totalsX, summaryY + tRowH, totalsW, tRowH, "FD");
  doc.setTextColor(...COLOR_TEXT_MUTED);
  doc.text("DESCUENTO:", totalsX + 4, summaryY + tRowH + 5.5);
  doc.setTextColor(...COLOR_TEXT_DARK);
  doc.text(money(0), totalsX + totalsW - 4, summaryY + tRowH + 5.5, { align: "right" });

  // Total PAGO
  doc.setFillColor(...COLOR_PRIMARY);
  doc.roundedRect(totalsX, summaryY + tRowH * 2, totalsW, tRowH + 2, 1, 1, "F");
  doc.setTextColor(...COLOR_WHITE);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL FINAL CLP:", totalsX + 4, summaryY + tRowH * 2 + 6.5);
  doc.text(money(subtotal), totalsX + totalsW - 4, summaryY + tRowH * 2 + 6.5, { align: "right" });

  // 5. Garantía & Términos
  const termsY = summaryY + 30;
  const termsW = tableW;
  doc.setFillColor(255, 246, 240);
  doc.setDrawColor(...COLOR_PRIMARY);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, termsY, termsW, 16, 2, 2, "FD");

  doc.setTextColor(...COLOR_PRIMARY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("TÉRMINOS Y CONDICIONES DE FABRICACIÓN Y GARANTÍA", margin + 6, termsY + 5);

  doc.setTextColor(...COLOR_TEXT_DARK);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("• 1 AÑO DE GARANTÍA OFICIAL: Cobertura total de fábrica con soporte técnico y disponibilidad de repuestos.", margin + 6, termsY + 10);
  doc.text("• TIEMPO DE PRODUCCIÓN: 25 días hábiles de fabricación (margen de ±5 días según requerimientos especiales).", margin + 6, termsY + 13.5);
  doc.text("• ADUANA Y ARANCELES: Los valores no incluyen costos de impuestos o tramitación aduanera fuera de Chile.", margin + 140, termsY + 10);

  // 6. Footer de la Empresa
  const footerY = pageHeight - 15;
  doc.setFillColor(...COLOR_DARK);
  doc.rect(0, footerY, pageWidth, 15, "F");

  doc.setTextColor(...COLOR_WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(`${companyName.toUpperCase()}  ·  RUT: ${text(company?.taxId, "76.683.592-9")}`.slice(0, 62), margin, footerY + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(`Casa Matriz: ${companyAddress}  |  Tel: ${companyPhone}`.slice(0, 80), margin, footerY + 10.5);

  doc.setFont("helvetica", "bold");
  doc.text("FORMAS DE PAGO:", pageWidth - margin - 85, footerY + 6);
  doc.setFont("helvetica", "normal");
  doc.text("Transferencia Remesa · PayPal · Efectivo", pageWidth - margin - 85, footerY + 10.5);

  const blob = doc.output("blob");
  const fileName = `OT-${text(item.id, "sin-numero")}.pdf`;
  const url = URL.createObjectURL(blob);

  return { blob, fileName, url, item };
}

/** Descarga un PDF generado, notifica al usuario indicando la ubicación e integra apertura directa. */
export function descargarPdf(pdf: CotizacionPdf): void {
  const anchor = document.createElement("a");
  anchor.href = pdf.url;
  anchor.download = pdf.fileName;
  anchor.click();

  showToast({
    title: "Archivo Guardado",
    message: `El documento ${pdf.fileName} se guardó en tu carpeta de Descargas (Downloads).`,
    tone: "success",
    icon: "fileText",
    durationMs: 12000,
    actions: [
      {
        label: "Abrir documento",
        primary: true,
        onClick: () => openPdfViewer(pdf),
      },
    ],
  });
}

/** Libera la URL temporal de un PDF que ya no se necesita. */
export function liberarPdf(pdf: CotizacionPdf): void {
  URL.revokeObjectURL(pdf.url);
}
