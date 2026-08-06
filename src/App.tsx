import { useEffect, useState } from "react";
import type { ViewId } from "./types";
import { BottomNav } from "./components/BottomNav";
import { ToastHost } from "./components/ToastHost";
import { PdfActionsSheet } from "./components/PdfActionsSheet";
import { CotizacionesScreen } from "./screens/CotizacionesScreen";
import { NuevaCotizacionScreen } from "./screens/NuevaCotizacionScreen";
import { EmpresaScreen } from "./screens/EmpresaScreen";
import { OTScreen } from "./screens/OTScreen";
import { HistorialScreen } from "./screens/HistorialScreen";
import { ClientesScreen } from "./screens/ClientesScreen";
import { ProductosScreen } from "./screens/ProductosScreen";
import { ReportesScreen } from "./screens/ReportesScreen";
import { SoporteScreen } from "./screens/SoporteScreen";
import { ConexionesScreen } from "./screens/ConexionesScreen";
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
    case "reportes":
      return <ReportesScreen />;
    case "soporte":
      return <SoporteScreen />;
    case "conexiones":
      return <ConexionesScreen />;
    case "empresa":
      return <EmpresaScreen onBack={() => setView("soporte")} />;
    case "actualizaciones":
      return <ActualizacionesScreen />;
  }
}

export function App() {
  const [view, setView] = useState<ViewId>("cotizaciones");

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (detail && detail in { actualizaciones: 1, cotizaciones: 1, soporte: 1 }) {
        setView(detail as ViewId);
      }
    };
    window.addEventListener("app:navigate", handler);
    return () => window.removeEventListener("app:navigate", handler);
  }, []);

  return (
    <div className="app-shell">
      <main className="content">
        <PullToRefresh onRefresh={refreshSolicitudes}>
          <div key={view} className="view-transition">
            {renderScreen(view, setView)}
          </div>
        </PullToRefresh>
      </main>

      <BottomNav active={view} onChange={setView} />
      <ToastHost />
      <PdfActionsSheet />
    </div>
  );
}
