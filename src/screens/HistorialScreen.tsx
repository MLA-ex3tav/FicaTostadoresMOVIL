import { useEffect, useMemo, useState } from "react";
import { FileText, Search } from "lucide-react";
import type { SolicitudRemota } from "../lib/web-api";
import {
  getSolicitudDate,
  subscribeSolicitudes,
  type SolicitudesState,
} from "../services/solicitudes";
import { generarCotizacionPdf, descargarPdf } from "../services/cotizacion-pdf";
import { openPdfViewer } from "../ui/pdf-viewer";
import { showToast } from "../ui/toast";
import { StatusPill } from "../components/StatusPill";
import { EmptyState } from "../components/EmptyState";
import {
  estadoLabel,
  estadoPillVariant,
  formatFecha,
  getEstado,
  resumirProductos,
} from "./shared";

const HISTORIAL_ESTADOS = ["completada", "rechazada", "cerrada", "entregada", "resuelta"];

function tipoLabel(item: SolicitudRemota): string {
  const estado = getEstado(item, "");
  if (estado === "resuelta" || estado === "cerrada") return "Soporte";
  return "OT";
}

export function HistorialScreen() {
  const [state, setState] = useState<SolicitudesState | null>(null);
  const [query, setQuery] = useState("");
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  useEffect(() => {
    return subscribeSolicitudes(setState);
  }, []);

  const items = useMemo(() => {
    const all = (state?.cotizaciones ?? []).concat(state?.soporte ?? []).filter((item) => {
      const estado = getEstado(item, "");
      return HISTORIAL_ESTADOS.includes(estado);
    });

    const term = query.trim().toLowerCase();
    if (!term) return all;

    return all.filter((item) =>
      `${item.clientName ?? ""} ${item.clientEmail ?? ""}`.toLowerCase().includes(term),
    );
  }, [state, query]);

  if (!state) return null;

  const verPdf = async (item: SolicitudRemota) => {
    setGeneratingId(item.id);
    try {
      const pdf = await generarCotizacionPdf(item);
      openPdfViewer(pdf);
      showToast({
        title: "PDF del Historial",
        message: `Se ha abierto ${pdf.fileName} para visualización.`,
        tone: "info",
        icon: "fileText",
        actions: [{ label: "Descargar PDF", onClick: () => descargarPdf(pdf), primary: true }],
      });
    } catch (error) {
      console.error("Error al generar PDF:", error);
      showToast({
        title: "Error al generar PDF",
        message: "No se pudo recuperar el PDF del historial.",
        tone: "error",
      });
    } finally {
      setGeneratingId(null);
    }
  };

  return (
    <div className="screen">
      <div className="view__header">
        <div>
          <div className="view__eyebrow">Operación</div>
          <h1 className="view__title">Historial</h1>
          <p className="view__subtitle">Cotizaciones y OT cerradas</p>
        </div>
      </div>

      <div className="search-field">
        <span className="search-field__icon" aria-hidden="true">
          <Search size={16} />
        </span>
        <input
          className="search-input"
          type="search"
          placeholder="Buscar por cliente…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <div className="panel">
        {items.length === 0 ? (
          <EmptyState
            title={state.loading ? "Cargando historial…" : "Historial vacío"}
            text={
              state.loading
                ? "Consultando la web."
                : "Cuando se cierren cotizaciones u OT, aparecerán aquí para consulta."
            }
          />
        ) : (
          <ul className="card-list">
            {items.map((item) => {
              const esCotizacion = Array.isArray(item.products) && item.products.length > 0;
              const estado = getEstado(item, "completada");
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
                    {resumirProductos(item)} · {tipoLabel(item)} · {formatFecha(getSolicitudDate(item))}
                  </div>
                  {esCotizacion ? (
                    <div className="card-list__actions">
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        onClick={() => void verPdf(item)}
                        disabled={generatingId === item.id}
                      >
                        <FileText size={14} /> {generatingId === item.id ? "Generando…" : "PDF"}
                      </button>
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
