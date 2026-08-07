import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronRight, Minus, Package, Plus, Save, Search, Trash2, X } from "lucide-react";
import type { SolicitudRemota } from "../lib/web-api";
import {
  findProducto,
  getPrecioLocal,
  loadCatalogo,
  subscribeCatalogo,
  type ProductoCatalogo,
} from "../services/catalog";
import { generarCotizacionPdf, invalidarCotizacionPdf } from "../services/cotizacion-pdf";
import { guardarEdicionLocal } from "../services/solicitudes";
import { EmptyState } from "./EmptyState";
import { showToast } from "../ui/toast";
import { openPdfActions } from "../ui/pdf-actions";
import {
  DEFAULT_PRODUCT_COLOR_ID,
  getProductColorById,
  getProductColorLabel,
  PRODUCT_COLORS,
} from "../lib/product-colors";

interface EditarCotizacionProps {
  item: SolicitudRemota;
  onClose: () => void;
}

interface ProductoEditable {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  selectedColorId?: string;
  selectedColor?: string;
}

function formatPrecio(valor: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(valor);
}

function parseQuantity(value: unknown): number {
  const quantity = Number(value ?? 1);
  return Number.isFinite(quantity) && quantity > 0 ? Math.max(1, Math.round(quantity)) : 1;
}

function parsePrice(value: unknown): number {
  const price = Number(value ?? 0);
  return Number.isFinite(price) && price > 0 ? price : 0;
}

