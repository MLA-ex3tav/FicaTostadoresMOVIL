import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Eye,
  FileText,
  Menu,
  Minus,
  Plus,
  Search,
  Share2,
  Trash2,
  User,
  X,
} from "lucide-react";
import {
  getPrecioLocal,
  loadCatalogo,
  subscribeCatalogo,
  type ProductoCatalogo,
} from "../services/catalog";
import { generarCotizacionPdf } from "../services/cotizacion-pdf";
import type { RegistroOrdenTrabajoPayload, SolicitudRemota } from "../lib/web-api";
import { showToast } from "../ui/toast";
import { openPdfActions } from "../ui/pdf-actions";
import { getCompanyData } from "../lib/company";
import {
  DEFAULT_PRODUCT_COLOR_ID,
  getProductColorById,
  getProductColorLabel,
  PRODUCT_COLORS,
} from "../lib/product-colors";
import { EmptyState } from "../components/EmptyState";
import { useSheetDrag } from "../components/useSheetDrag";
import { MaquinasSheet, type MaquinaItem } from "../components/MaquinasSheet";
import { PhoneCountryField } from "../components/PhoneCountryField";
import {
  enviarCotizacionAFirebase,
} from "../services/solicitudes";
import {
  clearCotizacionDraft,
  loadCotizacionDraft,
  saveCotizacionDraft,
  type CotizacionDraft,
} from "../services/cotizacion-draft";
import { extraerComunaDeDireccion, formatRut } from "./shared";

