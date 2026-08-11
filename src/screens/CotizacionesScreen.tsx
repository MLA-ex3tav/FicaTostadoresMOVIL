import { useEffect, useRef, useState } from "react";
import { ChevronRight, Clock, Package } from "lucide-react";
import type { SolicitudRemota } from "../lib/web-api";
import {
  aprobarCotizacion,
  borrarSolicitud,
  getSolicitudDate,
  isSolicitudPendiente,
  rechazarCotizacion,
  subscribeSolicitudes,
  esCotizacionSoloLocal,
  eliminarSolicitudVisible,
  type SolicitudesState,
} from "../services/solicitudes";
import { obtenerCotizacionPdf } from "../services/cotizacion-pdf";
import { showToast } from "../ui/toast";
import { openPdfActions } from "../ui/pdf-actions";
import { setNavBadge } from "../lib/badges";
import { StatusPill } from "../components/StatusPill";
import { EmptyState } from "../components/EmptyState";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { EditarCotizacion } from "../components/EditarCotizacion";
import { CotizacionActionsSheet } from "../components/CotizacionActionsSheet";
import { DetalleSolicitudSheet } from "../components/DetalleSolicitudSheet";
import { ProductColorSwatches } from "../components/ProductColorSwatches";
import {
  coloresProductos,
  estadoLabel,
  estadoPillVariant,
  formatFechaHora,
  getEstado,
  resumirProductos,
} from "./shared";

interface ItemState {
  generating: boolean;
  acting: string | null;
}

const LONG_PRESS_MS = 500;

