import { useEffect, useState } from "react";
import { FileText, Plus, RefreshCw, Check, X } from "lucide-react";
import type { SolicitudRemota } from "../lib/web-api";
import {
  aprobarCotizacion,
  getSolicitudDate,
  isSolicitudPendiente,
  rechazarCotizacion,
  refreshSolicitudes,
  subscribeSolicitudes,
  type SolicitudesState,
} from "../services/solicitudes";
import { generarCotizacionPdf, descargarPdf } from "../services/cotizacion-pdf";
import { openPdfViewer } from "../ui/pdf-viewer";
import { showToast } from "../ui/toast";
import { setNavBadge } from "../lib/badges";
import { StatsGrid, StatCard } from "../components/StatCard";
import { StatusPill } from "../components/StatusPill";
import { EmptyState } from "../components/EmptyState";
import {
  estadoLabel,
  estadoPillVariant,
  formatFecha,
  getEstado,
  isThisWeek,
  isToday,
  resumirProductos,
} from "./shared";

interface ItemState {
  generating: boolean;
  acting: string | null;
}

export function CotizacionesScreen({ onNavigate }: { onNavigate: (view: string) => void }) {
  const [state, setState] = useState<SolicitudesState | null>(null);
  const [itemState, setItemState] = useState<Record<string, ItemState>>({});

  useEffect(() => {
    return subscribeSolicitudes(setState);
  }, []);

  if (!state) return null;

  const items = state.cotizaciones;
  const pendientes = items.filter(isSolicitudPendiente);
  const hoy = items.filter((item) => isToday(getSolicitudDate(item)));
  const semana = items.filter((item) => isThisWeek(getSolicitudDate(item)));
  const aprobadas = items.filter((item) =>
    ["aprobada_ot", "completada"].includes(getEstado(item, "")),
  );

  setNavBadge("cotizaciones", pendientes.length);

  const verPdf = async (item: SolicitudRemota) => {
    setItemState((prev) => ({ ...prev, [item.id]: { ...prev[item.id], generating: true } }));
    try {
      const pdf = await generarCotizacionPdf(item);
      openPdfViewer(pdf);
      showToast({
        title: "PDF Generado",
        message: `Se ha abierto ${pdf.fileName} para visualización.`,
        tone: "success",
        icon: "fileText",
        actions: [{ label: "Descargar PDF", onClick: () => descargarPdf(pdf), primary: true }],
      });
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

  const aprobar = async (item: SolicitudRemota) => {
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
      const pdf = await generarCotizacionPdf(item);
      openPdfViewer(pdf);
      showToast({
        title: "PDF de Orden de Trabajo Generado",
        message: `Documento ${pdf.fileName} listo.`,
        tone: "success",
        icon: "fileText",
        actions: [
          { label: "Ver PDF", onClick: () => openPdfViewer(pdf), primary: true },
          { label: "Descargar", onClick: () => descargarPdf(pdf) },
        ],
      });
    } catch (error) {
      console.error("No se pudo generar el PDF de la OT", error);
    }
    setItemState((prev) => ({ ...prev, [item.id]: { ...prev[item.id], acting: null } }));
  };

  const rechazar = async (item: SolicitudRemota) => {
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

  return (
    <div className="screen">
      <div className="view__header">
        <div>
          <h1 className="view__title">Cotizaciones</h1>
          <p className="view__subtitle">Solicitudes pendientes en tiempo real</p>
        </div>
        <div className="view__actions">
          <button
            className="btn btn--primary"
            type="button"
            onClick={() => onNavigate("nueva")}
          >
            <Plus size={16} /> Nueva
          </button>
          <button
            className="btn btn--secondary btn--icon"
            type="button"
            onClick={() => void refreshSolicitudes()}
            disabled={state.loading}
            aria-label="Actualizar"
          >
            <RefreshCw size={16} className={state.loading ? "spin" : ""} />
          </button>
        </div>
      </div>

      <StatsGrid>
        <StatCard label="Pendientes" value={String(pendientes.length)} tone="accent" hint={state.loading ? "Actualizando…" : undefined} />
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
          />
        ) : (
          <ul className="card-list">
            {items.map((item) => {
              const estado = getEstado(item, "pendiente");
              const esEditable = !["aprobada_ot", "rechazada", "completada"].includes(estado);
              const local = itemState[item.id] ?? { generating: false, acting: null };

              return (
                <li key={item.id} className="card-list__item">
                  <div className="card-list__top">
                    <div className="card-list__title">{String(item.clientName ?? "Sin nombre")}</div>
                    <StatusPill label={estadoLabel(estado)} variant={estadoPillVariant(estado)} />
                  </div>
                  <div className="card-list__meta">
                    {String(item.clientPhone ?? item.clientEmail ?? "—")}
                  </div>
                  <div className="card-list__meta">{resumirProductos(item)}</div>
                  <div className="card-list__meta">{formatFecha(getSolicitudDate(item))}</div>
                  <div className="card-list__actions">
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
                      onClick={() => void verPdf(item)}
                      disabled={local.generating}
                    >
                      <FileText size={14} /> {local.generating ? "Generando…" : "PDF"}
                    </button>
                    {esEditable ? (
                      <>
                        <button
                          type="button"
                          className="btn btn--success btn--sm"
                          onClick={() => void aprobar(item)}
                          disabled={local.acting !== null}
                        >
                          <Check size={14} /> {local.acting === "aprobar" ? "Aprobando…" : "Aprobar"}
                        </button>
                        <button
                          type="button"
                          className="btn btn--danger btn--sm"
                          onClick={() => void rechazar(item)}
                          disabled={local.acting !== null}
                        >
                          <X size={14} /> {local.acting === "rechazar" ? "Rechazando…" : "Rechazar"}
                        </button>
                      </>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {state.error && items.length > 0 ? (
          <div className="conn-updated">Última actualización con errores: {state.error}</div>
        ) : null}
      </div>
    </div>
  );
}
