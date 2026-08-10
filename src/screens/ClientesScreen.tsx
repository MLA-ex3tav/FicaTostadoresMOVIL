import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  getSolicitudDate,
  subscribeSolicitudes,
  type SolicitudesState,
} from "../services/solicitudes";
import { StatusPill } from "../components/StatusPill";
import { EmptyState } from "../components/EmptyState";
import { formatFecha } from "./shared";

interface ClienteInfo {
  key: string;
  name: string;
  phone: string;
  email: string;
  total: number;
  ultimaFecha: Date | null;
}

/** Normaliza un teléfono: conserva dígitos y el "+" inicial. */
function normalizePhone(phone: unknown): string {
  const raw = typeof phone === "string" ? phone.trim() : "";
  return raw.replace(/[^0-9+]/g, "");
}

/**
 * Clave de identidad del cliente. Prioriza teléfono, luego e-mail, y solo usa
 * el nombre como último recurso (cuando no hay dato de contacto).
 */
function clienteKey(item: { [key: string]: unknown }): string {
  const phone = normalizePhone(item.clientPhone);
  if (phone) return `tel:${phone}`;
  const email =
    typeof item.clientEmail === "string" ? item.clientEmail.trim().toLowerCase() : "";
  if (email) return `email:${email}`;
  const name =
    typeof item.clientName === "string" ? item.clientName.trim().toLowerCase() : "";
  return `nom:${name}`;
}

function buildClientes(state: SolicitudesState): ClienteInfo[] {
  const map = new Map<string, ClienteInfo>();

  const allItems = state.cotizaciones.concat(state.soporte);

  for (const item of allItems) {
    const name = (typeof item.clientName === "string" ? item.clientName : "").trim();
    if (!name) continue;

    const key = clienteKey(item);
    const existing = map.get(key);
    const fecha = getSolicitudDate(item);

    if (existing) {
      existing.total++;
      if (fecha && (!existing.ultimaFecha || fecha > existing.ultimaFecha)) {
        existing.ultimaFecha = fecha;
      }
    } else {
      map.set(key, {
        key,
        name,
        phone: typeof item.clientPhone === "string" ? item.clientPhone : "",
        email: typeof item.clientEmail === "string" ? item.clientEmail : "",
        total: 1,
        ultimaFecha: fecha,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

export function ClientesScreen() {
  const [state, setState] = useState<SolicitudesState | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    return subscribeSolicitudes(setState);
  }, []);

  const clientes = useMemo(() => {
    if (!state) return [];
    const list = buildClientes(state);
    const term = query.trim().toLowerCase();
    if (!term) return list;
    return list.filter((cliente) =>
      `${cliente.name} ${cliente.phone} ${cliente.email}`.toLowerCase().includes(term),
    );
  }, [state, query]);

  if (!state) return null;

  return (
    <div className="screen">
      <div className="view__header">
        <div>
          <div className="view__eyebrow">Administración</div>
          <h1 className="view__title">Clientes</h1>
          <p className="view__subtitle">Historial y reincidencia por cliente</p>
        </div>
      </div>

      <div className="search-field">
        <span className="search-field__icon" aria-hidden="true">
          <Search size={16} />
        </span>
        <input
          className="search-input"
          type="search"
          placeholder="Buscar cliente…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <div className="panel">
        {clientes.length === 0 ? (
          <EmptyState
            title={state.loading ? "Cargando clientes…" : "Sin clientes registrados"}
            text={
              state.loading
                ? "Consultando la web."
                : "Los clientes aparecerán automáticamente cuando lleguen solicitudes desde la web."
            }
          />
        ) : (
          <ul className="card-list">
            {clientes.map((cliente) => (
              <li key={cliente.key} className="card-list__item">
                <div className="card-list__top">
                  <div className="card-list__title">{cliente.name}</div>
                  <StatusPill
                    label={`${cliente.total} solicitud${cliente.total > 1 ? "es" : ""}`}
                    variant={cliente.total > 1 ? "progress" : "pending"}
                  />
                </div>
                <div className="card-list__meta">
                  {[cliente.phone, cliente.email].filter(Boolean).join(" · ") || "—"}
                </div>
                <div className="card-list__meta">Última: {formatFecha(cliente.ultimaFecha)}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
