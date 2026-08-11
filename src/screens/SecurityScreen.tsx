import { SecuritySection } from "../components/SecuritySection";

/** Sección dedicada a la seguridad de la app (PIN + biometría). */
export function SecurityScreen() {
  return (
    <div className="screen">
      <div className="view__header">
        <div>
          <div className="view__eyebrow">Sistema</div>
          <h1 className="view__title">Seguridad</h1>
          <p className="view__subtitle">Protege el acceso a la app con PIN y biometría</p>
        </div>
      </div>
      <SecuritySection />
    </div>
  );
}
