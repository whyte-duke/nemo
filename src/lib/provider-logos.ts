/**
 * Source unique pour l'affichage des providers (streaming, import, hubs).
 * Logos via Simple Icons CDN : https://cdn.simpleicons.org/{slug} (couleur de marque)
 * ou https://cdn.simpleicons.org/{slug}/{hex} (couleur forcée).
 * Slugs vérifiés via https://github.com/simple-icons/simple-icons/blob/develop/slugs.md
 * Quand pas de slug (ex. Prime Video retiré de simple-icons), fallback sur initiales.
 */

export interface ProviderLogoConfig {
  /** Slug Simple Icons (lowercase, ex: netflix, disneyplus). Ignoré si customImageUrl est défini. */
  simpleIconSlug: string | null;
  /** URL d’image personnalisée (logo non dispo sur Simple Icons). Prioritaire sur simpleIconSlug. */
  customImageUrl?: string | null;
  /** Nom affiché (ex: "Netflix", "Disney+") */
  name: string;
  /** Couleur brand hex (ex: "#E50914") */
  color: string;
}

/** URLs de logos personnalisés (non disponibles sur Simple Icons). Domaines autorisés dans next.config. */
const CUSTOM_LOGO_URLS = {
  disneyPlus:
    "https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/0cd82ff4-fa94-4020-9a16-f41089efc593/dd5d95n-46013979-82a8-4fae-ac31-fd4865a8d99d.png/v1/fill/w_880,h_908/disney__app_design_by_kiofficialart_by_kiofficialart_dd5d95n-pre.png?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7ImhlaWdodCI6Ijw9MzMzMSIsInBhdGgiOiIvZi8wY2Q4MmZmNC1mYTk0LTQwMjAtOWExNi1mNDEwODllZmM1OTMvZGQ1ZDk1bi00NjAxMzk3OS04MmE4LTRmYWUtYWMzMS1mZDQ4NjVhOGQ5OWQucG5nIiwid2lkdGgiOiI8PTMyMjcifV1dLCJhdWQiOlsidXJuOnNlcnZpY2U6aW1hZ2Uub3BlcmF0aW9ucyJdfQ.vADCTmTOrAUOESNZTwibkdwKKNrRmoqR9E3pCa3UTTc",
  amazonPrime: "https://img.icons8.com/?size=100&id=Rs68BrhxH0XZ&format=png&color=000000",
  canalPlus: "https://images.seeklogo.com/logo-png/36/1/canal-logo-png_seeklogo-360525.png",
  ocs: "https://upload.wikimedia.org/wikipedia/fr/1/1e/OCS.svg",
} as const;

/** Hub slug (URL) → config logo. Utilisé par HubContent, MediaRow, etc. */
const BY_HUB_SLUG: Record<string, ProviderLogoConfig> = {
  netflix: { simpleIconSlug: "netflix", name: "Netflix", color: "#E50914" },
  "apple-tv": { simpleIconSlug: "appletv", name: "Apple TV+", color: "#000000" },
  "canal-plus": { simpleIconSlug: null, customImageUrl: CUSTOM_LOGO_URLS.canalPlus, name: "Canal+", color: "#1A1A1A" },
  "disney-plus": { simpleIconSlug: null, customImageUrl: CUSTOM_LOGO_URLS.disneyPlus, name: "Disney+", color: "#113CCF" },
  "disney+": { simpleIconSlug: null, customImageUrl: CUSTOM_LOGO_URLS.disneyPlus, name: "Disney+", color: "#113CCF" },
  disney: { simpleIconSlug: null, customImageUrl: CUSTOM_LOGO_URLS.disneyPlus, name: "Disney+", color: "#113CCF" },
  amazon: { simpleIconSlug: null, customImageUrl: CUSTOM_LOGO_URLS.amazonPrime, name: "Amazon Prime Video", color: "#00A8E1" },
  ocs: { simpleIconSlug: null, customImageUrl: CUSTOM_LOGO_URLS.ocs, name: "OCS", color: "#E4001B" },
  paramount: { simpleIconSlug: "paramountplus", name: "Paramount+", color: "#0064FF" },
  max: { simpleIconSlug: "hbomax", name: "Max", color: "#002BE7" },
};

