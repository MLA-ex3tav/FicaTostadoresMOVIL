import { Trash2 } from "lucide-react";
import { createPortal } from "react-dom";
import { useSheetDrag } from "./useSheetDrag";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Eliminar",
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { panelRef, requestClose } = useSheetDrag(onCancel, { enabled: !busy });

  if (!open) return null;

  return createPortal(
    <div className="more-sheet" role="dialog" aria-modal="true" aria-label={title}>
      <div className="more-sheet__backdrop" onClick={busy ? undefined : requestClose} />
      <div ref={panelRef} className="more-sheet__panel">
        <div className="confirm-sheet">
          <div className="confirm-sheet__icon" aria-hidden="true">
            <Trash2 size={22} />
          </div>
          <div className="confirm-sheet__title">{title}</div>
          <div className="confirm-sheet__message">{message}</div>
        </div>
        <div className="more-sheet__list confirm-sheet__actions">
          <button type="button" className="more-sheet__item" onClick={requestClose} disabled={busy}>
            <span className="more-sheet__item-label">Cancelar</span>
          </button>
          <button
            type="button"
            className="more-sheet__item more-sheet__item--danger"
            onClick={onConfirm}
            disabled={busy}
          >
            <span className="more-sheet__item-icon more-sheet__item-icon--danger" aria-hidden="true">
              {busy ? <span className="btn__spinner" aria-hidden="true" /> : <Trash2 size={20} />}
            </span>
            <span className="more-sheet__item-label">
              {busy ? "Eliminando…" : confirmLabel}
            </span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
