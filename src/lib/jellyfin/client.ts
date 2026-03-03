import type {
  JellyfinAuthenticationResult,
  JellyfinUser,
  JellyfinItemsResponse,
  JellyfinPlaybackInfoResponse,
  JellyfinBaseItem,
} from "@/types/jellyfin";

const BASE_URL = process.env.NEXT_PUBLIC_JELLYFIN_URL ?? "";
const API_KEY = process.env.JELLYFIN_API_KEY ?? "";
const CLIENT_NAME = "NEMO";
const DEVICE_ID = "nemo-web-v1";

/** Header X-Emby-Authorization : doit commencer par "MediaBrowser" (requis par Jellyfin pour request.App). */
function getHeaders(accessToken?: string, useApiKey?: boolean): HeadersInit {
  const token =
    accessToken ?? (useApiKey && API_KEY ? API_KEY : undefined);
  const parts = [
    `Client="${CLIENT_NAME}"`,
    `Device="Web"`,
    `DeviceId="${DEVICE_ID}"`,
    `Version="1.0"`,
    ...(token ? [`Token="${token}"`] : []),
  ];
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    "X-Emby-Authorization": `MediaBrowser ${parts.join(", ")}`,
  };
  return headers;
}

async function jellyfinFetch<T>(
  path: string,
  options: RequestInit & { accessToken?: string; useApiKey?: boolean } = {}
): Promise<T> {
  const { accessToken, useApiKey = false, ...init } = options;
  const url = `${BASE_URL.replace(/\/$/, "")}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      ...getHeaders(accessToken, useApiKey),
      ...(init.headers as HeadersInit),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jellyfin API error ${res.status}: ${text || res.statusText}`);
  }
  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

/**
 * Authentification par identifiant / mot de passe.
 * À appeler côté serveur (Route Handler) : ne pas exposer le mot de passe au client.
 */
export async function authenticateByName(
  username: string,
  password: string
): Promise<JellyfinAuthenticationResult> {
  return jellyfinFetch<JellyfinAuthenticationResult>("/Users/AuthenticateByName", {
    method: "POST",
    body: JSON.stringify({ Username: username, Pw: password }),
  });
}

/**
 * Récupère l'utilisateur courant (session valide).
 * À appeler avec le token stocké (cookie) côté serveur.
 */
export async function getCurrentUser(
  accessToken: string
): Promise<JellyfinUser> {
  const res = await jellyfinFetch<JellyfinUser>("/Users/Me", {
    accessToken,
  });
  return res;
}

/**
 * Items déjà vus par l'utilisateur (historique).
 */
export async function getPlayedItems(
  accessToken: string,
  userId: string,
  limit = 100
): Promise<JellyfinItemsResponse> {
  const params = new URLSearchParams({
    UserId: userId,
    Recursive: "true",
    Filters: "IsPlayed",
    SortBy: "DatePlayed",
    SortOrder: "Descending",
    Limit: String(limit),
    Fields: "ProviderIds,UserData,MediaSources",
  });
  return jellyfinFetch<JellyfinItemsResponse>(
    `/Users/${userId}/Items?${params}`,
    { accessToken }
  );
}

/**
 * Items favoris.
 */
export async function getFavoriteItems(
  accessToken: string,
  userId: string,
  limit = 500
): Promise<JellyfinItemsResponse> {
  const params = new URLSearchParams({
    UserId: userId,
    Recursive: "true",
    Filters: "IsFavorite",
    SortBy: "SortName",
    Limit: String(limit),
    Fields: "ProviderIds,UserData",
  });
  return jellyfinFetch<JellyfinItemsResponse>(
    `/Users/${userId}/Items?${params}`,
    { accessToken }
  );
}

/**
 * Items à reprendre (en cours).
 */
export async function getResumeItems(
  accessToken: string,
  userId: string
): Promise<JellyfinItemsResponse> {
  const params = new URLSearchParams({
    UserId: userId,
    Limit: "24",
    Fields: "ProviderIds,UserData",
  });
  return jellyfinFetch<JellyfinItemsResponse>(
    `/Users/${userId}/Items/Resume?${params}`,
    { accessToken }
  );
}

/**
 * Bibliothèque films + séries (pour construire le cache TMDB → Jellyfin).
 */
export async function getLibraryItems(
  accessToken: string,
  userId: string,
  options: { includeTypes?: string[]; limit?: number } = {}
): Promise<JellyfinItemsResponse> {
  const { includeTypes = ["Movie", "Series"], limit = 5000 } = options;
  const params = new URLSearchParams({
    UserId: userId,
    Recursive: "true",
    IncludeItemTypes: includeTypes.join(","),
    Limit: String(limit),
    Fields: "ProviderIds,MediaSources",
  });
  return jellyfinFetch<JellyfinItemsResponse>(
    `/Users/${userId}/Items?${params}`,
    { accessToken }
  );
}

/**
 * Infos de lecture pour un item (URL de stream HLS ou direct).
 */
export async function getPlaybackInfo(
  accessToken: string,
  itemId: string,
  userId: string
): Promise<JellyfinPlaybackInfoResponse> {
  const body = {
    DeviceProfile: {
      MaxStreamingBitrate: 120_000_000,
      MaxStaticBitrate: 0,
      MusicStreamingTranscodingBitrate: 128000,
      TranscodingProfiles: [],
      DirectPlayProfiles: [
        { Container: "mp4", Type: "Video" },
        { Container: "mkv", Type: "Video" },
        { Container: "webm", Type: "Video" },
      ],
      SubtitleProfiles: [],
    },
  };
  const res = await jellyfinFetch<JellyfinPlaybackInfoResponse>(
    `/Items/${itemId}/PlaybackInfo?UserId=${userId}`,
    {
      method: "POST",
      accessToken,
      body: JSON.stringify(body),
    }
  );
  return res;
}

