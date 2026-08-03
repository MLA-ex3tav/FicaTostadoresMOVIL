import { collection, getDocs, limit, query } from "firebase/firestore";
import { getDb } from "../lib/firebase";

export interface ProductoCatalogo {
  id: string;
  name?: string;
  modelo?: string;
  category?: string;
  categoria?: string;
  capacity?: string;
  price?: number;
  precio?: number;
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
  return numberValue(producto.price, producto.precio, producto.unitPrice) ?? 0;
}

export function setPrecioLocal(productId: string, price: number): void {
  const prices = readLocalPrices();
  prices[productId] = Math.max(0, Number.isFinite(price) ? price : 0);
  writeLocalPrices(prices);
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
