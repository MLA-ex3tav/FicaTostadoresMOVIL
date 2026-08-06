import { useEffect, useState } from "react";
import {
  ClipboardList,
  FileText,
  History,
  Menu,
  MoreHorizontal,
  Plus,
  X,
  Users,
  Box,
  Headphones,
  Plug,
  Building2,
  RefreshCw,
} from "lucide-react";
import type { ViewId } from "../types";
import { subscribeNavBadges } from "../lib/badges";

const LEFT_ITEMS: Array<{ id: ViewId; label: string; icon: typeof FileText }> = [
  { id: "cotizaciones", label: "Cotizaciones", icon: FileText },
  { id: "ot", label: "OT", icon: ClipboardList },
];

const RIGHT_ITEMS: Array<{ id: ViewId; label: string; icon: typeof FileText }> = [
  { id: "historial", label: "Historial", icon: History },
];

const MORE_ITEMS: Array<{ id: ViewId; label: string; icon: typeof FileText }> = [
  { id: "soporte", label: "Soporte técnico", icon: Headphones },
  { id: "clientes", label: "Clientes", icon: Users },
  { id: "productos", label: "Productos", icon: Box },
  { id: "empresa", label: "Datos de la empresa", icon: Building2 },
  { id: "conexiones", label: "Conexiones", icon: Plug },
  { id: "actualizaciones", label: "Actualizaciones", icon: RefreshCw },
];

interface BottomNavProps {
  active: ViewId;
  onChange: (view: ViewId) => void;
}

function useBadges(): Partial<Record<ViewId, number>> {
  const [badges, setBadges] = useState<Partial<Record<ViewId, number>>>({});
  useEffect(() => subscribeNavBadges(setBadges), []);
  return badges;
}

export function BottomNav({ active, onChange }: BottomNavProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const badges = useBadges();

  const highlight = active === "nueva" ? "cotizaciones" : active;
  const primaryActive = [...LEFT_ITEMS, ...RIGHT_ITEMS].some(
    (item) => item.id === highlight,
  );

  const select = (view: ViewId) => {
    onChange(view);
    setSheetOpen(false);
  };

  const renderItem = (item: (typeof LEFT_ITEMS)[number]) => {
    const Icon = item.icon;
    const badge = badges[item.id];
    return (
      <button
        key={item.id}
        type="button"
        className={`bottom-nav__item${highlight === item.id ? " bottom-nav__item--active" : ""}`}
        onClick={() => select(item.id)}
      >
        <span className="bottom-nav__icon" aria-hidden="true">
          <Icon size={20} />
          {badge ? <span className="bottom-nav__badge">{badge > 99 ? "99+" : badge}</span> : null}
        </span>
        <span className="bottom-nav__label">{item.label}</span>
      </button>
    );
  };

  return (
    <>
      <nav className="bottom-nav" aria-label="Navegación inferior">
        <div className="bottom-nav__group">{LEFT_ITEMS.map(renderItem)}</div>
        <button
          type="button"
          className="bottom-nav__fab"
          aria-label="Nueva cotización"
          onClick={() => select("nueva")}
        >
          <Plus size={26} strokeWidth={2.5} />
        </button>
        <div className="bottom-nav__group">
          {RIGHT_ITEMS.map(renderItem)}
          <button
            type="button"
            className={`bottom-nav__item${!primaryActive && !sheetOpen ? " bottom-nav__item--active" : ""}`}
            aria-label="Ver más opciones"
            onClick={() => setSheetOpen((open) => !open)}
          >
            <span className="bottom-nav__icon" aria-hidden="true">
              {sheetOpen ? <X size={20} /> : <MoreHorizontal size={20} />}
            </span>
            <span className="bottom-nav__label">Más</span>
          </button>
        </div>
      </nav>

      {sheetOpen ? (
        <div className="more-sheet" role="dialog" aria-modal="true" aria-label="Más opciones">
          <div className="more-sheet__backdrop" onClick={() => setSheetOpen(false)} />
          <div className="more-sheet__panel">
            <header className="more-sheet__header">
              <span className="more-sheet__title">Más opciones</span>
              <span className="more-sheet__icon" aria-hidden="true">
                <Menu size={18} />
              </span>
            </header>
            <div className="more-sheet__list">
              {MORE_ITEMS.map((item) => {
                const Icon = item.icon;
                const badge = badges[item.id];
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`more-sheet__item${highlight === item.id ? " more-sheet__item--active" : ""}`}
                    onClick={() => select(item.id)}
                  >
                    <span className="more-sheet__item-icon" aria-hidden="true">
                      <Icon size={20} />
                    </span>
                    <span className="more-sheet__item-label">{item.label}</span>
                    {badge ? <span className="more-sheet__badge">{badge > 99 ? "99+" : badge}</span> : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
