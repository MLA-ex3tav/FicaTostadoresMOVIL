import { useEffect, useState } from "react";
import type { ViewId } from "./types";
import { BottomNav } from "./components/BottomNav";
import { ConnectionBanner } from "./components/ConnectionBanner";
import { LockScreen } from "./components/LockScreen";
import { ToastHost } from "./components/ToastHost";
import { isLockEnabled } from "./lib/lock";
import { PdfActionsSheet } from "./components/PdfActionsSheet";
import { CotizacionesScreen } from "./screens/CotizacionesScreen";
import { NuevaCotizacionScreen } from "./screens/NuevaCotizacionScreen";
import { EmpresaScreen } from "./screens/EmpresaScreen";
import { OTScreen } from "./screens/OTScreen";
import { HistorialScreen } from "./screens/HistorialScreen";
import { ClientesScreen } from "./screens/ClientesScreen";
import { ProductosScreen } from "./screens/ProductosScreen";
import { SoporteScreen } from "./screens/SoporteScreen";
import { ConexionesScreen } from "./screens/ConexionesScreen";
import { SecurityScreen } from "./screens/SecurityScreen";
import { ActualizacionesScreen } from "./screens/ActualizacionesScreen";
import { PullToRefresh } from "./components/PullToRefresh";
import { refreshSolicitudes } from "./services/solicitudes";

function renderScreen(view: ViewId, setView: (view: ViewId) => void): React.JSX.Element | null {
  switch (view) {
    case "cotizaciones":
      return <CotizacionesScreen onCreate={() => setView("nueva")} />;
    case "nueva":
      return <NuevaCotizacionScreen onBack={() => setView("cotizaciones")} />;
    case "ot":
      return <OTScreen />;
    case "historial":
      return <HistorialScreen />;
    case "clientes":
      return <ClientesScreen />;
    case "productos":
      return <ProductosScreen />;
    case "soporte":
      return <SoporteScreen />;
    case "conexiones":
      return <ConexionesScreen />;
    case "seguridad":
      return <SecurityScreen />;
    case "empresa":
      return <EmpresaScreen onBack={() => setView("soporte")} />;
    case "actualizaciones":
      return <ActualizacionesScreen />;
  }
}

export function App() {
  const [view, setView] = useState<ViewId>("cotizaciones");
  const [locked, setLocked] = useState<boolean>(() => isLockEnabled());

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (detail && detail in { actualizaciones: 1, cotizaciones: 1, soporte: 1, seguridad: 1 }) {
        setView(detail as ViewId);
      }
    };
    window.addEventListener("app:navigate", handler);
    return () => window.removeEventListener("app:navigate", handler);
  }, []);

  // Bloqueo por PIN/biometría: al arrancar (si está activo) y al pasar la app
  // a segundo plano se vuelve a bloquear.
  useEffect(() => {
    if (!isLockEnabled()) return;

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        setLocked(true);
      }
    };
    const onLockEvent = () => setLocked(true);

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("app:lock", onLockEvent);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("app:lock", onLockEvent);
    };
  }, []);

  if (locked) {
    return (
      <LockScreen
        onUnlock={() => {
          setLocked(false);
        }}
      />
    );
  }

  const isNueva = view === "nueva";

  return (
    <div className="app-shell">
      <ConnectionBanner />
      <main className={`content${isNueva ? " content--no-nav" : ""}`}>
        <PullToRefresh onRefresh={refreshSolicitudes}>
          <div key={view} className="view-transition">
            {renderScreen(view, setView)}
          </div>
        </PullToRefresh>
      </main>

      {isNueva ? null : <BottomNav active={view} onChange={setView} />}
      <ToastHost />
      <PdfActionsSheet />
    </div>
  );
}
