import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { APP_VERSION, GITHUB_REPO, APK_ASSET_SUFFIX } from "../lib/app-config";
import { showToast } from "../ui/toast";

export interface GitHubReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

export interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  html_url: string;
  published_at: string;
  assets: GitHubReleaseAsset[];
}

export interface UpdateCheckResult {
  /** true si hay una versión más nueva disponible. */
  updateAvailable: boolean;
  /** Última versión publicada en GitHub (tag). */
  latestVersion: string | null;
  /** Release completo de GitHub (si se pudo consultar). */
  release: GitHubRelease | null;
  /** URL del APK a descargar (si hay update y existe asset). */
  apkUrl: string | null;
  /** URL de la página del release (fallback si no hay APK). */
  releaseUrl: string | null;
  /** Mensaje de error (solo si falló la consulta). */
  error: string | null;
}

export const CURRENT_VERSION = APP_VERSION;

/**
 * Compara dos versiones SemVer (ej: "0.1.0" vs "0.2.0").
 * Retorna true si targetVersion es mayor que currentVersion.
 */
export function isNewerVersion(currentVersion: string, targetVersion: string): boolean {
  const cleanCurrent = currentVersion.replace(/^v/i, "").trim();
  const cleanTarget = targetVersion.replace(/^v/i, "").trim();

  const currentParts = cleanCurrent.split(".").map((n) => parseInt(n, 10) || 0);
  const targetParts = cleanTarget.split(".").map((n) => parseInt(n, 10) || 0);

  const maxLen = Math.max(currentParts.length, targetParts.length);

  for (let i = 0; i < maxLen; i++) {
    const c = currentParts[i] ?? 0;
    const t = targetParts[i] ?? 0;
    if (t > c) return true;
    if (t < c) return false;
  }

  return false;
}

/**
 * Consulta la release más reciente en GitHub Releases.
 * Retorna null si no hay releases publicadas (404) o si falla la conexión.
 */
export async function getLatestRelease(): Promise<GitHubRelease | null> {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
  const response = await fetch(url, {
    headers: { Accept: "application/vnd.github.v3+json" },
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as GitHubRelease;
}

/**
 * Realiza la comprobación de actualizaciones.
 * No muestra toasts; devuelve el resultado para que la UI lo decida.
 */
export async function checkForUpdates(): Promise<UpdateCheckResult> {
  const empty: UpdateCheckResult = {
    updateAvailable: false,
    latestVersion: null,
    release: null,
    apkUrl: null,
    releaseUrl: null,
    error: null,
  };

  try {
    const release = await getLatestRelease();
    if (!release) {
      return {
        ...empty,
        error:
          "No hay versiones publicadas todavía o no se pudo conectar con GitHub Releases.",
      };
    }

    const latestVersion = release.tag_name;
    const updateAvailable = isNewerVersion(CURRENT_VERSION, latestVersion);

    const apkAsset = release.assets.find((a) => a.name.endsWith(APK_ASSET_SUFFIX));

    return {
      updateAvailable,
      latestVersion,
      release,
      apkUrl: apkAsset ? apkAsset.browser_download_url : null,
      releaseUrl: release.html_url,
      error: null,
    };
  } catch {
    return {
      ...empty,
      error: "Error de conexión al consultar las actualizaciones.",
    };
  }
}

/**
 * Abre la descarga de la actualización.
 * En Android (Capacitor) usa el navegador externo; en web, abre en pestaña nueva.
 */
export async function openUpdate(apkUrl: string | null, releaseUrl: string | null): Promise<void> {
  const url = apkUrl ?? releaseUrl;
  if (!url) return;

  if (Capacitor.isNativePlatform()) {
    await Browser.open({ url, presentationStyle: "fullscreen" });
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

/**
 * Comprobación automática al iniciar: muestra un toast si hay actualización.
 * No muestra errores silenciosos.
 */
export async function checkAppUpdates(): Promise<void> {
  const result = await checkForUpdates();
  if (!result.updateAvailable) return;

  showToast({
    title: `⚡ Actualización ${result.latestVersion} disponible`,
    message: `Hay una nueva versión de la app. Descárgala desde Actualizaciones.`,
    tone: "warning",
    durationMs: 12000,
    actions: [
      {
        label: "Ir a Actualizaciones",
        onClick: () => {
          const event = new CustomEvent("app:navigate", { detail: "actualizaciones" });
          window.dispatchEvent(event);
        },
      },
    ],
  });
}
