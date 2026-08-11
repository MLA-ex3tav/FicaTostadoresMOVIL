import { Check, Headphones, Info, Trash2, X } from "lucide-react";
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
} from "../screens/shared";
import { useSheetDrag } from "./useSheetDrag";

interface SoporteActionsSheetProps {
  item: SolicitudRemota;
  busy: boolean;
  acting: string | null;
  onClose: () => void;
  onVerDetalle: () => void;
  onAtender: () => void;
  onResolver: () => void;
  onWhatsapp: () => void;
  onEliminar: () => void;
}

export function SoporteActionsSheet({
  item,
  busy,
  acting,
  onClose,
  onVerDetalle,
  onAtender,
  onResolver,
  onWhatsapp,
  onEliminar,
}: SoporteActionsSheetProps) {
  const estado = getEstado(item, "abierta");
  const phone = String(item.clientPhone ?? "");
  const puedeAtender = ["abierta", "pendiente"].includes(estado);
  const puedeResolver = ["abierta", "pendiente", "en_curso", "en_revision"].includes(estado);
  const { panelRef, requestClose } = useSheetDrag(onClose, { enabled: !busy && acting === null });

  return createPortal(
    <div className="more-sheet" role="dialog" aria-modal="true" aria-label="Acciones de soporte">
      <div className="more-sheet__backdrop" onClick={busy || acting ? undefined : requestClose} />
      <div ref={panelRef} className="more-sheet__panel">
        <header className="more-sheet__header">
          <div className="cotizacion-sheet__info">
            <span className="cotizacion-sheet__name">
              {String(item.clientName ?? "Sin nombre")}
            </span>
            <span className="cotizacion-sheet__meta">
              {formatFechaHora(getSolicitudDate(item))} · {String(item.equipmentModel ?? "Equipo")} · {String(item.issueCategory ?? "Falla")}
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

          <button type="button" className="more-sheet__item" onClick={onVerDetalle}>
            <span className="more-sheet__item-icon" aria-hidden="true">
              <Info size={20} />
            </span>
            <span className="more-sheet__item-label">Ver Detalle Completo</span>
          </button>

          {puedeAtender ? (
            <button type="button" className="more-sheet__item" onClick={onAtender} disabled={acting !== null}>
              <span className="more-sheet__item-icon" aria-hidden="true" style={{ color: "#38bdf8" }}>
                {acting === "en_curso" ? <span className="btn__spinner" aria-hidden="true" /> : <Headphones size={20} />}
              </span>
              <span className="more-sheet__item-label">
                {acting === "en_curso" ? "Actualizando…" : "Marcar En Atención"}
              </span>
            </button>
          ) : null}

          {puedeResolver ? (
            <button type="button" className="more-sheet__item" onClick={onResolver} disabled={acting !== null}>
              <span className="more-sheet__item-icon more-sheet__item-icon--success" aria-hidden="true">
                {acting === "resuelta" ? <span className="btn__spinner" aria-hidden="true" /> : <Check size={20} />}
              </span>
              <span className="more-sheet__item-label">
                {acting === "resuelta" ? "Resolviendo…" : "Marcar Resuelta"}
              </span>
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
            disabled={busy || acting !== null}
          >
            <span className="more-sheet__item-icon more-sheet__item-icon--danger" aria-hidden="true">
              <Trash2 size={20} />
            </span>
            <span className="more-sheet__item-label">Eliminar Solicitud</span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
