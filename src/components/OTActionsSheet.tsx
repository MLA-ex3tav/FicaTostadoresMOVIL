import { Eye, FileText, Play, Trash2, X } from "lucide-react";
import { createPortal } from "react-dom";
import type { SolicitudRemota } from "../lib/web-api";
import { getSolicitudDate } from "../services/solicitudes";
import { StatusPill } from "./StatusPill";
import {
  OT_ESTADO_LABELS,
  OT_ESTADO_VARIANT,
  formatFechaHora,
  getEstado,
  resumirProductos,
} from "../screens/shared";
import { useSheetDrag } from "./useSheetDrag";

interface OTActionsSheetProps {
  item: SolicitudRemota;
  next?: string;
  nextLabel?: string;
  busy: boolean;
  advancing: boolean;
  onClose: () => void;
  onVerDetalles: () => void;
  onAvanzar: () => void;
  onVerPdf: () => void;
  onEliminar: () => void;
}

export function OTActionsSheet({
  item,
  next,
  nextLabel,
  busy,
  advancing,
  onClose,
  onVerDetalles,
  onAvanzar,
  onVerPdf,
  onEliminar,
}: OTActionsSheetProps) {
  const estado = getEstado(item, "aprobada_ot");
  const { panelRef, requestClose } = useSheetDrag(onClose, { enabled: !busy && !advancing });

  return createPortal(
    <div className="more-sheet" role="dialog" aria-modal="true" aria-label="Acciones de la orden de trabajo">
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
          </div>
          <div className="cotizacion-sheet__pill">
            <StatusPill
              label={OT_ESTADO_LABELS[estado] ?? estado}
              variant={OT_ESTADO_VARIANT[estado] ?? "pending"}
            />
          </div>
          <button type="button" className="more-sheet__close" aria-label="Cerrar" onClick={requestClose}>
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
          {next ? (
            <button type="button" className="more-sheet__item" onClick={onAvanzar} disabled={advancing}>
              <span className="more-sheet__item-icon more-sheet__item-icon--success" aria-hidden="true">
                {advancing ? <span className="btn__spinner" aria-hidden="true" /> : <Play size={20} />}
              </span>
              <span className="more-sheet__item-label">
                {advancing ? "Actualizando…" : nextLabel ?? "Avanzar etapa"}
              </span>
            </button>
          ) : null}
          <button type="button" className="more-sheet__item" onClick={onVerPdf} disabled={busy}>
            <span className="more-sheet__item-icon" aria-hidden="true">
              {busy ? <span className="btn__spinner" aria-hidden="true" /> : <FileText size={20} />}
            </span>
            <span className="more-sheet__item-label">{busy ? "Generando PDF…" : "Ver PDF"}</span>
          </button>
          <button
            type="button"
            className="more-sheet__item more-sheet__item--danger"
            onClick={onEliminar}
            disabled={busy || advancing}
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