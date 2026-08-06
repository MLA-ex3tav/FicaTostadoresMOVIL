import { Capacitor } from "@capacitor/core";
import { LocalNotifications, type LocalNotificationSchema } from "@capacitor/local-notifications";
import type { SolicitudRemota } from "../lib/web-api";

/**
 * Notificaciones locales del sistema (SO) cuando llegan nuevas cotizaciones o
 * solicitudes de soporte técnico desde la web. Usa @capacitor/local-notifications.
 *
 * Nota: solo funciona en plataforma nativa (Android/iOS). En navegador web se
 * ignora silenciosamente.
 */

const SEEN_COTIZACIONES_KEY = "fica-seen-cotizaciones";
const SEEN_SOPORTE_KEY = "fica-seen-soporte";
/** Marca que ya se estableció la línea base (primera carga sin notificar). */
const BASELINE_KEY = "fica-notif-baseline";

/** El plugin Android requiere un ícono pequeño en res/drawable (ver README). */
const SMALL_ICON = "ic_stat_ficatostadores";

function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

function readSeen(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === "string"));
  } catch {
    return new Set();
  }
}

function persistSeen(key: string, ids: Set<string>): void {
  try {
    localStorage.setItem(key, JSON.stringify([...ids]));
  } catch {
    // almacenamiento no disponible; se ignora
  }
}

async function ensurePermission(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const current = await LocalNotifications.checkPermissions();
    if (current.display === "granted") return true;
    if (current.display === "denied") return false;
    const result = await LocalNotifications.requestPermissions();
    return result.display === "granted";
  } catch {
    return false;
  }
}

/** Asocia el id de una notificación con la vista a abrir al tocarla. */
const VIEW_D = new Map<number, "cotizaciones" | "soporte">();

function navigate(view: "cotizaciones" | "soporte"): void {
  const event = new CustomEvent("app:navigate", { detail: view });
  window.dispatchEvent(event);
}

/**
 * Inicializa el listener de toques en notificaciones. Debe llamarse una vez,
 * al inicio de la app. No hace nada en web.
 */
export function initLocalNotifications(): void {
  if (!isNative()) return;

  void LocalNotifications.addListener("localNotificationActionPerformed", ({ notification }) => {
    const view = VIEW_D.get(Number(notification.id));
    if (view) navigate(view);
  });
}

async function notify(title: string, body: string, id: number, view: "cotizaciones" | "soporte"): Promise<void> {
  if (!(await ensurePermission())) return;

  VIEW_D.set(id, view);

  const schedule: LocalNotificationSchema = {
    title,
    body,
    id,
    smallIcon: SMALL_ICON,
  };

  try {
    await LocalNotifications.schedule({ notifications: [schedule] });
  } catch (error) {
    console.error("[notifications] no se pudo programar la notificación:", error);
  }
}

function extraerNombre(item: SolicitudRemota): string {
  const value =
    typeof item.clientName === "string" && item.clientName.trim()
      ? item.clientName.trim()
      : typeof item.name === "string" && item.name.trim()
        ? item.name.trim()
        : "";
  return value;
}

function extraerProductos(item: SolicitudRemota): string {
  if (!Array.isArray(item.products) || item.products.length === 0) return "";
  const nombres = item.products
    .map((product) =>
      product && typeof product === "object" && "name" in product
        ? String((product as { name?: unknown }).name ?? "").trim()
        : "",
    )
    .filter((name) => name.length > 0);
  if (nombres.length === 0) return "";
  return nombres[0] + (nombres.length > 1 ? ` y ${nombres.length - 1} más` : "");
}

function descriptCotizacion(item: SolicitudRemota): string {
  const cliente = extraerNombre(item);
  const productos = extraerProductos(item);
  const base = cliente ? `De ${cliente}.` : "Nueva cotización recibida.";
  return productos ? `${base} Productos: ${productos}.` : base;
}

function descriptSoporte(item: SolicitudRemota): string {
  const cliente = extraerNombre(item);
  const message =
    typeof item.message === "string" && item.message.trim() ? item.message.trim() : "";
  const base = cliente ? `De ${cliente}.` : "Nueva solicitud de soporte recibida.";
  const resumen = message.length > 80 ? `${message.slice(0, 80)}…` : message;
  return resumen ? `${base} ${resumen}` : base;
}

let counter = 1;

/**
 * Compara el último lote recibido con lo ya notificado y dispara notificaciones
 * locales para cotizaciones/soporte nuevos (no vistos antes ni creados en esta
 * app). Devuelve cuántas notificaciones se programaron (0 si no hay soporte
 * nativo o permiso denegado).
 */
export async function notifyNewSolicitudes(
  cotizaciones: SolicitudRemota[],
  soporte: SolicitudRemota[],
): Promise<number> {
  if (!isNative()) return 0;

  const seenCotizaciones = readSeen(SEEN_COTIZACIONES_KEY);
  const seenSoporte = readSeen(SEEN_SOPORTE_KEY);

  const baselineEstablished = localStorage.getItem(BASELINE_KEY) === "1";

  const locales = new Set(
    cotizaciones
      .filter((item) => typeof item.id === "string" && /^COT-/.test(item.id))
      .map((item) => item.id),
  );

  const nuevasCotizaciones: { id: string; item: SolicitudRemota }[] = [];
  for (const item of cotizaciones) {
    const id = item.id;
    if (!id || seenCotizaciones.has(id) || locales.has(id)) continue;
    if (baselineEstablished) nuevasCotizaciones.push({ id, item });
    seenCotizaciones.add(id);
  }

  const nuevoSoporte: { id: string; item: SolicitudRemota }[] = [];
  for (const item of soporte) {
    const id = item.id;
    if (!id || seenSoporte.has(id)) continue;
    if (baselineEstablished) nuevoSoporte.push({ id, item });
    seenSoporte.add(id);
  }

  persistSeen(SEEN_COTIZACIONES_KEY, seenCotizaciones);
  persistSeen(SEEN_SOPORTE_KEY, seenSoporte);

  if (!baselineEstablished) {
    localStorage.setItem(BASELINE_KEY, "1");
    return 0;
  }

  let count = 0;

  for (const { item } of nuevasCotizaciones) {
    await notify("Nueva cotización", descriptCotizacion(item), ++counter, "cotizaciones");
    count++;
  }

  for (const { item } of nuevoSoporte) {
    await notify("Soporte técnico", descriptSoporte(item), ++counter, "soporte");
    count++;
  }

  return count;
}
