import { useEffect, useState } from "react";
import { Headphones, Check } from "lucide-react";
import { actualizarEstadoSolicitud } from "../lib/web-api";
import {
  getSolicitudDate,
  refreshSolicitudes,
  subscribeSolicitudes,
  type SolicitudesState,
} from "../services/solicitudes";
import { showToast } from "../ui/toast";
import { setNavBadge } from "../lib/badges";
import { StatsGrid, StatCard } from "../components/StatCard";
import { StatusPill } from "../components/StatusPill";
import { EmptyState } from "../components/EmptyState";
import {
  ESTADO_LABELS,
  estadoLabel,
  estadoPillVariant,
  formatFecha,
  getEstado,
  isThisMonth,
} from "./shared";

const SOPORTE_ESTADOS = ["abierta", "en_curso", "resuelta", "cerrada"];

interface ItemState {
  acting: string | null;
}

export function SoporteScreen() {
  const [state, setState] = useState<SolicitudesState | null>(null);
  const [itemState, setItemState] = useState<Record<string, ItemState>>({});

  useEffect(() => {
    return subscribeSolicitudes(setState);
  }, []);

  if (!state) return null;

  const items = state.soporte.filter((item) => SOPORTE_ESTADOS.includes(getEstado(item, "")));

  const abiertas = items.filter((item) => getEstado(item, "abierta") === "abierta");
  const enCurso = items.filter((item) => getEstado(item, "") === "en_curso");
  const resueltas = items.filter((item) => ["resuelta", "cerrada"].includes(getEstado(item, "")));
  const esteMes = items.filter((item) => isThisMonth(getSolicitudDate(item)));

  setNavBadge("soporte", abiertas.length);

  const actualizar = async (id: string, nextState: string) => {
    setItemState((prev) => ({ ...prev, [id]: { acting: nextState } }));
    const result = await actualizarEstadoSolicitud(id, nextState);
    if (result.ok) {
      await refreshSolicitudes();
      showToast({
        title: "Ticket de Soporte Actualizado",
        message: `La solicitud cambió a estado: ${ESTADO_LABELS[nextState] ?? nextState}`,
        tone: "success",
      });
    } else {
      setItemState((prev) => ({ ...prev, [id]: { acting: null } }));
      showToast({
        title: "Error al actualizar ticket",
        message: result.error ?? "No se pudo actualizar la solicitud.",
        tone: "error",
      });
    }
  };

  return (
    <div className="screen">
      <div className="view__header">
        <div>
          <h1 className="view__title">Soporte técnico</h1>
          <p className="view__subtitle">Solicitudes de servicio desde la web</p>
        </div>
      </div>

      <StatsGrid>
        <StatCard label="Abiertas" value={String(abiertas.length)} tone="warning" />
        <StatCard label="En curso" value={String(enCurso.length)} tone="info" />
        <StatCard label="Resueltas" value={String(resueltas.length)} tone="success" />
        <StatCard label="Este mes" value={String(esteMes.length)} />
      </StatsGrid>

      <div className="panel">
        {items.length === 0 ? (
          <EmptyState
            title={
              state.error
                ? "No se pudieron cargar las solicitudes"
                : state.loading
                  ? "Cargando solicitudes…"
                  : "Sin solicitudes de soporte"
            }
            text={
              state.error
                ? `${state.error} · Revisa la sección Conexiones.`
                : state.loading
                  ? "Consultando la web."
                  : "Cuando llegue una solicitud de servicio técnico desde la web aparecerá aquí."
            }
          />
        ) : (
          <ul className="card-list">
            {items.map((item) => {
              const estado = getEstado(item, "abierta");
              const local = itemState[item.id] ?? { acting: null };
              const puedeAtender = estado === "abierta";
              const puedeResolver = estado === "abierta" || estado === "en_curso";

              return (
                <li key={item.id} className="card-list__item">
                  <div className="card-list__top">
                    <div className="card-list__title">{String(item.clientName ?? "Sin nombre")}</div>
                    <StatusPill label={estadoLabel(estado)} variant={estadoPillVariant(estado)} />
                  </div>
                  <div className="card-list__meta">
                    {String(item.clientPhone ?? item.clientEmail ?? "—")}
                  </div>
                  <div className="card-list__meta">
                    {String(item.equipmentModel ?? "—")} · {String(item.issueCategory ?? "—")}
                  </div>
                  <div className="card-list__meta">{formatFecha(getSolicitudDate(item))}</div>
                  {puedeAtender || puedeResolver ? (
                    <div className="card-list__actions">
                      {puedeAtender ? (
                        <button
                          type="button"
                          className="btn btn--info btn--sm"
                          onClick={() => void actualizar(item.id, "en_curso")}
                          disabled={local.acting !== null}
                        >
                          <Headphones size={14} /> {local.acting === "en_curso" ? "Actualizando…" : "Atender"}
                        </button>
                      ) : null}
                      {puedeResolver ? (
                        <button
                          type="button"
                          className="btn btn--success btn--sm"
                          onClick={() => void actualizar(item.id, "resuelta")}
                          disabled={local.acting !== null}
                        >
                          <Check size={14} /> {local.acting === "resuelta" ? "Actualizando…" : "Resolver"}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
