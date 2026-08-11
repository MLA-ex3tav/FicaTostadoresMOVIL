import { useCallback, useEffect, useRef, useState } from "react";
import { Fingerprint, Lock } from "lucide-react";
import { BiometricAuth } from "@aparajita/capacitor-biometric-auth";
import { isBiometricEnabled, verifyPin } from "../lib/lock";

const PIN_LENGTH = 4;

interface LockScreenProps {
  onUnlock: () => void;
}

/**
 * Pantalla de bloqueo: PIN de 4 dígitos con el teclado nativo del teléfono
 * + botón de huella/rostro si está habilitado y el dispositivo lo soporta.
 */
export function LockScreen({ onUnlock }: LockScreenProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isBiometricEnabled()) return;
    void BiometricAuth.checkBiometry()
      .then((result) => setBiometricAvailable(result.isAvailable))
      .catch(() => setBiometricAvailable(false));
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const attemptUnlock = useCallback(
    async (candidate: string) => {
      if (busy || candidate.length !== PIN_LENGTH) return;
      setBusy(true);
      setError(null);
      try {
        const ok = await verifyPin(candidate);
        if (ok) {
          onUnlock();
        } else {
          setError("PIN incorrecto. Inténtalo de nuevo.");
          setPin("");
          inputRef.current?.focus();
        }
      } catch {
        setError("No se pudo verificar el PIN.");
        setPin("");
      } finally {
        setBusy(false);
      }
    },
    [busy, onUnlock],
  );

  const handleChange = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, PIN_LENGTH);
    setError(null);
    setPin(digits);
    if (digits.length === PIN_LENGTH) {
      void attemptUnlock(digits);
    }
  };

  const pressBiometric = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await BiometricAuth.authenticate({
        reason: "Desbloquear Fica Tostadores",
        cancelTitle: "Usar PIN",
      });
      onUnlock();
    } catch {
      // el usuario canceló o falló la biometría: sigue con el PIN
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="lock-screen">
      <div className="lock-screen__card">
        <div className="lock-screen__icon">
          <Lock size={28} />
        </div>
        <h1 className="lock-screen__title">Fica Tostadores</h1>
        <p className="lock-screen__subtitle">Ingresa tu PIN para desbloquear</p>

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

        {error ? <p className="lock-screen__error">{error}</p> : null}

        {biometricAvailable ? (
          <button
            type="button"
            className="lock-screen__biometric-link"
            disabled={busy}
            onClick={() => void pressBiometric()}
          >
            <Fingerprint size={16} /> Usar huella o rostro
          </button>
        ) : null}
      </div>
    </div>
  );
}
