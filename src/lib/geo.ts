export interface GeoRegion {
  name: string;
  cities: string[];
  /** Código postal representativo de la región (Chile). */
  zip?: string;
}

export const COUNTRIES = [
  "Chile",
  "Argentina",
  "Perú",
  "Bolivia",
  "Colombia",
  "México",
  "Ecuador",
  "España",
  "Estados Unidos",
  "Brasil",
  "Uruguay",
  "Otro",
];

export const REGIONS_BY_COUNTRY: Record<string, GeoRegion[]> = {
  Chile: [
    { name: "Arica y Parinacota", zip: "1000000", cities: ["Arica", "Camarones", "Putre", "General Lagos"] },
    { name: "Tarapacá", zip: "1100000", cities: ["Iquique", "Alto Hospicio", "Pozo Almonte", "Pica", "Huara", "Camiña", "Colchane"] },
    { name: "Antofagasta", zip: "1200000", cities: ["Antofagasta", "Mejillones", "Taltal", "Calama", "San Pedro de Atacama", "Tocopilla", "María Elena"] },
    { name: "Atacama", zip: "1300000", cities: ["Copiapó", "Caldera", "Tierra Amarilla", "Vallenar", "Huasco", "Freirina", "Chañaral", "Diego de Almagro"] },
    { name: "Coquimbo", zip: "1700000", cities: ["La Serena", "Coquimbo", "Vicuña", "Andacollo", "Paihuano", "Illapel", "Los Vilos", "Salamanca", "Ovalle", "Combarbalá", "Monte Patria", "Punitaqui", "Río Hurtado"] },
    { name: "Valparaíso", zip: "2100000", cities: ["Valparaíso", "Viña del Mar", "Concón", "Quilpué", "Villa Alemana", "Casablanca", "Quillota", "San Antonio", "Los Andes", "San Felipe", "La Calera", "Limache", "Cartagena", "El Quisco", "Algarrobo", "Zapallar"] },
    { name: "Metropolitana de Santiago", zip: "8300000", cities: ["Santiago", "Providencia", "Las Condes", "Ñuñoa", "La Florida", "Puente Alto", "Maipú", "Peñalolén", "Vitacura", "Lo Barnechea", "La Reina", "San Miguel", "Macul", "Independencia", "Recoleta", "Conchalí", "Quilicura", "Renca", "Pudahuel", "Estación Central", "La Cisterna", "San Bernardo", "Colina", "Lampa", "Melipilla", "Talagante", "Peñaflor", "Buin", "Paine"] },
    { name: "Libertador General Bernardo O'Higgins", zip: "2800000", cities: ["Rancagua", "Rengo", "San Fernando", "Santa Cruz", "Chimbarongo", "Machalí", "Graneros", "Codegua", "Requínoa", "Pichilemu", "Las Cabras", "Peumo", "San Vicente de Tagua Tagua", "Navidad", "Peralillo"] },
    { name: "Maule", zip: "3400000", cities: ["Talca", "Curicó", "Linares", "Constitución", "Cauquenes", "Molina", "San Javier", "Maule", "San Clemente", "Parral", "Curepto", "Teno", "Romeral", "Colbún", "Yerbas Buenas"] },
    { name: "Ñuble", zip: "3800000", cities: ["Chillán", "Chillán Viejo", "San Carlos", "Bulnes", "Quirihue", "Coihueco", "Yungay", "Pemuco", "El Carmen", "San Ignacio", "Ninhue", "Portezuelo", "Ñiquén", "San Fabián"] },
    { name: "Biobío", zip: "4000000", cities: ["Concepción", "Talcahuano", "Hualpén", "San Pedro de la Paz", "Chiguayante", "Coronel", "Lota", "Tomé", "Penco", "Los Ángeles", "Santa Bárbara", "Arauco", "Lebu", "Curanilahue", "Cañete", "Nacimiento", "Mulchén", "Laja", "Cabrero", "Yumbel", "Hualqui", "Florida", "Santa Juana"] },
    { name: "La Araucanía", zip: "4700000", cities: ["Temuco", "Padre Las Casas", "Villarrica", "Pucón", "Angol", "Victoria", "Lautaro", "Nueva Imperial", "Carahue", "Pitrufquén", "Gorbea", "Freire", "Traiguén", "Collipulli", "Curacautín", "Loncoche", "Toltén", "Cunco"] },
    { name: "Los Ríos", zip: "5100000", cities: ["Valdivia", "La Unión", "Río Bueno", "Panguipulli", "Los Lagos", "Paillaco", "Futrono", "Lanco", "Máfil", "Corral", "Mariquina", "Lago Ranco"] },
    { name: "Los Lagos", zip: "5400000", cities: ["Puerto Montt", "Osorno", "Puerto Varas", "Castro", "Ancud", "Quellón", "Calbuco", "Frutillar", "Llanquihue", "Purranque", "Río Negro", "Chonchi", "Quemchi", "Dalcahue", "Maullín", "Los Muermos"] },
    { name: "Aysén del General Carlos Ibáñez del Campo", zip: "6000000", cities: ["Coyhaique", "Puerto Aysén", "Chile Chico", "Cochrane", "Puerto Cisnes", "Melinka", "Tortel", "Villa O'Higgins", "Lago Verde", "Guaitecas"] },
    { name: "Magallanes y de la Antártica Chilena", zip: "6200000", cities: ["Punta Arenas", "Puerto Natales", "Porvenir", "Puerto Williams", "Cerro Castillo"] },
  ],
  Argentina: [
    { name: "Argentina", cities: ["Buenos Aires", "Córdoba", "Rosario", "Mendoza", "La Plata", "Mar del Plata", "Salta", "San Miguel de Tucumán", "Neuquén", "San Carlos de Bariloche", "Ushuaia", "Santa Fe", "Corrientes", "Posadas", "San Juan"] },
  ],
  Perú: [
    { name: "Perú", cities: ["Lima", "Arequipa", "Trujillo", "Chiclayo", "Piura", "Iquitos", "Cusco", "Huancayo", "Pucallpa", "Tacna", "Chimbote", "Ica"] },
  ],
  Bolivia: [
    { name: "Bolivia", cities: ["La Paz", "Santa Cruz de la Sierra", "Cochabamba", "Sucre", "Oruro", "Potosí", "Tarija", "El Alto"] },
  ],
  Colombia: [
    { name: "Colombia", cities: ["Bogotá", "Medellín", "Cali", "Barranquilla", "Cartagena", "Bucaramanga", "Pereira", "Cúcuta"] },
  ],
  México: [
    { name: "México", cities: ["Ciudad de México", "Guadalajara", "Monterrey", "Puebla", "Tijuana", "León", "Querétaro", "Cancún", "Mérida", "Veracruz"] },
  ],
  Ecuador: [
    { name: "Ecuador", cities: ["Quito", "Guayaquil", "Cuenca", "Ambato", "Machala", "Manta", "Loja"] },
  ],
  España: [
    { name: "España", cities: ["Madrid", "Barcelona", "Valencia", "Sevilla", "Bilbao", "Málaga", "Zaragoza", "Granada"] },
  ],
  "Estados Unidos": [
    { name: "Estados Unidos", cities: ["Nueva York", "Los Ángeles", "Miami", "Houston", "Chicago", "Dallas", "San Francisco", "Seattle", "Boston", "Atlanta"] },
  ],
  Brasil: [
    { name: "Brasil", cities: ["São Paulo", "Río de Janeiro", "Brasilia", "Salvador", "Curitiba", "Belo Horizonte", "Porto Alegre", "Fortaleza"] },
  ],
  Uruguay: [
    { name: "Uruguay", cities: ["Montevideo", "Punta del Este", "Salto", "Paysandú", "Colonia del Sacramento"] },
  ],
};

