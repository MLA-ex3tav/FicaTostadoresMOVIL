import { Capacitor } from "@capacitor/core";
import { jsPDF } from "jspdf";
import type { SolicitudRemota } from "../lib/web-api";
import { findProducto, getPrecioLocal, getCatalogo, loadCatalogo } from "./catalog";
import { showToast } from "../ui/toast";
import { openPdfViewer } from "../ui/pdf-viewer";

type RGB = [number, number, number];

const BLACK: RGB = [0, 0, 0];
const WHITE: RGB = [255, 255, 255];
const GRAY_MED: RGB = [127, 127, 127];
const GRAY_LIGHT: RGB = [231, 230, 230];
const GRAY_VLIGHT: RGB = [242, 242, 242];

/** Datos de la empresa según el OT oficial (EMPRESAS FICA LTDA). */
const OT_COMPANY = {
  name: "EMPRESAS FICA LTDA.",
  taxId: "76.683.592-9",
  giro: "FABRICA",
  address: "SAN RAMON PC. 39 LT. 12 - 19 PADRE LAS CASAS",
  bankName: "BANCO DE CHILE",
  bankAccount: "CUENTA CORRIENTE 1440487600",
  email: "TOSTADORESFICA@GMAIL.COM",
};

const IVA_RATE = 0.19;

function text(value: unknown, fallback = ""): string {
  const result = String(value ?? "").trim();
  return result || fallback;
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

function moneyCLP(value: number): string {
  return `$ ${Math.round(value).toLocaleString("es-CL")}`;
}

function dateSlash(date = new Date()): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

function comunaFrom(address: string): string {
  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 1] : "";
}

function box(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  fill?: RGB,
  lineWidth = 0.7,
): void {
  if (fill) {
    doc.setFillColor(...fill);
    doc.rect(x, y, w, h, "F");
  }
  doc.setDrawColor(...BLACK);
  doc.setLineWidth(lineWidth);
  doc.rect(x, y, w, h, "S");
}

function cellText(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  value: string,
  opts: { bold?: boolean; align?: "left" | "center" | "right"; color?: RGB; size?: number } = {},
): void {
  const style = opts.bold ? "bold" : "normal";
  doc.setFont("helvetica", style);
  doc.setFontSize(opts.size ?? 8.4);
  doc.setTextColor(...(opts.color ?? WHITE));
  const baseline = y + h - 1.4;
  if (opts.align === "center") {
    doc.text(value, x + w / 2, baseline, { align: "center" });
  } else if (opts.align === "right") {
    doc.text(value, x + w - 3, baseline, { align: "right" });
  } else {
    doc.text(value, x + 3, baseline);
  }
}

function otLineItem(record: unknown): {
  code: string;
  name: string;
  color: string;
  quantity: number;
  unitPrice: number;
} {
  const rec = record && typeof record === "object" ? (record as Record<string, unknown>) : {};
  const product = findProducto(rec.productId, rec.name) ?? undefined;
  const quantity = Math.max(1, numberFrom(rec.quantity, rec.cantidad, 1));
  const unitPrice = product
    ? getPrecioLocal(product)
    : numberFrom(rec.price, rec.precio, 0);

  return {
    code: text(rec.productId ?? product?.id),
    name: text(rec.name ?? product?.name),
    color: text(rec.color, ""),
    quantity,
    unitPrice,
  };
}

export interface OtPdf {
  blob: Blob;
  fileName: string;
  url: string;
  item: SolicitudRemota;
}

/**
 * Genera el PDF de la Orden de Trabajo replicando el diseño oficial de FICA
 * (formato Legal vertical, 612x1008 pt). Referencia: ficadatos/OT.pdf.
 */
