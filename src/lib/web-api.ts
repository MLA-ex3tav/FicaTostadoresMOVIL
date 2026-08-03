import { getConfig } from "./config";

export interface ApiResult<T> {
  ok: boolean;
  status: number | null;
  latencyMs: number;
  data: T | null;
  error: string | null;
}

function ok<T>(status: number, latencyMs: number, data: T): ApiResult<T> {
  return { ok: true, status, latencyMs, data, error: null };
}

function fail<T>(
  status: number | null,
  latencyMs: number,
  error: string,
): ApiResult<T> {
  return { ok: false, status, latencyMs, data: null, error };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function authHeaders(): HeadersInit {
  const { appSecret } = getConfig();
  return appSecret ? { Authorization: `Bearer ${appSecret}` } : {};
}

async function readApiError(res: Response): Promise<string | null> {
  try {
    const body = (await res.json()) as { error?: unknown };
    return typeof body.error === "string" ? body.error : null;
  } catch {
    return null;
  }
}

/** Verifica la API con el mismo origen CORS que usa la app de escritorio. */
export async function pingWeb(): Promise<ApiResult<null>> {
  const { webUrl } = getConfig();

  if (!webUrl) {
    return fail(null, 0, "VITE_WEB_API_URL no definida en .env");
  }

  const started = performance.now();

  try {
    const res = await fetch(`${webUrl}/api/electron/solicitudes?tipo=cotizaciones`, {
      headers: { ...authHeaders() },
      cache: "no-store",
    });
    const latencyMs = Math.round(performance.now() - started);

    if (res.ok) {
      return ok(res.status, latencyMs, null);
    }

    return fail(res.status, latencyMs, `HTTP ${res.status}`);
  } catch (error) {
    return fail(
      null,
      Math.round(performance.now() - started),
      `Sin respuesta (${errorMessage(error)})`,
    );
  }
}

export interface HeartbeatPayload {
  version?: string;
  instanceId?: string;
  hostname?: string;
}

export interface HeartbeatResponse {
  ok: boolean;
  lastSeenAt?: string;
}

export async function sendHeartbeat(
  payload: HeartbeatPayload,
): Promise<ApiResult<HeartbeatResponse>> {
  const { webUrl } = getConfig();

  if (!webUrl) {
    return fail(null, 0, "VITE_WEB_API_URL no definida en .env");
  }

  const started = performance.now();

  try {
    const res = await fetch(`${webUrl}/api/electron/heartbeat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(payload),
    });
    const latencyMs = Math.round(performance.now() - started);

    if (res.ok) {
      const data = (await res.json()) as HeartbeatResponse;
      return ok(res.status, latencyMs, data);
    }

    const apiError = await readApiError(res);
    return fail(res.status, latencyMs, apiError ?? `HTTP ${res.status}`);
  } catch (error) {
    return fail(
      null,
      Math.round(performance.now() - started),
      `Sin respuesta (${errorMessage(error)})`,
    );
  }
}

export type SolicitudesTipo = "cotizaciones" | "soporte";

export interface SolicitudRemota {
  id: string;
  [key: string]: unknown;
}

export interface SolicitudesResponse {
  ok: boolean;
  count: number;
  solicitudes: SolicitudRemota[];
}

export interface ActualizarEstadoPayload {
  estado: string;
}

export async function actualizarEstadoSolicitud(
  id: string,
  estado: string,
): Promise<ApiResult<{ ok: boolean }>> {
  const { webUrl } = getConfig();

  if (!webUrl) {
    return fail(null, 0, "VITE_WEB_API_URL no definida en .env");
  }

  const started = performance.now();

  try {
    const res = await fetch(`${webUrl}/api/electron/solicitudes/${id}/estado`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ estado } satisfies ActualizarEstadoPayload),
    });
    const latencyMs = Math.round(performance.now() - started);

    if (res.ok) {
      const data = (await res.json()) as { ok: boolean };
      return ok(res.status, latencyMs, data);
    }

    const apiError = await readApiError(res);
    return fail(res.status, latencyMs, apiError ?? `HTTP ${res.status}`);
  } catch (error) {
    return fail(
      null,
      Math.round(performance.now() - started),
      `Sin respuesta (${errorMessage(error)})`,
    );
  }
}

export async function fetchSolicitudes(
  tipo: SolicitudesTipo,
): Promise<ApiResult<SolicitudesResponse>> {
  const { webUrl } = getConfig();

  if (!webUrl) {
    return fail(null, 0, "VITE_WEB_API_URL no definida en .env");
  }

  const started = performance.now();

  try {
    const res = await fetch(`${webUrl}/api/electron/solicitudes?tipo=${tipo}`, {
      headers: { ...authHeaders() },
      cache: "no-store",
    });
    const latencyMs = Math.round(performance.now() - started);

    if (res.ok) {
      const data = (await res.json()) as SolicitudesResponse;
      return ok(res.status, latencyMs, data);
    }

    const apiError = await readApiError(res);
    return fail(res.status, latencyMs, apiError ?? `HTTP ${res.status}`);
  } catch (error) {
    return fail(
      null,
      Math.round(performance.now() - started),
      `Sin respuesta (${errorMessage(error)})`,
    );
  }
}

export interface RegistroOrdenTrabajoPayload {
  clientName: string;
  clientPhone?: string;
  clientRut?: string;
  clientEmail?: string;
  clientComuna?: string;
  clientAddress?: string;
  message?: string;
  shipping?: Record<string, unknown> | null;
  products: Array<{
    productId?: string;
    name?: string;
    quantity: number;
    unitPrice?: number;
  }>;
}

export interface RegistroOrdenTrabajoResponse {
  ok: boolean;
  id: string;
  estado: string;
}

/**
 * Registra una cotización como orden de trabajo (OT) en Firestore, vía la API
 * protegida de la web. La OT queda con estado "aprobada_ot" y enOT: true.
 */
export async function registrarOrdenTrabajo(
  payload: RegistroOrdenTrabajoPayload,
): Promise<ApiResult<RegistroOrdenTrabajoResponse>> {
  const { webUrl } = getConfig();

  if (!webUrl) {
    return fail(null, 0, "VITE_WEB_API_URL no definida en .env");
  }

  const started = performance.now();

  try {
    const res = await fetch(`${webUrl}/api/electron/solicitudes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(payload),
    });
    const latencyMs = Math.round(performance.now() - started);

    if (res.ok) {
      const data = (await res.json()) as RegistroOrdenTrabajoResponse;
      return ok(res.status, latencyMs, data);
    }

    const apiError = await readApiError(res);
    return fail(res.status, latencyMs, apiError ?? `HTTP ${res.status}`);
  } catch (error) {
    return fail(
      null,
      Math.round(performance.now() - started),
      `Sin respuesta (${errorMessage(error)})`,
    );
  }
}
