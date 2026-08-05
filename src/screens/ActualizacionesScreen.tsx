import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Download, CheckCircle2, GitBranch, AlertTriangle, Smartphone } from "lucide-react";
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
  const isChecking = status === "checking";

  return (
    <div className="screen">
      <div className="view__header">
        <div>
          <div className="view__eyebrow">Sistema</div>
          <h1 className="view__title">Actualizaciones</h1>
          <p className="view__subtitle">Mantén tu app siempre al día</p>
        </div>
      </div>

      <div className="upd-hero">
        <div className="upd-hero__top">
          <span className="upd-hero__icon" aria-hidden="true">
            <Smartphone size={22} />
          </span>
          <div className="upd-hero__info">
            <span className="upd-hero__label">Versión instalada</span>
            <strong className="upd-hero__version">v{APP_VERSION}</strong>
            {lastCheck ? (
              <span className="upd-hero__meta">
                Última comprobación · {formatDate(lastCheck, { withTime: true })}
              </span>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          className="btn btn--primary btn--block"
          onClick={() => void buscar()}
          disabled={isChecking}
        >
          <RefreshCw size={16} className={isChecking ? "spin" : ""} />
          {isChecking ? "Buscando actualizaciones…" : "Buscar actualizaciones"}
        </button>
      </div>

      {isChecking ? (
        <div className="panel panel--boxed">
          <EmptyStateUpd title="Comprobando…" text="Consultando GitHub Releases." />
        </div>
      ) : null}

      {status === "error" ? (
        <div className="panel panel--boxed upd-card-error">
          <div className="upd-card-error__icon">
            <AlertTriangle size={20} />
          </div>
          <div className="upd-card-error__body">
            <strong>No se pudo comprobar</strong>
            <p>{error ?? "Error desconocido"}</p>
            <p className="upd-card-error__hint">
              Asegúrate de que el repo <code>GITHUB_REPO</code> en src/lib/app-config.ts exista y tenga
              releases publicadas.
            </p>
          </div>
        </div>
      ) : null}

      {status === "done" && result ? (
        result.updateAvailable ? (
          <div className="upd-download">
            <div className="upd-download__head">
              <span className="upd-download__icon" aria-hidden="true">
                <Download size={20} />
              </span>
              <div>
                <div className="upd-download__title">Nueva versión v{result.latestVersion}</div>
                <div className="upd-download__subtitle">Disponible para instalar</div>
              </div>
            </div>

            <div className="upd-specs">
              <div className="upd-spec">
                <span className="upd-spec__label">Archivo</span>
                <strong className="upd-spec__value">{apkAsset?.name ?? "GitHub Releases"}</strong>
              </div>
              <div className="upd-spec">
                <span className="upd-spec__label">Tamaño</span>
                <strong className="upd-spec__value">
                  {apkAsset ? formatBytes(apkAsset.size) : "—"}
                </strong>
              </div>
              {result.release?.published_at ? (
                <div className="upd-spec">
                  <span className="upd-spec__label">Publicado</span>
                  <strong className="upd-spec__value">
                    {formatDate(result.release.published_at, { withTime: true })}
                  </strong>
                </div>
              ) : null}
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
                className="btn btn--success btn--block"
                onClick={() => void handleDownload()}
                disabled={downloading || !apkAsset}
              >
                <Download size={16} />
                {downloading ? "Descargando…" : "Descargar e instalar APK"}
              </button>
            )}
            {!apkAsset && result.releaseUrl ? (
              <p className="upd-download__hint">
                No se encontró un archivo .apk en la release. Se abrirá la página del release.
              </p>
            ) : null}
            {Capacitor.isNativePlatform() ? (
              <p className="upd-download__hint">
                La descarga se hace en segundo plano y luego se abre el instalador de Android.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="upd-fresh">
            <span className="upd-fresh__icon" aria-hidden="true">
              <CheckCircle2 size={22} />
            </span>
            <div>
              <strong className="upd-fresh__title">Tu aplicación está actualizada</strong>
              <p className="upd-fresh__text">
                v{result.latestVersion ?? APP_VERSION} es la última versión disponible.
              </p>
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
