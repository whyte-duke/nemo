import type {
  StremioRawStream,
  StremioStreamsResponse,
  ParsedStream,
  StreamQuality,
  StreamLanguage,
  StreamCodec,
  StreamHDR,
  StreamFusionConfig,
} from "@/types/stremio";

const STREAMFUSION_BASE =
  process.env.NEXT_PUBLIC_STREAMFUSION_BASE ?? "https://stream-fusion.stremiofr.com";

// ─── Encodage de la configuration en Base64 standard ─────────────────────────

export function encodeConfig(config: StreamFusionConfig): string {
  const json = JSON.stringify(config);
  return btoa(unescape(encodeURIComponent(json)));
}

export function buildStreamFusionUrl(
  config: StreamFusionConfig,
  imdbId: string,
  mediaType: "movie" | "series" = "movie"
): string {
  const encodedConfig = encodeConfig(config);
  return `${STREAMFUSION_BASE}/${encodedConfig}/stream/${mediaType}/${imdbId}.json`;
}

// ─── Fetch des flux depuis l'addon Stremio ────────────────────────────────────

export async function fetchStreams(
  imdbId: string,
  config: StreamFusionConfig,
  mediaType: "movie" | "series" = "movie",
  signal?: AbortSignal
): Promise<StremioStreamsResponse> {
  const url = buildStreamFusionUrl(config, imdbId, mediaType);

  const timeoutSignal = AbortSignal.timeout(15_000);
  const combinedSignal = signal
    ? AbortSignal.any([signal, timeoutSignal])
    : timeoutSignal;

  const res = await fetch(url, {
    next: { revalidate: 300 },
    signal: combinedSignal,
  });

  if (!res.ok) {
    throw new Error(`StreamFusion error: ${res.status}`);
  }

  return res.json() as Promise<StremioStreamsResponse>;
}

// ─── Parsing des flux bruts ───────────────────────────────────────────────────

const QUALITY_PATTERNS: Array<[RegExp, StreamQuality]> = [
  [/2160p|4K|UHD/i, "4K"],
  [/1080p/i, "1080p"],
  [/720p/i, "720p"],
  [/480p/i, "480p"],
];

const LANG_PATTERNS: Array<[RegExp, StreamLanguage]> = [
  [/\bMULTI\b/i, "MULTI"],
  [/\bVFF\b/i, "VFF"],
  [/\bVOSTFR\b/i, "VOSTFR"],
  [/\bVF\b/i, "VF"],
  [/🇫🇷/u, "VF"],
  [/\bFRENCH\b/i, "VF"],
  [/\bVO\b/i, "VO"],
  [/🇬🇧/u, "VO"],
];

const CODEC_PATTERNS: Array<[RegExp, StreamCodec]> = [
  [/\bAV1\b/i, "AV1"],
  [/\bHEVC\b|H\.265|H265/i, "HEVC"],
  [/\bH\.264\b|H264|AVC/i, "AVC"],
  [/\bVP9\b/i, "VP9"],
];

const HDR_PATTERNS: Array<[RegExp, StreamHDR]> = [
  [/HDR10\+/i, "HDR10+"],
  [/\bDV\b|Dolby\.?Vision/i, "DV"],
  [/\bHDR10\b/i, "HDR10"],
  [/\bHDR\b/i, "HDR"],
];

function matchFirst<T>(text: string, patterns: Array<[RegExp, T]>): T | null {
  for (const [regex, value] of patterns) {
    if (regex.test(text)) return value;
  }
  return null;
}

function parseSizeFromDescription(text: string): { sizeMb: number | null; sizeLabel: string | null } {
  const gbMatch = text.match(/💾\s*([\d.]+)\s*GB/i) ?? text.match(/([\d.]+)\s*GB/i);
  if (gbMatch) {
    const gb = parseFloat(gbMatch[1]);
    return { sizeMb: Math.round(gb * 1024), sizeLabel: `${gb.toFixed(1)} Go` };
  }
  const mbMatch = text.match(/💾\s*([\d.]+)\s*MB/i) ?? text.match(/([\d.]+)\s*MB/i);
  if (mbMatch) {
    const mb = parseFloat(mbMatch[1]);
    return { sizeMb: Math.round(mb), sizeLabel: `${mb} Mo` };
  }
  return { sizeMb: null, sizeLabel: null };
}

