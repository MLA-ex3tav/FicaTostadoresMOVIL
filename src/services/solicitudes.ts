import {
  actualizarCotizacionSolicitud,
  actualizarEstadoSolicitud,
  crearSolicitudCotizacion,
  eliminarSolicitud,
  fetchSolicitudes,
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

/* ── Cambios de estado (OT) locales, se sincronizan en segundo plano ── */

const LOCAL_ESTADOS_KEY = "fica-local-estados";

/** Estado de etapa pendiente de sincronizar por OT (id → estado). */
let localEstados: Record<string, string> = loadLocalEstados();

function loadLocalEstados(): Record<string, string> {
  try {
    const raw = localStorage.getItem(LOCAL_ESTADOS_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      const out: Record<string, string> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === "string" && value.trim()) out[key] = value;
      }
      return out;
    }
    return {};
  } catch {
    return {};
  }
}

function persistLocalEstados(): void {
  try {
    localStorage.setItem(LOCAL_ESTADOS_KEY, JSON.stringify(localEstados));
  } catch {
    // almacenamiento no disponible o lleno; se ignora
  }
}

/**
 * Cambia el estado de una OT de forma optimista: la UI lo ve al instante y el
 * cambio se envía a Firebase en segundo plano. Si el envío falla, se reintenta
 * en el próximo refresh. Para que el cambio no se pierda al reiniciar, se
 * persiste localmente con el estado pendiente.
 */
export function cambiarEstadoLocal(id: string, estado: string): void {
  // Cotización creada localmente: solo existe en el dispositivo, así que el
  // cambio se guarda localmente y no se envía a Firebase.
  const localEntry = findLocalCotizacion(id);
  if (localEntry) {
    localEntry.solicitud = { ...localEntry.solicitud, estado };
    persistLocalCotizaciones();
    rebuildCotizaciones();
    emit();
    return;
  }

  localEstados[id] = estado;
  persistLocalEstados();
  localOverrides[id] = { ...(localOverrides[id] ?? {}), estado };

  const index = state.cotizaciones.findIndex((item) => item.id === id);
  if (index >= 0) {
    state.cotizaciones[index] = { ...state.cotizaciones[index], estado };
  }

  emit();
  void sincronizarEstadosPendientes();
}

let estadoSyncInFlight = false;

async function sincronizarEstadosPendientes(): Promise<void> {
  if (estadoSyncInFlight) return;
  const pending = Object.entries(localEstados);
  if (pending.length === 0) return;

  estadoSyncInFlight = true;
  try {
    for (const [id, estado] of pending) {
      const res = await actualizarEstadoSolicitud(id, estado);
      if (res.ok) {
        delete localEstados[id];
        // Una vez confirmado por el servidor, dejamos de aplicar el override
        // para que la versión remota vuelva a mandar en el próximo refresh.
        if (localOverrides[id]) {
          const { estado: _estado, ...rest } = localOverrides[id];
          delete localOverrides[id];
          if (Object.keys(rest).length > 0) localOverrides[id] = rest;
        } else {
          delete localOverrides[id];
        }
      }
    }
    persistLocalEstados();
    rebuildCotizaciones();
    emit();
  } finally {
    estadoSyncInFlight = false;
  }
}

