import { useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, Hash, MapPin, Mail, Package, Phone, User, X } from "lucide-react";
import type { SolicitudRemota } from "../lib/web-api";
import { getSolicitudDate } from "../services/solicitudes";
import { StatusPill } from "./StatusPill";
import {
  estadoLabel,
  estadoPillVariant,
  formatFechaHora,
  getEstado,
  OT_ESTADO_LABELS,
  OT_ESTADO_VARIANT,
} from "../screens/shared";
import { getProductColorById, getProductColorLabel } from "../lib/product-colors";
import { ProductColorSwatches } from "./ProductColorSwatches";
import { coloresProductos } from "../screens/shared";
import { useSheetDrag } from "./useSheetDrag";
import { MaquinasSheet, type MaquinaItem } from "./MaquinasSheet";

interface DetalleSolicitudSheetProps {
  item: SolicitudRemota;
  variant?: "cotizacion" | "ot";
  onClose: () => void;
}

function formatPrecio(valor: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(valor);
}

interface DetalleProducto {
  name: string;
  quantity: number;
  unitPrice: number;
  colorId?: string;
  color?: string;
}

function parseProductos(item: SolicitudRemota): DetalleProducto[] {
  if (!Array.isArray(item.products)) return [];
  return item.products
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => {
      const record = entry as Record<string, unknown>;
      const rawQuantity = Number(record.quantity ?? record.cantidad ?? 1);
      const quantity = Number.isFinite(rawQuantity) && rawQuantity > 0
        ? Math.max(1, Math.round(rawQuantity))
        : 1;
      const rawPrice = Number(record.price ?? record.precio ?? record.unitPrice ?? 0);
      const unitPrice = Number.isFinite(rawPrice) && rawPrice > 0 ? rawPrice : 0;
      return {
        name: String(record.name ?? record.modelo ?? "Producto"),
        quantity,
        unitPrice,
        colorId: String(record.selectedColorId ?? ""),
        color:
          String(record.selectedColor ?? "") ||
          getProductColorLabel(String(record.selectedColorId ?? "")) ||
          "",
      } satisfies DetalleProducto;
    });
}

