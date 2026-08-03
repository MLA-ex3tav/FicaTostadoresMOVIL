import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  Mail,
  MessageCircle,
  Minus,
  Package,
  Plus,
  Search,
  Share2,
  Trash2,
} from "lucide-react";
import {
  getPrecioLocal,
  loadCatalogo,
  type ProductoCatalogo,
} from "../services/catalog";
import { generarCotizacionPdf, type CotizacionPdf } from "../services/cotizacion-pdf";
import type { SolicitudRemota } from "../lib/web-api";
import { openPdfViewer } from "../ui/pdf-viewer";
import { showToast } from "../ui/toast";
import { abrirGmail, abrirWhatsApp, compartirPdf, descargarPdf } from "../lib/share";
import { getCompanyData } from "../lib/company";
import { suggestAddresses } from "../lib/geo";
import { EmptyState } from "../components/EmptyState";

interface ItemSeleccionado {
  product: ProductoCatalogo;
  quantity: number;
}

interface StepIndicatorProps {
  current: number;
}

function StepIndicator({ current }: StepIndicatorProps) {
  const labels = ["Datos", "Productos", "Enviar"];

  return (
    <div className="steps" aria-label="Progreso de la cotización">
      {labels.map((label, index) => {
        const stepNumber = index + 1;
        const state =
          stepNumber < current
            ? "step step--done"
            : stepNumber === current
              ? "step step--active"
              : "step";

        return (
          <div key={label} className="step-group">
            {index > 0 ? (
              <span
                className={`step__line${stepNumber <= current ? " step__line--done" : ""}`}
                aria-hidden="true"
              />
            ) : null}
            <div className={state}>
              <span className="step__dot" aria-hidden="true">
                {stepNumber < current ? <Check size={16} /> : stepNumber}
              </span>
              <span className="step__label">{label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatPrecio(valor: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(valor);
}

export function NuevaCotizacionScreen({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState(1);
  const [productos, setProductos] = useState<ProductoCatalogo[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [seleccion, setSeleccion] = useState<Record<string, ItemSeleccionado>>({});
  const [cliente, setCliente] = useState({
    name: "",
    taxId: "",
    email: "",
    phone: "",
    address: "",
  });
  const [message, setMessage] = useState("");
  const [generating, setGenerating] = useState(false);
  const [resultado, setResultado] = useState<CotizacionPdf | null>(null);
  const [addressFocused, setAddressFocused] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(0);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        setProductos(await loadCatalogo());
      } catch (err) {
        showToast({
          title: "No se pudo cargar el catálogo",
          message: err instanceof Error ? err.message : String(err),
          tone: "error",
        });
        setProductos([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const list = productos ?? [];
    const term = query.trim().toLowerCase();
    if (!term) return list;
    return list.filter((product) =>
      `${product.name ?? ""} ${product.modelo ?? ""} ${product.categoria ?? product.category ?? ""}`
        .toLowerCase()
        .includes(term),
    );
  }, [productos, query]);

  const items = Object.values(seleccion);
  const totalProductos = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalCotizacion = items.reduce(
    (sum, item) => sum + getPrecioLocal(item.product) * item.quantity,
    0,
  );

  const addressSuggestions = useMemo(() => {
    const value = cliente.address.trim();
    if (!value || !addressFocused) return [];
    const lastPart = value.split(",").pop() ?? "";
    return suggestAddresses(lastPart, "Chile");
  }, [cliente.address, addressFocused]);

  const seleccionarDireccion = (label: string) => {
    setCliente((prev) => ({ ...prev, address: label }));
    setActiveSuggestion(0);
  };

  const agregar = (product: ProductoCatalogo) => {
    setSeleccion((prev) => {
      const existing = prev[product.id];
      return {
        ...prev,
        [product.id]: {
          product,
          quantity: existing ? existing.quantity + 1 : 1,
        },
      };
    });
  };

  const quitar = (id: string) => {
    setSeleccion((prev) => {
      const existing = prev[id];
      if (!existing) return prev;
      if (existing.quantity <= 1) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: { ...existing, quantity: existing.quantity - 1 } };
    });
  };

  const eliminar = (id: string) => {
    setSeleccion((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const limpiar = () => {
    setSeleccion({});
    setCliente({
      name: "",
      taxId: "",
      email: "",
      phone: "",
      address: "",
    });
    setMessage("");
    setResultado(null);
    setStep(1);
    setAddressFocused(false);
    setActiveSuggestion(0);
  };

  const irSiguiente = () => {
    if (step === 1 && !cliente.name.trim()) {
      showToast({
        title: "Falta el nombre del cliente",
        message: "Completa el nombre o razón social para continuar.",
        tone: "warning",
      });
      return;
    }
    if (step === 2 && items.length === 0) {
      showToast({
        title: "Selecciona productos",
        message: "Agrega al menos un producto para continuar.",
        tone: "warning",
      });
      return;
    }
    setStep((current) => Math.min(current + 1, 3));
  };

  const generar = async () => {
    setGenerating(true);
    try {
      const direccionCompleta = cliente.address.trim();
      const destino = direccionCompleta || "Por acordar con el cliente";
      const company = getCompanyData();
      const origen = company
        ? [company.address, company.city, company.region].filter(Boolean).join(", ") || company.country
        : "Padre Las Casas, Chile";

      const item: SolicitudRemota = {
        id: `COT-${Date.now().toString().slice(-6)}`,
        clientName: cliente.name.trim(),
        clientTaxId: cliente.taxId.trim(),
        clientEmail: cliente.email.trim(),
        clientPhone: cliente.phone.trim(),
        clientCountry: "Chile",
        clientAddress: direccionCompleta,
        shipping: {
          origin: origen,
          originZip: company.zip ?? "",
          destination: destino,
        },
        products: items.map(({ product, quantity }) => ({
          productId: product.id,
          name: product.name ?? product.modelo ?? "Producto",
          quantity,
        })),
        message: message.trim(),
        estado: "pendiente",
      };

      const pdf = await generarCotizacionPdf(item);
      setResultado(pdf);
      openPdfViewer(pdf);
    } catch (error) {
      console.error("Error al generar cotización:", error);
      showToast({
        title: "Error al generar el PDF",
        message: "No se pudo crear la cotización.",
        tone: "error",
      });
    } finally {
      setGenerating(false);
    }
  };

  const compartir = async () => {
    if (!resultado) return;
    const ok = await compartirPdf(resultado);
    if (!ok) {
      showToast({
        title: "Compartir no disponible",
        message: "Tu navegador no soporta compartir archivos. Usa WhatsApp/Gmail y adjunta el PDF.",
        tone: "info",
      });
    }
  };

  return (
    <div className="screen">
      <div className="view__header">
        <div className="view__header-row">
          <button
            type="button"
            className="btn btn--secondary btn--icon"
            onClick={() => (step === 1 ? onBack() : setStep((current) => current - 1))}
            aria-label="Volver"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="view__title">Nueva cotización</h1>
            <p className="view__subtitle">
              Paso {step} de 3 · {["Datos", "Productos", "Enviar"][step - 1]}
            </p>
          </div>
        </div>
      </div>

      <StepIndicator current={step} />

      {step === 1 ? (
        <>
          <section className="form-section">
            <div className="form-grid">
              <div className="form-field">
                <label className="form-label" htmlFor="nc-name">Nombre / Razón social *</label>
                <input
                  id="nc-name"
                  className="form-input"
                  type="text"
                  value={cliente.name}
                  onChange={(event) => setCliente({ ...cliente, name: event.target.value })}
                  placeholder="Ej. Juan Pérez"
                />
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="nc-tax">RUT / Tax ID</label>
                <input
                  id="nc-tax"
                  className="form-input"
                  type="text"
                  value={cliente.taxId}
                  onChange={(event) => setCliente({ ...cliente, taxId: event.target.value })}
                  placeholder="Ej. 12.345.678-9"
                />
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="nc-email">Email</label>
                <input
                  id="nc-email"
                  className="form-input"
                  type="email"
                  inputMode="email"
                  value={cliente.email}
                  onChange={(event) => setCliente({ ...cliente, email: event.target.value })}
                  placeholder="cliente@correo.cl"
                />
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="nc-phone">Teléfono</label>
                <input
                  id="nc-phone"
                  className="form-input"
                  type="tel"
                  inputMode="tel"
                  value={cliente.phone}
                  onChange={(event) => setCliente({ ...cliente, phone: event.target.value })}
                  placeholder="+56 9 1234 5678"
                />
              </div>
              <div className="form-field form-field--wide">
                <label className="form-label" htmlFor="nc-address">Dirección</label>
                <div className="address-input">
                  <input
                    id="nc-address"
                    className="form-input"
                    type="text"
                    value={cliente.address}
                    autoComplete="off"
                    onChange={(event) => {
                      setCliente({ ...cliente, address: event.target.value });
                      setActiveSuggestion(0);
                    }}
                    onFocus={() => setAddressFocused(true)}
                    onBlur={() => {
                      setTimeout(() => setAddressFocused(false), 150);
                    }}
                    onKeyDown={(event) => {
                      if (addressSuggestions.length === 0) return;
                      if (event.key === "ArrowDown") {
                        event.preventDefault();
                        setActiveSuggestion((current) =>
                          Math.min(current + 1, addressSuggestions.length - 1),
                        );
                      } else if (event.key === "ArrowUp") {
                        event.preventDefault();
                        setActiveSuggestion((current) => Math.max(current - 1, 0));
                      } else if (event.key === "Enter") {
                        event.preventDefault();
                        seleccionarDireccion(addressSuggestions[activeSuggestion].label);
                      } else if (event.key === "Escape") {
                        setAddressFocused(false);
                      }
                    }}
                    placeholder="Calle, número, depto · Comuna, Región, País"
                  />
                  {addressSuggestions.length > 0 ? (
                    <ul className="address-suggestions" role="listbox">
                      {addressSuggestions.map((suggestion, index) => (
                        <li key={suggestion.label}>
                          <button
                            type="button"
                            className={`address-suggestion${index === activeSuggestion ? " address-suggestion--active" : ""}`}
                            onMouseDown={(event) => {
                              event.preventDefault();
                              seleccionarDireccion(suggestion.label);
                            }}
                          >
                            {suggestion.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          <div className="wizard-actions">
            <button type="button" className="btn btn--primary" onClick={irSiguiente}>
              Siguiente <ArrowRight size={16} />
            </button>
          </div>
        </>
      ) : null}

      {step === 2 ? (
        <>
          {items.length > 0 ? (
            <section className="form-section">
              <h2 className="form-section__title">
                Seleccionados ({totalProductos} producto{totalProductos === 1 ? "" : "s"})
              </h2>
              <ul className="card-list">
                {items.map(({ product, quantity }) => (
                  <li key={product.id} className="card-list__item">
                    <div className="card-list__top">
                      <div className="card-list__title">
                        {String(product.name ?? product.modelo ?? "Producto")}
                      </div>
                      <button
                        type="button"
                        className="btn btn--danger btn--sm"
                        onClick={() => eliminar(product.id)}
                        aria-label={`Quitar ${product.name ?? "producto"}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="card-list__meta">{formatPrecio(getPrecioLocal(product))}</div>
                    <div className="qty-stepper">
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        onClick={() => quitar(product.id)}
                        aria-label="Disminuir cantidad"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="qty-stepper__value">{quantity}</span>
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        onClick={() => agregar(product)}
                        aria-label="Aumentar cantidad"
                      >
                        <Plus size={14} />
                      </button>
                      <span className="qty-stepper__total">
                        {formatPrecio(getPrecioLocal(product) * quantity)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="form-section">
            <h2 className="form-section__title">Elige productos</h2>
            <div className="search-field">
              <span className="search-field__icon" aria-hidden="true">
                <Search size={16} />
              </span>
              <input
                className="search-input"
                type="search"
                placeholder="Buscar producto…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>

            {loading && productos === null ? (
              <EmptyState title="Cargando catálogo…" text="Consultando Firestore." />
            ) : productos && productos.length === 0 ? (
              <EmptyState
                title="Catálogo vacío"
                text="No se encontraron productos en Firestore para cotizar."
              />
            ) : filtered.length === 0 ? (
              <EmptyState title="Sin resultados" text={`No se encontraron productos para "${query}".`} />
            ) : (
              <ul className="card-list">
                {filtered.map((product) => {
                  const yaSeleccionado = Boolean(seleccion[product.id]);
                  return (
                    <li key={product.id} className="card-list__item card-list__item--tap">
                      <button
                        type="button"
                        className="card-list__btn"
                        onClick={() => (yaSeleccionado ? eliminar(product.id) : agregar(product))}
                      >
                        <div className="card-list__top">
                          <div className="card-list__title">
                            {String(product.name ?? product.modelo ?? "Sin nombre")}
                          </div>
                          {yaSeleccionado ? (
                            <span className="btn btn--success btn--sm">
                              <Check size={14} /> {seleccion[product.id].quantity}
                            </span>
                          ) : (
                            <span className="btn btn--primary btn--sm">
                              <Plus size={14} /> Agregar
                            </span>
                          )}
                        </div>
                        <div className="card-list__meta">
                          {product.modelo ? String(product.modelo) : "—"} ·{" "}
                          {String(product.categoria ?? product.category ?? "—")}
                        </div>
                        <div className="card-list__price">{formatPrecio(getPrecioLocal(product))}</div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {items.length > 0 ? <div className="fab-spacer" aria-hidden="true" /> : null}
        </>
      ) : null}

      {step === 3 ? (
        <>
          <section className="form-section">
            <h2 className="form-section__title">Revisar y enviar</h2>
            <div className="wizard-summary">
              <div className="wizard-summary__row">
                <span>Cliente</span>
                <strong>{cliente.name || "—"}</strong>
              </div>
              <div className="wizard-summary__row">
                <span>Dirección</span>
                <strong>{cliente.address || "—"}</strong>
              </div>
              <div className="wizard-summary__row">
                <span>Productos</span>
                <strong>
                  {totalProductos} producto{totalProductos === 1 ? "" : "s"}
                </strong>
              </div>
              {items.map(({ product, quantity }) => (
                <div key={product.id} className="wizard-summary__row">
                  <span>
                    {String(product.name ?? product.modelo ?? "Producto")} × {quantity}
                  </span>
                  <strong>{formatPrecio(getPrecioLocal(product) * quantity)}</strong>
                </div>
              ))}
              <div className="wizard-summary__row wizard-summary__row--total">
                <span>Total estimado</span>
                <strong>{formatPrecio(totalCotizacion)}</strong>
              </div>
            </div>
          </section>

          {resultado ? (
            <section className="form-section">
              <div className="result-card">
                <div className="result-card__title">
                  <FileText size={16} /> {resultado.fileName}
                </div>
                <div className="result-card__sub">Elige cómo enviarlo:</div>
                <div className="result-card__actions">
                  <button type="button" className="btn btn--success" onClick={() => void compartir()}>
                    <Share2 size={16} /> Compartir
                  </button>
                  <button type="button" className="btn btn--primary" onClick={() => abrirWhatsApp(resultado)}>
                    <MessageCircle size={16} /> WhatsApp
                  </button>
                  <button type="button" className="btn btn--info" onClick={() => abrirGmail(resultado)}>
                    <Mail size={16} /> Gmail
                  </button>
                  <button type="button" className="btn btn--secondary" onClick={() => descargarPdf(resultado)}>
                    <Package size={16} /> Descargar
                  </button>
                </div>
                <button type="button" className="btn btn--secondary btn--block" onClick={limpiar}>
                  Crear otra cotización
                </button>
              </div>
            </section>
          ) : (
            <div className="wizard-actions">
              <button type="button" className="btn btn--secondary" onClick={() => setStep(2)}>
                <ArrowLeft size={16} /> Atrás
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => void generar()}
                disabled={generating}
              >
                <FileText size={16} />
                {generating ? "Generando PDF…" : "Generar PDF"}
              </button>
            </div>
          )}
        </>
      ) : null}

      {step === 2 && items.length > 0 ? (
        <div className="fab-bar">
          <button type="button" className="btn btn--primary fab-bar__button" onClick={irSiguiente}>
            <span className="fab-bar__count">
              {totalProductos} producto{totalProductos === 1 ? "" : "s"} seleccionado{totalProductos === 1 ? "" : "s"}
            </span>
            <ArrowRight size={18} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
