import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import {
  initialChecks,
  runConnectionChecks,
  summarizeChecks,
  type CheckStatus,
  type ConnectionCheck,
} from "../lib/connections";
import { StatusPill, type PillVariant } from "../components/StatusPill";
import { renderIcon } from "../ui/icons";

function statusLabel(status: CheckStatus): string {
  switch (status) {
    case "ok":
      return "Operativo";
    case "warn":
      return "Atención";
    case "error":
      return "Error";
    case "checking":
      return "Comprobando…";
  }
}

function statusVariant(status: CheckStatus): PillVariant {
  switch (status) {
    case "ok":
      return "done";
    case "warn":
      return "pending";
    case "error":
      return "error";
    case "checking":
      return "progress";
  }
}

export function ConexionesScreen() {
  const [checks, setChecks] = useState<ConnectionCheck[]>(initialChecks);
  const [running, setRunning] = useState(false);
  const [lastRunAt, setLastRunAt] = useState<number | null>(null);

  const run = useCallback(async () => {
    if (running) return;
    setRunning(true);
    try {
      const result = await runConnectionChecks(setChecks);
      setChecks(result);
      setLastRunAt(Date.now());
    } finally {
      setRunning(false);
    }
  }, [running]);

  useEffect(() => {
    void run();
  }, []);

  const overall = summarizeChecks(checks);

  return (
    <div className="screen">
      <div className="view__header">
        <div>
          <div className="view__eyebrow">Sistema</div>
          <h1 className="view__title">Conexiones</h1>
          <p className="view__subtitle">Estado del enlace app ↔ web y base de datos</p>
        </div>
        <button
          className="btn btn--secondary btn--icon"
          type="button"
          onClick={() => void run()}
          disabled={running}
          aria-label="Comprobar de nuevo"
        >
          <RefreshCw size={16} className={running ? "spin" : ""} />
        </button>
      </div>

      <div className={`conn-overall conn-overall--${overall}`}>
        {overall === "ok"
          ? "Todos los servicios operativos"
          : overall === "warn"
            ? "Conexión parcial"
            : "Sin conexión"}
      </div>

      <div className="panel">
        <div className="conn-list">
          {checks.map((check) => {
            const iconHtml = renderIcon(check.icon, { size: 20 });
            return (
              <div key={check.id} className="conn-row">
                <span
                  className="conn-row__icon"
                  aria-hidden="true"
                  dangerouslySetInnerHTML={{ __html: iconHtml }}
                />
                <div className="conn-row__body">
                  <span className="conn-row__label">{check.label}</span>
                  <span className="conn-row__detail">{check.detail}</span>
                </div>
                <div className="conn-row__meta">
                  <StatusPill label={statusLabel(check.status)} variant={statusVariant(check.status)} />
                  {check.latencyMs !== null ? (
                    <span className="conn-latency">{check.latencyMs} ms</span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
        <div className="conn-updated">
          {lastRunAt
            ? `Última comprobación: ${new Date(lastRunAt).toLocaleTimeString()}`
            : "Comprobando por primera vez…"}{" "}
          · Se vuelve a comprobar al abrir esta sección.
        </div>
      </div>
    </div>
  );
}
