# Streaming et Lecture Video

> Documentation technique de la fonctionnalite streaming/lecture de Nemo.

---

## Vue d'ensemble

Nemo integre **StreamFusion** (addon Stremio) comme source de flux video. Architecture en trois couches :

```
Page Detail (Film/Serie)
    |
StreamProvider (Context React)
    |
Resolver (src/lib/stremio/resolver.ts)
    |
API StreamFusion (addon distant)
    |
Flux parses --> StreamModal --> VideoPlayer / VLC
```

**Fichiers cles :**

| Fichier | Role |
|---------|------|
| `src/lib/stremio/resolver.ts` | Encodage config, appel StreamFusion, parsing des flux |
| `src/types/stremio.ts` | Types TypeScript (flux, config) |
| `src/providers/stream-provider.tsx` | Context React gerant la resolution |
| `src/app/api/streaming/[imdbId]/route.ts` | Route API disponibilite plateformes legales |
| `src/hooks/use-streaming-availability.ts` | Hook React Query streaming legal |
| `src/hooks/use-streaming-preferences.ts` | Preferences utilisateur |
| `src/components/player/VideoPlayer.tsx` | Lecteur video custom + HLS.js |
| `src/components/player/StreamModal.tsx` | Modal selection de source |
| `src/components/player/WatchModal.tsx` | Modal principal "Comment regarder" |
| `src/components/player/MovieWatchModal.tsx` | Wrapper modal films |
| `src/lib/m3u.ts` | Generation fichiers M3U pour VLC |

---

## Flux de resolution des streams

Chemin : **TMDB ID --> IMDb ID --> StreamFusion --> URL HLS**

### Construction de l'URL StreamFusion

```typescript
export function buildStreamFusionUrl(
  config: StreamFusionConfig,
  imdbId: string,
  mediaType: "movie" | "series" = "movie"
): string {
  const encodedConfig = encodeConfig(config);
  return `${STREAMFUSION_BASE}/${encodedConfig}/stream/${mediaType}/${imdbId}.json`;
}
```

Format : `https://<host>/<config-base64>/stream/<type>/<imdbId>.json`

### Fetch avec timeout

- **Timeout** : 15 secondes (`AbortSignal.timeout(15_000)`)
- **Cache Next.js** : `revalidate: 300` (5 minutes)
- **Signal combine** : Signal utilisateur + timeout via `AbortSignal.any()`

La reponse `StremioStreamsResponse` contient un tableau de `StremioRawStream`, chacun parse par `parseStream()` puis trie par `parseStreams()`.

---

## Parsing de qualite

Le resolver extrait les metadonnees depuis le texte combine (`name + title + description`) de chaque flux brut.

### Qualite video

| Pattern Regex | Resultat |
|---------------|----------|
| `/2160p\|4K\|UHD/i` | `"4K"` |
| `/1080p/i` | `"1080p"` |
| `/720p/i` | `"720p"` |
| `/480p/i` | `"480p"` |
| *(aucun match)* | `"SD"` |

### Langue

| Pattern Regex | Langue |
|---------------|--------|
| `/\bMULTI\b/i` | `"MULTI"` |
| `/\bVFF\b/i` | `"VFF"` |
| `/\bVOSTFR\b/i` | `"VOSTFR"` |
| `/\bVF\b/i`, `/\bFRENCH\b/i`, drapeau FR | `"VF"` |
| `/\bVO\b/i`, drapeau GB | `"VO"` |

### Codec video

| Pattern Regex | Codec |
|---------------|-------|
| `/\bAV1\b/i` | `"AV1"` |
| `/\bHEVC\b\|H\.265\|H265/i` | `"HEVC"` |
| `/\bH\.264\b\|H264\|AVC/i` | `"AVC"` |
| `/\bVP9\b/i` | `"VP9"` |

### HDR

| Pattern Regex | Type HDR |
|---------------|----------|
| `/HDR10\+/i` | `"HDR10+"` |
| `/\bDV\b\|Dolby\.?Vision/i` | `"DV"` |
| `/\bHDR10\b/i` | `"HDR10"` |
| `/\bHDR\b/i` | `"HDR"` |

### Taille du fichier

```typescript
// Gigaoctets -- avec ou sans emoji disquette
/\u{1F4BE}\s*([\d.]+)\s*GB/i  ||  /([\d.]+)\s*GB/i
// Megaoctets
/\u{1F4BE}\s*([\d.]+)\s*MB/i  ||  /([\d.]+)\s*MB/i
```

### Source / Tracker

Sources reconnues : `Yggflix, Yggtorrent, YGG, Sharewood, Zilean, Torr9, 1337x, RARBG, Jackett, AllDebrid, RealDebrid`. Fallback : `/\[([A-Z0-9-]{2,})\]/`.

### Seeders

```typescript
/\u{1F465}\s*(\d+)|(\d+)\s*seeders?/i
```

---

## Encodage de la configuration StreamFusion

```typescript
export function encodeConfig(config: StreamFusionConfig): string {
  const json = JSON.stringify(config);
  return btoa(unescape(encodeURIComponent(json)));
}
```

### Champs principaux de StreamFusionConfig

| Champ | Type | Description |
|-------|------|-------------|
| `addonHost` | `string` | URL de base StreamFusion |
| `apiKey` | `string` | Cle API |
| `service` | `string[]` | Services debrid actifs |
| `ADToken` / `RDToken` | `string` | Tokens AllDebrid / RealDebrid |
| `maxSize` | `number` | Taille max (Go) |
| `languages` | `string[]` | Langues preferees |
| `sort` | `"quality" \| "size" \| "seeders"` | Critere de tri |
| `resultsPerQuality` | `number` | Resultats par qualite |
| `maxResults` | `number` | Max resultats |
| `exclusion` | `string[]` | Qualites exclues |
| `debrid` | `boolean` | Activer debrid |
| `zilean` / `yggflix` / `sharewood` | `boolean` | Sources actives |
| `cache` | `boolean` | Activer le cache |
| `metadataProvider` | `string` | Provider metadonnees (`"tmdb"`) |