function parseSource(text: string): string | null {
  const sources = [
    "Yggflix", "Yggtorrent", "YGG",
    "Sharewood", "Zilean",
    "Torr9", "1337x", "RARBG", "Jackett",
    "AllDebrid", "RealDebrid",
  ];
  for (const src of sources) {
    if (new RegExp(src, "i").test(text)) return src;
  }
  const match = text.match(/\[([A-Z0-9-]{2,})\]/);
  return match ? match[1] : null;
}

function parseSeeders(text: string): number | null {
  const match = text.match(/👥\s*(\d+)|(\d+)\s*seeders?/i);
  return match ? parseInt(match[1] ?? match[2], 10) : null;
}

export function parseStream(raw: StremioRawStream, index: number): ParsedStream | null {
  const url = raw.url;
  if (!url) return null;

  const allText = [raw.name, raw.title, raw.description].filter(Boolean).join(" ");

  const quality = matchFirst(allText, QUALITY_PATTERNS) ?? "SD";
  const language = matchFirst(allText, LANG_PATTERNS) ?? "VO";
  const codec = matchFirst(allText, CODEC_PATTERNS);
  const hdr = matchFirst(allText, HDR_PATTERNS);
  const { sizeMb, sizeLabel } = parseSizeFromDescription(allText);
  const source = parseSource(allText);
  const seeders = parseSeeders(allText);

  return {
    id: `stream-${index}-${raw.infoHash ?? url.slice(-8)}`,
    name: raw.name ?? "Flux inconnu",
    url,
    quality,
    sizeMb,
    sizeLabel,
    language,
    codec,
    hdr,
    source,
    seeders,
    raw,
  };
}

export function parseStreams(response: StremioStreamsResponse): ParsedStream[] {
  return response.streams
    .map((s, i) => parseStream(s, i))
    .filter((s): s is ParsedStream => s !== null)
    .sort((a, b) => {
      const qualityOrder: StreamQuality[] = ["4K", "1080p", "720p", "480p", "SD"];
      const qa = qualityOrder.indexOf(a.quality);
      const qb = qualityOrder.indexOf(b.quality);
      if (qa !== qb) return qa - qb;
      if (a.sizeMb && b.sizeMb) return b.sizeMb - a.sizeMb;
      return 0;
    });
}

// ─── Configuration StreamFusion par défaut ────────────────────────────────────
// addonHost est remplacé dynamiquement par NEXT_PUBLIC_STREAMFUSION_BASE

export function buildDefaultConfig(): StreamFusionConfig {
  return {
    addonHost: STREAMFUSION_BASE,
    apiKey: process.env.NEXT_PUBLIC_STREAMFUSION_API_KEY ?? "",
    service: ["AllDebrid"],
    RDToken: "",
    ADToken: process.env.NEXT_PUBLIC_ALLDEBRID_TOKEN ?? "",
    TBToken: "",
    PMToken: "",
    TBUsenet: false,
    TBSearch: false,
    maxSize: 150,
    exclusionKeywords: [],
    languages: ["fr"],
    sort: "quality",
    resultsPerQuality: 2,
    maxResults: 5,
    minCachedResults: 10,
    exclusion: ["480p", "cam", "unknown"],
    cacheUrl: "https://stremio-jackett-cacher.elfhosted.com/",
    cache: true,
    zilean: true,
    yggflix: true,
    sharewood: true,
    yggtorrentCtg: true,
    yggflixCtg: false,
    torrenting: false,
    debrid: true,
    metadataProvider: "tmdb",
    debridDownloader: "AllDebrid",
    stremthru: false,
    stremthruUrl: "https://stremthru.stremiofr.com",
    debridlinkApiKey: "",
    easydebridApiKey: "",
    offcloudCredentials: "",
    pikpakCredentials: "",
  };
}
