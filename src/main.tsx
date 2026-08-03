import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { startHeartbeat } from "./services/heartbeat";
import { startSolicitudesPolling } from "./services/solicitudes";
import { checkAppUpdates } from "./services/updater";
import { setTheme } from "./ui/theme";
import { getTheme } from "./ui/theme";
import "./styles.css";

setTheme(getTheme());

startHeartbeat();
startSolicitudesPolling();

window.setTimeout(() => {
  void checkAppUpdates();
}, 2500);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