Variable d'environnement : `NEXT_PUBLIC_STREAMFUSION_BASE` surcharge l'hote par defaut.

---

## Logique de fallback qualite

Tri dans `parseStreams()` :

1. **Par qualite** (meilleure en premier) : `4K > 1080p > 720p > 480p > SD`
2. **A qualite egale** : par taille decroissante
3. Flux sans URL filtres en amont

La config par defaut exclut `480p`, `cam`, `unknown` via le champ `exclusion`.

---

## Routes API

### GET /api/streaming/[imdbId]

Interroge **Streaming Availability** (RapidAPI) pour les plateformes legales.

| Parametre | Source | Default | Description |
|-----------|--------|---------|-------------|
| `imdbId` | URL path | requis | ID IMDb |
| `country` | Query string | `"fr"` | Code pays ISO |

**Cache** : 1 heure. **Deduplication** : par `service.id + type`.

**Reponse** : `StreamingOption[]` avec :

```typescript
interface StreamingOption {
  service: { id: string; name: string; homePage: string };
  type: "subscription" | "free" | "rent" | "buy" | "addon";
  link: string;
  quality: "sd" | "hd" | "qhd" | "uhd";
  price?: { amount: string; currency: string; formatted: string };
  expiresSoon: boolean;
}
```

---

## Lecteur video

### VideoPlayer (`src/components/player/VideoPlayer.tsx`)

Lecteur custom avec `<video>` natif et HLS.js (pas de Plyr).

**Props** : `url`, `tmdbId?`, `mediaType?`, `title?`, `onBack?`, `startTime?`, `subtitles?`, `audioTracks?`

#### Integration HLS.js

Detection automatique du type d'URL :
1. **HLS + HLS.js supporte** : import dynamique, config ABR (5 Mbps estimation, buffer 60-120s)
2. **HLS + Safari** : lecture native via `canPlayType("application/vnd.apple.mpegurl")`
3. **Direct** : MP4/WebM charge via `videoEl.src`

Qualite HLS : `-1` = auto (ABR), sinon index dans le manifest. Changement via `hls.currentLevel`.

#### Controles clavier

| Touche | Action |
|--------|--------|
| `Espace` / `K` | Play/Pause |
| `Gauche` / `J` | -10s |
| `Droite` / `L` | +10s |
| `Haut` / `Bas` | Volume |
| `M` | Mute |
| `F` | Plein ecran |
| `I` | Picture-in-Picture |

#### Fonctionnalites cles

- **Sauvegarde progression** : toutes les 30s + pause/fin via `useUpdateProgress`
- **Reprise** : prop `startTime` appliquee quand le media est pret
- **Vitesses** : 0.25x a 2x
- **Volume persistant** : `localStorage` (`nemo-volume`)
- **Auto-hide controles** : 3 secondes d'inactivite
- **Recovery HLS** : relance auto sur erreur reseau/media

### StreamModal

Modal de selection de source avec badges colores par qualite/langue. Options : VLC (`vlc://`), navigateur, M3U, telechargement, Jellyfin. Notation post-visionnage (like/dislike).

### WatchModal

Modal combine streaming legal + Jellyfin + sources StreamFusion + lecteur integre.

---

## Hook useStreamingAvailability

```typescript
function useStreamingAvailability(
  imdbId: string | null | undefined,
  country?: string  // default: "fr"
): UseQueryResult<StreamingOption[]>
```

| Option React Query | Valeur | Raison |
|--------------------|--------|--------|
| `enabled` | `!!imdbId` | Pas de fetch sans IMDb ID |
| `staleTime` | 1 heure | Les options changent rarement |
| `retry` | `false` | Evite tentatives multiples |

---

## Hook useStreamingPreferences

```typescript
function useStreamingPreferences(): StreamingPreferences

interface StreamingPreferences {
  services: string[] | null;  // null = tous, sinon IDs selectionnes
  showPaid: boolean;          // Afficher location/achat
  isLoading: boolean;
}
```

`filterStreamingOptions(options, prefs)` filtre par services et masque les options payantes si `showPaid = false`.

---

## StreamProvider et useStream

Context React encapsulant la resolution StreamFusion.

```typescript
interface StreamContextValue {
  state: {
    streams: ParsedStream[];
    isLoading: boolean;
    error: string | null;
    currentImdbId: string | null;
  };
  resolveStreams: (imdbId: string, mediaType?: "movie" | "series") => Promise<void>;
  clearStreams: () => void;
  config: StreamFusionConfig;
}
```

Usage :

```tsx
const { state, resolveStreams } = useStream();
// Lancer la resolution
void resolveStreams(imdbId, "movie");
// Lire l'etat
state.streams / state.isLoading / state.error
```

---

## Generation de fichiers M3U

**Fichier** : `src/lib/m3u.ts`

```typescript
function buildM3UContent(stream: ParsedStream, mediaTitle?: string): string
function downloadM3U(stream: ParsedStream, mediaTitle?: string): void
```

Genere un fichier `.m3u` avec metadonnees (qualite, langue) et declenche le telechargement. Format :

```
#EXTM3U
#EXTINF:-1 tvg-name="Titre" group-title="1080p" language="VF",Titre [1080p] [VF]
https://url-du-flux...
```
