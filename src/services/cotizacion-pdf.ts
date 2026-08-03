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
const COLOR_DARK: RGB = [28, 28, 32];
const COLOR_LIGHT_BG: RGB = [248, 248, 250];
const COLOR_BORDER: RGB = [220, 218, 212];
const COLOR_TEXT_DARK: RGB = [30, 30, 35];
const COLOR_TEXT_MUTED: RGB = [105, 100, 95];
const COLOR_WHITE: RGB = [255, 255, 255];

function text(value: unknown, fallback = "-"): string {
  const result = String(value ?? "").trim();
  return result || fallback;
}

function moneyCLP(value: number): string {
  const rounded = Math.round(value);
  return `${rounded.toLocaleString("es-CL")}$`;
}

function dateLabel(date = new Date()): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}-${month}-${date.getFullYear()}`;
}

function comunaFrom(address: string): string {
  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 1] : "";
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

const IVA_RATE = 0.19;

/** Genera el PDF de la cotización replicando el diseño oficial de FICA. */
export async function generarCotizacionPdf(item: SolicitudRemota): Promise<CotizacionPdf> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 14;

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
  const neto = products.reduce((sum, product) => sum + product.quantity * product.unitPrice, 0);
  const iva = Math.round(neto * IVA_RATE);
  const total = neto + iva;

  const company = getCompanyData();
  const companyName = text(company.name, "TOSTADORES FICA LTDA");
  const companyTaxId = text(company.taxId, "76.683.592-9");
  const companyAddress = text(
    [company.address, company.city, company.region].filter(Boolean).join(", "),
    "San Ramón Pc. 39 Lt. 12-19, Padre Las Casas, Chile",
  );
  const companyPhone = text(company.phone, "+56 9 9002 0089");
  const companyEmail = text(company.email, "administracion@tostadoresfica.cl");
  const companyGiro = text(company.giro, "Reparación y mantención de maq.");
  const companyBank = text(company.bankName, "BANCO SCOTIABANK");
  const companyAccount = text(company.bankAccount, "CUENTA CORRIENTE 979706529");

  const clientName = text(item.clientName, "Sin cliente registrado");
  const clientRut = text(item.clientRut, "N/A");
  const clientPhone = text(item.clientPhone, "N/A");
  const clientEmail = text(item.clientEmail, "N/A");
  const clientAddress = text(item.clientAddress, "Por acordar con el cliente");
  const clientComuna = comunaFrom(clientAddress) || text(item.clientComuna, "N/A");

  // ── 1. Encabezado: logo + nombre empresa (izquierda) / COTIZACIÓN (derecha) ──
  const logo = await imageDataUrl("/assets/logo.webp");
  let headerTextX = margin;
  if (logo) {
    doc.addImage(logo, "PNG", margin, 10, 20, 20);
    headerTextX = margin + 24;
  }

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLOR_DARK);
  doc.setFontSize(13);
  doc.text(companyName.toUpperCase().slice(0, 40), headerTextX, 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_TEXT_MUTED);
  doc.text(`RUT: ${companyTaxId}`, headerTextX, 23.5);
  doc.text(`GIRO: ${companyGiro}`.slice(0, 52), headerTextX, 27.5);
  doc.text(`DIRECCIÓN: ${companyAddress}`.slice(0, 58), headerTextX, 31.5);

  // Banner COTIZACIÓN
  const docLabel = "COTIZACIÓN";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text(docLabel, pageWidth - margin, 20, { align: "right" });

  doc.setFontSize(8);
  doc.setTextColor(...COLOR_DARK);
  doc.text(`Nº ${text(item.id).slice(0, 16)}`, pageWidth - margin, 27, { align: "right" });
  doc.text(`FECHA EMISIÓN: ${dateLabel()}`, pageWidth - margin, 31.5, { align: "right" });
  doc.text("VALIDEZ: 15 DÍAS", pageWidth - margin, 35.5, { align: "right" });

  doc.setDrawColor(...COLOR_PRIMARY);
  doc.setLineWidth(0.5);
  doc.line(margin, 39, pageWidth - margin, 39);

  // ── 2. Bloques: DATOS EMPRESA / CUENTA BANCARIA ──
  const blockY = 43;
  const blockH = 34;
  const blockW = (pageWidth - margin * 2 - 6) / 2;

  const drawEmpresaBlock = (x: number, title: string, lines: string[]) => {
    doc.setFillColor(...COLOR_LIGHT_BG);
    doc.setDrawColor(...COLOR_BORDER);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, blockY, blockW, blockH, 2, 2, "FD");

    doc.setFillColor(...COLOR_DARK);
    doc.rect(x, blockY, 2.5, blockH, "F");

    doc.setTextColor(...COLOR_DARK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(title, x + 6, blockY + 6);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLOR_TEXT_DARK);
    lines.slice(0, 4).forEach((line, index) => {
      doc.text(line.slice(0, 48), x + 6, blockY + 12.5 + index * 5.5);
    });
  };

  drawEmpresaBlock(margin, "DATOS EMPRESA:", [
    companyName.toUpperCase(),
    `RUT: ${companyTaxId}`,
    `GIRO: ${companyGiro}`,
    `CASA MATRIZ: ${companyAddress}`,
  ]);

  drawEmpresaBlock(margin + blockW + 6, "CUENTA BANCARIA:", [
    companyName.toUpperCase(),
    `RUT ${companyTaxId}`,
    companyBank.toUpperCase(),
    companyAccount.toUpperCase(),
  ]);

  // ── 3. Datos del Cliente ──
  const clientY = blockY + blockH + 6;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...COLOR_BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, clientY, pageWidth - margin * 2, 30, 2, 2, "FD");

  doc.setFillColor(...COLOR_PRIMARY);
  doc.rect(margin, clientY, 2.5, 30, "F");

  doc.setTextColor(...COLOR_PRIMARY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("DATOS DEL CLIENTE", margin + 6, clientY + 6);

  const clientLeftX = margin + 6;
  const clientRightX = pageWidth / 2 + 6;

  doc.setTextColor(...COLOR_TEXT_DARK);
  doc.setFontSize(8);

  doc.setFont("helvetica", "bold");
  doc.text("NOMBRE:", clientLeftX, clientY + 12.5);
  doc.setFont("helvetica", "normal");
  doc.text(clientName.slice(0, 40), clientLeftX + 20, clientY + 12.5);

  doc.setFont("helvetica", "bold");
  doc.text("DIRECCIÓN:", clientLeftX, clientY + 18.5);
  doc.setFont("helvetica", "normal");
  doc.text(clientAddress.slice(0, 48), clientLeftX + 20, clientY + 18.5);

  doc.setFont("helvetica", "bold");
  doc.text("E-MAIL:", clientLeftX, clientY + 24.5);
  doc.setFont("helvetica", "normal");
  doc.text(clientEmail.slice(0, 44), clientLeftX + 20, clientY + 24.5);

  doc.setFont("helvetica", "bold");
  doc.text("RUT:", clientRightX, clientY + 12.5);
  doc.setFont("helvetica", "normal");
  doc.text(clientRut.slice(0, 20), clientRightX + 12, clientY + 12.5);

  doc.setFont("helvetica", "bold");
  doc.text("COMUNA:", clientRightX, clientY + 18.5);
  doc.setFont("helvetica", "normal");
  doc.text(clientComuna.slice(0, 30), clientRightX + 20, clientY + 18.5);

  doc.setFont("helvetica", "bold");
  doc.text("TELÉFONO:", clientRightX, clientY + 24.5);
  doc.setFont("helvetica", "normal");
  doc.text(clientPhone.slice(0, 24), clientRightX + 20, clientY + 24.5);

  // ── 4. Tabla de Productos ──
  const tableY = clientY + 36;
  const colX = [margin, 102, 126, 150, 162];
  const colW = [88, 24, 24, 12, 34];
  const tableW = pageWidth - margin * 2;

  doc.setFillColor(...COLOR_DARK);
  doc.roundedRect(margin, tableY, tableW, 8, 1, 1, "F");
  doc.setTextColor(...COLOR_WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);

  doc.text("PRODUCTO", colX[0] + 3, tableY + 5.5);
  doc.text("CÓDIGO", colX[1] + 3, tableY + 5.5);
  doc.text("VALOR UNIDAD", colX[2] + colW[2] - 3, tableY + 5.5, { align: "right" });
  doc.text("CANTIDAD", colX[3] + colW[3] / 2, tableY + 5.5, { align: "center" });
  doc.text("VALOR TOTAL NETO", colX[4] + colW[4] - 3, tableY + 5.5, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLOR_TEXT_DARK);

  const displayRows = products.length > 0
    ? products
    : [{ code: "FT-GEN", name: "Servicio de Fabricación de Maquinaria", quantity: 1, unitPrice: neto || 0 }];

  displayRows.slice(0, 8).forEach((product, index) => {
    const rowY = tableY + 8 + index * 9;
    const bg: RGB = index % 2 === 0 ? COLOR_WHITE : COLOR_LIGHT_BG;

    doc.setFillColor(...bg);
    doc.rect(margin, rowY, tableW, 9, "F");
    doc.setDrawColor(...COLOR_BORDER);
    doc.setLineWidth(0.2);
    doc.line(margin, rowY + 9, margin + tableW, rowY + 9);

    doc.text(product.name.slice(0, 54), colX[0] + 3, rowY + 6);
    doc.text(product.code.slice(0, 14), colX[1] + 3, rowY + 6);
    doc.text(moneyCLP(product.unitPrice), colX[2] + colW[2] - 3, rowY + 6, { align: "right" });
    doc.text(String(product.quantity), colX[3] + colW[3] / 2, rowY + 6, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.text(moneyCLP(product.unitPrice * product.quantity), colX[4] + colW[4] - 3, rowY + 6, { align: "right" });
    doc.setFont("helvetica", "normal");
  });

  // ── 5. Totales: NETO / IVA / TOTAL ──
  const totalsY = tableY + 8 + Math.min(displayRows.length, 8) * 9 + 4;
  const totalsW = 52;
  const totalsX = pageWidth - margin - totalsW;
  const tRowH = 8;

  doc.setFillColor(...COLOR_WHITE);
  doc.setDrawColor(...COLOR_BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(totalsX, totalsY, totalsW, tRowH * 2 + 9, 1, 1, "FD");

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLOR_TEXT_MUTED);
  doc.text("NETO", totalsX + 4, totalsY + 5.5);
  doc.setTextColor(...COLOR_TEXT_DARK);
  doc.text(moneyCLP(neto), totalsX + totalsW - 4, totalsY + 5.5, { align: "right" });

  doc.setTextColor(...COLOR_TEXT_MUTED);
  doc.text("IVA 19%", totalsX + 4, totalsY + tRowH + 5.5);
  doc.setTextColor(...COLOR_TEXT_DARK);
  doc.text(moneyCLP(iva), totalsX + totalsW - 4, totalsY + tRowH + 5.5, { align: "right" });

  doc.setFillColor(...COLOR_PRIMARY);
  doc.roundedRect(totalsX, totalsY + tRowH * 2, totalsW, 9, 1, 1, "F");
  doc.setTextColor(...COLOR_WHITE);
  doc.setFontSize(9);
  doc.text("TOTAL", totalsX + 4, totalsY + tRowH * 2 + 6);
  doc.text(moneyCLP(total), totalsX + totalsW - 4, totalsY + tRowH * 2 + 6, { align: "right" });

  // ── 6. Dirección y Observación ──
  const notesY = totalsY + 30;
  const notesH = 22;
  doc.setFillColor(...COLOR_LIGHT_BG);
  doc.setDrawColor(...COLOR_BORDER);
  doc.roundedRect(margin, notesY, pageWidth - margin * 2, notesH, 2, 2, "FD");

  doc.setTextColor(...COLOR_DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("DIRECCIÓN:", margin + 4, notesY + 6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLOR_TEXT_MUTED);
  doc.text(clientAddress.slice(0, 70), margin + 4, notesY + 11);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLOR_DARK);
  doc.text("OBSERVACIÓN:", margin + 4, notesY + 16);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLOR_TEXT_MUTED);
  doc.text(
    text(item.message, "Sin observaciones adicionales registradas.").slice(0, 76),
    margin + 4,
    notesY + 21,
  );

  // ── 7. Nota de plazos ──
  const noteY = notesY + notesH + 6;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_TEXT_MUTED);
  doc.text(
    "LA FÁBRICA POSEE PLAZOS DE ENTREGA DE 20-25 DÍAS QUE PUEDEN VARIAR 5 DÍAS HÁBILES, EN CONSECUENCIA DE LOS PLAZOS DE ENTREGA DE COMPONENTES ESPECIALES DE PROVEEDORES NACIONALES E INTERNACIONALES.",
    margin,
    noteY,
    { maxWidth: pageWidth - margin * 2 },
  );

  // ── 8. Footer ──
  const footerY = pageHeight - 13;
  doc.setFillColor(...COLOR_DARK);
  doc.rect(0, footerY, pageWidth, 13, "F");

  doc.setTextColor(...COLOR_WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(`${companyName.toUpperCase()}  ·  RUT: ${companyTaxId}`.slice(0, 48), margin, footerY + 5.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(`Casa Matriz: ${companyAddress}  |  Tel: ${companyPhone}`.slice(0, 74), margin, footerY + 10);

  doc.setFont("helvetica", "bold");
  doc.text("CONTACTO:", pageWidth - margin - 72, footerY + 5.5);
  doc.setFont("helvetica", "normal");
  doc.text(`${companyEmail}`.slice(0, 34), pageWidth - margin - 72, footerY + 10);

  const blob = doc.output("blob");
  const fileName = `COT-${text(item.id, "sin-numero")}.pdf`;
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
