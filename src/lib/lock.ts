/**
 * Bloqueo de la app móvil por PIN (hash SHA-256 en almacenamiento local).
 * No guarda el PIN en claro; solo su hash con sal fija.
 */

const ENABLED_KEY = "fica-lock-enabled";
const PIN_HASH_KEY = "fica-lock-pin-hash";
const AUTOLOCK_KEY = "fica-lock-autolock-ms";
const BIOMETRIC_KEY = "fica-lock-biometric";

const SALT = "fica::lock::v1";

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(SALT + text + SALT);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function isLockEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) === "1";
  } catch {
    return false;
  }
}

export async function hasPin(): Promise<boolean> {
  try {
    return Boolean(localStorage.getItem(PIN_HASH_KEY));
  } catch {
    return false;
  }
}

export async function setPin(pin: string): Promise<void> {
  const hash = await sha256(pin);
  try {
    localStorage.setItem(PIN_HASH_KEY, hash);
    localStorage.setItem(ENABLED_KEY, "1");
  } catch {
    throw new Error("No se pudo guardar el PIN.");
  }
}

export async function verifyPin(pin: string): Promise<boolean> {
  let expected: string | null = null;
  try {
    expected = localStorage.getItem(PIN_HASH_KEY);
  } catch {
    return false;
  }
  if (!expected) return false;
  const hash = await sha256(pin);
  return hash === expected;
}

export async function clearLock(): Promise<void> {
  try {
    localStorage.removeItem(ENABLED_KEY);
    localStorage.removeItem(PIN_HASH_KEY);
    localStorage.removeItem(BIOMETRIC_KEY);
  } catch {
    /* noop */
  }
}

export function setBiometricEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(BIOMETRIC_KEY, enabled ? "1" : "0");
  } catch {
    /* noop */
  }
}

export function isBiometricEnabled(): boolean {
  try {
    return localStorage.getItem(BIOMETRIC_KEY) === "1";
  } catch {
    return false;
  }
}

export function setAutoLockMs(ms: number): void {
  try {
    localStorage.setItem(AUTOLOCK_KEY, String(ms));
  } catch {
    /* noop */
  }
}

export function getAutoLockMs(): number {
  try {
    const value = Number(localStorage.getItem(AUTOLOCK_KEY));
    return Number.isFinite(value) && value >= 0 ? value : 60_000;
  } catch {
    return 60_000;
  }
}
