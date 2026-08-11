import { useEffect, useState } from "react";
import { Download, Mail, MessageCircle, Share2, X } from "lucide-react";
import {
  closePdfActions,
  subscribePdfActions,
  type PdfFile,
} from "../ui/pdf-actions";
import {
  abrirGmail,
  abrirWhatsApp,
  compartirPdf,
  descargarPdf,
} from "../lib/share";
import { useSheetDrag } from "./useSheetDrag";

interface SheetItem {
  id: string;
  label: string;
  icon: typeof Share2;
  onClick: (pdf: PdfFile) => void;
}

const ITEMS: SheetItem[] = [
  {
    id: "compartir",
    label: "Compartir",
    icon: Share2,
    onClick: (pdf) => void compartirPdf(pdf),
  },
  {
    id: "whatsapp",
    label: "Enviar por WhatsApp",
    icon: MessageCircle,
    onClick: (pdf) => void abrirWhatsApp(pdf),
  },
  {
    id: "correo",
    label: "Enviar por correo",
    icon: Mail,
    onClick: (pdf) => void abrirGmail(pdf),
  },
  {
    id: "descargar",
    label: "Descargar",
    icon: Download,
    onClick: (pdf) => void descargarPdf(pdf),
  },
];

export function PdfActionsSheet() {
  const [pdf, setPdf] = useState<PdfFile | null>(null);
  const { panelRef, requestClose } = useSheetDrag(() => closePdfActions());

  useEffect(() => subscribePdfActions(setPdf), []);

  if (!pdf) return null;

  const handle = (onClick: (p: PdfFile) => void) => {
    onClick(pdf);
    requestClose();
  };

  return (
    <div
      className="more-sheet"
      role="dialog"
      aria-modal="true"
      aria-label="Acciones del documento"
    >
      <div className="more-sheet__backdrop" onClick={requestClose} />
      <div ref={panelRef} className="more-sheet__panel">
        <header className="more-sheet__header">
          <span className="more-sheet__title more-sheet__title--file">
            {pdf.fileName}
          </span>
          <button
            type="button"
            className="more-sheet__close"
            aria-label="Cerrar"
            onClick={requestClose}
          >
            <X size={18} />
          </button>
        </header>
        <div className="more-sheet__list">
          {ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className="more-sheet__item"
                onClick={() => handle(item.onClick)}
              >
                <span className="more-sheet__item-icon" aria-hidden="true">
                  <Icon size={20} />
                </span>
                <span className="more-sheet__item-label">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