export async function generarOtPdf(item: SolicitudRemota): Promise<OtPdf> {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: [612, 1008] });

  let catalog = getCatalogo();
  if (catalog.length === 0) {
    try {
      catalog = await loadCatalogo();
    } catch {
      catalog = [];
    }
  }

  const products =
    Array.isArray(item.products) && item.products.length > 0
      ? item.products.map((product) => otLineItem(product))
      : [
          {
            code: "FT-GEN",
            name: "SERVICIO DE FABRICACIÓN DE MAQUINARIA",
            color: "",
            quantity: 1,
            unitPrice: 0,
          },
        ];

  const subtotal = products.reduce((sum, p) => sum + p.quantity * p.unitPrice, 0);
  const neto = Math.round(subtotal / (1 + IVA_RATE));
  const iva = subtotal - neto;
  const total = subtotal;

  const clientName = text(item.clientName);
  const clientRut = text(item.clientRut);
  const clientAddress = text(item.clientAddress);
  const clientComuna = comunaFrom(clientAddress) || text(item.clientComuna);
  const clientPhone = text(item.clientPhone);
  const clientEmail = text(item.clientEmail);
  const contact = text(item.contact ?? item.clientName);
  const activity = text(item.activity ?? item.actividad);
  const message = text(item.message);

  const numeroOt = text(item.id);
  const fechaEmision = dateSlash();
  const fechaEntrega = "POR DEFINIR";

  // ── 1. Título ──
  box(doc, 35.8, 121.1, 526.7, 19.5, BLACK);
  cellText(doc, 35.8, 121.1, 526.7, 19.5, `ORDEN DE TRABAJO N° ${numeroOt}`, {
    align: "center",
  });

  // ── 2. Fila de emisión ──
  box(doc, 35.8, 149, 83.0, 14, BLACK);
  cellText(doc, 35.8, 149, 83.0, 14, "EMISIÓN");
  box(doc, 118.8, 149, 182.1, 14, GRAY_LIGHT);
  cellText(doc, 118.8, 149, 182.1, 14, fechaEmision, { color: BLACK, bold: true });
  box(doc, 300.9, 149, 67.0, 14, BLACK);
  cellText(doc, 300.9, 149, 67.0, 14, "FECHA ENTREGA");
  box(doc, 367.9, 149, 193.9, 14, GRAY_LIGHT);
  cellText(doc, 367.9, 149, 193.9, 14, fechaEntrega, { color: BLACK, bold: true });

  // ── 3. Datos del cliente ──
  const clientRows: Array<[string, string, string, string]> = [
    ["NOMBRE", clientName, "RUT", clientRut],
    ["DIRECCIÓN", clientAddress, "COMUNA", clientComuna],
    ["CONTACTO", contact, "TELÉFONO", clientPhone],
    ["E-MAIL", clientEmail, "ACTIVIDAD", activity],
  ];
  let rowY = 175.5;
  for (const [labelLeft, valueLeft, labelRight, valueRight] of clientRows) {
    box(doc, 35.8, rowY, 83.0, 14, BLACK);
    cellText(doc, 35.8, rowY, 83.0, 14, labelLeft);
    box(doc, 118.8, rowY, 182.1, 14);
    cellText(doc, 118.8, rowY, 182.1, 14, valueLeft, { color: BLACK });
    box(doc, 300.9, rowY, 67.0, 14, BLACK);
    cellText(doc, 300.9, rowY, 67.0, 14, labelRight);
    box(doc, 367.9, rowY, 193.9, 14);
    cellText(doc, 367.9, rowY, 193.9, 14, valueRight, { color: BLACK });
    rowY += 16.8;
  }

  // ── 4. Tabla de productos ──
  const HEADER_Y = 252.2;
  const HEADER_H = 13.3;
  const colX = [35.8, 85.4, 300.9, 367.9, 427.8, 474.6];
  const colW = [49.6, 215.5, 67.0, 59.9, 46.8, 87.2];

  box(doc, colX[0], HEADER_Y, colW[0], HEADER_H, BLACK);
  cellText(doc, colX[0], HEADER_Y, colW[0], HEADER_H, "CÓDIGO");
  box(doc, colX[1], HEADER_Y, colW[1], HEADER_H, BLACK);
  cellText(doc, colX[1], HEADER_Y, colW[1], HEADER_H, "PRODUCTO");
  box(doc, colX[2], HEADER_Y, colW[2], HEADER_H, BLACK);
  cellText(doc, colX[2], HEADER_Y, colW[2], HEADER_H, "COLOR");
  box(doc, colX[3], HEADER_Y, colW[3], HEADER_H, BLACK);
  cellText(doc, colX[3], HEADER_Y, colW[3], HEADER_H, "VALOR UNIDAD", { align: "right" });
  box(doc, colX[4], HEADER_Y, colW[4], HEADER_H, BLACK);
  cellText(doc, colX[4], HEADER_Y, colW[4], HEADER_H, "CANTIDAD", { align: "center" });
  box(doc, colX[5], HEADER_Y, colW[5], HEADER_H, BLACK);
  cellText(doc, colX[5], HEADER_Y, colW[5], HEADER_H, "TOTAL", { align: "right" });

  const maxRows = 5;
  const visibleProducts = products.slice(0, maxRows);
  const extraCount = products.length - maxRows;
  let prodY = 265.5;
  const ROW_H = 13.2;

  for (const p of visibleProducts) {
    box(doc, colX[0], prodY, colW[0], ROW_H);
    cellText(doc, colX[0], prodY, colW[0], ROW_H, p.code, { color: BLACK });
    box(doc, colX[1], prodY, colW[1], ROW_H);
    cellText(doc, colX[1], prodY, colW[1], ROW_H, p.name.slice(0, 40), { color: BLACK });
    box(doc, colX[2], prodY, colW[2], ROW_H);
    cellText(doc, colX[2], prodY, colW[2], ROW_H, p.color, { color: BLACK });
    box(doc, colX[3], prodY, colW[3], ROW_H);
    cellText(doc, colX[3], prodY, colW[3], ROW_H, moneyCLP(p.unitPrice), {
      color: BLACK,
      align: "right",
    });
    box(doc, colX[4], prodY, colW[4], ROW_H);
    cellText(doc, colX[4], prodY, colW[4], ROW_H, String(p.quantity), {
      color: BLACK,
      align: "center",
    });
    box(doc, colX[5], prodY, colW[5], ROW_H);
    cellText(doc, colX[5], prodY, colW[5], ROW_H, moneyCLP(p.quantity * p.unitPrice), {
      color: BLACK,
      align: "right",
    });
    prodY += ROW_H;
  }

  // Bloque de observación (izquierda) + totales (derecha)
  const blockY = prodY;
  const totalsRows: Array<[string, string, boolean]> = [
    ["SUBTOTAL", moneyCLP(subtotal), false],
    ["DESC.", "-", true],
    ["NETO", moneyCLP(neto), false],
    ["IVA", moneyCLP(iva), false],
    ["TOTAL", moneyCLP(total), false],
  ];
  let ty = blockY;
  for (let i = 0; i < totalsRows.length; i++) {
    const [label, value, boldValue] = totalsRows[i];
    const isLast = i === totalsRows.length - 1;
    const fill = isLast ? GRAY_VLIGHT : undefined;
    box(doc, colX[4], ty, colW[4], ROW_H, fill);
    cellText(doc, colX[4], ty, colW[4], ROW_H, label, { color: BLACK, bold: true });
    box(doc, colX[5], ty, colW[5], ROW_H, fill);
    cellText(doc, colX[5], ty, colW[5], ROW_H, value, {
      color: BLACK,
      align: "right",
      bold: boldValue,
    });
    ty += ROW_H;
  }

  // Nota de observación (izquierda, junto a los totales)
  const noteLine = `OBSERVACIÓN: ${message || "-"}${extraCount > 0 ? ` (+${extraCount} productos más)` : ""}`;
  const noteBoxTop = blockY + 0.7;
  const noteBoxBottom = 342.9;
  box(doc, 36.5, noteBoxTop, 391.3, Math.max(8, noteBoxBottom - noteBoxTop), GRAY_VLIGHT);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.4);
  doc.setTextColor(...BLACK);
  doc.text(noteLine.slice(0, 60), 40, noteBoxTop + 11);

  // ── 5. Gestión de entrega/despacho ──
  box(doc, 35.8, 356.2, 526.7, 11.8, GRAY_MED);
  cellText(doc, 35.8, 356.2, 526.7, 11.8, "GESTIÓN DE ENTREGA/DESPACHO", { align: "center" });

  const gestRows: Array<[string, string, string, string]> = [
    ["FECHA", "", "DIRECCIÓN", clientAddress],
    ["FORMA DE ENTREGA", text(item.formaEntrega), "UBICACIÓN", text(item.ubicacion)],
    ["CONTACTO", contact, "VALOR", "-"],
  ];
  let gy = 368.0;
  for (const [labelLeft, valueLeft, labelRight, valueRight] of gestRows) {
    box(doc, 35.8, gy, 83.0, 13.3, GRAY_MED);
    cellText(doc, 35.8, gy, 83.0, 13.3, labelLeft);
    box(doc, 118.8, gy, 182.1, 13.3);
    cellText(doc, 118.8, gy, 182.1, 13.3, valueLeft, { color: BLACK });
    box(doc, 300.9, gy, 67.0, 13.3, GRAY_MED);
    cellText(doc, 300.9, gy, 67.0, 13.3, labelRight);
    box(doc, 367.9, gy, 193.9, 13.3);
    cellText(doc, 367.9, gy, 193.9, 13.3, valueRight, { color: BLACK });
    gy += 13.3;
  }

  // ── 6. Registro de pagos ──
  box(doc, 35.8, 420.3, 526.7, 14, BLACK);
  cellText(doc, 35.8, 420.3, 526.7, 14, "REGISTRO DE PAGOS", { align: "center" });

  const payCols: Array<{ x: number; w: number; label: string; fill?: RGB }> = [
    { x: 35.8, w: 83.0, label: "FECHA", fill: BLACK },
    { x: 118.8, w: 182.1, label: "MONTO" },
    { x: 300.9, w: 67.0, label: "FORMA DE PAGO" },
    { x: 367.9, w: 106.7, label: "B. EMPRESA", fill: BLACK },
    { x: 474.6, w: 87.2, label: "OBSERVACIÓN", fill: BLACK },
  ];
  const payHeaderY = 433.6;
  const payHeaderH = 13.9;
  for (const col of payCols) {
    box(doc, col.x, payHeaderY, col.w, payHeaderH, col.fill);
    cellText(doc, col.x, payHeaderY, col.w, payHeaderH, col.label, {
      color: col.fill === BLACK ? WHITE : BLACK,
      bold: true,
    });
  }

  let py = payHeaderY + payHeaderH;
  for (let i = 0; i < 2; i++) {
    for (const col of payCols) {
      box(doc, col.x, py, col.w, 13.3);
    }
    py += 13.3;
  }
  py += 12.9; // salto hasta la fila de saldo

  box(doc, 35.8, py, 83.0, 13.9, BLACK);
  cellText(doc, 35.8, py, 83.0, 13.9, "SALDO ABONADO");
  box(doc, 118.8, py, 182.1, 13.9);
  cellText(doc, 118.8, py, 182.1, 13.9, moneyCLP(0), { color: BLACK, align: "right" });
  box(doc, 300.9, py, 67.0, 13.9, BLACK);
  cellText(doc, 300.9, py, 67.0, 13.9, "SALDO PENDIENTE");
  box(doc, 367.9, py, 193.9, 13.9);
  cellText(doc, 367.9, py, 193.9, 13.9, moneyCLP(total), { color: BLACK, align: "right" });

  const totalRowY = py + 13.2;
  box(doc, 35.8, totalRowY, 83.0, 14, BLACK);
  cellText(doc, 35.8, totalRowY, 83.0, 14, "TOTAL");
  box(doc, 118.8, totalRowY, 182.1, 14);
  cellText(doc, 118.8, totalRowY, 182.1, 14, moneyCLP(total), {
    color: BLACK,
    align: "right",
    bold: true,
  });
  box(doc, 300.9, totalRowY, 67.0, 14, BLACK);
  cellText(doc, 300.9, totalRowY, 67.0, 14, "N° FACTURA");
  box(doc, 367.9, totalRowY, 193.9, 14);
  cellText(doc, 367.9, totalRowY, 193.9, 14, "", { color: BLACK, align: "right", bold: true });

  // ── 7. Registro de equipo ──
  box(doc, 35.8, 539.6, 526.7, 14, GRAY_MED);
  cellText(doc, 35.8, 539.6, 526.7, 14, "REGISTRO DE EQUIPO", { align: "center" });

  const eqRows: Array<[string, string, string, string]> = [
    ["CAPACITACIÓN", text(item.capacitacion), "GARANTÍA", "1 AÑO"],
    ["N° DE SERIE EQUIPO", text(item.numeroSerie), "ACTIVIDAD", ""],
  ];
  let ey = 553.6;
  for (const [labelLeft, valueLeft, labelRight, valueRight] of eqRows) {
    box(doc, 35.8, ey, 83.0, 13.2, GRAY_MED);
    cellText(doc, 35.8, ey, 83.0, 13.2, labelLeft);
    box(doc, 118.8, ey, 182.1, 13.2);
    cellText(doc, 118.8, ey, 182.1, 13.2, valueLeft, { color: BLACK });
    box(doc, 300.9, ey, 67.0, 13.2, GRAY_MED);
    cellText(doc, 300.9, ey, 67.0, 13.2, labelRight);
    box(doc, 367.9, ey, 193.9, 13.2);
    cellText(doc, 367.9, ey, 193.9, 13.2, valueRight, { color: BLACK });
    ey += 13.2;
  }

  // ── 8. Notas legales ──
  box(doc, 35.8, 592.6, 526.7, 49.5, GRAY_LIGHT);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.4);
  doc.setTextColor(...BLACK);
  const legalParagraphs = [
    "LA FÁBRICA POSEE PLAZOS DE ENTREGA DE 20-25 DÍAS QUE PUEDEN VARIAR 5 DÍAS HÁBILES, EN CONSECUENCIA DE LOS PLAZOS DE ENTREGA DE COMPONENTES ESPECIALES DE PROVEEDORES NACIONALES E INTERNACIONALES.",
    "LOS MOLINOS A MARTILLO REQUIEREN CONTAR CON UNA INSTALACIÓN ELÉCTRICA PREVIA DE 16 AMPERES, O UN AUTOMÁTICO CON GUARDAMOTOR DE 10 AMPERES EXCLUSIVO PARA EL EQUIPO.",
  ];
  let ly = 604;
  for (const paragraph of legalParagraphs) {
    const wrapped = doc.splitTextToSize(paragraph, 470) as string[];
    for (const line of wrapped) {
      if (ly > 635) break;
      doc.text(line, 299, ly, { align: "center" });
      ly += 9.6;
    }
  }

  // ── 9. Importante ──
  box(doc, 35.8, 651.9, 526.7, 25.8, GRAY_LIGHT);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.4);
  doc.text("IMPORTANTE: ", 42, 665);
  const importanteText =
    "PARA HACER EFECTIVA LA GARANTÍA DE NUESTRAS MÁQUINAS, ES REQUISITO INDISPENSABLE QUE EL EQUIPO SEA TRASLADADO A NUESTRA FÁBRICA.";
  doc.setFont("helvetica", "normal");
  const importanteWrapped = doc.splitTextToSize(importanteText, 440) as string[];
  let impY = 665;
  for (const line of importanteWrapped) {
    doc.text(line, 42 + doc.getTextWidth("IMPORTANTE: "), impY);
    impY += 9.6;
  }

  // ── 10. Datos de empresa / cuenta bancaria ──
  box(doc, 35.8, 690.3, 265.8, 66.2, GRAY_LIGHT);
  const leftCompanyLines: Array<[string, boolean]> = [
    ["DATOS EMPRESA:", true],
    [OT_COMPANY.name, false],
    [`RUT: ${OT_COMPANY.taxId}`, false],
    [`GIRO: ${OT_COMPANY.giro}`, false],
    ["DIRECCIÓN PRINCIPAL (CASA MATRIZ)", false],
    [OT_COMPANY.address, false],
  ];
  leftCompanyLines.forEach(([line, isBold], index) => {
    doc.setFont("helvetica", isBold ? "bold" : "normal");
    doc.setFontSize(7.4);
    doc.setTextColor(...BLACK);
    doc.text(String(line).slice(0, 44), 42, 701 + index * 10.5);
  });

  box(doc, 300.9, 690.3, 260.9, 66.2, GRAY_LIGHT);
  const rightCompanyLines: Array<[string, boolean]> = [
    ["CUENTA BANCARIA:", true],
    [OT_COMPANY.bankName, false],
    [`RUT ${OT_COMPANY.taxId}`, false],
    [OT_COMPANY.name, false],
    [OT_COMPANY.bankAccount, false],
    [OT_COMPANY.email, false],
  ];
  rightCompanyLines.forEach(([line, isBold], index) => {
    doc.setFont("helvetica", isBold ? "bold" : "normal");
    doc.setFontSize(7.4);
    doc.setTextColor(...BLACK);
    doc.text(String(line).slice(0, 42), 308, 701 + index * 10.5);
  });

  // ── 11. Eslogan ──
  doc.setFont("times", "bold");
  doc.setFontSize(8.4);
  doc.setTextColor(...BLACK);
  doc.text("15 AÑOS DE EXPERIENCIA, MÁXIMA CALIDAD", 306, 775, { align: "center" });

  // ── 12. Observaciones de entrega ──
  doc.setFont("helvetica", "bolditalic");
  doc.setFontSize(8.4);
  doc.text("Observaciones de entrega y compromisos:", 37.9, 779);
  box(doc, 36.5, 781.6, 525.3, 60);

  // ── 13. Firma ──
  box(doc, 17.7, 842.3, 555.2, 44);
  doc.setDrawColor(...BLACK);
  doc.setLineWidth(0.6);
  doc.line(167.9, 870.6, 423.2, 870.6);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.4);
  doc.text("FIRMA CLIENTE. RECIBÍ CONFORME EL EQUIPO Y CAPACITACIÓN", 306, 885, {
    align: "center",
  });

  // ── 14. Banda inferior ──
  box(doc, 17.7, 887.0, 555.2, 12.5);

  const blob = doc.output("blob");
  const fileName = `OT-${text(item.id, "sin-numero")}.pdf`;
  const url = URL.createObjectURL(blob);

  return { blob, fileName, url, item };
}

/** Descarga un PDF de OT generado. En el celular abre el visor externo. */
export function descargarOtPdf(pdf: OtPdf): void {
  if (Capacitor.isNativePlatform()) {
    void openPdfViewer(pdf);
    return;
  }

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

/** Libera la URL temporal de un PDF de OT que ya no se necesita. */
export function liberarOtPdf(pdf: OtPdf): void {
  URL.revokeObjectURL(pdf.url);
}