/** Envía una edición de cotización directamente a Firebase para sincronizar con App v2 y la Web. */
export async function enviarEdicionAFirebase(solicitud: SolicitudRemota): Promise<boolean> {
  try {
    const rawProducts = Array.isArray(solicitud.products) ? solicitud.products : [];
    const payload: Omit<RegistroOrdenTrabajoPayload, "id"> = {
      clientName: String(solicitud.clientName ?? ""),
      clientPhone: String(solicitud.clientPhone ?? ""),
      clientRut: String(solicitud.clientRut ?? ""),
      clientEmail: String(solicitud.clientEmail ?? ""),
      clientComuna: String(solicitud.clientComuna ?? ""),
      clientAddress: String(solicitud.clientAddress ?? ""),
      message: String(solicitud.message ?? ""),
      estado: String(solicitud.estado ?? "pendiente"),
      enOT: Boolean(solicitud.enOT),
      products: rawProducts.map((p: unknown) => {
        const rec = p && typeof p === "object" ? (p as Record<string, unknown>) : {};
        return {
          productId: String(rec.productId ?? rec.id ?? ""),
          name: String(rec.name ?? ""),
          quantity: Math.max(1, Number(rec.quantity ?? rec.cantidad ?? 1)),
          unitPrice: Math.max(0, Number(rec.unitPrice ?? rec.price ?? rec.precio ?? 0)),
        };
      }),
    };

    const res = await actualizarCotizacionSolicitud(solicitud.id, payload);

    if (!res.ok && res.status === 404) {
      // La cotización ya no existe en el servidor: la recreamos para no perder la edición.
      const recreated = await crearSolicitudCotizacion({
        ...payload,
        id: String(solicitud.id ?? ""),
        estado: "pendiente",
        enOT: false,
      });

      if (!recreated.ok) {
        return false;
      }
    } else if (!res.ok) {
      return false;
    }

    delete localOverrides[solicitud.id];
    // Si existía como borrador local, limpiamos el borrador para no duplicarlo en pantalla
    localCotizaciones = localCotizaciones.filter(
      (entry) => entry.localId !== solicitud.id && entry.solicitud.id !== solicitud.id,
    );
    persistLocalCotizaciones();
    void refreshSolicitudes();
    return true;
  } catch (error) {
    console.error("[solicitudes:enviarEdicionAFirebase]", error);
    return false;
  }
}

/** Guarda una edición de una solicitud, la envía a Firebase y notifica a la UI. */
export function guardarEdicionLocal(id: string, patch: Partial<SolicitudRemota>): void {
  localOverrides[id] = { ...(localOverrides[id] ?? {}), ...patch };

  const localEntry = localCotizaciones.find((entry) => entry.localId === id || entry.solicitud.id === id);
  if (localEntry) {
    localEntry.solicitud = { ...localEntry.solicitud, ...patch };
    persistLocalCotizaciones();
  }

  const index = state.cotizaciones.findIndex((item) => item.id === id);
  if (index >= 0) {
    const updated = { ...state.cotizaciones[index], ...localOverrides[id] };
    state.cotizaciones[index] = updated;

    // Sincronizar automáticamente la edición con Firebase
    void enviarEdicionAFirebase(updated);
  }

  rebuildCotizaciones();
  emit();
}

function applyOverrides(solicitudes: SolicitudRemota[]): SolicitudRemota[] {
  return solicitudes.map((solicitud) => {
    const override = localOverrides[solicitud.id];
    return override ? { ...solicitud, ...override } : solicitud;
  });
}

/* ── Cotizaciones creadas localmente (solo en este dispositivo) ── */

const LOCAL_COTIZACIONES_KEY = "fica-local-cotizaciones";

/**
 * Cotizaciones creadas desde la app. Solo existen en el dispositivo: nunca se
 * suben a Firebase y aparecen al instante en la lista. Se distinguen de las que
 * llegan del servidor (ver esCotizacionSoloLocal).
 */