export function EditarCotizacion({ item, onClose }: EditarCotizacionProps) {
  const [cliente, setCliente] = useState(() => ({
    name: String(item.clientName ?? ""),
    phone: String(item.clientPhone ?? ""),
    rut: String(item.clientRut ?? ""),
    email: String(item.clientEmail ?? ""),
    comuna: String(item.clientComuna ?? ""),
    address: String(item.clientAddress ?? ""),
  }));

  const [productos, setProductos] = useState<ProductoEditable[]>(() =>
    (Array.isArray(item.products) ? item.products : []).map((entry) => {
      const record = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
      return {
        productId: String(record.productId ?? record.id ?? ""),
        name: String(record.name ?? ""),
        quantity: parseQuantity(record.quantity ?? record.cantidad),
        unitPrice: parsePrice(record.price ?? record.precio ?? record.unitPrice),
        selectedColorId: String(record.selectedColorId ?? DEFAULT_PRODUCT_COLOR_ID),
        selectedColor:
          String(record.selectedColor ?? "") ||
          (getProductColorLabel(String(record.selectedColorId ?? DEFAULT_PRODUCT_COLOR_ID)) ??
            undefined),
      };
    }),
  );

  const [catalogo, setCatalogo] = useState<ProductoCatalogo[] | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [showProductos, setShowProductos] = useState(false);
  const [collapsing, setCollapsing] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeCatalogo(setCatalogo);
    void loadCatalogo().catch(() => undefined);
    return unsubscribe;
  }, []);

  const precioEfectivo = (producto: ProductoEditable): number => {
    const product = findProducto(producto.productId, producto.name);
    return product ? getPrecioLocal(product) : producto.unitPrice;
  };

  const total = useMemo(
    () => productos.reduce((sum, producto) => sum + producto.quantity * precioEfectivo(producto), 0),
    [productos, catalogo],
  );

  const filtered = useMemo(() => {
    const list = catalogo ?? [];
    const term = busqueda.trim().toLowerCase();
    return list.filter((product) =>
      !term ||
      `${product.name ?? ""} ${product.modelo ?? ""} ${product.categoria ?? product.category ?? ""}`
        .toLowerCase()
        .includes(term),
    );
  }, [catalogo, busqueda, productos]);

  const seleccion = useMemo(() => {
    const map: Record<string, ProductoEditable> = {};
    for (const producto of productos) map[producto.productId] = producto;
    return map;
  }, [productos]);

  const totalProductos = productos.reduce((sum, producto) => sum + producto.quantity, 0);

  const agregar = (product: ProductoCatalogo) => {
    setProductos((prev) => {
      const existing = prev.find((selected) => selected.productId === product.id);
      if (existing) {
        return prev.map((selected) =>
          selected.productId === product.id
            ? { ...selected, quantity: selected.quantity + 1 }
            : selected,
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: String(product.name ?? product.modelo ?? ""),
          quantity: 1,
          unitPrice: getPrecioLocal(product),
          selectedColorId: DEFAULT_PRODUCT_COLOR_ID,
          selectedColor: getProductColorLabel(DEFAULT_PRODUCT_COLOR_ID) ?? undefined,
        },
      ];
    });
  };

  const cambiarColor = (productId: string, colorId: string) => {
    setProductos((prev) =>
      prev.map((producto) =>
        producto.productId === productId
          ? {
              ...producto,
              selectedColorId: colorId,
              selectedColor: getProductColorById(colorId)?.name ?? producto.selectedColor,
            }
          : producto,
      ),
    );
  };

  const quitar = (productId: string) => {
    const existing = seleccion[productId];
    if (!existing) return;
    if (existing.quantity <= 1) {
      colapsarYQuitar(productId);
      return;
    }
    setProductos((prev) =>
      prev.map((producto) =>
        producto.productId === productId
          ? { ...producto, quantity: producto.quantity - 1 }
          : producto,
      ),
    );
  };

  const colapsarYQuitar = (productId: string) => {
    if (collapsing) return;
    setCollapsing(productId);
    window.setTimeout(() => {
      setProductos((prev) => prev.filter((producto) => producto.productId !== productId));
      setCollapsing(null);
    }, 300);
  };

  const eliminar = (productId: string) => {
    colapsarYQuitar(productId);
  };

  const guardar = async () => {
    setGuardando(true);
    const patch: Partial<SolicitudRemota> = {
      clientName: cliente.name.trim(),
      clientPhone: cliente.phone.trim(),
      clientRut: cliente.rut.trim(),
      clientEmail: cliente.email.trim(),
      clientComuna: cliente.comuna.trim(),
      clientAddress: cliente.address.trim(),
      products: productos.map((producto) => ({
        productId: producto.productId,
        name: producto.name,
        quantity: producto.quantity,
        unitPrice: precioEfectivo(producto),
        selectedColorId: producto.selectedColorId ?? DEFAULT_PRODUCT_COLOR_ID,
        selectedColor: producto.selectedColor,
      })),
    };

    guardarEdicionLocal(item.id, patch);

    const updated = { ...item, ...patch };
    invalidarCotizacionPdf(item.id);
    try {
      const pdf = await generarCotizacionPdf(updated);
      showToast({
        title: "PDF actualizado",
        message: `${pdf.fileName} listo para compartir con los cambios.`,
        tone: "success",
        icon: "fileText",
      });
      openPdfActions(pdf);
    } catch (error) {
      console.error("Error al generar PDF tras editar:", error);
      showToast({
        title: "Cotización guardada",
        message: "Los cambios se guardaron localmente, pero no se pudo generar el PDF.",
        tone: "warning",
      });
    } finally {
      setGuardando(false);
      onClose();
    }
  };

  return (
    <>
      {createPortal(
        <div className="editor-overlay">
          <div className="editor" role="dialog" aria-modal="true" aria-label="Editar cotización">
            <header className="editor__header">
              <div className="editor__header-info">
                <span className="view__eyebrow">Editar cotización</span>
                <h2 className="editor__title">Nº {String(item.id).slice(0, 16)}</h2>
              </div>
              <button
                type="button"
                className="btn btn--secondary btn--icon"
                onClick={onClose}
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </header>

            <div className="editor__body">
              <section className="form-section">
                <h3 className="form-section__title">Datos del cliente</h3>
                <div className="form-grid">
                  <div className="form-field">
                    <label className="form-label" htmlFor="edit-name">Nombre / Razón social</label>
                    <input
                      id="edit-name"
                      className="form-input"
                      type="text"
                      value={cliente.name}
                      onChange={(event) => setCliente({ ...cliente, name: event.target.value })}
                    />
                  </div>
                  <div className="form-field">
                    <label className="form-label" htmlFor="edit-phone">Teléfono</label>
                    <input
                      id="edit-phone"
                      className="form-input"
                      type="tel"
                      inputMode="tel"
                      value={cliente.phone}
                      onChange={(event) => setCliente({ ...cliente, phone: event.target.value })}
                    />
                  </div>
                  <div className="form-field">
                    <label className="form-label" htmlFor="edit-rut">RUT</label>
                    <input
                      id="edit-rut"
                      className="form-input"
                      type="text"
                      value={cliente.rut}
                      onChange={(event) =>
                        setCliente({ ...cliente, rut: event.target.value.replace(/\D/g, "") })
                      }
                    />
                  </div>
                  <div className="form-field">
                    <label className="form-label" htmlFor="edit-email">E-mail</label>
                    <input
                      id="edit-email"
                      className="form-input"
                      type="email"
                      inputMode="email"
                      value={cliente.email}
                      onChange={(event) => setCliente({ ...cliente, email: event.target.value })}
                    />
                  </div>
                  <div className="form-field">
                    <label className="form-label" htmlFor="edit-comuna">Comuna</label>
                    <input
                      id="edit-comuna"
                      className="form-input"
                      type="text"
                      value={cliente.comuna}
                      onChange={(event) => setCliente({ ...cliente, comuna: event.target.value })}
                    />
                  </div>
                  <div className="form-field form-field--wide">
                    <label className="form-label" htmlFor="edit-address">Dirección</label>
                    <input
                      id="edit-address"
                      className="form-input"
                      type="text"
                      value={cliente.address}
                      onChange={(event) => setCliente({ ...cliente, address: event.target.value })}
                    />
                  </div>
                </div>
              </section>

              <section className="form-section">
                <div className="form-section__row">
                  <h3 className="form-section__title">Productos</h3>
                  <span className="editor__count">
                    {productos.length} producto{productos.length === 1 ? "" : "s"}
                  </span>
                </div>

                {productos.length === 0 ? (
                  <p className="editor__empty">Sin productos seleccionados.</p>
                ) : (
                  <ul className="editor-product-list">
                    {productos.map((producto) => (
                      <li
                        key={producto.productId || producto.name}
                        className="editor-product-row"
                      >
                        <span className="editor-product-row__name">
                          {producto.name || String(producto.productId || "Producto")}
                        </span>
                        {producto.selectedColorId ? (
                          <span className="editor-product-row__color">
                            {getProductColorLabel(producto.selectedColorId) ??
                              producto.selectedColor}
                          </span>
                        ) : null}
                        <span className="editor-product-row__qty">× {producto.quantity}</span>
                        <span className="editor-product-row__total">
                          {formatPrecio(precioEfectivo(producto) * producto.quantity)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                <button
                  type="button"
                  className="btn btn--secondary btn--block"
                  onClick={() => setShowProductos(true)}
                >
                  <Package size={16} />
                  {productos.length === 0 ? "Agregar productos" : "Editar productos"}
                  <ChevronRight size={16} />
                </button>
              </section>
            </div>

            <footer className="editor__footer">
              <div className="editor__total">
                <span className="editor__total-label">Total estimado</span>
                <strong className="editor__total-value">{formatPrecio(total)}</strong>
              </div>
              <button
                type="button"
                className="btn btn--primary btn--icon"
                onClick={() => void guardar()}
                disabled={guardando || productos.length === 0}
                aria-label="Guardar y generar PDF"
              >
                {guardando ? (
                  <span className="btn__spinner" aria-hidden="true" />
                ) : (
                  <Save size={18} strokeWidth={2.5} />
                )}
                {guardando ? "Guardando…" : ""}
              </button>
            </footer>
          </div>
        </div>,
        document.body,
      )}

      {showProductos ? (
        createPortal(
          <div className="editor-overlay editor-overlay--front">
            <div className="editor" role="dialog" aria-modal="true" aria-label="Editar productos">
              <header className="editor__header">
                <div className="editor__header-info">
                  <span className="view__eyebrow">Editar cotización</span>
                  <h2 className="editor__title">Productos</h2>
                </div>
                <button
                  type="button"
                  className="btn btn--secondary btn--icon"
                  onClick={() => setShowProductos(false)}
                  aria-label="Cerrar productos"
                >
                  <X size={18} />
                </button>
              </header>

              <div className="editor__body">
                <section className="form-section">
                  <div className="form-section__row">
                    <h3 className="form-section__title">Productos</h3>
                    <span className="editor__count">
                      {totalProductos} producto{totalProductos === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="search-field">
                    <span className="search-field__icon" aria-hidden="true">
                      <Search size={22} />
                    </span>
                    <input
                      className="search-input"
                      type="search"
                      placeholder="Buscar productos…"
                      value={busqueda}
                      onChange={(event) => setBusqueda(event.target.value)}
                    />
                    {busqueda ? (
                      <button
                        type="button"
                        className="search-field__clear"
                        onClick={() => setBusqueda("")}
                        aria-label="Limpiar búsqueda"
                      >
                        <X size={16} />
                      </button>
                    ) : null}
                  </div>

                  {catalogo === null ? (
                    <EmptyState title="Cargando catálogo…" text="Consultando Firestore." />
                  ) : catalogo.length === 0 ? (
                    <EmptyState
                      title="Catálogo vacío"
                      text="No se encontraron productos en Firestore para cotizar."
                    />
                  ) : filtered.length === 0 ? (
                    <EmptyState
                      title="Sin resultados"
                      text={`No se encontraron productos para "${busqueda}".`}
                    />
                  ) : (
                    <ul className="card-list">
                      {filtered.map((product) => {
                        const isSelected = Boolean(seleccion[product.id]);
                        const isCollapsing = collapsing === product.id;
                        return (
                          <li
                            key={product.id}
                            className={`card-list__item${isSelected ? " card-list__item--selected" : " card-list__item--tap"}${isCollapsing ? " card-list__item--closing" : ""}`}
                          >
                            {isSelected ? (
                              <button
                                type="button"
                                className="card-list__btn card-list__btn--static"
                                onClick={() => eliminar(product.id)}
                                disabled={isCollapsing}
                                aria-label={`Deseleccionar ${product.name ?? "producto"}`}
                              >
                                <div className="card-list__top">
                                  <div className="card-list__title">
                                    {String(product.name ?? product.modelo ?? "Sin nombre")}
                                  </div>
                                  <button
                                    type="button"
                                    className="btn btn--danger btn--sm"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      eliminar(product.id);
                                    }}
                                    aria-label={`Quitar ${product.name ?? "producto"}`}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                                <div className="card-list__meta">
                                  {product.modelo ? String(product.modelo) : "—"} ·{" "}
                                  {String(product.categoria ?? product.category ?? "—")}
                                </div>
                                <div className="card-list__price">{formatPrecio(getPrecioLocal(product))}</div>
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="card-list__btn"
                                onClick={() => agregar(product)}
                              >
                                <div className="card-list__top">
                                  <div className="card-list__title">
                                    {String(product.name ?? product.modelo ?? "Sin nombre")}
                                  </div>
                                  <span className="card-list__add" role="button" aria-label="Agregar">
                                    <Plus size={14} />
                                  </span>
                                </div>
                                <div className="card-list__meta">
                                  {product.modelo ? String(product.modelo) : "—"} ·{" "}
                                  {String(product.categoria ?? product.category ?? "—")}
                                </div>
                                <div className="card-list__price">{formatPrecio(getPrecioLocal(product))}</div>
                              </button>
                            )}

                            {seleccion[product.id] ? (
                              <div className="card-list__expand">
                                <div className="qty-stepper">
                                  <button
                                    type="button"
                                    className="btn btn--secondary btn--sm"
                                    onClick={() => quitar(product.id)}
                                    aria-label="Disminuir cantidad"
                                  >
                                    <Minus size={14} />
                                  </button>
                                  <span className="qty-stepper__value">{seleccion[product.id].quantity}</span>
                                  <button
                                    type="button"
                                    className="btn btn--secondary btn--sm"
                                    onClick={() => agregar(product)}
                                    aria-label="Aumentar cantidad"
                                  >
                                    <Plus size={14} />
                                  </button>
                                  <span className="qty-stepper__total">
                                    {formatPrecio(getPrecioLocal(product) * seleccion[product.id].quantity)}
                                  </span>
                                </div>
                                <div className="color-picker">
                                  <span
                                    className="color-picker__current"
                                    style={{ backgroundColor: getProductColorById(seleccion[product.id].selectedColorId)?.hex }}
                                    aria-hidden="true"
                                  />
                                  <div className="color-picker__dots" role="radiogroup" aria-label={`Color de ${product.name ?? "producto"}`}>
                                    {PRODUCT_COLORS.map((color) => {
                                      const isSelected =
                                        (seleccion[product.id].selectedColorId ?? DEFAULT_PRODUCT_COLOR_ID) === color.id;
                                      return (
                                        <button
                                          key={color.id}
                                          type="button"
                                          role="radio"
                                          aria-checked={isSelected}
                                          aria-label={`Color ${color.name}`}
                                          className={`color-picker__dot${isSelected ? " color-picker__dot--active" : ""}`}
                                          style={{ backgroundColor: color.hex }}
                                          onClick={() => cambiarColor(product.id, color.id)}
                                        />
                                      );
                                    })}
                                  </div>
                                  <span className="color-picker__label">
                                    {getProductColorLabel(seleccion[product.id].selectedColorId) ?? seleccion[product.id].selectedColor ?? "Color"}
                                  </span>
                                </div>
                              </div>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              </div>

              <footer className="editor__footer">
                <div className="editor__total">
                  <span className="editor__total-label">Total ({totalProductos} {totalProductos === 1 ? "producto" : "productos"})</span>
                  <strong className="editor__total-value">{formatPrecio(total)}</strong>
                </div>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => setShowProductos(false)}
                >
                  <Check size={18} strokeWidth={2.5} /> Listo
                </button>
              </footer>
            </div>
          </div>,
          document.body,
        )
      ) : null}
    </>
  );
}
