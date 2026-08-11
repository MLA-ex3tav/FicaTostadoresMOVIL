import { Check, Eye, FileText, Pencil, Trash2, X } from "lucide-react";
import { createPortal } from "react-dom";
import type { SolicitudRemota } from "../lib/web-api";
import { getSolicitudDate } from "../services/solicitudes";
import { StatusPill } from "./StatusPill";
import {
  estadoLabel,
  estadoPillVariant,
  getEstado,
  formatFechaHora,
  resumirProductos,
  coloresProductos,
} from "../screens/shared";
import { ProductColorSwatches } from "./ProductColorSwatches";
import { useSheetDrag } from "./useSheetDrag";

interface CotizacionActionsSheetProps {
  item: SolicitudRemota;
  esEditable: boolean;
  busy: boolean;
  acting: string | null;
  onClose: () => void;
  onVerDetalles: () => void;
  onVerPdf: () => void;
  onEditar: () => void;
  onAprobar: () => void;
  onRechazar: () => void;
  onEliminar: () => void;
}

export function CotizacionActionsSheet({
  item,
  esEditable,
  busy,
  acting,
  onClose,
  onVerDetalles,
  onVerPdf,
  onEditar,
  onAprobar,
  onRechazar,
  onEliminar,
}: CotizacionActionsSheetProps) {
  const estado = getEstado(item, "pendiente");
  const { panelRef, requestClose } = useSheetDrag(onClose, { enabled: !busy });

  return createPortal(
    <div className="more-sheet" role="dialog" aria-modal="true" aria-label="Acciones de la cotización">
      <div className="more-sheet__backdrop" onClick={busy ? undefined : requestClose} />
      <div ref={panelRef} className="more-sheet__panel">
        <header className="more-sheet__header">
          <div className="cotizacion-sheet__info">
            <span className="cotizacion-sheet__name">
              {String(item.clientName ?? "Sin nombre")}
            </span>
            <span className="cotizacion-sheet__meta">
              {formatFechaHora(getSolicitudDate(item))} · {resumirProductos(item)}
            </span>
            <ProductColorSwatches colors={coloresProductos(item)} />
          </div>
          <div className="cotizacion-sheet__pill">
            <StatusPill label={estadoLabel(estado)} variant={estadoPillVariant(estado)} />
          </div>
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
          <div className="cotizacion-sheet__divider" aria-hidden="true" />
          <button type="button" className="more-sheet__item" onClick={onVerDetalles}>
            <span className="more-sheet__item-icon" aria-hidden="true">
              <Eye size={20} />
            </span>
            <span className="more-sheet__item-label">Detalles</span>
          </button>
          <button type="button" className="more-sheet__item" onClick={onVerPdf} disabled={busy}>
            <span className="more-sheet__item-icon" aria-hidden="true">
              {busy ? <span className="btn__spinner" aria-hidden="true" /> : <FileText size={20} />}
            </span>
            <span className="more-sheet__item-label">{busy ? "Generando PDF…" : "Ver PDF"}</span>
          </button>

          {esEditable ? (
            <button type="button" className="more-sheet__item" onClick={onEditar}>
              <span className="more-sheet__item-icon" aria-hidden="true">
                <Pencil size={20} />
              </span>
              <span className="more-sheet__item-label">Editar</span>
            </button>
          ) : null}

          {esEditable ? (
            <button type="button" className="more-sheet__item" onClick={onAprobar} disabled={acting !== null}>
              <span className="more-sheet__item-icon more-sheet__item-icon--success" aria-hidden="true">
                {acting === "aprobar" ? <span className="btn__spinner" aria-hidden="true" /> : <Check size={20} />}
              </span>
              <span className="more-sheet__item-label">
                {acting === "aprobar" ? "Aprobando…" : "Aprobar"}
              </span>
            </button>
          ) : null}

          {esEditable ? (
            <button type="button" className="more-sheet__item" onClick={onRechazar} disabled={acting !== null}>
              <span className="more-sheet__item-icon more-sheet__item-icon--danger" aria-hidden="true">
                {acting === "rechazar" ? <span className="btn__spinner" aria-hidden="true" /> : <X size={20} />}
              </span>
              <span className="more-sheet__item-label">
                {acting === "rechazar" ? "Rechazando…" : "Rechazar"}
              </span>
            </button>
          ) : null}

          <button
            type="button"
            className="more-sheet__item more-sheet__item--danger"
            onClick={onEliminar}
            disabled={busy || acting !== null}
          >
            <span className="more-sheet__item-icon more-sheet__item-icon--danger" aria-hidden="true">
              <Trash2 size={20} />
            </span>
            <span className="more-sheet__item-label">Eliminar</span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
