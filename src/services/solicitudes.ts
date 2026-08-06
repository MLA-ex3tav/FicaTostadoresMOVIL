import {
  actualizarEstadoSolicitud,
  eliminarSolicitud,
  fetchSolicitudes,
  registrarOrdenTrabajo,
  type RegistroOrdenTrabajoPayload,
  type SolicitudRemota,
} from "../lib/web-api";
import { notifyNewSolicitudes } from "./notifications";

export interface SolicitudesState {
  cotizaciones: SolicitudRemota[];
  soporte: SolicitudRemota[];
  loading: boolean;
  error: string | null;
  lastUpdatedAt: number | null;
  /** Cotizaciones creadas localmente que aún no se han subido a Firebase. */
  pendientesSincronizar: number;
}

const state: SolicitudesState = {
  cotizaciones: [],
  soporte: [],
  loading: false,
  error: null,
  lastUpdatedAt: null,
  pendientesSincronizar: 0,
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

/* ── Cotizaciones creadas localmente (aparecen al instante) ── */

const LOCAL_COTIZACIONES_KEY = "fica-local-cotizaciones";

/**
 * Copias locales de cotizaciones recién creadas. Se muestran en la lista de
 * inmediato y, cuando la web confirma el registro (serverId), se deja que la
 * versión remota las sobreescriba.
 */
interface LocalCotizacion {
  /** id temporal generado en la app (p.ej. COT-123456). */
  localId: string;
  /** id real asignado por el servidor, una vez registrada. */
  serverId: string | null;
  solicitud: SolicitudRemota;
}

let localCotizaciones: LocalCotizacion[] = loadLocalCotizaciones();

/** Última lista de cotizaciones tal como llegó del servidor (sin locales). */
let serverCotizaciones: SolicitudRemota[] = [];

function loadLocalCotizaciones(): LocalCotizacion[] {
  try {
    const raw = localStorage.getItem(LOCAL_COTIZACIONES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is LocalCotizacion =>
        item !== null &&
        typeof item === "object" &&
        typeof (item as LocalCotizacion).localId === "string" &&
        typeof (item as LocalCotizacion).solicitud === "object",
    );
  } catch {
    return [];
  }
}

function persistLocalCotizaciones(): void {
  try {
    localStorage.setItem(LOCAL_COTIZACIONES_KEY, JSON.stringify(localCotizaciones));
  } catch {
    // almacenamiento no disponible o lleno; se ignora
  }
}

/** Descarta copias locales que ya fueron confirmadas por el servidor. */
function reconcileLocalWithServer(): void {
  const serverIds = new Set(serverCotizaciones.map((s) => s.id));
  const before = localCotizaciones.length;
  localCotizaciones = localCotizaciones.filter(
    (entry) => entry.serverId === null || !serverIds.has(entry.serverId),
  );
  if (localCotizaciones.length !== before) persistLocalCotizaciones();
}

/** Reconstruye la lista visible: primero las locales pendientes, luego las remotas. */
function rebuildCotizaciones(): void {
  reconcileLocalWithServer();
  state.cotizaciones = [
    ...localCotizaciones.map((entry) => entry.solicitud),
    ...applyOverrides(serverCotizaciones),
  ];
  state.pendientesSincronizar = localCotizaciones.filter(
    (entry) => entry.serverId === null,
  ).length;
}

/** Registra una cotización creada localmente para que aparezca al instante en la lista. */
export function agregarCotizacionLocal(item: SolicitudRemota): void {
  const existing = localCotizaciones.find((entry) => entry.localId === item.id);
  if (existing) {
    existing.solicitud = item;
  } else {
    localCotizaciones.push({ localId: item.id, serverId: null, solicitud: item });
  }
  persistLocalCotizaciones();
  rebuildCotizaciones();
  emit();
}

/** Aplica los datos reales (id y estado del servidor) a una cotización local. */
export function confirmarCotizacionLocal(
  localId: string,
  server: { id: string; estado: string },
): void {
  const entry = localCotizaciones.find((c) => c.localId === localId);
  if (!entry) return;
  entry.serverId = server.id;
  entry.solicitud = {
    ...entry.solicitud,
    id: server.id,
    estado: server.estado,
  };
  persistLocalCotizaciones();
  rebuildCotizaciones();
  emit();
}

/** Busca la copia local asociada a un id (localId o id de servidor). */
function findLocalCotizacion(id: string): LocalCotizacion | undefined {
  return localCotizaciones.find(
    (entry) => entry.localId === id || entry.solicitud.id === id,
  );
}

/**
 * Devuelve true si el id pertenece a una cotización creada localmente que aún
 * no está registrada en la web (serverId null). Esas solo existen en el
 * dispositivo y no pueden borrarse vía API.
 */
export function esCotizacionSoloLocal(id: string): boolean {
  const entry = findLocalCotizacion(id);
  return Boolean(entry && entry.serverId === null);
}

/**
 * Elimina la copia local persistida de una cotización (si existe) y notifica a
 * la UI. Devuelve true si había una copia local que remover.
 */
export function borrarCotizacionLocal(id: string): boolean {
  return borrarCotizacionDeLista(id);
}

/**
 * Quita una cotización de la lista visible al instante, tanto si es una copia
 * local recién creada como si fue traída de la web. El borrado real en el
 * servidor debe hacerse por separado con borrarSolicitud().
 */
export function eliminarSolicitudVisible(id: string): void {
  borrarCotizacionDeLista(id);
}

function borrarCotizacionDeLista(id: string): boolean {
  const beforeLocal = localCotizaciones.length;
  localCotizaciones = localCotizaciones.filter(
    (entry) => entry.localId !== id && entry.solicitud.id !== id,
  );

  const beforeServer = serverCotizaciones.length;
  serverCotizaciones = serverCotizaciones.filter((solicitud) => solicitud.id !== id);

  if (localCotizaciones.length !== beforeLocal) {
    persistLocalCotizaciones();
  }
  if (localCotizaciones.length !== beforeLocal || serverCotizaciones.length !== beforeServer) {
    rebuildCotizaciones();
    emit();
  }
  return localCotizaciones.length !== beforeLocal || serverCotizaciones.length !== beforeServer;
}

/* ── Sincronización en segundo plano hacia Firebase ── */

let syncInFlight = false;

function toSyncString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function buildRegistroPayload(solicitud: SolicitudRemota): RegistroOrdenTrabajoPayload {
  const products = Array.isArray(solicitud.products)
    ? (solicitud.products as Array<{
        productId?: string;
        name?: string;
        quantity: number;
        unitPrice?: number;
      }>)
    : [];

  return {
    clientName: toSyncString(solicitud.clientName),
    clientPhone: toSyncString(solicitud.clientPhone) || undefined,
    clientRut: toSyncString(solicitud.clientRut) || undefined,
    clientEmail: toSyncString(solicitud.clientEmail) || undefined,
    clientComuna: toSyncString(solicitud.clientComuna) || undefined,
    clientAddress: toSyncString(solicitud.clientAddress) || undefined,
    message: toSyncString(solicitud.message) || undefined,
    shipping:
      solicitud.shipping && typeof solicitud.shipping === "object"
        ? (solicitud.shipping as Record<string, unknown>)
        : undefined,
    products,
  };
}

/**
 * Reintenta subir a Firebase todas las cotizaciones creadas localmente que aún
 * no tienen confirmación del servidor (serverId null). Si una se registra con
 * éxito, se marca con su id real y en el próximo refresh la reemplaza la
 * versión remota. Se usa como respaldo automático cuando el envío inicial
 * falló (sin red, backend caído, etc.).
 */
export async function sincronizarPendientes(): Promise<void> {
  if (syncInFlight) return;
  const pendientes = localCotizaciones.filter((entry) => entry.serverId === null);
  if (pendientes.length === 0) return;

  syncInFlight = true;
  try {
    for (const entry of pendientes) {
      const res = await registrarOrdenTrabajo(buildRegistroPayload(entry.solicitud));
      if (res.ok && res.data) {
        entry.serverId = res.data.id;
        entry.solicitud = {
          ...entry.solicitud,
          id: res.data.id,
          estado: res.data.estado,
        };
      }
    }
    if (localCotizaciones.some((entry) => entry.serverId !== null)) {
      persistLocalCotizaciones();
      rebuildCotizaciones();
      emit();
    }
  } finally {
    syncInFlight = false;
  }
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

/** Normaliza campos provenientes de distintas colecciones o variantes de Firebase (soporte / servicio técnico). */
export function normalizarSolicitud(item: SolicitudRemota): SolicitudRemota {
  if (!item || typeof item !== "object") return item;

  const getStr = (...keys: string[]): string | undefined => {
    for (const k of keys) {
      const v = item[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return undefined;
  };

  const clientName = getStr("clientName", "nombre", "nombreCliente", "cliente", "name") ?? "Sin nombre";
  const clientPhone = getStr("clientPhone", "telefono", "phone", "telefonoCliente");
  const clientEmail = getStr("clientEmail", "email", "correo");
  const equipmentModel = getStr("equipmentModel", "modelo", "equipo", "modeloEquipo", "maquina");
  const issueCategory = getStr("issueCategory", "categoria", "tipoFalla", "asunto", "tipo", "motivo");
  const message = getStr("message", "mensaje", "descripcion", "detalle", "comentario");
  const createdAt = getStr("createdAt", "fecha", "timestamp", "created_at");

  return {
    ...item,
    clientName: item.clientName ?? clientName,
    clientPhone: item.clientPhone ?? clientPhone,
    clientEmail: item.clientEmail ?? clientEmail,
    equipmentModel: item.equipmentModel ?? equipmentModel,
    issueCategory: item.issueCategory ?? issueCategory,
    message: item.message ?? message,
    createdAt: item.createdAt ?? createdAt,
  };
}

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
      serverCotizaciones = cotizaciones.data.solicitudes.map(normalizarSolicitud);
      rebuildCotizaciones();
    }

    if (soporte.ok && soporte.data) {
      state.soporte = soporte.data.solicitudes.map(normalizarSolicitud);
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

    // Notifica por el SO cuando llegan cotizaciones/soporte nuevos.
    if (cotizaciones.ok) {
      void notifyNewSolicitudes(state.cotizaciones, state.soporte);
    }

    // Intenta subir cotizaciones locales pendientes a Firebase (reintentos en
    // segundo plano, sin bloquear la UI).
    void sincronizarPendientes();
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
