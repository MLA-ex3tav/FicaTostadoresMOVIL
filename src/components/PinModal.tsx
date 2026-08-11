import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useSheetDrag } from "./useSheetDrag";

const PIN_LENGTH = 4;

export interface PinResult {
  ok: boolean;
  message?: string;
}

interface PinModalProps {
  title: string;
  subtitle?: string;
  onCancel: () => void;
  onComplete: (pin: string) => Promise<PinResult> | PinResult;
}

/**
 * Modal para ingresar un PIN con el teclado nativo del teléfono. Al completar
 * los 4 dígitos llama a onComplete; si falla muestra el error y limpia el PIN.
 */
export function PinModal({ title, subtitle, onCancel, onComplete }: PinModalProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { panelRef, requestClose } = useSheetDrag(onCancel);
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = async (candidate: string) => {
    if (busy) return;
    setBusy(true);
    const result = await Promise.resolve(completeRef.current(candidate));
    setBusy(false);
    if (!result.ok) {
      setError(result.message ?? "PIN incorrecto.");
      setPin("");
      inputRef.current?.focus();
    }
  };

  const handleChange = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, PIN_LENGTH);
    setError(null);
    setPin(digits);
    if (digits.length === PIN_LENGTH) {
      void submit(digits);
    }
  };

  return createPortal(
    <div className="more-sheet more-sheet--front" role="dialog" aria-modal="true" aria-label={title}>
      <div className="more-sheet__backdrop" onClick={requestClose} />
      <div ref={panelRef} className="more-sheet__panel pin-modal">
        <header className="more-sheet__header">
          <span className="more-sheet__title">{title}</span>
          <button
            type="button"
            className="more-sheet__close"
            aria-label="Cerrar"
            onClick={requestClose}
          >
            <X size={18} />
          </button>
        </header>

        {subtitle ? <p className="pin-modal__subtitle">{subtitle}</p> : null}

        <div className={`lock-screen__dots${error ? " lock-screen__dots--error" : ""}`}>
          {Array.from({ length: PIN_LENGTH }).map((_, index) => (
            <span
              key={index}
              className={`lock-screen__dot${index < pin.length ? " is-filled" : ""}`}
            />
          ))}
        </div>

        <input
          ref={inputRef}
          className="pin-input"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={PIN_LENGTH}
          value={pin}
          onChange={(event) => handleChange(event.target.value)}
          disabled={busy}
          aria-label="PIN"
        />

        {error ? <p className="pin-modal__error">{error}</p> : null}
      </div>
    </div>,
    document.body,
  );
}
