/**
 * Catalogue statique des services de streaming.
 * Ordre : du plus connu/utilisé au moins connu, centré sur la France.
 * Les IDs correspondent exactement aux IDs de la Streaming Availability API.
 */
export interface ServiceCatalogEntry {
  id: string;
  name: string;
  color: string;
}

export const STREAMING_SERVICES_CATALOG: ServiceCatalogEntry[] = [
  { id: "netflix",      name: "Netflix",           color: "#E50914" },
  { id: "prime",        name: "Prime Video",        color: "#00A8E1" },
  { id: "disney",       name: "Disney+",            color: "#113CCF" },
  { id: "apple",        name: "Apple TV+",          color: "#555555" },
  { id: "canal",        name: "Canal+",             color: "#1A1A1A" },
  { id: "hbo",          name: "Max",                color: "#002BE7" },
  { id: "paramount",    name: "Paramount+",         color: "#0064FF" },
  { id: "ocs",          name: "OCS",                color: "#E4001B" },
  { id: "crunchyroll",  name: "Crunchyroll",        color: "#F47521" },
  { id: "mubi",         name: "MUBI",               color: "#34373B" },
  { id: "arte",         name: "Arte",               color: "#EA3F07" },
  { id: "france_tv",    name: "France.tv",          color: "#004494" },
  { id: "youtube",      name: "YouTube Premium",    color: "#FF0000" },
  { id: "peacock",      name: "Peacock",            color: "#000000" },
  { id: "hulu",         name: "Hulu",               color: "#1CE783" },
  { id: "starz",        name: "Starz",              color: "#1D1D1D" },
  { id: "showtime",     name: "Showtime",           color: "#C8002F" },
  { id: "bbc_iplayer",  name: "BBC iPlayer",        color: "#FF4E84" },
  { id: "britbox",      name: "BritBox",            color: "#0E1B3D" },
  { id: "stan",         name: "Stan",               color: "#0D72ED" },
  { id: "now",          name: "Now",                color: "#3BE8B0" },
  { id: "wow",          name: "WOW",                color: "#C30C6E" },
  { id: "crave",        name: "Crave",              color: "#5500D4" },
  { id: "all4",         name: "All 4",              color: "#00D7B5" },
  { id: "hotstar",      name: "Hotstar",            color: "#1F80E0" },
  { id: "zee5",         name: "ZEE5",               color: "#6B00A8" },
];

export const ALL_SERVICE_IDS = STREAMING_SERVICES_CATALOG.map((s) => s.id);

export function getServiceById(id: string): ServiceCatalogEntry | undefined {
  return STREAMING_SERVICES_CATALOG.find((s) => s.id === id);
}
