import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search, X } from "lucide-react";

interface CollapsibleSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/**
 * Buscador plegable: por defecto es solo la lupa (sin recuadro), lista en el
 * header de la sección. Al tocarla se abre una barra de búsqueda fija arriba
 * con foco automático. Se cierra con la X o al perder el foco con el campo vacío.
 */
export function CollapsibleSearch({
  value,
  onChange,
  placeholder = "Buscar…",
}: CollapsibleSearchProps) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const expand = () => {
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleBlur = () => {
    if (!value) setOpen(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        className="collapsible-search__lupa"
        aria-label="Buscar"
        onClick={expand}
      >
        <Search size={20} />
      </button>
    );
  }

  return createPortal(
    <div className="collapsible-search-bar" role="search">
      <div className="collapsible-search-bar__row">
        <span className="collapsible-search-bar__icon" aria-hidden="true">
          <Search size={18} />
        </span>
        <input
          ref={inputRef}
          className="collapsible-search-bar__input"
          type="search"
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={handleBlur}
          autoFocus
        />
        {value ? (
          <button
            type="button"
            className="search-field__clear"
            aria-label="Limpiar búsqueda"
            onClick={() => {
              onChange("");
              inputRef.current?.focus();
            }}
          >
            <X size={14} />
          </button>
        ) : null}
        <button
          type="button"
          className="collapsible-search-bar__close"
          aria-label="Cerrar búsqueda"
          onClick={() => setOpen(false)}
        >
          <X size={20} />
        </button>
      </div>
    </div>,
    document.body,
  );
}
