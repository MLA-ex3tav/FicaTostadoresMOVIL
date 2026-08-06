import { useEffect, useState } from "react";
import { Plus, RefreshCw, ChevronRight } from "lucide-react";
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
import { StatsGrid, StatCard } from "../components/StatCard";
import { StatusPill } from "../components/StatusPill";
import { EmptyState } from "../components/EmptyState";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { EditarCotizacion } from "../components/EditarCotizacion";
import { CotizacionActionsSheet } from "../components/CotizacionActionsSheet";
import { ProductColorSwatches } from "../components/ProductColorSwatches";
import {
  estadoLabel,
  estadoPillVariant,
  formatFecha,
  getEstado,
  isThisWeek,
  isToday,
  resumirProductos,
  coloresProductos,
} from "./shared";

interface ItemState {
  generating: boolean;
  acting: string | null;
}

export function CotizacionesScreen({ onCreate }: { onCreate: () => void }) {
  const [state, setState] = useState<SolicitudesState | null>(null);
  const [itemState, setItemState] = useState<Record<string, ItemState>>({});
  const [confirmDelete, setConfirmDelete] = useState<SolicitudRemota | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState<SolicitudRemota | null>(null);
  const [actionsFor, setActionsFor] = useState<SolicitudRemota | null>(null);

  useEffect(() => {
    return subscribeSolicitudes(setState);
  }, []);

  const items = state?.cotizaciones ?? [];
  const pendientes = items.filter(isSolicitudPendiente);
  const hoy = items.filter((item) => isToday(getSolicitudDate(item)));
  const semana = items.filter((item) => isThisWeek(getSolicitudDate(item)));
  const aprobadas = items.filter((item) =>
    ["aprobada_ot", "completada"].includes(getEstado(item, "")),
  );

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

      <StatsGrid>
        <StatCard label="Pendientes" value={String(pendientes.length)} tone="accent" />
        <StatCard label="Hoy" value={String(hoy.length)} tone="info" />
        <StatCard label="Esta semana" value={String(semana.length)} />
        <StatCard label="Aprobadas" value={String(aprobadas.length)} tone="success" />
      </StatsGrid>

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
                  : "Cuando llegue una solicitud desde la web aparecerá aquí automáticamente."
            }
          >
            {!state.loading && !state.error ? (
              <button type="button" className="btn btn--primary" onClick={onCreate}>
                <Plus size={16} /> Crear cotización
              </button>
            ) : null}
          </EmptyState>
        ) : (
          <ul className="card-list">
            {items.map((item) => {
              const estado = getEstado(item, "pendiente");

              return (
                <li key={item.id} className="card-list__item card-list__item--tap">
                  <button
                    type="button"
                    className="card-list__btn"
                    onClick={() => setActionsFor(item)}
                    aria-label={`Opciones de cotización de ${String(item.clientName ?? "sin nombre")}`}
                  >
                    <div className="card-list__top">
                      <div className="card-list__title">{String(item.clientName ?? "Sin nombre")}</div>
                      <StatusPill label={estadoLabel(estado)} variant={estadoPillVariant(estado)} />
                    </div>
                    <div className="card-list__meta">
                      {String(item.clientPhone ?? item.clientEmail ?? "—")}
                    </div>
                    <div className="card-list__meta">{resumirProductos(item)}</div>
                    <ProductColorSwatches colors={coloresProductos(item)} />
                    <div className="card-list__meta card-list__meta--row">
                      <span>{formatFecha(getSolicitudDate(item))}</span>
                      <span className="card-list__chevron" aria-hidden="true">
                        <ChevronRight size={16} />
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {state.pendientesSincronizar > 0 ? (
          <div className="sync-banner" role="status">
            <span className="sync-banner__icon" aria-hidden="true">
              <RefreshCw size={14} />
            </span>
            <span>
              {state.pendientesSincronizar}{" "}
              {state.pendientesSincronizar === 1
                ? "cotización guardada localmente"
                : "cotizaciones guardadas localmente"}
              , sincronizando con el servidor…
            </span>
          </div>
        ) : null}
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
    </div>
  );
}
