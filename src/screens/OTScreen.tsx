import { useEffect, useState } from "react";
import { FileText, Play, Trash2 } from "lucide-react";
import type { SolicitudRemota } from "../lib/web-api";
import { actualizarEstadoSolicitud } from "../lib/web-api";
import {
  borrarSolicitud,
  getSolicitudDate,
  refreshSolicitudes,
  subscribeSolicitudes,
  type SolicitudesState,
} from "../services/solicitudes";
import { generarOtPdf } from "../services/ot-pdf";
import { showToast } from "../ui/toast";
import { openPdfActions } from "../ui/pdf-actions";
import { StatsGrid, StatCard } from "../components/StatCard";
import { StatusPill } from "../components/StatusPill";
import { EmptyState } from "../components/EmptyState";
import { ConfirmDialog } from "../components/ConfirmDialog";
import {
  OT_ESTADO_LABELS,
  OT_ESTADOS,
  formatFecha,
  getEstado,
  resumirProductos,
} from "./shared";

const OT_ESTADO_VARIANT: Record<string, "done" | "pending" | "progress"> = {
  entregada: "done",
  en_produccion: "progress",
  terminada: "progress",
  aprobada_ot: "pending",
};

function siguienteEstado(estado: string): string | null {
  switch (estado) {
    case "aprobada_ot":
      return "en_produccion";
    case "en_produccion":
      return "terminada";
    case "terminada":
      return "entregada";
    default:
      return null;
  }
}

function siguienteLabel(estado: string): string {
  switch (estado) {
    case "aprobada_ot":
      return "Iniciar producción";
    case "en_produccion":
      return "Marcar terminada";
    case "terminada":
      return "Marcar entregada";
    default:
      return "—";
  }
}

interface ItemState {
  generating: boolean;
  advancing: boolean;
}

export function OTScreen() {
  const [state, setState] = useState<SolicitudesState | null>(null);
  const [itemState, setItemState] = useState<Record<string, ItemState>>({});
  const [confirmDelete, setConfirmDelete] = useState<SolicitudRemota | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    return subscribeSolicitudes(setState);
  }, []);

  if (!state) return null;

  const items = state.cotizaciones.filter((item) => {
    const estado = getEstado(item, "");
    return OT_ESTADOS.includes(estado);
  });

  const porIniciar = items.filter((item) => item.estado === "aprobada_ot");
  const enProduccion = items.filter((item) => item.estado === "en_produccion");
  const terminadas = items.filter((item) => item.estado === "terminada");
  const entregadas = items.filter((item) => item.estado === "entregada");

  const verPdf = async (item: SolicitudRemota) => {
    setItemState((prev) => ({ ...prev, [item.id]: { ...prev[item.id], generating: true } }));
    try {
      const pdf = await generarOtPdf(item);
      showToast({
        title: "PDF de OT Generado",
        message: `${pdf.fileName} listo para compartir.`,
        tone: "success",
        icon: "fileText",
      });
      openPdfActions(pdf);
    } catch (error) {
      console.error("Error al generar PDF de OT:", error);
      showToast({
        title: "Error al generar PDF",
        message: "No se pudo generar la Orden de Trabajo en PDF.",
        tone: "error",
      });
    } finally {
      setItemState((prev) => ({ ...prev, [item.id]: { ...prev[item.id], generating: false } }));
    }
  };

  const avanzar = async (item: SolicitudRemota, next: string) => {
    setItemState((prev) => ({ ...prev, [item.id]: { ...prev[item.id], advancing: true } }));
    const result = await actualizarEstadoSolicitud(item.id, next);
    if (!result.ok) {
      setItemState((prev) => ({ ...prev, [item.id]: { ...prev[item.id], advancing: false } }));
      showToast({
        title: "Error al actualizar OT",
        message: result.error ?? "Ocurrió un error al cambiar la etapa de producción.",
        tone: "error",
      });
      return;
    }
    await refreshSolicitudes();
    showToast({
      title: "Etapa de OT Actualizada",
      message: "La orden de trabajo fue avanzada exitosamente.",
      tone: "success",
    });
    setItemState((prev) => ({ ...prev, [item.id]: { ...prev[item.id], advancing: false } }));
  };

  const eliminar = async (item: SolicitudRemota) => {
    setDeleting(true);
    const result = await borrarSolicitud(item.id);
    setDeleting(false);
    if (!result.ok) {
      showToast({
        title: "Error al eliminar",
        message: result.error ?? "No se pudo eliminar la orden de trabajo.",
        tone: "error",
      });
      return;
    }
    setConfirmDelete(null);
    showToast({
      title: "Orden Eliminada",
      message: "La orden de trabajo fue eliminada.",
      tone: "success",
    });
  };

  return (
    <div className="screen">
      <div className="view__header">
        <div>
          <div className="view__eyebrow">Producción</div>
          <h1 className="view__title">Órdenes de Trabajo</h1>
          <p className="view__subtitle">Producción y seguimiento de fabricación</p>
        </div>
      </div>

      <StatsGrid>
        <StatCard label="Por iniciar" value={String(porIniciar.length)} tone="warning" />
        <StatCard label="En producción" value={String(enProduccion.length)} tone="info" />
        <StatCard label="Terminadas" value={String(terminadas.length)} tone="accent" />
        <StatCard label="Entregadas" value={String(entregadas.length)} tone="success" />
      </StatsGrid>

      <div className="panel">
        {items.length === 0 ? (
          <EmptyState
            title={state.loading ? "Cargando órdenes…" : "Sin órdenes de trabajo"}
            text={
              state.loading
                ? "Consultando la web."
                : "Aprueba cotizaciones desde la sección Cotizaciones para generar órdenes de trabajo."
            }
          />
        ) : (
          <ul className="card-list">
            {items.map((item) => {
              const estado = getEstado(item, "aprobada_ot");
              const next = siguienteEstado(estado);
              const local = itemState[item.id] ?? { generating: false, advancing: false };

              return (
                <li key={item.id} className="card-list__item">
                  <div className="card-list__top">
                    <div className="card-list__title">{String(item.clientName ?? "Sin nombre")}</div>
                    <StatusPill
                      label={OT_ESTADO_LABELS[estado] ?? estado}
                      variant={OT_ESTADO_VARIANT[estado] ?? "pending"}
                    />
                  </div>
                  <div className="card-list__meta">
                    {String(item.clientPhone ?? item.clientEmail ?? "—")}
                  </div>
                  <div className="card-list__meta">{resumirProductos(item)}</div>
                  <div className="card-list__meta">{formatFecha(getSolicitudDate(item))}</div>
                  <div className="card-list__actions">
                    {next ? (
                      <button
                        type="button"
                        className="btn btn--stage btn--sm"
                        onClick={() => void avanzar(item, next)}
                        disabled={local.advancing}
                      >
                        <Play size={14} /> {local.advancing ? "Actualizando…" : siguienteLabel(estado)}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
                      onClick={() => void verPdf(item)}
                      disabled={local.generating}
                      aria-label="Ver PDF"
                    >
                      <FileText size={14} />
                    </button>
                    <button
                      type="button"
                      className="btn btn--danger btn--sm"
                      onClick={() => setConfirmDelete(item)}
                      disabled={local.generating || local.advancing}
                      aria-label="Eliminar orden"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Eliminar orden de trabajo"
        message={`¿Seguro que deseas eliminar la OT de ${confirmDelete ? String(confirmDelete.clientName ?? "este cliente") : ""}? Esta acción no se puede deshacer.`}
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