/** ID catalogue streaming (streaming-services-catalog) → config. Utilisé par StepServices, etc. */
const BY_CATALOG_ID: Record<string, ProviderLogoConfig> = {
  netflix: { simpleIconSlug: "netflix", name: "Netflix", color: "#E50914" },
  prime: { simpleIconSlug: null, customImageUrl: CUSTOM_LOGO_URLS.amazonPrime, name: "Prime Video", color: "#00A8E1" },
  disney: { simpleIconSlug: null, customImageUrl: CUSTOM_LOGO_URLS.disneyPlus, name: "Disney+", color: "#113CCF" },
  apple: { simpleIconSlug: "appletv", name: "Apple TV+", color: "#555555" },
  canal: { simpleIconSlug: null, customImageUrl: CUSTOM_LOGO_URLS.canalPlus, name: "Canal+", color: "#1A1A1A" },
  hbo: { simpleIconSlug: "hbomax", name: "Max", color: "#002BE7" },
  paramount: { simpleIconSlug: "paramountplus", name: "Paramount+", color: "#0064FF" },
  ocs: { simpleIconSlug: null, customImageUrl: CUSTOM_LOGO_URLS.ocs, name: "OCS", color: "#E4001B" },
  crunchyroll: { simpleIconSlug: "crunchyroll", name: "Crunchyroll", color: "#F47521" },
  mubi: { simpleIconSlug: "mubi", name: "MUBI", color: "#34373B" },
  arte: { simpleIconSlug: null, name: "Arte", color: "#EA3F07" },
  france_tv: { simpleIconSlug: null, name: "France.tv", color: "#004494" },
  youtube: { simpleIconSlug: "youtube", name: "YouTube Premium", color: "#FF0000" },
  peacock: { simpleIconSlug: "peacock", name: "Peacock", color: "#000000" },
  hulu: { simpleIconSlug: "hulu", name: "Hulu", color: "#1CE783" },
  starz: { simpleIconSlug: "starz", name: "Starz", color: "#1D1D1D" },
  showtime: { simpleIconSlug: "showtime", name: "Showtime", color: "#C8002F" },
  bbc_iplayer: { simpleIconSlug: "bbciplayer", name: "BBC iPlayer", color: "#FF4E84" },
  britbox: { simpleIconSlug: "britbox", name: "BritBox", color: "#0E1B3D" },
  stan: { simpleIconSlug: "stan", name: "Stan", color: "#0D72ED" },
  now: { simpleIconSlug: null, name: "Now", color: "#3BE8B0" },
  wow: { simpleIconSlug: null, name: "WOW", color: "#C30C6E" },
  crave: { simpleIconSlug: null, name: "Crave", color: "#5500D4" },
  all4: { simpleIconSlug: null, name: "All 4", color: "#00D7B5" },
  hotstar: { simpleIconSlug: "hotstar", name: "Hotstar", color: "#1F80E0" },
  zee5: { simpleIconSlug: "zee5", name: "ZEE5", color: "#6B00A8" },
};

/** Sources d'import onboarding (StepImport, StepDone) */
const BY_IMPORT_SOURCE: Record<string, ProviderLogoConfig> = {
  netflix: { simpleIconSlug: "netflix", name: "Netflix", color: "#E50914" },
  letterboxd: { simpleIconSlug: "letterboxd", name: "Letterboxd", color: "#00C030" },
  trakt: { simpleIconSlug: "trakt", name: "Trakt.tv", color: "#ED1C24" },
};

/** TMDb provider id (watch/providers) → config. Pour cohérence avec types/tmdb WATCH_PROVIDERS. */
const BY_TMDB_ID: Record<number, ProviderLogoConfig> = {
  8: { simpleIconSlug: "netflix", name: "Netflix", color: "#E50914" },
  350: { simpleIconSlug: "appletv", name: "Apple TV+", color: "#000000" },
  381: { simpleIconSlug: null, customImageUrl: CUSTOM_LOGO_URLS.canalPlus, name: "Canal+", color: "#000000" },
  337: { simpleIconSlug: null, customImageUrl: CUSTOM_LOGO_URLS.disneyPlus, name: "Disney+", color: "#113CCF" },
  119: { simpleIconSlug: null, customImageUrl: CUSTOM_LOGO_URLS.amazonPrime, name: "Amazon Prime Video", color: "#00A8E1" },
  56: { simpleIconSlug: null, customImageUrl: CUSTOM_LOGO_URLS.ocs, name: "OCS", color: "#FF6600" },
  531: { simpleIconSlug: "paramountplus", name: "Paramount+", color: "#0064FF" },
  1899: { simpleIconSlug: "hbomax", name: "Max", color: "#002BE7" },
};

/**
 * Récupère la config logo pour un provider.
 * @param key - Hub slug (netflix, apple-tv), catalog id (netflix, prime), import source (netflix, letterboxd), ou TMDb provider id (8, 350)
 */
export function getProviderLogoConfig(
  key: string | number
): ProviderLogoConfig | undefined {
  if (typeof key === "number") {
    return BY_TMDB_ID[key];
  }
  const k = key.toLowerCase().replace(/\s+/g, "-").trim();
  return BY_HUB_SLUG[k] ?? BY_CATALOG_ID[k] ?? BY_IMPORT_SOURCE[k];
}

/**
 * URL du logo Simple Icons.
 * @param slug - Slug simple-icons (ex: netflix, paramountplus).
 * @param color - Si absent ou null, le CDN renvoie le SVG avec la couleur de marque officielle.
 *                Sinon hex sans # (ex: ffffff) pour forcer la couleur.
 */
export function getSimpleIconUrl(slug: string, color?: string | null): string {
  if (color == null || color === "") {
    return `https://cdn.simpleicons.org/${slug}`;
  }
  const hex = color.replace("#", "");
  return `https://cdn.simpleicons.org/${slug}/${hex}`;
}

/** Initiales pour fallback quand pas de logo (ex: "Netflix" → "N", "Amazon Prime" → "AP"). */
export function getProviderInitials(name: string, maxLength = 2): string {
  const words = name.replace(/[+—–-]/g, " ").trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] ?? "") + (words[1][0] ?? "").toUpperCase();
  }
  return (name.slice(0, maxLength) ?? "").toUpperCase();
}
