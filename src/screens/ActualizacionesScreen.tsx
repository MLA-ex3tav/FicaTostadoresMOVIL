import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Download, CheckCircle2, GitBranch, AlertTriangle } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { APP_VERSION } from "../lib/app-config";
import {
  checkForUpdates,
  downloadAndInstallApk,
  type UpdateCheckResult,
} from "../services/updater";
import { showToast } from "../ui/toast";
import { formatBytes, formatDate } from "./shared";

type Status = "idle" | "checking" | "done" | "error";

export function ActualizacionesScreen() {
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<UpdateCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastCheck, setLastCheck] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<{ loaded: number; total: number; pct: number } | null>(
    null,
  );

  const buscar = useCallback(async () => {
    setStatus("checking");
    setError(null);
    const res = await checkForUpdates();
    setResult(res);
    setStatus(res.error ? "error" : "done");
    setError(res.error);
    setLastCheck(new Date().toISOString());
  }, []);

  useEffect(() => {
    void buscar();
  }, [buscar]);

  const handleDownload = async () => {
    if (!result?.apkUrl) return;
    setDownloading(true);
    setProgress({ loaded: 0, total: 0, pct: 0 });
    try {
      const fileName = apkAsset?.name ?? "fica-tostadores.apk";
      const outcome = await downloadAndInstallApk(result.apkUrl, fileName, (loaded, total) => {
        setProgress({ loaded, total, pct: total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0 });
      });

      if (outcome === "installing") {
        setProgress({ loaded: 0, total: 0, pct: 100 });
        showToast({
          title: "Descarga completada",
          message: "El APK se descargó. Confirma la instalación cuando Android lo solicite.",
          tone: "success",
          durationMs: 10000,
        });
      } else if (outcome === "downloaded") {
        setProgress({ loaded: 0, total: 0, pct: 100 });
        showToast({
          title: "APK descargado",
          message: "El archivo se descargó. Ábrelo para instalarlo.",
          tone: "success",
        });
      } else {
        setProgress(null);
        showToast({
          title: "Error al descargar",
          message: "No se pudo descargar el APK. Revisa tu conexión o inténtalo de nuevo.",
          tone: "error",
        });
      }
    } finally {
      setDownloading(false);
    }
  };

  const apkAsset = result?.release?.assets.find((a) => a.name.endsWith(".apk"));

  return (
    <div className="screen">
      <div className="view__header">
        <div>
          <h1 className="view__title">Actualizaciones</h1>
          <p className="view__subtitle">Versión instalada y nuevas versiones del APK</p>
        </div>
      </div>

      <div className="panel">
        <div className="upd-current">
          <div className="upd-current__row">
            <span className="upd-current__label">Versión instalada</span>
            <strong className="upd-current__value">v{APP_VERSION}</strong>
          </div>
          {lastCheck ? (
            <div className="upd-current__meta">
              Última comprobación: {formatDate(lastCheck, { withTime: true })}
            </div>
          ) : null}
        </div>

        <button
          type="button"
          className="btn btn--primary"
          onClick={() => void buscar()}
          disabled={status === "checking"}
        >
          <RefreshCw size={16} className={status === "checking" ? "spin" : ""} />
          {status === "checking" ? "Buscando actualizaciones…" : "Buscar actualizaciones"}
        </button>
      </div>

      {status === "checking" ? (
        <div className="panel">
          <EmptyStateUpd title="Comprobando…" text="Consultando GitHub Releases." />
        </div>
      ) : null}

      {status === "error" ? (
        <div className="panel">
          <div className="upd-error">
            <AlertTriangle size={20} />
            <div>
              <strong>No se pudo comprobar</strong>
              <p>{error ?? "Error desconocido"}</p>
              <p className="upd-error__hint">
                Asegúrate de que el repo <code>GITHUB_REPO</code> en src/lib/app-config.ts exista y tenga
                releases publicadas.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {status === "done" && result ? (
        result.updateAvailable ? (
          <div className="panel">
            <div className="upd-available">
              <div className="upd-available__icon">
                <Download size={20} />
              </div>
              <div>
                <div className="upd-available__title">
                  Nueva versión v{result.latestVersion} disponible
                </div>
                {apkAsset ? (
                  <div className="upd-available__meta">
                    APK {apkAsset.name} · {formatBytes(apkAsset.size)}
                  </div>
                ) : (
                  <div className="upd-available__meta">Publicado en GitHub Releases</div>
                )}
                {result.release?.published_at ? (
                  <div className="upd-available__meta">
                    Publicado el {formatDate(result.release.published_at, { withTime: true })}
                  </div>
                ) : null}
              </div>
            </div>

            {result.release?.body ? (
              <div className="upd-notes">
                <div className="upd-notes__title">
                  <GitBranch size={14} /> Notas de la versión
                </div>
                <pre className="upd-notes__body">{result.release.body}</pre>
              </div>
            ) : null}

            {progress && downloading ? (
              <div className="upd-progress">
                <div className="upd-progress__bar" style={{ width: `${progress.pct}%` }} />
                <div className="upd-progress__label">
                  {progress.pct < 100
                    ? `Descargando… ${progress.pct}%`
                    : "Preparando instalación…"}
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn--success"
                onClick={() => void handleDownload()}
                disabled={downloading || !apkAsset}
              >
                <Download size={16} />
                {downloading ? "Descargando…" : "Descargar e instalar APK"}
              </button>
            )}
            {!apkAsset && result.releaseUrl ? (
              <p className="upd-available__hint">
                No se encontró un archivo .apk en la release. Se abrirá la página del release.
              </p>
            ) : null}
            {Capacitor.isNativePlatform() ? (
              <p className="upd-available__hint">
                La descarga se hace en segundo plano y luego se abre el instalador de Android.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="panel">
            <div className="upd-current">
              <div className="upd-current__row">
                <span className="upd-current__label">Última versión publicada</span>
                <strong className="upd-current__value">v{result.latestVersion ?? APP_VERSION}</strong>
              </div>
            </div>
            <div className="upd-up-to-date">
              <CheckCircle2 size={20} />
              <span>Tu aplicación está actualizada.</span>
            </div>
          </div>
        )
      ) : null}
    </div>
  );
}

function EmptyStateUpd({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon">
        <RefreshCw size={22} />
      </div>
      <div className="empty-state__title">{title}</div>
      <div className="empty-state__text">{text}</div>
    </div>
  );
}
