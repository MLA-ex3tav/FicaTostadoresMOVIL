import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  query,
} from "firebase/firestore";
import { getDb } from "../lib/firebase";
import { getConfig } from "../lib/config";
import { reportFailure } from "../lib/network";

export interface ProductoCatalogo {
  id: string;
  name?: string;
  modelo?: string;
  category?: string;
  categoria?: string;
  capacity?: string;
  listPrice?: number;
  price?: number;
  precio?: number;
  [key: string]: unknown;
}

/**
 * El precio vive en Firestore (campos listPrice/price/precio), que es la fuente
 * de verdad compartida con la app de escritorio (v2) y la web. El localStorage
 * solo se usa como cola de escrituras pendientes (offline) que se reenvía al
 * servidor; nunca se usa para mostrar el precio.
 */
const LOCAL_PRICES_KEY = "fica-product-prices";

let catalogo: ProductoCatalogo[] = [];
let unsubscribeSnapshot: (() => void) | null = null;

type CatalogoListener = (productos: ProductoCatalogo[]) => void;
const listeners = new Set<CatalogoListener>();

function emit(): void {
  const snapshot = getCatalogo();
  listeners.forEach((listener) => listener(snapshot));
}

function readLocalPrices(): Record<string, number> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(LOCAL_PRICES_KEY) ?? "{}");
    if (!value || typeof value !== "object") return {};

    return Object.fromEntries(
      Object.entries(value).filter(
        ([, price]) => typeof price === "number" && Number.isFinite(price) && price >= 0,
      ),
    );
  } catch {
    return {};
  }
}

function writeLocalPrices(prices: Record<string, number>): void {
  localStorage.setItem(LOCAL_PRICES_KEY, JSON.stringify(prices));
}

function numberValue(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value.replace(/[^0-9.-]/g, ""));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

export function getCatalogo(): ProductoCatalogo[] {
  return [...catalogo];
}

/** Precio vigente del catálogo en tiempo real (listPrice > price > precio). */
export function getPrecioLocal(producto: ProductoCatalogo): number {
  return (
    numberValue(producto.listPrice, producto.price, producto.precio, producto.unitPrice) ?? 0
  );
}

function syncPriceToServer(productId: string, price: number): void {
  const { webUrl, appSecret } = getConfig();

  if (!webUrl || !appSecret) {
    return;
  }

  void fetch(`${webUrl}/api/electron/productos/${encodeURIComponent(productId)}/precio`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${appSecret}`,
    },
    body: JSON.stringify({ price }),
  })
    .then((res) => {
      const dropPending = () => {
        const prices = readLocalPrices();
        if (prices[productId] !== undefined) {
          delete prices[productId];
          writeLocalPrices(prices);
        }
      };
      if (res.ok) {
        dropPending();
      } else if (res.status === 404) {
        // El producto ya no existe en el servidor: nunca se podrá sincronizar.
        // Se descarta para que no quede el banner de pendientes pegado por siempre.
        console.warn(`[catalog] Precio descartado: el producto ${productId} ya no existe en el servidor (404).`);
        dropPending();
      }
    })
    .catch((error) => {
      console.warn("[catalog] No se pudo sincronizar el precio con el servidor", error);
    });
}

/**
 * Guarda un precio y lo sincroniza con Firestore (vía la API protegida), para
 * que quede disponible en tiempo real en cualquier otra instalación.
 */
export function setPrecioLocal(productId: string, price: number): void {
  const clean = Math.max(0, Number.isFinite(price) ? price : 0);

  const prices = readLocalPrices();
  prices[productId] = clean;
  writeLocalPrices(prices);

  const product = catalogo.find((entry) => entry.id === productId);
  if (product) {
    product.listPrice = clean;
    product.price = clean;
    product.precio = clean;
  }
  emit();

  syncPriceToServer(productId, clean);
}

export interface SyncResult {
  ok: boolean;
  total: number;
  failed: { id: string; reason: string }[];
}

/** Reenvía al servidor los precios pendientes (editados sin conexión). */
export async function syncAllPreciosToServer(): Promise<SyncResult> {
  const { webUrl, appSecret } = getConfig();
  const prices = readLocalPrices();
  const ids = Object.keys(prices);

  if (!webUrl || !appSecret) {
    return {
      ok: false,
      total: ids.length,
      failed: ids.map((id) => ({
        id,
        reason: "webUrl o appSecret no configurados (revisa .env)",
      })),
    };
  }

  const failed: SyncResult["failed"] = [];

  for (const id of ids) {
    try {
      const res = await fetch(
        `${webUrl}/api/electron/productos/${encodeURIComponent(id)}/precio`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${appSecret}`,
          },
          body: JSON.stringify({ price: prices[id] }),
        },
      );

      if (res.ok) {
        const pending = readLocalPrices();
        if (pending[id] !== undefined) {
          delete pending[id];
          writeLocalPrices(pending);
        }
      } else if (res.status === 404) {
        // Producto eliminado en el servidor: reintentarlo no tiene sentido.
        // Se descarta para no dejar el banner de sincronización pegado.
        console.warn(`[catalog] Precio descartado: el producto ${id} ya no existe en el servidor (404).`);
        const pending = readLocalPrices();
        if (pending[id] !== undefined) {
          delete pending[id];
          writeLocalPrices(pending);
        }
      } else {
        failed.push({ id, reason: `HTTP ${res.status}` });
      }
    } catch (error) {
      failed.push({
        id,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { ok: failed.length === 0, total: ids.length, failed };
}

/** Nº de precios editados sin conexión que aún esperan sincronizarse. */
export function getPreciosPendientesCount(): number {
  return Object.keys(readLocalPrices()).length;
}

export function findProducto(productId: unknown, name: unknown): ProductoCatalogo | null {
  const id = typeof productId === "string" ? productId : "";
  const productName = typeof name === "string" ? name.trim().toLowerCase() : "";

  return (
    catalogo.find((product) => product.id === id) ??
    catalogo.find((product) => product.name?.trim().toLowerCase() === productName) ??
    null
  );
}

export async function loadCatalogo(): Promise<ProductoCatalogo[]> {
  const snapshot = await getDocs(query(collection(getDb(), "productos"), limit(100)));
  catalogo = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as ProductoCatalogo));
  emit();
  return getCatalogo();
}

/**
 * Mantiene una única suscripción en tiempo real al catálogo de Firestore
 * (onSnapshot). Se activa automáticamente al primer subscriptor y devuelve una
 * función para cancelarla.
 */
export function startCatalogoLive(): () => void {
  if (unsubscribeSnapshot) {
    return unsubscribeSnapshot;
  }

  const source = query(collection(getDb(), "productos"), limit(100));

  unsubscribeSnapshot = onSnapshot(
    source,
    (snapshot) => {
      catalogo = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as ProductoCatalogo,
      );
      emit();
    },
    (error) => {
      console.warn("[catalog] No se pudo suscribir al catálogo en tiempo real", error);
      if (!navigator.onLine) {
        reportFailure();
      }
    },
  );

  return unsubscribeSnapshot;
}

/**
 * Suscribe un listener a los cambios del catálogo (en tiempo real) y asegura
 * que la suscripción de Firestore esté activa. Retorna una función para
 * cancelar la suscripción del listener.
 */
export function subscribeCatalogo(listener: CatalogoListener): () => void {
  listeners.add(listener);
  startCatalogoLive();
  listener(getCatalogo());

  return () => {
    listeners.delete(listener);
  };
}
