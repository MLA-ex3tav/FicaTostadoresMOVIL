import {
  actualizarEstadoSolicitud,
  eliminarSolicitud,
  fetchSolicitudes,
  type SolicitudRemota,
} from "../lib/web-api";

export interface SolicitudesState {
  cotizaciones: SolicitudRemota[];
  soporte: SolicitudRemota[];
  loading: boolean;
  error: string | null;
  lastUpdatedAt: number | null;
}

const state: SolicitudesState = {
  cotizaciones: [],
  soporte: [],
  loading: false,
  error: null,
  lastUpdatedAt: null,
};

/**
 * Overrides locales aplicados sobre solicitudes traídas de la web.
 * Se usan para "modificar" una cotización en la app (cambios no persistentes
 * en el servidor). Se re-aplican en cada refresh mientras la app esté abierta.
 */
const localOverrides: Record<string, Partial<SolicitudRemota>> = {};

/** Guarda una edición local de una solicitud y notifica a la UI. */
export function guardarEdicionLocal(id: string, patch: Partial<SolicitudRemota>): void {
  localOverrides[id] = { ...(localOverrides[id] ?? {}), ...patch };

  const index = state.cotizaciones.findIndex((item) => item.id === id);
  if (index >= 0) {
    state.cotizaciones[index] = { ...state.cotizaciones[index], ...localOverrides[id] };
  }

  emit();
}

function applyOverrides(solicitudes: SolicitudRemota[]): SolicitudRemota[] {
  return solicitudes.map((solicitud) => {
    const override = localOverrides[solicitud.id];
    return override ? { ...solicitud, ...override } : solicitud;
  });
}

type SolicitudesListener = (state: SolicitudesState) => void;

const listeners = new Set<SolicitudesListener>();

function emit(): void {
  listeners.forEach((listener) => listener({ ...state }));
}

export function subscribeSolicitudes(
  listener: SolicitudesListener,
): () => void {
  listeners.add(listener);
  listener({ ...state });

  return () => {
    listeners.delete(listener);
  };
}

const POLL_INTERVAL_MS = 30_000;

let pollTimer: number | null = null;
let refreshInFlight: Promise<void> | null = null;
let hasLoadedOnce = false;

export async function refreshSolicitudes(): Promise<void> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    // Solo emitimos el estado "loading" en la primera carga. En los polls
    // de fondo no se re-renderiza nada intermedio (evita saltos de layout).
    if (!hasLoadedOnce) {
      state.loading = true;
      emit();
    }

    const [cotizaciones, soporte] = await Promise.all([
      fetchSolicitudes("cotizaciones"),
      fetchSolicitudes("soporte"),
    ]);

    if (cotizaciones.ok && cotizaciones.data) {
      state.cotizaciones = applyOverrides(cotizaciones.data.solicitudes);
    }

    if (soporte.ok && soporte.data) {
      state.soporte = soporte.data.solicitudes;
    }

    if (cotizaciones.ok && soporte.ok) {
      hasLoadedOnce = true;
    }

    const errors = [cotizaciones, soporte]
      .filter((result) => !result.ok)
      .map((result) => result.error);

    state.error = errors.length > 0 ? errors.join(" · ") : null;
    state.loading = false;
    state.lastUpdatedAt = Date.now();
    emit();
  })();

  try {
    await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

export function startSolicitudesPolling(): void {
  stopSolicitudesPolling();
  void refreshSolicitudes();
  pollTimer = window.setInterval(
    () => void refreshSolicitudes(),
    POLL_INTERVAL_MS,
  );
}

export function stopSolicitudesPolling(): void {
  if (pollTimer !== null) {
    window.clearInterval(pollTimer);
    pollTimer = null;
  }
}

/* ── Helpers de dominio ── */

const ESTADOS_CERRADOS = new Set([
  "en_cotizacion",
  "aprobada_ot",
  "rechazada",
  "completada",
]);

export function isSolicitudPendiente(item: SolicitudRemota): boolean {
  const estado = item.estado;

  if (typeof estado !== "string" || !estado.trim()) {
    return true;
  }

  return !ESTADOS_CERRADOS.has(estado);
}

export async function aprobarCotizacion(
  id: string,
): Promise<{ ok: boolean; error: string | null }> {
  const result = await actualizarEstadoSolicitud(id, "aprobada_ot");

  if (result.ok) {
    await refreshSolicitudes();
    return { ok: true, error: null };
  }

  return { ok: false, error: result.error ?? "Error desconocido" };
}

export async function rechazarCotizacion(
  id: string,
): Promise<{ ok: boolean; error: string | null }> {
  const result = await actualizarEstadoSolicitud(id, "rechazada");

  if (result.ok) {
    await refreshSolicitudes();
    return { ok: true, error: null };
  }

  return { ok: false, error: result.error ?? "Error desconocido" };
}

export async function borrarSolicitud(
  id: string,
): Promise<{ ok: boolean; error: string | null }> {
  const result = await eliminarSolicitud(id);

  if (result.ok) {
    await refreshSolicitudes();
    return { ok: true, error: null };
  }

  return { ok: false, error: result.error ?? "Error desconocido" };
}

export function getSolicitudDate(item: SolicitudRemota): Date | null {
  const value = item.createdAt;

  if (typeof value !== "string" || !value) {
    return null;
  }

  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time) : null;
}
