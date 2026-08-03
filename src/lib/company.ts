export interface CompanyData {
  name: string;
  taxId: string;
  address: string;
  city: string;
  region: string;
  country: string;
  zip: string;
  phone: string;
  email: string;
  website: string;
}

const STORAGE_KEY = "fica.company.data";

export const DEFAULT_FICA: CompanyData = {
  name: "TOSTADORES FICA LTDA",
  taxId: "76.683.592-9",
  address: "San Ramón Pc. 39 Lt. 12-19",
  city: "Padre Las Casas",
  region: "La Araucanía",
  country: "Chile",
  zip: "4780000",
  phone: "+56 9 85088171",
  email: "tostadoresfica@gmail.com",
  website: "www.tostadoresfica.cl",
};

/** Devuelve los datos guardados o, si no hay nada guardado, los de FICA. */
export function getCompanyData(): CompanyData {
  return loadCompany() ?? DEFAULT_FICA;
}

export function loadCompany(): CompanyData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CompanyData;
    if (!parsed || typeof parsed !== "object" || !parsed.name) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveCompany(data: CompanyData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function clearCompany(): void {
  localStorage.removeItem(STORAGE_KEY);
}
