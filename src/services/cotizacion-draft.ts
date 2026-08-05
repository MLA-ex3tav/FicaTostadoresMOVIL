export interface CotizacionDraftCliente {
  name: string;
  phone: string;
  address: string;
  rut: string;
  email: string;
  comuna: string;
}

export interface CotizacionDraft {
  step: number;
  cliente: CotizacionDraftCliente;
  message: string;
  /** productId -> cantidad */
  seleccion: Record<string, number>;
  updatedAt: number;
}

const DRAFT_KEY = "fica-cotizacion-draft";

function readDraft(): CotizacionDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    return value as CotizacionDraft;
  } catch {
    return null;
  }
}

export function saveCotizacionDraft(draft: CotizacionDraft): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // almacenamiento no disponible o lleno; se ignora
  }
}

export function loadCotizacionDraft(): CotizacionDraft | null {
  return readDraft();
}

export function clearCotizacionDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // noop
  }
}
