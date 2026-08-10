import { useCallback, useEffect, useState } from "react";
import { Fingerprint, Lock, Delete } from "lucide-react";
import { BiometricAuth } from "@aparajita/capacitor-biometric-auth";
import { isBiometricEnabled, verifyPin } from "../lib/lock";

const PIN_LENGTH = 4;

interface LockScreenProps {
  onUnlock: () => void;
}

/**
 * Pantalla de bloqueo: PIN de 4 dígitos + botón de huella/rostro si está
 * habilitado y el dispositivo lo soporta.
 */
export function LockScreen({ onUnlock }: LockScreenProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isBiometricEnabled()) return;
    void BiometricAuth.checkBiometry()
      .then((result) => setBiometricAvailable(result.isAvailable))
      .catch(() => setBiometricAvailable(false));
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

  const pressDigit = (digit: string) => {
    setError(null);
    const next = (pin + digit).slice(0, PIN_LENGTH);
    setPin(next);
    if (next.length === PIN_LENGTH) {
      void attemptUnlock(next);
    }
  };

  const pressBackspace = () => {
    setError(null);
    setPin((prev) => prev.slice(0, -1));
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

  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

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

        {error ? <p className="lock-screen__error">{error}</p> : null}

        <div className="lock-screen__keypad">
          {digits.map((digit) => (
            <button
              key={digit}
              type="button"
              className="lock-screen__key"
              disabled={busy}
              onClick={() => pressDigit(String(digit))}
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            className="lock-screen__key lock-screen__key--action"
            disabled={busy || pin.length === 0}
            onClick={pressBackspace}
            aria-label="Borrar"
          >
            <Delete size={20} />
          </button>
          {biometricAvailable ? (
            <button
              type="button"
              className="lock-screen__key lock-screen__key--action"
              disabled={busy}
              onClick={() => void pressBiometric()}
              aria-label="Usar huella o rostro"
            >
              <Fingerprint size={20} />
            </button>
          ) : (
            <button
              type="button"
              className="lock-screen__key lock-screen__key--action"
              disabled
              aria-hidden="true"
            />
          )}
        </div>

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
