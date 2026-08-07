import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Package, Clock, Headphones, ChevronRight } from "lucide-react";
import type { SolicitudRemota } from "../lib/web-api";
import {
  borrarSolicitud,
  getSolicitudDate,
  subscribeSolicitudes,
  type SolicitudesState,
} from "../services/solicitudes";
import { generarCotizacionPdf } from "../services/cotizacion-pdf";
import { generarOtPdf } from "../services/ot-pdf";
import { openPdfActions } from "../ui/pdf-actions";
import { showToast } from "../ui/toast";
import { StatusPill } from "../components/StatusPill";
import { EmptyState } from "../components/EmptyState";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { HistorialActionsSheet } from "../components/HistorialActionsSheet";
import { Picker } from "../components/Picker";
import {
  estadoLabel,
  estadoPillVariant,
  formatFechaHora,
  getEstado,
  resumirProductos,
} from "./shared";

const HISTORIAL_ESTADOS = [
  "completada",
  "rechazada",
  "cerrada",
  "entregada",
  "resuelta",
  "terminada",
];

const LONG_PRESS_MS = 500;

type CategoryFilter = "todos" | "cotizaciones" | "ot" | "soporte";

function esItemSoporte(item: SolicitudRemota): boolean {
  const estado = getEstado(item, "");
  return estado === "resuelta" || estado === "cerrada" || Boolean(item.equipmentModel || item.issueCategory);
}

function esItemOt(item: SolicitudRemota): boolean {
  const estado = getEstado(item, "");
  return ["terminada", "entregada"].includes(estado);
}