export interface AddressSuggestion {
  city: string;
  region: string;
  country: string;
  label: string;
}

/** Calles conocidas de la zona (Temuco / Padre Las Casas) para autocompletar. */
const STREETS: Array<{ street: string; city: string; region: string }> = [
  { street: "Mac Iver", city: "Temuco", region: "La Araucanía" },
  { street: "San Ramón", city: "Padre Las Casas", region: "La Araucanía" },
  { street: "Av. San Ramón", city: "Padre Las Casas", region: "La Araucanía" },
  { street: "Eleuterio Ramírez", city: "Padre Las Casas", region: "La Araucanía" },
  { street: "Bilbao", city: "Padre Las Casas", region: "La Araucanía" },
  { street: "Manuel Rodríguez", city: "Padre Las Casas", region: "La Araucanía" },
  { street: "Manuel Montt", city: "Temuco", region: "La Araucanía" },
  { street: "Av. Manuel Montt", city: "Temuco", region: "La Araucanía" },
  { street: "Claro Solar", city: "Temuco", region: "La Araucanía" },
  { street: "Portales", city: "Temuco", region: "La Araucanía" },
  { street: "Vicuña Mackenna", city: "Temuco", region: "La Araucanía" },
  { street: "Av. Pedro de Valdivia", city: "Temuco", region: "La Araucanía" },
  { street: "Prieto Norte", city: "Temuco", region: "La Araucanía" },
  { street: "Prieto Sur", city: "Temuco", region: "La Araucanía" },
  { street: "Caupolicán", city: "Temuco", region: "La Araucanía" },
  { street: "Av. Caupolicán", city: "Temuco", region: "La Araucanía" },
  { street: "Balmaceda", city: "Temuco", region: "La Araucanía" },
  { street: "Barros Arana", city: "Temuco", region: "La Araucanía" },
  { street: "Lautaro", city: "Temuco", region: "La Araucanía" },
  { street: "San Martín", city: "Temuco", region: "La Araucanía" },
  { street: "Aldunate", city: "Temuco", region: "La Araucanía" },
  { street: "Bulnes", city: "Temuco", region: "La Araucanía" },
  { street: "General Cruz", city: "Temuco", region: "La Araucanía" },
  { street: "Arturo Prat", city: "Temuco", region: "La Araucanía" },
  { street: "Av. Alemania", city: "Temuco", region: "La Araucanía" },
  { street: "Av. Arturo Prat", city: "Temuco", region: "La Araucanía" },
];

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function capitalizeWords(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .map((word) => (word.length > 1 ? word[0].toUpperCase() + word.slice(1) : word.toUpperCase()))
    .join(" ");
}

