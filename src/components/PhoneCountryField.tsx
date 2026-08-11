import { useState } from "react";
import { ChevronDown, Users, X } from "lucide-react";
import {
  PHONE_COUNTRIES,
  detectPhoneCountry,
  type PhoneCountry,
} from "../lib/phone-countries";
import { useSheetDrag } from "./useSheetDrag";
import { ContactPickerSheet } from "./ContactPickerSheet";

const ALL_CODES = PHONE_COUNTRIES.map((c) => c.code).join("|");

/** Formatea el número nacional en bloques: 949959571 -> 9 4995 9571 */
function formatNational(digits: string): string {
  if (!digits) return "";
  if (digits.length === 9) {
    return digits.replace(/(\d)(\d{4})(\d{4})/, "$1 $2 $3");
  }
  const parts: string[] = [];
  let rest = digits;
  while (rest.length > 4) {
    parts.unshift(rest.slice(-4));
    rest = rest.slice(0, -4);
  }
  parts.unshift(rest);
  return parts.join(" ");
}

interface PhoneCountryFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
}

/**
 * Campo de teléfono con selector de país: el código (ej. +56) se muestra en el
 * botón del selector y el input solo lleva el número nacional (formateado en
 * bloques), sin duplicar el prefijo.
 */
export function PhoneCountryField({
  value,
  onChange,
  placeholder = "9 1234 5678",
  id,
}: PhoneCountryFieldProps) {
  const [country, setCountry] = useState<PhoneCountry>(() => detectPhoneCountry(value));
  const [open, setOpen] = useState(false);
  const [contactsOpen, setContactsOpen] = useState(false);
  const { panelRef, requestClose } = useSheetDrag(() => setOpen(false));

  const digits = value.replace(/\D/g, "");
  const nationalDigits = digits.replace(new RegExp(`^(${ALL_CODES})`), "");

  const handlePhoneChange = (raw: string) => {
    const national = raw.replace(/\D/g, "");
    const full = national ? `+${country.code} ${national}` : "";
    const detected = detectPhoneCountry(full, country);
    if (detected.code !== country.code) setCountry(detected);
    onChange(full);
  };

  const selectCountry = (next: PhoneCountry) => {
    setCountry(next);
    setOpen(false);
    onChange(nationalDigits ? `+${next.code} ${nationalDigits}` : "");
  };

  return (
    <>
      <div className="phone-country">
        <button
          type="button"
          className="phone-country__code"
          onClick={() => setOpen(true)}
          aria-label="Código de país"
        >
          +{country.code} <ChevronDown size={14} />
        </button>
        <input
          id={id}
          className="phone-country__input"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          value={formatNational(nationalDigits)}
          onChange={(event) => handlePhoneChange(event.target.value)}
          placeholder={placeholder}
        />
        <button
          type="button"
          className="phone-country__contacts"
          onClick={() => setContactsOpen(true)}
          aria-label="Elegir teléfono de contactos"
        >
          <Users size={18} />
        </button>
      </div>

      {open ? (
        <div
          className="more-sheet more-sheet--front"
          role="dialog"
          aria-modal="true"
          aria-label="Código de país"
        >
          <div className="more-sheet__backdrop" onClick={requestClose} />
          <div ref={panelRef} className="more-sheet__panel">
            <header className="more-sheet__header">
              <span className="more-sheet__title">Código de país</span>
              <button
                type="button"
                className="more-sheet__close"
                aria-label="Cerrar"
                onClick={requestClose}
              >
                <X size={18} />
              </button>
            </header>
            <div className="more-sheet__list">
              {PHONE_COUNTRIES.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  className={`more-sheet__item${c.code === country.code ? " more-sheet__item--active" : ""}`}
                  onClick={() => selectCountry(c)}
                >
                  <span className="more-sheet__item-label">{c.name}</span>
                  <span className="phone-country__sheet-code">+{c.code}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {contactsOpen ? (
        <ContactPickerSheet
          onClose={() => setContactsOpen(false)}
          onSelect={(phone) => {
            const detected = detectPhoneCountry(phone, country);
            setCountry(detected);
            setContactsOpen(false);
            onChange(phone);
          }}
        />
      ) : null}
    </>
  );
}
