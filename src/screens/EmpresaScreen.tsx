import { useState } from "react";
import { ArrowLeft, Check, ShieldCheck } from "lucide-react";
import { COUNTRIES, REGIONS_BY_COUNTRY } from "../lib/geo";
import { getCompanyData, saveCompany, type CompanyData } from "../lib/company";
import { Picker } from "../components/Picker";
import { showToast } from "../ui/toast";

export function EmpresaScreen({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<CompanyData>(() => getCompanyData());

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
