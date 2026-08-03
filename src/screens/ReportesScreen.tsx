import { useEffect, useState } from "react";
import { ChartBar } from "lucide-react";
import { subscribeSolicitudes, type SolicitudesState } from "../services/solicitudes";
import { StatsGrid, StatCard } from "../components/StatCard";
import { EmptyState } from "../components/EmptyState";

interface MetricasReporte {
  ingresosEstimados: number;
  totalCotizaciones: number;
  aprobadas: number;
  tasaConversion: number;
  otActivas: number;
}

function calcularMetricas(state: SolicitudesState): MetricasReporte {
  const cotizaciones = state.cotizaciones;
  const otActivas = cotizaciones.filter((c) => {
    const estado = typeof c.estado === "string" && c.estado.trim() ? c.estado : "";
    return ["aprobada_ot", "en_produccion", "terminada"].includes(estado);
  }).length;

  const aprobadas = cotizaciones.filter((c) => {
    const estado = typeof c.estado === "string" && c.estado.trim() ? c.estado : "";
    return ["aprobada_ot", "en_produccion", "terminada", "entregada", "completada"].includes(estado);
  }).length;

  const tasaConversion = cotizaciones.length > 0
    ? Math.round((aprobadas / cotizaciones.length) * 100)
    : 0;

  let ingresosEstimados = 0;
  for (const c of cotizaciones) {
    const estado = typeof c.estado === "string" && c.estado.trim() ? c.estado : "";
    if (!["aprobada_ot", "en_produccion", "terminada", "entregada", "completada"].includes(estado)) continue;
    if (Array.isArray(c.products)) {
      for (const product of c.products) {
        if (product && typeof product === "object" && "price" in product) {
          const precio = (product as { price?: unknown }).price;
          if (typeof precio === "number" && Number.isFinite(precio)) {
            ingresosEstimados += precio;
          }
        }
      }
    }
  }

  return { ingresosEstimados, totalCotizaciones: cotizaciones.length, aprobadas, tasaConversion, otActivas };
}

function formatPesos(valor: number): string {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(valor);
}

export function ReportesScreen() {
  const [state, setState] = useState<SolicitudesState | null>(null);

  useEffect(() => {
    return subscribeSolicitudes(setState);
  }, []);

  if (!state) return null;

  const metricas = calcularMetricas(state);

  return (
    <div className="screen">
      <div className="view__header">
        <div>
          <h1 className="view__title">Reportes</h1>
          <p className="view__subtitle">Métricas e ingresos por período</p>
        </div>
      </div>

      <StatsGrid>
        <StatCard label="Ingresos estimados" value={formatPesos(metricas.ingresosEstimados)} tone="success" />
        <StatCard label="Cotizaciones totales" value={String(metricas.totalCotizaciones)} />
        <StatCard label="Tasa de conversión" value={`${metricas.tasaConversion}%`} tone="accent" />
        <StatCard label="OT activas" value={String(metricas.otActivas)} tone="info" />
      </StatsGrid>

      <div className="panel">
        {state.loading && state.cotizaciones.length === 0 ? (
          <EmptyState title="Cargando métricas…" text="Consultando la web." />
        ) : metricas.totalCotizaciones === 0 ? (
          <EmptyState
            title="Sin datos para reportar"
            text="Los reportes se generan automáticamente con los datos de cotizaciones y órdenes de trabajo."
          />
        ) : (
          <div className="report-table">
            <div className="report-row">
              <span>Cotizaciones totales</span>
              <strong>{metricas.totalCotizaciones}</strong>
            </div>
            <div className="report-row">
              <span>Aprobadas / Convertidas a OT</span>
              <strong>{metricas.aprobadas}</strong>
            </div>
            <div className="report-row">
              <span>Ingresos estimados (OT aprobadas)</span>
              <strong className="report-row__success">{formatPesos(metricas.ingresosEstimados)}</strong>
            </div>
            <div className="report-row">
              <span>Tasa de conversión</span>
              <strong className="report-row__accent">{metricas.tasaConversion}%</strong>
            </div>
            <div className="report-row report-row--muted">
              <span>
                <ChartBar size={14} /> Actualizado automáticamente
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
