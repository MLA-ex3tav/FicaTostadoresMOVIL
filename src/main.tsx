import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { ensureFirestorePersistence } from "./lib/firebase";
import { getNetworkState, initNetwork, onNetworkChange } from "./lib/network";
import { startHeartbeat } from "./services/heartbeat";
import { initPush } from "./services/push";
import { syncAllPreciosToServer } from "./services/catalog";
import { refreshSolicitudes, startSolicitudesPolling, syncPendientes } from "./services/solicitudes";
import { initLocalNotifications } from "./services/notifications";
import { checkAppUpdates } from "./services/updater";
import { setTheme } from "./ui/theme";
import { getTheme } from "./ui/theme";
import "./styles.css";

setTheme(getTheme());

// Persistencia offline de Firestore: debe habilitarse antes de la primera
// operación para que el catálogo funcione sin internet.
void ensureFirestorePersistence();

// Sistema de seguridad: conectividad + reconexión.
initNetwork();

// Al volver la conexión, reenvía lo pendiente y recarga datos al instante.
onNetworkChange((networkState) => {
  if (networkState === "online") {
    void syncPendientes().then(() => {
      void syncAllPreciosToServer();
      void refreshSolicitudes();
    });
  }
});

// Reintento periódico mientras haya cola pendiente.
window.setInterval(() => {
  if (getNetworkState() === "online") {
    void syncPendientes();
    void syncAllPreciosToServer();
  }
}, 60_000);

startHeartbeat();
startSolicitudesPolling();
initLocalNotifications();

// Notificaciones push reales (FCM): avisan aunque la app esté cerrada.
initPush();

window.setTimeout(() => {
  void checkAppUpdates();
}, 2500);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