function findCityForm(term: string): string | null {
  const normalized = normalize(term);
  for (const regions of Object.values(REGIONS_BY_COUNTRY)) {
    for (const region of regions) {
      for (const city of region.cities) {
        if (normalize(city) === normalized) return city;
      }
    }
  }
  return null;
}

/** Sugerencias de dirección completa: calle + comuna o ciudad/comuna. */
export function suggestAddresses(query: string, country?: string): AddressSuggestion[] {
  const full = query.trim();
  const term = normalize(full);
  if (term.length < 2) return [];

  const parts = full.split(",").map((part) => part.trim()).filter(Boolean);
  const hasComma = parts.length > 1;
  const streetInput = hasComma ? parts[0] : "";
  const placeInput = hasComma ? parts.slice(1).join(", ") : full;

  const streetTerm = normalize(streetInput);
  const placeTerm = normalize(placeInput);

  const seen = new Set<string>();
  const results: AddressSuggestion[] = [];

  const push = (label: string, city: string, region: string, countryName: string) => {
    const key = normalize(label);
    if (seen.has(key)) return;
    seen.add(key);
    results.push({ city, region, country: countryName, label });
  };

  // 1. Sugerencias de calle cuando hay un texto antes de la coma (o una calle solita).
  if (hasComma ? streetTerm.length >= 2 : term.length >= 3) {
    const streetMatches = STREETS.filter(
      (street) =>
        normalize(street.street).includes(streetTerm) ||
        streetTerm.includes(normalize(street.street)),
    );

    const numberMatch = full.match(/\d+/);
    const streetNumber = numberMatch ? ` ${numberMatch[0]}` : "";

    for (const street of streetMatches) {
      const countryName = country ?? "Chile";
      const placeForm =
        hasComma && placeTerm.length >= 2
          ? findCityForm(placeInput) ?? capitalizeWords(placeInput)
          : street.city;
      const regionForm = hasComma && placeTerm.length >= 2 ? "" : street.region;

      const label =
        hasComma
          ? `${street.street}${streetNumber}, ${placeForm}${regionForm ? `, ${regionForm}` : ""}${countryName ? `, ${countryName}` : ""}`
          : `${street.street}${streetNumber}, ${street.city}, ${street.region}, ${countryName}`;

      push(label, street.city, regionForm || street.region, countryName);
    }
  }

  // 2. Sugerencias de ciudad/comuna.
  const candidates = country
    ? (REGIONS_BY_COUNTRY[country] ?? [])
    : Object.values(REGIONS_BY_COUNTRY).flat();

  if (placeTerm.length >= 2) {
    for (const region of candidates) {
      for (const city of region.cities) {
        const haystack = normalize(`${city} ${region.name} ${city}`);
        if (!haystack.includes(placeTerm)) continue;

        const countryName = country ?? findCountryByRegion(region.name) ?? "";
        push(`${city}, ${region.name}${countryName ? `, ${countryName}` : ""}`, city, region.name, countryName);

        if (results.length >= 8) break;
      }
      if (results.length >= 8) break;
    }
  }

  return results.slice(0, 8);
}

function findCountryByRegion(regionName: string): string | undefined {
  for (const [country, regions] of Object.entries(REGIONS_BY_COUNTRY)) {
    if (regions.some((region) => region.name === regionName)) return country;
  }
  return undefined;
}
