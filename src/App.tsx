import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import type { ViewId } from "./types";
import { BottomNav } from "./components/BottomNav";
import { ToastHost } from "./components/ToastHost";
import { PdfViewerHost } from "./components/PdfViewerHost";
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
import { getTheme, toggleTheme, type Theme } from "./ui/theme";
import { APP_VERSION } from "./lib/app-config";

function renderScreen(view: ViewId, setView: (view: ViewId) => void): React.JSX.Element | null {
  switch (view) {
    case "cotizaciones":
      return <CotizacionesScreen onNavigate={(target) => setView(target as ViewId)} />;
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
  const [theme, setTheme] = useState<Theme>(() => getTheme());

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (detail && detail in { actualizaciones: 1 }) {
        setView("actualizaciones");
      }
    };
    window.addEventListener("app:navigate", handler);
    return () => window.removeEventListener("app:navigate", handler);
  }, []);

  const handleThemeToggle = () => {
    setTheme(toggleTheme());
  };

  return (
    <div className="app-shell">
      <header className="mobile-header">
        <div className="mobile-header__brand">
          <img src="/assets/logo.webp" alt="Fica Tostadores" className="mobile-header__logo" />
          <span className="mobile-header__title">Fica Tostadores</span>
          <span className="app-version-badge">v{APP_VERSION}</span>
        </div>
        <button
          className="theme-toggle"
          id="theme-toggle"
          type="button"
          title={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          aria-pressed={theme === "dark"}
          onClick={handleThemeToggle}
        >
          <span className="theme-toggle__icon theme-toggle__icon--sun" aria-hidden="true">
            <Sun size={18} />
          </span>
          <span className="theme-toggle__icon theme-toggle__icon--moon" aria-hidden="true">
            <Moon size={18} />
          </span>
        </button>
      </header>

      <main className="content">
        {renderScreen(view, setView)}
      </main>

      <BottomNav active={view} onChange={setView} />
      <ToastHost />
      <PdfViewerHost />
    </div>
  );
}