export function DetalleSolicitudSheet({
  item,
  variant = "cotizacion",
  onClose,
}: DetalleSolicitudSheetProps) {
  const estado = getEstado(item, variant === "ot" ? "aprobada_ot" : "pendiente");
  const productos = parseProductos(item);
  const colores = coloresProductos(item);
  const total = productos.reduce((sum, producto) => sum + producto.quantity * producto.unitPrice, 0);

  const clientName = String(item.clientName ?? "Sin nombre");
  const phone = String(item.clientPhone ?? "");
  const rut = String(item.clientRut ?? "");
  const email = String(item.clientEmail ?? "");
  const comuna = String(item.clientComuna ?? "");
  const address = String(item.clientAddress ?? "");
  const message = String(item.message ?? "");
  const { panelRef, requestClose } = useSheetDrag(onClose);
  const [maquinasOpen, setMaquinasOpen] = useState(false);

  const maquinasItems: MaquinaItem[] = productos.map((producto) => ({
    name: producto.name,
    quantity: producto.quantity,
    unitPrice: producto.unitPrice,
    colorId: producto.colorId,
    color: producto.color,
  }));

  const camposCliente = [
    { icon: Phone, label: "Teléfono", value: phone },
    { icon: Hash, label: "RUT", value: rut },
    { icon: Mail, label: "Email", value: email },
    { icon: MapPin, label: "Comuna", value: comuna },
    { icon: MapPin, label: "Dirección", value: address },
  ].filter((campo) => campo.value.trim());

  return createPortal(
    <div className="more-sheet" role="dialog" aria-modal="true" aria-label="Detalles">
      <div className="more-sheet__backdrop" onClick={requestClose} />
      <div ref={panelRef} className="more-sheet__panel">
        <header className="more-sheet__header">
          <div className="cotizacion-sheet__info">
            <span className="cotizacion-sheet__name">{clientName}</span>
            <span className="cotizacion-sheet__meta">
              {formatFechaHora(getSolicitudDate(item))}
            </span>
            {colores.length > 0 ? <ProductColorSwatches colors={colores} /> : null}
          </div>
          <div className="cotizacion-sheet__pill">
            {variant === "ot" ? (
              <StatusPill
                label={OT_ESTADO_LABELS[estado] ?? estado}
                variant={OT_ESTADO_VARIANT[estado] ?? "pending"}
              />
            ) : (
              <StatusPill label={estadoLabel(estado)} variant={estadoPillVariant(estado)} />
            )}
          </div>
          <button type="button" className="more-sheet__close" aria-label="Cerrar" onClick={requestClose}>
            <X size={18} />
          </button>
        </header>

        <div className="detalle-sheet__body">
          <section className="detalle-sheet__section">
            <h4 className="detalle-sheet__section-title">
              <User size={14} /> Datos del cliente
            </h4>
            {camposCliente.length > 0 ? (
              <dl className="detalle-sheet__fields">
                {camposCliente.map((campo) => (
                  <div className="detalle-sheet__field" key={campo.label}>
                    <span className="detalle-sheet__field-icon" aria-hidden="true">
                      <campo.icon size={14} />
                    </span>
                    <dt className="detalle-sheet__field-label">{campo.label}</dt>
                    <dd className="detalle-sheet__field-value">{campo.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="detalle-sheet__empty">Sin datos de contacto registrados.</p>
            )}
          </section>

          <section className="detalle-sheet__section">
            <h4 className="detalle-sheet__section-title">
              <Package size={16} /> Máquinas seleccionadas
            </h4>
            {productos.length === 0 ? (
              <p className="detalle-sheet__empty">Sin productos seleccionados.</p>
            ) : productos.length === 1 ? (
              <div className="maquina-list">
                <div className="maquina-card">
                  <div className="maquina-card__head">
                    <span className="maquina-card__name">{productos[0].name}</span>
                    <span className="maquina-card__qty">×{productos[0].quantity}</span>
                  </div>
                  <div className="maquina-card__meta">
                    {productos[0].color || getProductColorLabel(productos[0].colorId) ? (
                      <span className="maquina-card__color">
                        <span
                          className="maquina-card__dot"
                          style={{
                            backgroundColor:
                              getProductColorById(productos[0].colorId)?.hex ?? undefined,
                          }}
                          aria-hidden="true"
                        />
                        {productos[0].color || getProductColorLabel(productos[0].colorId)}
                      </span>
                    ) : null}
                    <strong className="maquina-card__subtotal">
                      {formatPrecio(productos[0].unitPrice * productos[0].quantity)}
                    </strong>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  className="wizard-machines"
                  onClick={() => setMaquinasOpen(true)}
                >
                  <span className="wizard-machines__info">
                    <span className="wizard-machines__title">Ver máquinas seleccionadas</span>
                    <span className="wizard-machines__sub">
                      {productos.length} máquina{productos.length === 1 ? "" : "s"} ·{" "}
                      {productos.reduce((sum, producto) => sum + producto.quantity, 0)} producto
                      {productos.reduce((sum, producto) => sum + producto.quantity, 0) === 1 ? "" : "s"}
                    </span>
                  </span>
                  <ChevronRight size={18} />
                </button>
                {maquinasOpen ? (
                  <MaquinasSheet
                    items={maquinasItems}
                    total={total}
                    onClose={() => setMaquinasOpen(false)}
                  />
                ) : null}
              </>
            )}
          </section>

          {message.trim() ? (
            <section className="detalle-sheet__section">
              <h4 className="detalle-sheet__section-title">Mensaje</h4>
              <p className="detalle-sheet__message">{message}</p>
            </section>
          ) : null}

          <div className="detalle-sheet__total">
            <span>Total</span>
            <strong>{formatPrecio(total)}</strong>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}