interface ItemSeleccionado {
  productId: string;
  quantity: number;
  selectedColorId?: string;
  selectedColor?: string;
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
    phone: "",
    address: "",
    rut: "",
    email: "",
    comuna: "",
  });
  const [message, setMessage] = useState("");
  const [generating, setGenerating] = useState(false);
  const [nameError, setNameError] = useState(false);
  const [collapsing, setCollapsing] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "leaving" | "leaving-back">("idle");
  const [dir, setDir] = useState<1 | -1>(1);
  const [actionsOpen, setActionsOpen] = useState(false);
  const { panelRef: actionsPanelRef, requestClose: actionsRequestClose } = useSheetDrag(() =>
    setActionsOpen(false),
  );
  const [draftPrompt, setDraftPrompt] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<CotizacionDraft | null>(null);
  const { panelRef: draftPanelRef, requestClose: draftRequestClose } = useSheetDrag(() =>
    setDraftPrompt(false),
  );
  const [maquinasOpen, setMaquinasOpen] = useState(false);

  const goTo = (next: number) => {
    if (phase !== "idle" || next === step || next < 1 || next > 3) return;
    const direction: 1 | -1 = next > step ? 1 : -1;
    setDir(direction);
    setPhase(direction === 1 ? "leaving" : "leaving-back");
    window.setTimeout(() => {
      setStep(next);
      setPhase("idle");
    }, 230);
  };

  useEffect(() => {
    const unsubscribe = subscribeCatalogo((docs) => {
      setProductos(docs);
      setLoading(false);
    });

    void (async () => {
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

    return unsubscribe;
  }, []);

  useEffect(() => {
    const draft = loadCotizacionDraft();
    if (!draft) return;

    const hasContent =
      draft.cliente?.name?.trim() ||
      draft.cliente?.phone?.trim() ||
      draft.cliente?.address?.trim() ||
      draft.cliente?.rut?.trim() ||
      draft.cliente?.email?.trim() ||
      draft.cliente?.comuna?.trim() ||
      draft.message?.trim() ||
      Object.keys(draft.seleccion ?? {}).length > 0;
    if (!hasContent) return;

    setPendingDraft(draft);
    setDraftPrompt(true);
  }, []);

  useEffect(() => {
    const hasContent =
      cliente.name.trim() ||
      cliente.phone.trim() ||
      cliente.address.trim() ||
      cliente.rut.trim() ||
      cliente.email.trim() ||
      cliente.comuna.trim() ||
      message.trim() ||
      Object.keys(seleccion).length > 0;
    if (!hasContent) return;

    saveCotizacionDraft({
      step,
      cliente,
      message,
      seleccion: Object.fromEntries(
        Object.entries(seleccion).map(([id, item]) => [
          id,
          {
            quantity: item.quantity,
            ...(item.selectedColorId ? { selectedColorId: item.selectedColorId } : {}),
            ...(item.selectedColor ? { selectedColor: item.selectedColor } : {}),
          },
        ]),
      ),
      updatedAt: Date.now(),
    });
  }, [step, cliente, message, seleccion]);

  const aplicarBorrador = (draft: CotizacionDraft) => {
    setStep(Math.min(Math.max(draft.step ?? 1, 1), 3));
    setCliente({
      name: draft.cliente?.name ?? "",
      phone: draft.cliente?.phone ?? "",
      address: draft.cliente?.address ?? "",
      rut: draft.cliente?.rut ?? "",
      email: draft.cliente?.email ?? "",
      comuna: draft.cliente?.comuna ?? "",
    });
    setMessage(draft.message ?? "");
    setSeleccion(
      Object.fromEntries(
        Object.entries(draft.seleccion ?? {}).map(([id, value]) => {
          const item = (
            typeof value === "number" ? { quantity: value } : value
          ) as Partial<ItemSeleccionado>;
          return [
            id,
            {
              productId: id,
              quantity: Math.max(1, Number(item?.quantity) || 1),
              selectedColorId: item?.selectedColorId,
              selectedColor: item?.selectedColor,
            },
          ];
        }),
      ),
    );
    showToast({
      title: "Borrador restaurado",
      message: "Continuaste donde lo dejaste la última vez.",
      tone: "info",
      icon: "fileText",
    });
  };

  const restaurarBorrador = () => {
    if (pendingDraft) aplicarBorrador(pendingDraft);
    setDraftPrompt(false);
  };

  const descartarBorradorPrompt = () => {
    clearCotizacionDraft();
    setPendingDraft(null);
    setDraftPrompt(false);
  };

  const filtered = useMemo(() => {
    const list = productos ?? [];
    const term = query.trim().toLowerCase();
    return list.filter((product) =>
      !term ||
      `${product.name ?? ""} ${product.modelo ?? ""} ${product.categoria ?? product.category ?? ""}`
        .toLowerCase()
        .includes(term),
    );
  }, [productos, query, seleccion]);

  const items = useMemo(() => {
    const catalogo = productos ?? [];
    const resultado: {
      product: ProductoCatalogo;
      quantity: number;
      selectedColorId?: string;
      selectedColor?: string;
    }[] = [];
    for (const selected of Object.values(seleccion)) {
      const product = catalogo.find((p) => p.id === selected.productId);
      if (product) {
        resultado.push({
          product,
          quantity: selected.quantity,
          selectedColorId: selected.selectedColorId,
          selectedColor: selected.selectedColor,
        });
      }
    }
    return resultado;
  }, [seleccion, productos]);

  const totalProductos = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalCotizacion = items.reduce(
    (sum, item) => sum + getPrecioLocal(item.product) * item.quantity,
    0,
  );

  const maquinasItems: MaquinaItem[] = items.map(
    ({ product, quantity, selectedColorId, selectedColor }) => ({
      name: String(product.name ?? product.modelo ?? "Producto"),
      quantity,
      unitPrice: getPrecioLocal(product),
      colorId: selectedColorId,
      color: selectedColor,
    }),
  );

  const agregar = (product: ProductoCatalogo) => {
    setSeleccion((prev) => {
      const existing = prev[product.id];
      return {
        ...prev,
        [product.id]: {
          productId: product.id,
          quantity: existing ? existing.quantity + 1 : 1,
          selectedColorId: existing?.selectedColorId ?? DEFAULT_PRODUCT_COLOR_ID,
          selectedColor: existing?.selectedColor ?? getProductColorLabel(DEFAULT_PRODUCT_COLOR_ID) ?? undefined,
        },
      };
    });
  };

  const cambiarColor = (id: string, colorId: string) => {
    setSeleccion((prev) => {
      const existing = prev[id];
      if (!existing) return prev;
      const color = getProductColorById(colorId);
      return {
        ...prev,
        [id]: {
          ...existing,
          selectedColorId: colorId,
          selectedColor: color?.name ?? existing.selectedColor,
        },
      };
    });
  };

  const quitar = (id: string) => {
    const existing = seleccion[id];
    if (!existing) return;
    if (existing.quantity <= 1) {
      colapsarYQuitar(id);
      return;
    }
    setSeleccion((prev) => ({
      ...prev,
      [id]: { ...existing, quantity: existing.quantity - 1 },
    }));
  };

  const colapsarYQuitar = (id: string) => {
    if (collapsing) return;
    setCollapsing(id);
    window.setTimeout(() => {
      setSeleccion((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setCollapsing(null);
    }, 300);
  };

  const eliminar = (id: string) => {
    colapsarYQuitar(id);
  };

  const irSiguiente = () => {
    if (phase !== "idle") return;
    if (step === 1 && !cliente.name.trim()) {
      setNameError(true);
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
    if (step === 3) return;
    setNameError(false);
    goTo(step + 1);
  };

  const prepararItemYPayload = (): { item: SolicitudRemota; payload: RegistroOrdenTrabajoPayload } => {
    const quoteId = `COT-${Date.now().toString().slice(-6)}`;
    const direccionCompleta = cliente.address.trim();
    const destino = direccionCompleta || "Por acordar con el cliente";
    const company = getCompanyData();
    const origen = company
      ? [company.address, company.city, company.region].filter(Boolean).join(", ") || company.country
      : "Padre Las Casas, Chile";

    const productsPayload = items.map(({ product, quantity, selectedColorId, selectedColor }) => ({
      productId: product.id,
      name: product.name ?? product.modelo ?? "Producto",
      quantity,
      unitPrice: getPrecioLocal(product),
      selectedColorId,
      selectedColor,
    }));

    const payload: RegistroOrdenTrabajoPayload & { id?: string } = {
      id: quoteId,
      clientName: cliente.name.trim(),
      clientPhone: cliente.phone.trim(),
      clientRut: cliente.rut.trim(),
      clientEmail: cliente.email.trim(),
      clientComuna: cliente.comuna.trim(),
      clientAddress: direccionCompleta,
      message: message.trim(),
      shipping: {
        origin: origen,
        originZip: company.zip ?? "",
        destination: destino,
      },
      products: productsPayload,
      estado: "pendiente",
      enOT: false,
    };

    const item: SolicitudRemota = {
      id: quoteId,
      clientName: cliente.name.trim(),
      clientPhone: cliente.phone.trim(),
      clientRut: cliente.rut.trim(),
      clientEmail: cliente.email.trim(),
      clientComuna: cliente.comuna.trim(),
      clientCountry: "Chile",
      clientAddress: direccionCompleta,
      createdAt: new Date().toISOString(),
      shipping: {
        origin: origen,
        originZip: company.zip ?? "",
        destination: destino,
      },
      products: productsPayload,
      message: message.trim(),
      estado: "pendiente",
    };

    return { item, payload };
  };

  const guardar = async () => {
    setGenerating(true);
    try {
      const { item, payload } = prepararItemYPayload();
      const res = await enviarCotizacionAFirebase(item, payload);

      clearCotizacionDraft();
      onBack();

      if (res.offline) {
        showToast({
          title: "Cotización guardada (offline)",
          message: "Se guardó en este dispositivo y se sincronizará a Firebase al conectar a internet.",
          tone: "warning",
          durationMs: 6000,
        });
      } else {
        showToast({
          title: "Cotización enviada a Firebase",
          message: "Se registró exitosamente en Firebase.",
          tone: "success",
          durationMs: 5000,
        });
      }
    } catch (error) {
      console.error("Error al guardar cotización:", error);
      showToast({
        title: "Error al guardar",
        message: "No se pudo crear la cotización.",
        tone: "error",
      });
    } finally {
      setGenerating(false);
    }
  };

  const generar = async () => {
    setGenerating(true);
    try {
      const { item, payload } = prepararItemYPayload();
      const res = await enviarCotizacionAFirebase(item, payload);

      const itemParaPdf = res.id ? { ...item, id: res.id } : item;
      const pdf = await generarCotizacionPdf(itemParaPdf);

      clearCotizacionDraft();
      onBack();

      openPdfActions(pdf);

      if (res.offline) {
        showToast({
          title: "PDF generado (guardada offline)",
          message: "El PDF está listo y la cotización se enviará a Firebase cuando haya internet.",
          tone: "warning",
          icon: "fileText",
          durationMs: 8000,
        });
      } else {
        showToast({
          title: "PDF generado",
          message: "La cotización fue enviada a Firebase y el PDF está listo para compartir.",
          tone: "success",
          icon: "fileText",
          durationMs: 8000,
        });
      }
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

  const descartarCotizacion = () => {
    clearCotizacionDraft();
    onBack();
  };

  return (
    <div className="screen">
      <div className="view__header">
        <div>
          <div className="view__eyebrow">Operación</div>
          <h1 className="view__title">Nueva cotización</h1>
          <p className="view__subtitle">
            Paso {step} de 3 · {["Datos", "Productos", "Enviar"][step - 1]}
          </p>
        </div>
        <div className="view__header__actions">
          <button
            type="button"
            className="more-sheet__close"
            onClick={onBack}
            aria-label="Cerrar"
          >
            <X size={22} />
          </button>
        </div>
      </div>

      <StepIndicator current={step} />

      {step === 1 ? (
        <div
          key={step}
          className={`wizard-step wizard-step--fill wizard-step--${dir === 1 ? "fwd" : "back"}${
            phase === "leaving"
              ? " wizard-step--leaving"
              : phase === "leaving-back"
                ? " wizard-step--leaving-back"
                : ""
          }`}
        >
          <section className="form-card">
            <div className="form-card__header">
              <span className="form-card__icon" aria-hidden="true">
                <User size={16} />
              </span>
              <h3 className="form-card__title">Datos del cliente</h3>
            </div>
            <div className="form-grid">
              <div className="form-field form-field--wide">
                <label className="form-label" htmlFor="nc-name">Nombre / Razón social *</label>
                <input
                  id="nc-name"
                  className={`form-input${nameError ? " form-input--error" : ""}`}
                  type="text"
                  value={cliente.name}
                  onChange={(event) => {
                    setCliente({ ...cliente, name: event.target.value });
                    if (nameError && event.target.value.trim()) setNameError(false);
                  }}
                  placeholder="Ej. Juan Pérez"
                />
                {nameError ? (
                  <span className="form-error" role="alert">
                    Completa el nombre o razón social para continuar.
                  </span>
                ) : null}
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="nc-phone">Teléfono</label>
                <PhoneCountryField
                  id="nc-phone"
                  value={cliente.phone}
                  onChange={(phone) => setCliente({ ...cliente, phone })}
                />
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="nc-rut">RUT</label>
                <input
                  id="nc-rut"
                  className="form-input"
                  type="text"
                  inputMode="text"
                  autoComplete="off"
                  value={cliente.rut}
                  onChange={(event) =>
                    setCliente({ ...cliente, rut: formatRut(event.target.value) })
                  }
                  placeholder="12.345.678-9"
                />
              </div>
              <div className="form-field form-field--wide">
                <label className="form-label" htmlFor="nc-email">E-mail</label>
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
              <div className="form-field form-field--wide">
                <label className="form-label" htmlFor="nc-address">
                  Dirección <span className="form-label__hint">(incluye comuna)</span>
                </label>
                <input
                  id="nc-address"
                  className="form-input"
                  type="text"
                  value={cliente.address}
                  autoComplete="off"
                  onChange={(event) => {
                    const value = event.target.value;
                    setCliente({
                      ...cliente,
                      address: value,
                      comuna: extraerComunaDeDireccion(value),
                    });
                  }}
                  placeholder="Ej. Av. Los Pinos 123, Padre Las Casas"
                />
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {step === 2 ? createPortal(
        <div
          className={`editor-overlay editor-overlay--wizard${dir === 1 ? "" : " editor-overlay--back"}${
            phase === "leaving"
              ? " editor-overlay--leaving"
              : phase === "leaving-back"
                ? " editor-overlay--leaving-back"
                : ""
          }`}
        >
          <div className="editor" role="dialog" aria-modal="true" aria-label="Productos de la cotización">
            <header className="editor__header">
              <div className="editor__header-info">
                <div className="view__eyebrow">Operación</div>
                <h2 className="view__title">Nueva cotización</h2>
                <p className="view__subtitle">Paso 2 de 3 · Productos</p>
              </div>
              <button
                type="button"
                className="more-sheet__close"
                onClick={onBack}
                aria-label="Cerrar"
              >
                <X size={22} />
              </button>
            </header>

            <div className="editor__body">
              <section className="form-section">
                <div className="form-section__row">
                  <h3 className="form-section__title">Productos</h3>
                  <div className="form-section__row-actions">
                    <span className="editor__count">
                      {totalProductos} producto{totalProductos === 1 ? "" : "s"}
                    </span>
                    {items.length > 0 ? (
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        onClick={() => setMaquinasOpen(true)}
                      >
                        <Eye size={14} /> Ver
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="search-field">
                  <span className="search-field__icon" aria-hidden="true">
                    <Search size={22} />
                  </span>
                  <input
                    className="search-input"
                    type="search"
                    placeholder="Buscar productos…"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                  {query ? (
                    <button
                      type="button"
                      className="search-field__clear"
                      onClick={() => setQuery("")}
                      aria-label="Limpiar búsqueda"
                    >
                      <X size={16} />
                    </button>
                  ) : null}
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
              <button
                type="button"
                className="btn btn--secondary btn--icon btn--icon-sm"
                onClick={() => goTo(1)}
                disabled={generating}
                aria-label="Volver a datos del cliente"
              >
                <ArrowLeft size={20} />
              </button>
              <div className="editor__total">
                <span className="editor__total-label">
                  Total ({items.length} producto{items.length === 1 ? "" : "s"})
                </span>
                <strong className="editor__total-value">{formatPrecio(totalCotizacion)}</strong>
              </div>
              <button
                type="button"
                className="btn btn--primary btn--icon btn--icon-sm"
                onClick={irSiguiente}
                disabled={items.length === 0}
                aria-label="Siguiente paso"
              >
                <ArrowRight size={20} />
              </button>
            </footer>
          </div>
        </div>,
        document.body,
      ) : null}

      {step === 3 ? (
        <div
          key={step}
          className={`wizard-step wizard-step--fill wizard-step--${dir === 1 ? "fwd" : "back"}${
            phase === "leaving"
              ? " wizard-step--leaving"
              : phase === "leaving-back"
                ? " wizard-step--leaving-back"
                : ""
          }`}
        >
          <section className="form-section">
            <h2 className="form-section__title">Revisar y enviar</h2>
            <div className="wizard-summary">
              <div className="wizard-summary__row">
                <span>Cliente</span>
                <strong>{cliente.name || "—"}</strong>
              </div>
              <div className="wizard-summary__row">
                <span>RUT</span>
                <strong>{cliente.rut || "—"}</strong>
              </div>
              <div className="wizard-summary__row">
                <span>E-mail</span>
                <strong>{cliente.email || "—"}</strong>
              </div>
              <div className="wizard-summary__row">
                <span>Dirección</span>
                <strong>{cliente.address || "—"}</strong>
              </div>
              <div className="wizard-summary__row">
                <span>Comuna</span>
                <strong>{cliente.comuna || "—"}</strong>
              </div>
              <div className="wizard-summary__row">
                <span>Productos</span>
                <strong>
                  {totalProductos} producto{totalProductos === 1 ? "" : "s"}
                </strong>
              </div>
              {items.length > 1 ? (
                <button
                  type="button"
                  className="wizard-machines"
                  onClick={() => setMaquinasOpen(true)}
                >
                  <span className="wizard-machines__info">
                    <span className="wizard-machines__title">Ver máquinas seleccionadas</span>
                    <span className="wizard-machines__sub">
                      {items.length} máquina{items.length === 1 ? "" : "s"} ·{" "}
                      {totalProductos} producto{totalProductos === 1 ? "" : "s"}
                    </span>
                  </span>
                  <ChevronRight size={18} />
                </button>
              ) : (
                items.map(({ product, quantity, selectedColorId, selectedColor }) => (
                  <div key={product.id} className="wizard-summary__row">
                    <span>
                      {String(product.name ?? product.modelo ?? "Producto")} × {quantity}
                      {getProductColorLabel(selectedColorId)
                        ? ` · ${getProductColorLabel(selectedColorId)}`
                        : selectedColor
                          ? ` · ${selectedColor}`
                          : ""}
                    </span>
                    <strong>{formatPrecio(getPrecioLocal(product) * quantity)}</strong>
                  </div>
                ))
              )}
              <div className="wizard-summary__row wizard-summary__row--total">
                <span>Total estimado</span>
                <strong>{formatPrecio(totalCotizacion)}</strong>
              </div>
            </div>

            <div className="form-field form-field--wide" style={{ marginTop: "16px" }}>
              <label className="form-label" htmlFor="nc-obs">
                Observaciones
              </label>
              <textarea
                id="nc-obs"
                className="form-input form-textarea"
                placeholder="Notas que aparecerán en la sección Observación del PDF (opcional)"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={3}
              />
            </div>
          </section>
        </div>
      ) : null}

      {actionsOpen
        ? createPortal(
            <div className="more-sheet" role="dialog" aria-modal="true" aria-label="Opciones de la cotización">
              <div className="more-sheet__backdrop" onClick={actionsRequestClose} />
              <div ref={actionsPanelRef} className="more-sheet__panel">
                <header className="more-sheet__header">
                  <span className="more-sheet__title">Opciones de la cotización</span>
                  <span className="more-sheet__icon" aria-hidden="true">
                    <Menu size={18} />
                  </span>
                </header>
                <div className="more-sheet__list">
                  <button
                    type="button"
                    className="more-sheet__item"
                    onClick={() => {
                      actionsRequestClose();
                      void guardar();
                    }}
                    disabled={generating}
                  >
                    <span className="more-sheet__item-icon more-sheet__item-icon--success" aria-hidden="true">
                      <Check size={20} />
                    </span>
                    <span className="more-sheet__item-label">Guardar</span>
                  </button>
                  <button
                    type="button"
                    className="more-sheet__item"
                    onClick={() => {
                      actionsRequestClose();
                      void generar();
                    }}
                    disabled={generating}
                  >
                    <span className="more-sheet__item-icon" aria-hidden="true">
                      <Share2 size={20} />
                    </span>
                    <span className="more-sheet__item-label">Compartir</span>
                  </button>
                  <button
                    type="button"
                    className="more-sheet__item more-sheet__item--danger"
                    onClick={() => {
                      actionsRequestClose();
                      descartarCotizacion();
                    }}
                  >
                    <span className="more-sheet__item-icon more-sheet__item-icon--danger" aria-hidden="true">
                      <Trash2 size={20} />
                    </span>
                    <span className="more-sheet__item-label">Descartar</span>
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {draftPrompt
        ? createPortal(
            <div className="more-sheet" role="dialog" aria-modal="true" aria-label="Restaurar borrador">
              <div className="more-sheet__backdrop" onClick={draftRequestClose} />
              <div ref={draftPanelRef} className="more-sheet__panel">
                <header className="more-sheet__header">
                  <span className="more-sheet__title">Borrador encontrado</span>
                  <span className="more-sheet__icon" aria-hidden="true">
                    <FileText size={18} />
                  </span>
                </header>
                <div className="more-sheet__list">
                  <p className="confirm-sheet__message">
                    Tienes una cotización sin terminar. ¿Quieres restaurarla para continuar
                    donde la dejaste?
                  </p>
                  <button
                    type="button"
                    className="more-sheet__item"
                    onClick={restaurarBorrador}
                  >
                    <span className="more-sheet__item-icon more-sheet__item-icon--success" aria-hidden="true">
                      <Check size={20} />
                    </span>
                    <span className="more-sheet__item-label">Restaurar</span>
                  </button>
                  <button
                    type="button"
                    className="more-sheet__item more-sheet__item--danger"
                    onClick={descartarBorradorPrompt}
                  >
                    <span className="more-sheet__item-icon more-sheet__item-icon--danger" aria-hidden="true">
                      <Trash2 size={20} />
                    </span>
                    <span className="more-sheet__item-label">Descartar</span>
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {maquinasOpen ? (
        <MaquinasSheet
          items={maquinasItems}
          total={totalCotizacion}
          onClose={() => setMaquinasOpen(false)}
        />
      ) : null}

      {step === 1 || step === 3
        ? createPortal(
            <div className="wizard-actions wizard-actions--fixed">
              <div className="wizard-actions__inner">
                {step === 1 ? (
                  <>
                    <button
                      type="button"
                      className="btn btn--secondary btn--icon btn--icon-sm"
                      onClick={onBack}
                      aria-label="Salir"
                    >
                      <ArrowLeft size={20} />
                    </button>
                    <button
                      type="button"
                      className="btn btn--primary btn--icon btn--icon-sm"
                      onClick={irSiguiente}
                      aria-label="Siguiente paso"
                    >
                      <ArrowRight size={20} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn btn--secondary btn--icon btn--icon-sm"
                      onClick={() => goTo(2)}
                      disabled={generating}
                      aria-label="Volver a productos"
                    >
                      <ArrowLeft size={20} />
                    </button>
                    <button
                      type="button"
                      className="btn btn--primary btn--icon btn--icon-sm"
                      onClick={() => setActionsOpen(true)}
                      disabled={generating}
                      aria-label="Guardar y compartir"
                    >
                      <Share2 size={20} />
                    </button>
                  </>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
