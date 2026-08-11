import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useSheetDrag } from "./useSheetDrag";
import {
  getProductColorById,
  getProductColorLabel,
  PRODUCT_COLORS,
} from "../lib/product-colors";

export interface MaquinaItem {
  name: string;
  quantity: number;
  unitPrice: number;
  colorId?: string;
  color?: string;
}

function formatPrecio(valor: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(valor);
}

interface MaquinasSheetProps {
  items: MaquinaItem[];
  total: number;
  onClose: () => void;
}

/**
 * Modal (bottom sheet) que lista todas las máquinas seleccionadas con nombre,
 * cantidad, color, precio unitario y subtotal. Reutilizado por el wizard de
 * nueva cotización y por los detalles de una cotización.
 */
export function MaquinasSheet({ items, total, onClose }: MaquinasSheetProps) {
  const { panelRef, requestClose } = useSheetDrag(onClose);

  return createPortal(
    <div className="more-sheet more-sheet--front" role="dialog" aria-modal="true" aria-label="Máquinas seleccionadas">
      <div className="more-sheet__backdrop" onClick={requestClose} />
      <div ref={panelRef} className="more-sheet__panel">
        <header className="more-sheet__header">
          <span className="more-sheet__title">Máquinas seleccionadas</span>
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
          {items.map((item, index) => {
            const colorLabel = item.color || getProductColorLabel(item.colorId) || "";
            const subtotal = item.unitPrice * item.quantity;
            const dotHex =
              getProductColorById(item.colorId)?.hex ??
              (colorLabel
                ? PRODUCT_COLORS.find(
                    (color) => color.name.toLowerCase() === colorLabel.toLowerCase(),
                  )?.hex
                : undefined);
            return (
              <div className="maquina-card" key={`${item.name}-${index}`}>
                <div className="maquina-card__head">
                  <span className="maquina-card__name">{item.name}</span>
                  <span className="maquina-card__qty">×{item.quantity}</span>
                </div>
                <div className="maquina-card__meta">
                  {colorLabel ? (
                    <span className="maquina-card__color">
                      <span
                        className="maquina-card__dot"
                        style={{ backgroundColor: dotHex }}
                        aria-hidden="true"
                      />
                      {colorLabel}
                    </span>
                  ) : null}
                  <strong className="maquina-card__subtotal">
                    {formatPrecio(subtotal)}
                  </strong>
                </div>
              </div>
            );
          })}
          <div className="maquina-card maquina-card--total">
            <span>Total</span>
            <strong>{formatPrecio(total)}</strong>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
