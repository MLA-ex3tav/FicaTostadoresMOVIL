export interface PhoneCountry {
  name: string;
  code: string;
}

/** Países con su código telefónico de marcación (sin el "+"). */
export const PHONE_COUNTRIES: PhoneCountry[] = [
  { name: "Chile", code: "56" },
  { name: "Argentina", code: "54" },
  { name: "Perú", code: "51" },
  { name: "Bolivia", code: "591" },
  { name: "Colombia", code: "57" },
  { name: "México", code: "52" },
  { name: "Ecuador", code: "593" },
  { name: "España", code: "34" },
  { name: "Estados Unidos", code: "1" },
  { name: "Brasil", code: "55" },
  { name: "Uruguay", code: "598" },
];

/** Detecta el país según el prefijo con el que empieza el número. */
export function detectPhoneCountry(
  raw: string,
  fallback: PhoneCountry = PHONE_COUNTRIES[0],
): PhoneCountry {
  const digits = raw.replace(/\D/g, "");
  const match = PHONE_COUNTRIES.find((c) => digits.startsWith(c.code));
  return match ?? fallback;
}