/**
 * Vérifie si le serveur Jellyfin est configuré (URL).
 */
export function isJellyfinConfigured(): boolean {
  return BASE_URL.startsWith("http");
}

/**
 * Vérifie si une clé API Jellyfin est configurée (dashboard Admin → API Keys).
 * Utile pour les opérations serveur sans session utilisateur (ex. cache bibliothèque).
 */
export function isJellyfinApiKeyConfigured(): boolean {
  return typeof API_KEY === "string" && API_KEY.length > 0;
}

// ─── Client dynamique (serveur Jellyfin personnel) ────────────────────────────

/**
 * Crée un client Jellyfin pointant sur un serveur arbitraire.
 * À utiliser pour les serveurs Jellyfin personnels des utilisateurs
 * (URL stockée dans profiles.personal_jellyfin_url).
 */
export function createJellyfinClient(serverUrl: string) {
  const base = serverUrl.replace(/\/$/, "");

  function buildHeaders(accessToken?: string): HeadersInit {
    const parts = [
      `Client="${CLIENT_NAME}"`,
      `Device="Web"`,
      `DeviceId="${DEVICE_ID}"`,
      `Version="1.0"`,
      ...(accessToken ? [`Token="${accessToken}"`] : []),
    ];
    return {
      "Content-Type": "application/json",
      "X-Emby-Authorization": `MediaBrowser ${parts.join(", ")}`,
    };
  }

  async function apiFetch<T>(
    path: string,
    options: RequestInit & { accessToken?: string } = {}
  ): Promise<T> {
    const { accessToken, ...init } = options;
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: { ...buildHeaders(accessToken), ...(init.headers as HeadersInit) },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Jellyfin API error ${res.status}: ${text || res.statusText}`);
    }
    if (res.status === 204 || res.headers.get("content-length") === "0") {
      return undefined as T;
    }
    return res.json() as Promise<T>;
  }

  return {
    serverUrl: base,

    authenticateByName(username: string, password: string) {
      return apiFetch<JellyfinAuthenticationResult>("/Users/AuthenticateByName", {
        method: "POST",
        body: JSON.stringify({ Username: username, Pw: password }),
      });
    },

    getResumeItems(accessToken: string, userId: string) {
      const params = new URLSearchParams({
        UserId: userId,
        Limit: "24",
        Fields: "ProviderIds,UserData,ImageTags",
      });
      return apiFetch<JellyfinItemsResponse>(
        `/Users/${userId}/Items/Resume?${params}`,
        { accessToken }
      );
    },

    getPlayedItems(accessToken: string, userId: string, limit = 200) {
      const params = new URLSearchParams({
        UserId: userId,
        Recursive: "true",
        Filters: "IsPlayed",
        SortBy: "DatePlayed",
        SortOrder: "Descending",
        Limit: String(limit),
        Fields: "ProviderIds,UserData,ImageTags",
      });
      return apiFetch<JellyfinItemsResponse>(
        `/Users/${userId}/Items?${params}`,
        { accessToken }
      );
    },

    getLibraryItems(accessToken: string, userId: string, limit = 2000) {
      const params = new URLSearchParams({
        UserId: userId,
        Recursive: "true",
        IncludeItemTypes: "Movie,Series",
        Limit: String(limit),
        Fields: "ProviderIds,UserData,ImageTags,Overview",
        SortBy: "SortName",
        SortOrder: "Ascending",
      });
      return apiFetch<JellyfinItemsResponse>(
        `/Users/${userId}/Items?${params}`,
        { accessToken }
      );
    },

    getPlaybackInfo(accessToken: string, itemId: string, userId: string) {
      const body = {
        DeviceProfile: {
          MaxStreamingBitrate: 120_000_000,
          TranscodingProfiles: [
            {
              Container: "ts",
              Type: "Video",
              Protocol: "hls",
              AudioCodec: "aac",
              VideoCodec: "h264",
              MaxAudioChannels: "6",
            },
          ],
          DirectPlayProfiles: [
            { Container: "mp4", Type: "Video" },
            { Container: "mkv", Type: "Video" },
            { Container: "webm", Type: "Video" },
          ],
          SubtitleProfiles: [
            { Format: "vtt", Method: "External" },
            { Format: "srt", Method: "External" },
            { Format: "ass", Method: "External" },
          ],
        },
      };
      return apiFetch<JellyfinPlaybackInfoResponse>(
        `/Items/${itemId}/PlaybackInfo?UserId=${userId}`,
        { method: "POST", accessToken, body: JSON.stringify(body) }
      );
    },

    /** Récupère un item avec UserData (position de reprise, etc.). */
    getUserItem(accessToken: string, userId: string, itemId: string) {
      return apiFetch<JellyfinBaseItem>(
        `/Users/${userId}/Items/${itemId}?Fields=UserData,MediaStreams`,
        { accessToken }
      );
    },

    /** URL de l'image principale d'un item. */
    imageUrl(itemId: string, maxWidth = 400): string {
      return `${base}/Items/${itemId}/Images/Primary?maxWidth=${maxWidth}&quality=90`;
    },
  };
}
