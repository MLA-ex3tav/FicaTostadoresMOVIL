import { FileText, Trash2, X } from "lucide-react";
import { createPortal } from "react-dom";
import type { SolicitudRemota } from "../lib/web-api";
import { getSolicitudDate } from "../services/solicitudes";
import { StatusPill } from "./StatusPill";
import { WhatsAppIcon } from "./WhatsAppIcon";
import {
  estadoLabel,
  estadoPillVariant,
  formatFechaHora,
  getEstado,
  resumirProductos,
} from "../screens/shared";
import { useSheetDrag } from "./useSheetDrag";

interface HistorialActionsSheetProps {
  item: SolicitudRemota;
  esSoporte: boolean;
  busy: boolean;
  onClose: () => void;
  onVerPdf: () => void;
  onWhatsapp: () => void;
  onEliminar: () => void;
}

export function HistorialActionsSheet({
  item,
  esSoporte,
  busy,
  onClose,
  onVerPdf,
  onWhatsapp,
  onEliminar,
}: HistorialActionsSheetProps) {
  const estado = getEstado(item, "completada");
  const phone = String(item.clientPhone ?? "");
  const { panelRef, requestClose } = useSheetDrag(onClose, { enabled: !busy });

  return createPortal(
    <div className="more-sheet" role="dialog" aria-modal="true" aria-label="Acciones del historial">
      <div className="more-sheet__backdrop" onClick={busy ? undefined : requestClose} />
      <div ref={panelRef} className="more-sheet__panel">
        <header className="more-sheet__header">
          <div className="cotizacion-sheet__info">
            <span className="cotizacion-sheet__name">
              {String(item.clientName ?? "Sin nombre")}
            </span>
            <span className="cotizacion-sheet__meta">
              {formatFechaHora(getSolicitudDate(item))} ·{" "}
              {esSoporte
                ? `${String(item.equipmentModel ?? "Soporte")} · ${String(item.issueCategory ?? "Servicio")}`
                : resumirProductos(item)}
            </span>
          </div>
          <div className="cotizacion-sheet__pill">
            <StatusPill label={estadoLabel(estado)} variant={estadoPillVariant(estado)} />
          </div>
          <button type="button" className="more-sheet__close" aria-label="Cerrar" onClick={requestClose}>
            <X size={18} />
          </button>
        </header>

        <div className="more-sheet__list">
          <div className="cotizacion-sheet__divider" aria-hidden="true" />

          {!esSoporte ? (
            <button type="button" className="more-sheet__item" onClick={onVerPdf} disabled={busy}>
              <span className="more-sheet__item-icon" aria-hidden="true">
                {busy ? <span className="btn__spinner" aria-hidden="true" /> : <FileText size={20} />}
              </span>
              <span className="more-sheet__item-label">{busy ? "Generando PDF…" : "Ver PDF"}</span>
            </button>
          ) : null}

          {phone ? (
            <button type="button" className="more-sheet__item" onClick={onWhatsapp}>
              <span className="more-sheet__item-icon" aria-hidden="true" style={{ color: "#25D366" }}>
                <WhatsAppIcon size={20} />
              </span>
              <span className="more-sheet__item-label">Contactar por WhatsApp</span>
            </button>
          ) : null}

          <button
            type="button"
            className="more-sheet__item more-sheet__item--danger"
            onClick={onEliminar}
            disabled={busy}
          >
            <span className="more-sheet__item-icon more-sheet__item-icon--danger" aria-hidden="true">
              <Trash2 size={20} />
            </span>
            <span className="more-sheet__item-label">Eliminar del Historial</span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
