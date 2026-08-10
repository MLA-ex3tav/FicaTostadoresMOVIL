import { useEffect, useState } from "react";
import { ArrowLeft, Check, Fingerprint, KeyRound, Lock, ShieldCheck, Unlock } from "lucide-react";
import { BiometricAuth } from "@aparajita/capacitor-biometric-auth";
import { COUNTRIES, REGIONS_BY_COUNTRY } from "../lib/geo";
import { getCompanyData, saveCompany, type CompanyData } from "../lib/company";
import {
  clearLock,
  isBiometricEnabled,
  isLockEnabled,
  setBiometricEnabled,
  setPin,
  verifyPin,
} from "../lib/lock";
import { Picker } from "../components/Picker";
import { showToast } from "../ui/toast";

const PIN_REGEX = /^\d{4}$/;

export function EmpresaScreen({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<CompanyData>(() => getCompanyData());

  // Seguridad de la app
  const [pinEnabled, setPinEnabled] = useState<boolean>(() => isLockEnabled());
  const [pinMode, setPinMode] = useState<"idle" | "set" | "change" | "disable">("idle");
  const [pin1, setPin1] = useState("");
  const [pin2, setPin2] = useState("");
  const [verify, setVerify] = useState("");
  const [biometricEnabled, setBiometricEnabledState] = useState<boolean>(() => isBiometricEnabled());
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  useEffect(() => {
    void BiometricAuth.checkBiometry()
      .then((result) => setBiometricAvailable(result.isAvailable))
      .catch(() => setBiometricAvailable(false));
  }, []);

  const resetPinFields = () => {
    setPin1("");
    setPin2("");
    setVerify("");
    setPinMode("idle");
  };

  const saveNewPin = async () => {
    if (!PIN_REGEX.test(pin1) || pin1 !== pin2) {
      showToast({
        title: "PIN inválido",
        message: "Ingresa 4 dígitos y que coincidan en ambos campos.",
        tone: "warning",
      });
      return;
    }
    try {
      await setPin(pin1);
      setPinEnabled(true);
      resetPinFields();
      showToast({
        title: "Bloqueo activado",
        message: "Se pedirá el PIN al abrir la app.",
        tone: "success",
        icon: "check",
      });
    } catch {
      showToast({
        title: "Error",
        message: "No se pudo guardar el PIN.",
        tone: "error",
      });
    }
  };

  const changePin = async () => {
    const ok = await verifyPin(verify);
    if (!ok) {
      showToast({ title: "PIN incorrecto", message: "Verifica tu PIN actual.", tone: "error" });
      return;
    }
    if (!PIN_REGEX.test(pin1) || pin1 !== pin2) {
      showToast({
        title: "PIN inválido",
        message: "Ingresa 4 dígitos y que coincidan en ambos campos.",
        tone: "warning",
      });
      return;
    }
    await setPin(pin1);
    resetPinFields();
    showToast({ title: "PIN actualizado", message: "El nuevo PIN quedó guardado.", tone: "success" });
  };

  const disablePin = async () => {
    const ok = await verifyPin(verify);
    if (!ok) {
      showToast({ title: "PIN incorrecto", message: "Verifica tu PIN actual.", tone: "error" });
      return;
    }
    await clearLock();
    setPinEnabled(false);
    setBiometricEnabledState(false);
    resetPinFields();
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

  const set = <K extends keyof CompanyData>(key: K, value: CompanyData[K]) => {
    setData((prev) => ({ ...prev, [key]: value }));
  };

  const save = () => {
    if (!data.name.trim()) {
      showToast({
        title: "Falta el nombre de la empresa",
        message: "Completa el nombre o razón social para continuar.",
        tone: "warning",
      });
      return;
    }
    saveCompany(data);
    showToast({
      title: "Empresa guardada",
      message: "Los cambios se aplicarán a los próximos PDF de cotizaciones.",
      tone: "success",
      icon: "check",
    });
  };

  const regiones = REGIONS_BY_COUNTRY[data.country] ?? [];
  const esChile = data.country === "Chile";
  const regionActual = esChile ? regiones.find((region) => region.name === data.region) : null;

  return (
    <div className="screen">
      <div className="view__header">
        <div className="view__header-row">
          <button
            type="button"
            className="btn btn--secondary btn--icon"
            onClick={onBack}
            aria-label="Volver"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="view__eyebrow">Configuración</div>
            <h1 className="view__title">Datos de la empresa</h1>
            <p className="view__subtitle">Se usan en los PDF de cotizaciones que generas.</p>
          </div>
        </div>
      </div>

      <section className="form-section">
        <div className="form-grid">
          <div className="form-field form-field--wide">
            <label className="form-label" htmlFor="co-name">Nombre / Razón social *</label>
            <input
              id="co-name"
              className="form-input"
              type="text"
              value={data.name}
              onChange={(event) => set("name", event.target.value)}
              placeholder="Ej. TOSTADORES FICA LTDA"
            />
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="co-tax">RUT</label>
            <input
              id="co-tax"
              className="form-input"
              type="text"
              value={data.taxId}
              onChange={(event) => set("taxId", event.target.value)}
              placeholder="76.683.592-9"
            />
          </div>
          <div className="form-field">
            <Picker
              label="País"
              placeholder="Selecciona país…"
              value={data.country}
              options={COUNTRIES}
              onChange={(country) => set("country", country)}
            />
          </div>
          {esChile ? (
            <div className="form-field">
              <Picker
                label="Región"
                placeholder="Selecciona región…"
                value={data.region}
                options={(REGIONS_BY_COUNTRY.Chile ?? []).map((region) => ({
                  value: region.name,
                  label: region.name,
                }))}
                onChange={(region) => set("region", region)}
              />
            </div>
          ) : null}
          {esChile ? (
            <div className="form-field">
              <Picker
                label="Ciudad"
                placeholder="Selecciona ciudad…"
                value={data.city}
                options={(regionActual?.cities ?? []).map((city) => ({ value: city, label: city }))}
                onChange={(city) => set("city", city)}
                disabled={!regionActual}
                disabledHint="Primero elige la región"
              />
            </div>
          ) : (
            <div className="form-field">
              <label className="form-label" htmlFor="co-city">Ciudad</label>
              <input
                id="co-city"
                className="form-input"
                type="text"
                value={data.city}
                onChange={(event) => set("city", event.target.value)}
                placeholder="Ciudad"
              />
            </div>
          )}
          <div className="form-field form-field--wide">
            <label className="form-label" htmlFor="co-address">Dirección</label>
            <input
              id="co-address"
              className="form-input"
              type="text"
              value={data.address}
              onChange={(event) => set("address", event.target.value)}
              placeholder="Calle, número, depto"
            />
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="co-zip">Código postal / ZIP origen</label>
            <input
              id="co-zip"
              className="form-input"
              type="text"
              inputMode="numeric"
              value={data.zip}
              onChange={(event) => set("zip", event.target.value)}
              placeholder="4780000"
            />
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="co-phone">Teléfono</label>
            <input
              id="co-phone"
              className="form-input"
              type="tel"
              inputMode="tel"
              value={data.phone}
              onChange={(event) => set("phone", event.target.value)}
              placeholder="+56 9 1234 5678"
            />
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="co-email">Email</label>
            <input
              id="co-email"
              className="form-input"
              type="email"
              inputMode="email"
              value={data.email}
              onChange={(event) => set("email", event.target.value)}
              placeholder="contacto@empresa.cl"
            />
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="co-web">Sitio web</label>
            <input
              id="co-web"
              className="form-input"
              type="text"
              value={data.website}
              onChange={(event) => set("website", event.target.value)}
              placeholder="www.empresa.cl"
            />
          </div>
        </div>
      </section>

      <section className="form-section">
        <div className="form-section__title">
          <Lock size={16} /> Seguridad de la app
        </div>

        <div className="form-grid">
          <div className="form-field form-field--wide">
            <label className="form-label">Bloqueo por PIN</label>
            {!pinEnabled ? (
              pinMode === "set" ? (
                <div className="seguridad-stack">
                  <input
                    className="form-input"
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="Nuevo PIN (4 dígitos)"
                    value={pin1}
                    onChange={(event) => setPin1(event.target.value.replace(/\D/g, ""))}
                  />
                  <input
                    className="form-input"
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="Repite el PIN"
                    value={pin2}
                    onChange={(event) => setPin2(event.target.value.replace(/\D/g, ""))}
                  />
                  <div className="seguridad-actions">
                    <button type="button" className="btn btn--primary" onClick={() => void saveNewPin()}>
                      <Check size={16} /> Guardar PIN
                    </button>
                    <button type="button" className="btn btn--secondary" onClick={() => setPinMode("idle")}>
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className="btn btn--secondary" onClick={() => setPinMode("set")}>
                  <KeyRound size={16} /> Activar bloqueo por PIN
                </button>
              )
            ) : (
              <div className="seguridad-stack">
                {pinMode === "change" || pinMode === "disable" ? (
                  <input
                    className="form-input"
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="PIN actual"
                    value={verify}
                    onChange={(event) => setVerify(event.target.value.replace(/\D/g, ""))}
                  />
                ) : null}
                {pinMode === "change" ? (
                  <>
                    <input
                      className="form-input"
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      placeholder="Nuevo PIN (4 dígitos)"
                      value={pin1}
                      onChange={(event) => setPin1(event.target.value.replace(/\D/g, ""))}
                    />
                    <input
                      className="form-input"
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      placeholder="Repite el nuevo PIN"
                      value={pin2}
                      onChange={(event) => setPin2(event.target.value.replace(/\D/g, ""))}
                    />
                  </>
                ) : null}
                <div className="seguridad-actions">
                  {pinMode === "idle" ? (
                    <>
                      <button type="button" className="btn btn--primary" onClick={lockNow}>
                        <Lock size={16} /> Bloquear ahora
                      </button>
                      <button type="button" className="btn btn--secondary" onClick={() => setPinMode("change")}>
                        Cambiar PIN
                      </button>
                      <button type="button" className="btn btn--secondary" onClick={() => setPinMode("disable")}>
                        Desactivar
                      </button>
                    </>
                  ) : pinMode === "change" ? (
                    <>
                      <button type="button" className="btn btn--primary" onClick={() => void changePin()}>
                        <Check size={16} /> Guardar
                      </button>
                      <button type="button" className="btn btn--secondary" onClick={resetPinFields}>
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="btn btn--primary" onClick={() => void disablePin()}>
                        <Unlock size={16} /> Desactivar bloqueo
                      </button>
                      <button type="button" className="btn btn--secondary" onClick={resetPinFields}>
                        Cancelar
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {pinEnabled && biometricAvailable ? (
            <div className="form-field form-field--wide">
              <label className="form-label">Desbloqueo con huella o rostro</label>
              <button
                type="button"
                className={`btn ${biometricEnabled ? "btn--primary" : "btn--secondary"}`}
                onClick={toggleBiometric}
              >
                <Fingerprint size={16} /> {biometricEnabled ? "Activado" : "Activar"}
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <div className="setup-note">
        <ShieldCheck size={16} />
        <span>Estos datos salen en el encabezado, el origen de envío y el pie de página del PDF.</span>
      </div>

      <div className="wizard-actions">
        <button type="button" className="btn btn--primary" onClick={save}>
          <Check size={16} /> Guardar cambios
        </button>
      </div>
    </div>
  );
}