export function CotizacionesScreen({ onCreate: _onCreate }: { onCreate?: () => void }) {
  const [state, setState] = useState<SolicitudesState | null>(null);
  const [itemState, setItemState] = useState<Record<string, ItemState>>({});
  const [confirmDelete, setConfirmDelete] = useState<SolicitudRemota | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState<SolicitudRemota | null>(null);
  const [actionsFor, setActionsFor] = useState<SolicitudRemota | null>(null);
  const [detalleFor, setDetalleFor] = useState<SolicitudRemota | null>(null);

  const editingRef = useRef(false);
  const editingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return subscribeSolicitudes(setState);
  }, []);

  const items = state?.cotizaciones ?? [];
  const pendientes = items.filter(isSolicitudPendiente);

  useEffect(() => {
    setNavBadge("cotizaciones", pendientes.length);
  }, [pendientes.length]);

  if (!state) return null;

  const verPdf = async (item: SolicitudRemota) => {
    setItemState((prev) => ({ ...prev, [item.id]: { ...prev[item.id], generating: true } }));
    try {
      const { pdf, cacheado } = await obtenerCotizacionPdf(item);
      if (!cacheado) {
        showToast({
          title: "PDF Generado",
          message: `${pdf.fileName} listo para compartir.`,
          tone: "success",
          icon: "fileText",
        });
      }
      openPdfActions(pdf);
    } catch (error) {
      console.error("Error al generar PDF:", error);
      showToast({
        title: "Error al generar PDF",
        message: "No se pudo crear el documento.",
        tone: "error",
      });
    } finally {
      setItemState((prev) => ({ ...prev, [item.id]: { ...prev[item.id], generating: false } }));
    }
  };

  const aprobarItem = async (item: SolicitudRemota) => {
    setItemState((prev) => ({ ...prev, [item.id]: { ...prev[item.id], acting: "aprobar" } }));
    const result = await aprobarCotizacion(item.id);
    if (!result.ok) {
      setItemState((prev) => ({ ...prev, [item.id]: { ...prev[item.id], acting: null } }));
      showToast({
        title: "Error al aprobar",
        message: result.error ?? "No se pudo aprobar la cotización.",
        tone: "error",
      });
      return;
    }
    showToast({
      title: "Cotización Aprobada",
      message: "La solicitud fue aprobada y movida a Órdenes de Trabajo.",
      tone: "success",
    });
    try {
      const { pdf, cacheado } = await obtenerCotizacionPdf(item);
      if (!cacheado) {
        showToast({
          title: "PDF de Orden de Trabajo Generado",
          message: `Documento ${pdf.fileName} listo para compartir.`,
          tone: "success",
          icon: "fileText",
        });
      }
      openPdfActions(pdf);
    } catch (error) {
      console.error("No se pudo generar el PDF de la OT", error);
    }
    setItemState((prev) => ({ ...prev, [item.id]: { ...prev[item.id], acting: null } }));
  };

  const rechazarItem = async (item: SolicitudRemota) => {
    setItemState((prev) => ({ ...prev, [item.id]: { ...prev[item.id], acting: "rechazar" } }));
    const result = await rechazarCotizacion(item.id);
    if (!result.ok) {
      setItemState((prev) => ({ ...prev, [item.id]: { ...prev[item.id], acting: null } }));
      showToast({
        title: "Error al rechazar",
        message: result.error ?? "No se pudo rechazar la cotización.",
        tone: "error",
      });
      return;
    }
    showToast({
      title: "Cotización Rechazada",
      message: "La solicitud fue marcada como rechazada.",
      tone: "info",
    });
    setItemState((prev) => ({ ...prev, [item.id]: { ...prev[item.id], acting: null } }));
  };

  const eliminar = async (item: SolicitudRemota) => {
    setDeleting(true);

    // Creada localmente y aún no registrada en la web: se borra solo en el dispositivo.
    if (esCotizacionSoloLocal(item.id)) {
      eliminarSolicitudVisible(item.id);
      setDeleting(false);
      setConfirmDelete(null);
      showToast({
        title: "Cotización Eliminada",
        message: "La solicitud fue eliminada de este dispositivo.",
        tone: "success",
      });
      return;
    }

    // Desaparece de la lista al instante, sin esperar la respuesta del servidor.
    eliminarSolicitudVisible(item.id);
    setConfirmDelete(null);
    showToast({
      title: "Cotización Eliminada",
      message: "La solicitud fue eliminada.",
      tone: "success",
    });

    const result = await borrarSolicitud(item.id);
    setDeleting(false);
    if (!result.ok) {
      showToast({
        title: "Error al eliminar",
        message: result.error ?? "No se pudo eliminar la cotización.",
        tone: "error",
      });
      // Si el borrado en el servidor falla, se trae de vuelta en el próximo refresh.
    }
  };

  return (
    <div className="screen">
      <div className="view__header">
        <div>
          <div className="view__eyebrow">Operación</div>
          <h1 className="view__title">Cotizaciones</h1>
          <p className="view__subtitle">Solicitudes pendientes en tiempo real</p>
        </div>
      </div>

      <div className="panel">
        {items.length === 0 ? (
          <EmptyState
            title={
              state.error
                ? "No se pudieron cargar las cotizaciones"
                : state.loading
                  ? "Cargando cotizaciones…"
                  : "Sin cotizaciones por ahora"
            }
            text={
              state.error
                ? `${state.error} · Revisa la sección Conexiones.`
                : state.loading
                  ? "Consultando la web."
                  : "Las nuevas cotizaciones aparecerán aquí automáticamente."
            }
          />
        ) : (
          <ul className="card-list">
            {items.map((item) => {
              const estado = getEstado(item, "pendiente");
              const colores = coloresProductos(item);
              const esLocal = esCotizacionSoloLocal(item.id);

              return (
                <li key={item.id} className={`card-list__item cot-card cot-card--${estado}`}>
                  <button
                    type="button"
                    className="cot-card__btn"
                    onClick={() => {
                      if (editingRef.current) return;
                      setActionsFor(item);
                    }}
                    onPointerDown={() => {
                      editingTimerRef.current = setTimeout(() => {
                        editingRef.current = true;
                        setEditing(item);
                      }, LONG_PRESS_MS);
                    }}
                    onPointerUp={() => {
                      if (editingTimerRef.current) {
                        clearTimeout(editingTimerRef.current);
                        editingTimerRef.current = null;
                      }
                      setTimeout(() => {
                        editingRef.current = false;
                      }, 0);
                    }}
                    onPointerLeave={() => {
                      if (editingTimerRef.current) {
                        clearTimeout(editingTimerRef.current);
                        editingTimerRef.current = null;
                      }
                    }}
                    onPointerCancel={() => {
                      if (editingTimerRef.current) {
                        clearTimeout(editingTimerRef.current);
                        editingTimerRef.current = null;
                      }
                    }}
                    aria-label={`Opciones de cotización de ${String(item.clientName ?? "sin nombre")}`}
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
                      <div className="cot-card__status">
                        {esLocal ? (
                          <span className="cot-card__local-badge">
                            <Package size={11} strokeWidth={2.5} /> Local
                          </span>
                        ) : null}
                        <StatusPill label={estadoLabel(estado)} variant={estadoPillVariant(estado)} />
                      </div>
                    </div>

                    <div className="cot-card__divider" aria-hidden="true" />

                    <div className="cot-card__row cot-card__row--products">
                      <span className="cot-card__row-icon" aria-hidden="true">
                        <Package size={15} strokeWidth={1.75} />
                      </span>
                      <span className="cot-card__products-text">{resumirProductos(item)}</span>
                      {colores.length > 0 ? (
                        <div className="cot-card__swatches">
                          <ProductColorSwatches colors={colores} limit={3} />
                        </div>
                      ) : null}
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
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {state.error && items.length > 0 ? (
          <div className="conn-updated">Última actualización con errores: {state.error}</div>
        ) : null}
      </div>

      {actionsFor ? (
        <CotizacionActionsSheet
          item={actionsFor}
          esEditable={
            !["aprobada_ot", "rechazada", "completada"].includes(
              getEstado(actionsFor, "pendiente"),
            )
          }
          busy={itemState[actionsFor.id]?.generating ?? false}
          acting={itemState[actionsFor.id]?.acting ?? null}
          onClose={() => setActionsFor(null)}
          onVerDetalles={() => {
            setActionsFor(null);
            setDetalleFor(actionsFor);
          }}
          onVerPdf={() => {
            setActionsFor(null);
            void verPdf(actionsFor);
          }}
          onEditar={() => {
            setActionsFor(null);
            setEditing(actionsFor);
          }}
          onAprobar={() => {
            setActionsFor(null);
            void aprobarItem(actionsFor);
          }}
          onRechazar={() => {
            setActionsFor(null);
            void rechazarItem(actionsFor);
          }}
          onEliminar={() => {
            setActionsFor(null);
            setConfirmDelete(actionsFor);
          }}
        />
      ) : null}

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Eliminar cotización"
        message={`¿Seguro que deseas eliminar la solicitud de ${confirmDelete ? String(confirmDelete.clientName ?? "este cliente") : ""}? Esta acción no se puede deshacer.`}
        busy={deleting}
        onConfirm={() => {
          if (confirmDelete) void eliminar(confirmDelete);
        }}
        onCancel={() => {
          if (!deleting) setConfirmDelete(null);
        }}
      />

      {editing ? (
        <EditarCotizacion item={editing} onClose={() => setEditing(null)} />
      ) : null}

      {detalleFor ? (
        <DetalleSolicitudSheet item={detalleFor} onClose={() => setDetalleFor(null)} />
      ) : null}
    </div>
  );
}
