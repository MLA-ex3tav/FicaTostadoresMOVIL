import { collection, getDocs, limit, query } from "firebase/firestore";
import { getDb } from "../lib/firebase";
import { getConfig } from "../lib/config";

export interface ProductoCatalogo {
  id: string;
  name?: string;
  modelo?: string;
  category?: string;
  categoria?: string;
  capacity?: string;
  price?: number;
  precio?: number;
  listPrice?: number;
  [key: string]: unknown;
}

const LOCAL_PRICES_KEY = "fica-product-prices";
let catalogo: ProductoCatalogo[] = [];

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

export function getPrecioLocal(producto: ProductoCatalogo): number {
  const override = readLocalPrices()[producto.id];
  if (override !== undefined) return override;
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
  }).catch((error) => {
    console.warn("[catalog] No se pudo sincronizar el precio con el servidor", error);
  });
}

export function setPrecioLocal(productId: string, price: number): void {
  const prices = readLocalPrices();
  const clean = Math.max(0, Number.isFinite(price) ? price : 0);
  prices[productId] = clean;
  writeLocalPrices(prices);
  syncPriceToServer(productId, clean);
}

export interface SyncResult {
  ok: boolean;
  total: number;
  failed: { id: string; reason: string }[];
}

/** Sube todos los precios locales a Firebase (vía la API protegida). */
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

      if (!res.ok) {
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
  return getCatalogo();
}
