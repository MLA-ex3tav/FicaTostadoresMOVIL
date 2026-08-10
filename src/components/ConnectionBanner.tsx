import { useEffect, useState } from "react";
import {
  getNetworkState,
  onNetworkChange,
  type NetworkState,
} from "../lib/network";
import {
  getPendingSyncCount,
  subscribeSolicitudes,
} from "../services/solicitudes";
import { getPreciosPendientesCount } from "../services/catalog";

/**
 * Banner fijo que indica el estado de conexión y los cambios pendientes por
 * sincronizar (port del banner de FicaTostadoresAPPv2).
 */
export function ConnectionBanner() {
  const [network, setNetwork] = useState<NetworkState>(getNetworkState());
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const refresh = () =>
      setPending(getPendingSyncCount() + getPreciosPendientesCount());

    const unsubscribeNetwork = onNetworkChange(setNetwork);
    const unsubscribeSolicitudes = subscribeSolicitudes(refresh);
    refresh();

    return () => {
      unsubscribeNetwork();
      unsubscribeSolicitudes();
    };
  }, []);

  if (network !== "offline" && pending <= 0) {
    return null;
  }

  const isOffline = network === "offline";

  return (
    <div
      className={isOffline ? "conn-banner conn-banner--offline" : "conn-banner conn-banner--pending"}
      role="status"
      aria-live="polite"
    >
      {isOffline
        ? pending > 0
          ? `Sin conexión · ${pending} cambio(s) guardado(s) localmente. Se enviarán al reconectar.`
          : "Sin conexión · Los cambios se guardan localmente y se enviarán al reconectar."
        : `Sincronizando ${pending} cambio(s) guardado(s)…`}
    </div>
  );
}
