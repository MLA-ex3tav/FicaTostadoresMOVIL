import { useEffect, useRef, useState } from "react";
import { Fingerprint, KeyRound, Lock, ShieldCheck, Unlock } from "lucide-react";
import { BiometricAuth } from "@aparajita/capacitor-biometric-auth";
import {
  clearLock,
  isBiometricEnabled,
  isLockEnabled,
  setBiometricEnabled,
  setPin,
  verifyPin,
} from "../lib/lock";
import { showToast } from "../ui/toast";
import { PinModal, type PinResult } from "./PinModal";
import { ConfirmDialog } from "./ConfirmDialog";

type Flow =
  | { kind: "set"; stage: "new" | "repeat" }
  | { kind: "change"; stage: "current" | "new" | "repeat" }
  | { kind: "disable"; stage: "current" };

/** Sección "Seguridad de la app" (PIN + biometría). El PIN se ingresa con el
 *  mismo teclado del bloqueo, en un modal. */
export function SecuritySection() {
  const [pinEnabled, setPinEnabled] = useState<boolean>(() => isLockEnabled());
  const [flow, setFlow] = useState<Flow | null>(null);
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [biometricEnabled, setBiometricEnabledState] = useState<boolean>(() => isBiometricEnabled());
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const newPinRef = useRef("");

  useEffect(() => {
    void BiometricAuth.checkBiometry()
      .then((result) => setBiometricAvailable(result.isAvailable))
      .catch(() => setBiometricAvailable(false));
  }, []);

  const handleComplete = async (pin: string): Promise<PinResult> => {
    if (flow?.kind === "set") {
      if (flow.stage === "new") {
        newPinRef.current = pin;
        setFlow({ kind: "set", stage: "repeat" });
        return { ok: true };
      }
      if (pin !== newPinRef.current) {
        return { ok: false, message: "Los PIN no coinciden." };
      }
      try {
        await setPin(pin);
        setPinEnabled(true);
        setFlow(null);
        showToast({
          title: "Bloqueo activado",
          message: "Se pedirá el PIN al abrir la app.",
          tone: "success",
          icon: "check",
        });
        return { ok: true };
      } catch {
        return { ok: false, message: "No se pudo guardar el PIN." };
      }
    }

    if (flow?.kind === "change") {
      if (flow.stage === "current") {
        const ok = await verifyPin(pin);
        if (!ok) return { ok: false, message: "PIN incorrecto." };
        newPinRef.current = "";
        setFlow({ kind: "change", stage: "new" });
        return { ok: true };
      }
      if (flow.stage === "new") {
        newPinRef.current = pin;
        setFlow({ kind: "change", stage: "repeat" });
        return { ok: true };
      }
      if (pin !== newPinRef.current) {
        return { ok: false, message: "Los PIN no coinciden." };
      }
      try {
        await setPin(pin);
        setFlow(null);
        showToast({ title: "PIN actualizado", message: "El nuevo PIN quedó guardado.", tone: "success" });
        return { ok: true };
      } catch {
        return { ok: false, message: "No se pudo guardar el PIN." };
      }
    }

    if (flow?.kind === "disable") {
      const ok = await verifyPin(pin);
      if (!ok) return { ok: false, message: "PIN incorrecto." };
      setFlow(null);
      setConfirmDisable(true);
      return { ok: true };
    }

    return { ok: true };
  };

  const desactivar = async () => {
    await clearLock();
    setPinEnabled(false);
    setBiometricEnabledState(false);
    setConfirmDisable(false);
    showToast({ title: "Bloqueo desactivado", message: "La app ya no pedirá PIN.", tone: "success" });
  };

  const lockNow = () => {
    window.dispatchEvent(new CustomEvent("app:lock"));
    showToast({ title: "App bloqueada", message: "Se pedirá el PIN para continuar.", tone: "info", icon: "check" });
  };

  const toggleBiometric = () => {
    const next = !biometricEnabled;
    setBiometricEnabled(next);
    setBiometricEnabledState(next);
    showToast({
      title: next ? "Huella/rostro activado" : "Huella/rostro desactivado",
      message: next ? "Podrás desbloquear con biometría." : "Solo se usará el PIN.",
      tone: "success",
    });
  };

  const modalMeta = (): { title: string; subtitle: string } => {
    if (flow?.kind === "set") {
      return flow.stage === "new"
        ? { title: "Crea tu PIN", subtitle: "Elige un PIN de 4 dígitos." }
        : { title: "Repite tu PIN", subtitle: "Vuelve a ingresar el PIN para confirmarlo." };
    }
    if (flow?.kind === "change") {
      if (flow.stage === "current") {
        return { title: "Verifica tu PIN", subtitle: "Ingresa tu PIN actual para continuar." };
      }
      if (flow.stage === "new") {
        return { title: "Nuevo PIN", subtitle: "Elige tu nuevo PIN de 4 dígitos." };
      }
      return { title: "Repite el nuevo PIN", subtitle: "Vuelve a ingresar el nuevo PIN." };
    }
    return { title: "Verifica tu PIN", subtitle: "Ingresa tu PIN actual para continuar." };
  };

  const meta = flow ? modalMeta() : { title: "", subtitle: "" };

  return (
    <section className="form-card">
      <div className="form-card__header">
        <span className="form-card__icon" aria-hidden="true">
          <ShieldCheck size={16} />
        </span>
        <h3 className="form-card__title">Seguridad de la app</h3>
      </div>

      <div className="form-grid">
        <div className="form-field form-field--wide">
          <label className="form-label">Bloqueo por PIN</label>
          {!pinEnabled ? (
            <div className="seguridad-actions seguridad-actions--stack">
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => setFlow({ kind: "set", stage: "new" })}
              >
                <KeyRound size={16} /> Activar bloqueo por PIN
              </button>
            </div>
          ) : (
            <div className="seguridad-actions seguridad-actions--stack">
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => setFlow({ kind: "change", stage: "current" })}
              >
                <KeyRound size={16} /> Cambiar PIN
              </button>
              <button type="button" className="btn btn--secondary" onClick={lockNow}>
                <Lock size={16} /> Bloquear ahora
              </button>
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => setFlow({ kind: "disable", stage: "current" })}
              >
                <Unlock size={16} /> Desactivar
              </button>
            </div>
          )}
        </div>

        {pinEnabled && biometricAvailable ? (
          <div className="form-field form-field--wide">
            <label className="form-label">Desbloqueo con huella o rostro</label>
            <div className="seguridad-actions seguridad-actions--stack">
              <button
                type="button"
                className={`btn ${biometricEnabled ? "btn--primary" : "btn--secondary"}`}
                onClick={toggleBiometric}
              >
                <Fingerprint size={16} /> {biometricEnabled ? "Activado" : "Activar"}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {flow ? (
        <PinModal
          key={`${flow.kind}-${flow.stage}`}
          title={meta.title}
          subtitle={meta.subtitle}
          onCancel={() => setFlow(null)}
          onComplete={handleComplete}
        />
      ) : null}

      <ConfirmDialog
        open={confirmDisable}
        title="Desactivar bloqueo"
        message="¿Seguro que quieres desactivar el bloqueo de la app? Ya no se pedirá el PIN."
        confirmLabel="Desactivar"
        onConfirm={() => void desactivar()}
        onCancel={() => setConfirmDisable(false)}
      />
    </section>
  );
}
