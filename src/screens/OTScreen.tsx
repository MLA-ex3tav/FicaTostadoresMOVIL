import { useEffect, useRef, useState } from "react";
import { Clock, Package, ChevronRight } from "lucide-react";
import type { SolicitudRemota } from "../lib/web-api";
import {
  borrarSolicitud,
  cambiarEstadoLocal,
  getSolicitudDate,
  subscribeSolicitudes,
  type SolicitudesState,
} from "../services/solicitudes";
import { generarOtPdf } from "../services/ot-pdf";
import { showToast } from "../ui/toast";
import { openPdfActions } from "../ui/pdf-actions";
import { EmptyState } from "../components/EmptyState";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { OTActionsSheet } from "../components/OTActionsSheet";
import { DetalleSolicitudSheet } from "../components/DetalleSolicitudSheet";
import {
  OT_ESTADOS,
  formatFechaHora,
  getEstado,
  resumirProductos,
} from "./shared";

function siguienteEstado(estado: string): string | null {
  switch (estado) {
    case "aprobada_ot":
      return "en_produccion";
    case "en_produccion":
      return "terminada";
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
    default:
      return "—";
  }
}

interface ItemState {
  generating: boolean;
  advancing: boolean;
}

const LONG_PRESS_MS = 500;

const OT_PIPELINE_STEPS = [
  { id: "aprobada_ot", label: "Por iniciar" },
  { id: "en_produccion", label: "En producción" },
  { id: "terminada", label: "Terminada" },
];

export function OTScreen() {
  const [state, setState] = useState<SolicitudesState | null>(null);
  const [itemState, setItemState] = useState<Record<string, ItemState>>({});
  const [confirmDelete, setConfirmDelete] = useState<SolicitudRemota | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionsFor, setActionsFor] = useState<SolicitudRemota | null>(null);
  const [detalleFor, setDetalleFor] = useState<SolicitudRemota | null>(null);

  useEffect(() => {
    return subscribeSolicitudes(setState);
  }, []);

  if (!state) return null;

  const items = state.cotizaciones.filter((item) => {
    const estado = getEstado(item, "");
    return OT_ESTADOS.includes(estado);
  });

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

  const avanzar = (item: SolicitudRemota, next: string) => {
    // Cambio optimista: se aplica al instante y se envía a Firebase en background.
    cambiarEstadoLocal(item.id, next);
    showToast({
      title: "Etapa de OT Actualizada",
      message: "El cambio se está sincronizando con el servidor.",
      tone: "success",
    });
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
              const currentStepIdx = OT_PIPELINE_STEPS.findIndex((s) => s.id === estado);

              return (
                <li key={item.id} className={`card-list__item ot-card ot-card--${estado}`}>
                  <OTLongPressButton
                    item={item}
                    onTap={() => setActionsFor(item)}
                    onLongPress={() => {
                      const n = siguienteEstado(getEstado(item, "aprobada_ot"));
                      if (n) void avanzar(item, n);
                    }}
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
                    </div>

                    {/* Stepper visual de producción */}
                    <div className="ot-pipeline" aria-label="Etapa de producción">
                      {OT_PIPELINE_STEPS.map((step, idx) => {
                        const isCurrent = estado === step.id;
                        const isPassed = idx <= currentStepIdx;
                        return (
                          <div
                            key={step.id}
                            className={`ot-pipeline__step ${isCurrent ? "ot-pipeline__step--active" : ""} ${isPassed ? "ot-pipeline__step--passed" : ""}`}
                          >
                            <div className="ot-pipeline__bar" />
                            <span className="ot-pipeline__dot" />
                            <span className="ot-pipeline__label">{step.label}</span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="cot-card__divider" aria-hidden="true" />

                    <div className="cot-card__row cot-card__row--products">
                      <span className="cot-card__row-icon" aria-hidden="true">
                        <Package size={15} strokeWidth={1.75} />
                      </span>
                      <span className="cot-card__products-text">{resumirProductos(item)}</span>
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

                    {next ? (
                      <div className="ot-card__next-sub">
                        Toca para opciones · Mantén presionado para pasar de fase
                      </div>
                    ) : (
                      <div className="ot-card__next-sub ot-card__next-sub--completed">
                        ✓ Orden terminada · Toca para opciones
                      </div>
                    )}
                  </OTLongPressButton>
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

      {actionsFor ? (
        <OTActionsSheet
          item={actionsFor}
          next={siguienteEstado(getEstado(actionsFor, "aprobada_ot")) ?? undefined}
          nextLabel={siguienteLabel(getEstado(actionsFor, "aprobada_ot"))}
          busy={itemState[actionsFor.id]?.generating ?? false}
          advancing={itemState[actionsFor.id]?.advancing ?? false}
          onClose={() => setActionsFor(null)}
          onVerDetalles={() => {
            setActionsFor(null);
            setDetalleFor(actionsFor);
          }}
          onAvanzar={() => {
            const next = siguienteEstado(getEstado(actionsFor, "aprobada_ot"));
            setActionsFor(null);
            if (next) void avanzar(actionsFor, next);
          }}
          onVerPdf={() => {
            setActionsFor(null);
            void verPdf(actionsFor);
          }}
          onEliminar={() => {
            setActionsFor(null);
            setConfirmDelete(actionsFor);
          }}
        />
      ) : null}

      {detalleFor ? (
        <DetalleSolicitudSheet item={detalleFor} variant="ot" onClose={() => setDetalleFor(null)} />
      ) : null}
    </div>
  );
}

function OTLongPressButton({
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

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    clearTimer();
    if (!firedRef.current) {
      onTap();
    }
  };

  const handleLeave = (event: React.PointerEvent) => {
    event.stopPropagation();
    clearTimer();
  };

  return (
    <button
      type="button"
      className="cot-card__btn"
      onPointerDown={start}
      onClick={handleClick}
      onPointerLeave={handleLeave}
      onPointerCancel={(event) => {
        event.stopPropagation();
        clearTimer();
      }}
      aria-label={`Opciones de la OT de ${String(item.clientName ?? "sin nombre")}`}
    >
      {children}
    </button>
  );
}
