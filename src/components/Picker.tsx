import { useMemo, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

export interface PickerOption {
  value: string;
  label: string;
}

export interface PickerProps {
  label: string;
  placeholder?: string;
  value: string;
  options: Array<string | PickerOption>;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Texto mostrado cuando está deshabilitado (ej: "Primero elige la región"). */
  disabledHint?: string;
  searchable?: boolean;
}

function normalize(options: Array<string | PickerOption>): PickerOption[] {
  return options.map((option) =>
    typeof option === "string" ? { value: option, label: option } : option,
  );
}

export function Picker({
  label,
  placeholder = "Selecciona…",
  value,
  options,
  onChange,
  disabled = false,
  disabledHint,
  searchable = true,
}: PickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const normalized = useMemo(() => normalize(options), [options]);

  const selected = normalized.find((option) => option.value === value);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return normalized;
    return normalized.filter((option) => option.label.toLowerCase().includes(term));
  }, [normalized, query]);

  const choose = (option: PickerOption) => {
    onChange(option.value);
    setOpen(false);
    setQuery("");
  };

  return (
    <div className="picker">
      <button
        type="button"
        className={`picker__field${disabled ? " picker__field--disabled" : ""}`}
        onClick={() => !disabled && setOpen(true)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="picker__label">{label}</span>
        <span className="picker__row">
          <span
            className={`picker__value${selected ? "" : " picker__value--placeholder"}`}
          >
            {selected ? selected.label : disabled ? disabledHint ?? placeholder : placeholder}
          </span>
          <span className="picker__chevron" aria-hidden="true">
            <ChevronDown size={18} />
          </span>
        </span>
      </button>

      {open ? (
        <div className="picker-sheet" role="dialog" aria-modal="true" aria-label={label}>
          <div className="picker-sheet__backdrop" onClick={() => setOpen(false)} />
          <div className="picker-sheet__panel">
            <header className="picker-sheet__header">
              <span className="picker-sheet__title">{label}</span>
              <button
                type="button"
                className="picker-sheet__close"
                aria-label="Cerrar"
                onClick={() => setOpen(false)}
              >
                <X size={20} />
              </button>
            </header>

            {searchable ? (
              <div className="picker-sheet__search">
                <span className="picker-sheet__search-icon" aria-hidden="true">
                  <Search size={16} />
                </span>
                <input
                  className="picker-sheet__search-input"
                  type="search"
                  placeholder="Buscar…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  autoFocus
                />
              </div>
            ) : null}

            <div className="picker-sheet__list" role="listbox">
              {filtered.length === 0 ? (
                <div className="picker-sheet__empty">Sin resultados</div>
              ) : (
                filtered.map((option) => {
                  const isSelected = option.value === value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={`picker-sheet__option${isSelected ? " picker-sheet__option--selected" : ""}`}
                      onClick={() => choose(option)}
                    >
                      <span className="picker-sheet__option-label">{option.label}</span>
                      {isSelected ? (
                        <span className="picker-sheet__option-check" aria-hidden="true">
                          <Check size={18} />
                        </span>
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