interface LocalCotizacion {
  /** id generado en la app (p.ej. COT-123456). */
  localId: string;
  solicitud: SolicitudRemota;
  payload?: RegistroOrdenTrabajoPayload;
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

/** Reconstruye la lista visible: las cotizaciones locales sin duplicados en el servidor. */
function rebuildCotizaciones(): void {
  const remoteIds = new Set(serverCotizaciones.map((item) => item.id));
  const filteredLocals = localCotizaciones.filter(
    (entry) => !remoteIds.has(entry.localId) && !remoteIds.has(entry.solicitud.id),
  );

  if (filteredLocals.length !== localCotizaciones.length) {
    localCotizaciones = filteredLocals;
    persistLocalCotizaciones();
  }

  state.cotizaciones = [
    ...localCotizaciones.map((entry) => entry.solicitud),
    ...applyOverrides(serverCotizaciones),
  ];
  state.pendientesSincronizar = localCotizaciones.length;
}

/** Registra una cotización creada localmente para que aparezca al instante en la lista. */
export function agregarCotizacionLocal(
  item: SolicitudRemota,
  payload?: RegistroOrdenTrabajoPayload,
): void {
  const existing = localCotizaciones.find((entry) => entry.localId === item.id);
  if (existing) {
    existing.solicitud = item;
    if (payload) existing.payload = payload;
  } else {
    localCotizaciones.push({ localId: item.id, solicitud: item, payload });
  }
  persistLocalCotizaciones();
  rebuildCotizaciones();
  emit();
}

/**
 * Envía una cotización directamente a Firebase vía la API protegida.
 * Si la red falla o está offline, se guarda localmente como pendiente de sincronización.
 */
export async function enviarCotizacionAFirebase(
  solicitudLocal: SolicitudRemota,
  payload: RegistroOrdenTrabajoPayload,
): Promise<{ ok: boolean; id?: string; offline?: boolean; error?: string }> {
  try {
    const res = await crearSolicitudCotizacion({
      ...payload,
      id: solicitudLocal.id,
      estado: "pendiente",
      enOT: false,
    });

    if (res.ok && res.data?.id) {
      borrarCotizacionDeLista(solicitudLocal.id);
      void refreshSolicitudes();
      return { ok: true, id: res.data.id, offline: false };
    }
  } catch (err) {
    console.warn("Sin conexión directa a Firebase, guardando copia local pendiente:", err);
  }

  agregarCotizacionLocal(solicitudLocal, payload);
  return { ok: true, id: solicitudLocal.id, offline: true };
}

let syncInFlight = false;

export async function sincronizarCotizacionesPendientes(): Promise<void> {
  if (syncInFlight || localCotizaciones.length === 0) return;

  syncInFlight = true;
  try {
    const pendingList = [...localCotizaciones];
    for (const entry of pendingList) {
      if (entry.payload) {
        const res = await crearSolicitudCotizacion({
          ...entry.payload,
          id: entry.localId,
          estado: "pendiente",
          enOT: false,
        });

        if (res.ok) {
          borrarCotizacionDeLista(entry.localId);
        }
      }
    }
  } catch (error) {
    console.error("Error al sincronizar cotizaciones pendientes a Firebase:", error);
  } finally {
    syncInFlight = false;
  }
}

/** Busca la copia local asociada a un id (localId). */

/** Busca la copia local asociada a un id (localId). */
function findLocalCotizacion(id: string): LocalCotizacion | undefined {
  return localCotizaciones.find((entry) => entry.localId === id || entry.solicitud.id === id);
}

/** Devuelve true si el id pertenece a una cotización creada localmente en la app. */
export function esCotizacionSoloLocal(id: string): boolean {
  return findLocalCotizacion(id) !== undefined;
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

    void sincronizarCotizacionesPendientes();

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

    // Reintenta en segundo plano cambios de estado (OT) locales no confirmados.
    void sincronizarEstadosPendientes();
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
  // Cotización creada localmente: solo pasa a OT (estado aprobada_ot) en el
  // dispositivo, sin enviarse a Firebase.
  if (esCotizacionSoloLocal(id)) {
    cambiarEstadoLocal(id, "aprobada_ot");
    return { ok: true, error: null };
  }

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
  // Cotización creada localmente: se marca localmente en el dispositivo.
  if (esCotizacionSoloLocal(id)) {
    cambiarEstadoLocal(id, "rechazada");
    return { ok: true, error: null };
  }

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
  // Cotización creada localmente: se elimina del dispositivo sin tocar Firebase.
  if (esCotizacionSoloLocal(id)) {
    borrarCotizacionDeLista(id);
    return { ok: true, error: null };
  }

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