export function HistorialScreen() {
  const [state, setState] = useState<SolicitudesState | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("todos");
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [actionsFor, setActionsFor] = useState<SolicitudRemota | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SolicitudRemota | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    return subscribeSolicitudes(setState);
  }, []);

  const allItems = useMemo(() => {
    const rawCotizaciones = state?.cotizaciones ?? [];
    const rawSoporte = state?.soporte ?? [];
    return [...rawCotizaciones, ...rawSoporte].filter((item) => {
      const estado = getEstado(item, "");
      return HISTORIAL_ESTADOS.includes(estado);
    });
  }, [state]);

  const filteredItems = useMemo(() => {
    let result = allItems;

    if (category === "cotizaciones") {
      result = result.filter((item) => !esItemSoporte(item) && !esItemOt(item));
    } else if (category === "ot") {
      result = result.filter((item) => esItemOt(item));
    } else if (category === "soporte") {
      result = result.filter((item) => esItemSoporte(item));
    }

    const term = query.trim().toLowerCase();
    if (!term) return result;

    return result.filter((item) => {
      const name = String(item.clientName ?? "").toLowerCase();
      const email = String(item.clientEmail ?? "").toLowerCase();
      const phone = String(item.clientPhone ?? "").toLowerCase();
      const id = String(item.id ?? "").toLowerCase();
      const products = resumirProductos(item).toLowerCase();
      const equipment = String(item.equipmentModel ?? "").toLowerCase();
      return (
        name.includes(term) ||
        email.includes(term) ||
        phone.includes(term) ||
        id.includes(term) ||
        products.includes(term) ||
        equipment.includes(term)
      );
    });
  }, [allItems, category, query]);

  if (!state) return null;

  const totalCotizaciones = allItems.filter((item) => !esItemSoporte(item) && !esItemOt(item)).length;
  const totalOt = allItems.filter(esItemOt).length;
  const totalSoporte = allItems.filter(esItemSoporte).length;

  const verPdf = async (item: SolicitudRemota) => {
    setGeneratingId(item.id);
    try {
      if (esItemOt(item)) {
        const pdf = await generarOtPdf(item);
        showToast({
          title: "PDF de OT Generado",
          message: `${pdf.fileName} listo para abrir.`,
          tone: "success",
          icon: "fileText",
        });
        openPdfActions(pdf);
      } else {
        const { pdf } = await generarCotizacionPdf(item).then((p) => ({ pdf: p }));
        showToast({
          title: "PDF de Cotización",
          message: `${pdf.fileName} listo para abrir.`,
          tone: "success",
          icon: "fileText",
        });
        openPdfActions(pdf);
      }
    } catch (error) {
      console.error("Error al generar PDF del historial:", error);
      showToast({
        title: "Error al generar PDF",
        message: "No se pudo preparar el documento PDF.",
        tone: "error",
      });
    } finally {
      setGeneratingId(null);
    }
  };

  const abrirWhatsapp = (item: SolicitudRemota) => {
    const phone = String(item.clientPhone ?? "").replace(/[^0-9+]/g, "");
    if (!phone) {
      showToast({ title: "Sin teléfono", message: "No registra teléfono de contacto.", tone: "warning" });
      return;
    }
    const msg = encodeURIComponent(`Hola ${item.clientName ?? ""}, te contactamos desde Empresas FICA referente a tu registro en nuestro historial.`);
    window.open(`https://wa.me/${phone.replace("+", "")}?text=${msg}`, "_blank");
  };

  const eliminar = async (item: SolicitudRemota) => {
    setDeleting(true);
    const result = await borrarSolicitud(item.id);
    setDeleting(false);
    if (!result.ok) {
      showToast({
        title: "Error al eliminar",
        message: result.error ?? "No se pudo eliminar el registro.",
        tone: "error",
      });
      return;
    }
    setConfirmDelete(null);
    showToast({
      title: "Registro Eliminado",
      message: "El elemento fue removido del historial.",
      tone: "success",
    });
  };

  return (
    <div className="screen">
      <div className="view__header">
        <div>
          <div className="view__eyebrow">Operación</div>
          <h1 className="view__title">Historial</h1>
          <p className="view__subtitle">Cotizaciones, OT y tickets cerrados</p>
        </div>
      </div>

      <div className="search-field" style={{ marginBottom: "10px" }}>
        <span className="search-field__icon" aria-hidden="true">
          <Search size={16} />
        </span>
        <input
          className="search-input"
          type="search"
          placeholder="Buscar por cliente, teléfono, producto..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <div style={{ marginBottom: "14px" }}>
        <Picker
        label="Categoría"
        value={category}
        onChange={(value) => setCategory(value as CategoryFilter)}
        searchable={false}
        options={[
          { value: "todos", label: `Todos (${allItems.length})` },
          { value: "cotizaciones", label: `Cotizaciones (${totalCotizaciones})` },
          { value: "ot", label: `OT (${totalOt})` },
          { value: "soporte", label: `Soporte (${totalSoporte})` },
        ]}
      />
      </div>

      <div className="panel">
        {filteredItems.length === 0 ? (
          <EmptyState
            title={state.loading ? "Cargando historial…" : "Sin registros en el historial"}
            text={
              state.loading
                ? "Consultando datos de la web."
                : query
                  ? "No se encontraron coincidencias para la búsqueda actual."
                  : "Cuando se completen cotizaciones, órdenes de trabajo o soporte, aparecerán aquí."
            }
          />
        ) : (
          <ul className="card-list">
            {filteredItems.map((item) => {
              const esSoporte = esItemSoporte(item);
              const estado = getEstado(item, "completada");

              return (
                <li key={item.id} className="card-list__item cot-card">
                  <HistorialLongPressButton
                    item={item}
                    onTap={() => setActionsFor(item)}
                    onLongPress={() => setActionsFor(item)}
                  >
                    <div className="cot-card__top">
                      <div className="cot-card__client">
                        <span className="cot-card__name">
                          {String(item.clientName ?? "Sin nombre")}
                        </span>
                        <span className="cot-card__contact">
                          {String(item.clientPhone ?? item.clientEmail ?? "—")}
                        </span>
                      </div>
                      <StatusPill label={estadoLabel(estado)} variant={estadoPillVariant(estado)} />
                    </div>

                    <div className="cot-card__divider" aria-hidden="true" />

                    <div className="cot-card__row cot-card__row--products">
                      <span className="cot-card__row-icon" aria-hidden="true">
                        {esSoporte ? <Headphones size={15} strokeWidth={1.75} /> : <Package size={15} strokeWidth={1.75} />}
                      </span>
                      <span className="cot-card__products-text">
                        {esSoporte
                          ? `${String(item.equipmentModel ?? "Equipo")} · ${String(item.issueCategory ?? "Soporte")}`
                          : resumirProductos(item)}
                      </span>
                    </div>

                    <div className="cot-card__date">
                      <div className="cot-card__row">
                        <span className="cot-card__row-icon" aria-hidden="true">
                          <Clock size={14} strokeWidth={1.75} />
                        </span>
                        <span>{formatFechaHora(getSolicitudDate(item))}</span>
                      </div>
                      <span className="cot-card__chevron" aria-hidden="true">
                        <ChevronRight size={16} />
                      </span>
                    </div>

                    <div className="ot-card__next-sub">
                      Toca o mantén presionado para opciones
                    </div>
                  </HistorialLongPressButton>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Menú de acciones */}
      {actionsFor ? (
        <HistorialActionsSheet
          item={actionsFor}
          esSoporte={esItemSoporte(actionsFor)}
          busy={generatingId === actionsFor.id}
          onClose={() => setActionsFor(null)}
          onVerPdf={() => {
            const target = actionsFor;
            setActionsFor(null);
            void verPdf(target);
          }}
          onWhatsapp={() => {
            const target = actionsFor;
            setActionsFor(null);
            abrirWhatsapp(target);
          }}
          onEliminar={() => {
            const target = actionsFor;
            setActionsFor(null);
            setConfirmDelete(target);
          }}
        />
      ) : null}

      {/* Confirmar borrado */}
      <ConfirmDialog
        open={confirmDelete !== null}
        title="Eliminar del historial"
        message={`¿Seguro que deseas eliminar el registro de ${confirmDelete ? String(confirmDelete.clientName ?? "este cliente") : ""}? Esta acción no se puede deshacer.`}
        busy={deleting}
        onConfirm={() => {
          if (confirmDelete) void eliminar(confirmDelete);
        }}
        onCancel={() => {
          if (!deleting) setConfirmDelete(null);
        }}
      />
    </div>
  );
}

function HistorialLongPressButton({
  item,
  onTap,
  onLongPress,
  children,
}: {
  item: SolicitudRemota;
  onTap: () => void;
  onLongPress: () => void;
  children: React.ReactNode;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firedRef = useRef(false);

  const start = (event: React.PointerEvent) => {
    event.stopPropagation();
    firedRef.current = false;
    timerRef.current = setTimeout(() => {
      firedRef.current = true;
      onLongPress();
    }, LONG_PRESS_MS);
  };

  const finish = (event: React.PointerEvent) => {
    event.stopPropagation();
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!firedRef.current) {
      onTap();
    }
  };

  const cancel = (event: React.PointerEvent) => {
    event.stopPropagation();
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  return (
    <button
      type="button"
      className="cot-card__btn"
      onPointerDown={start}
      onPointerUp={finish}
      onPointerLeave={(e) => {
        e.stopPropagation();
        cancel(e);
      }}
      onPointerCancel={cancel}
      aria-label={`Opciones del historial de ${String(item.clientName ?? "sin nombre")}`}
    >
      {children}
    </button>
  );
}


