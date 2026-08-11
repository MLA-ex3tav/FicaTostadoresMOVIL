import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Search, User, X } from "lucide-react";
import { getPhoneContacts, type ContactEntry } from "../services/contacts";
import { useSheetDrag } from "./useSheetDrag";

interface ContactPickerSheetProps {
  onSelect: (phone: string) => void;
  onClose: () => void;
}

/** Sheet para elegir un teléfono desde los contactos del dispositivo. */
export function ContactPickerSheet({ onSelect, onClose }: ContactPickerSheetProps) {
  const [contacts, setContacts] = useState<ContactEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const { panelRef, requestClose } = useSheetDrag(onClose);

  useEffect(() => {
    let active = true;
    void getPhoneContacts()
      .then((list) => {
        if (!active) return;
        setContacts(list);
        setError(null);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    const flat = contacts.flatMap((contact) =>
      contact.phones.map((phone) => ({ name: contact.name, phone })),
    );
    if (!term) return flat;
    return flat.filter(
      (row) =>
        row.name.toLowerCase().includes(term) ||
        row.phone.toLowerCase().includes(term),
    );
  }, [contacts, query]);

  return createPortal(
    <div className="more-sheet more-sheet--front" role="dialog" aria-modal="true" aria-label="Contactos">
      <div className="more-sheet__backdrop" onClick={requestClose} />
      <div ref={panelRef} className="more-sheet__panel">
        <header className="more-sheet__header">
          <span className="more-sheet__title">Elegir contacto</span>
          <button
            type="button"
            className="more-sheet__close"
            aria-label="Cerrar"
            onClick={requestClose}
          >
            <X size={18} />
          </button>
        </header>

        <div className="picker-sheet__search">
          <span className="picker-sheet__search-icon" aria-hidden="true">
            <Search size={16} />
          </span>
          <input
            className="picker-sheet__search-input"
            type="search"
            placeholder="Buscar contacto…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="more-sheet__list">
          {loading ? (
            <p className="contacts-empty">Cargando contactos…</p>
          ) : error ? (
            <p className="contacts-empty contacts-empty--error">{error}</p>
          ) : rows.length === 0 ? (
            <p className="contacts-empty">Sin resultados</p>
          ) : (
            rows.map((row, index) => (
              <button
                key={`${row.phone}-${index}`}
                type="button"
                className="more-sheet__item"
                onClick={() => onSelect(row.phone)}
              >
                <span className="more-sheet__item-icon" aria-hidden="true">
                  <User size={18} />
                </span>
                <span className="more-sheet__item-label">{row.name}</span>
                <span className="phone-country__sheet-code">{row.phone}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
