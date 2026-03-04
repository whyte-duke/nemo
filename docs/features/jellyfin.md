# Integration Jellyfin

> Documentation technique de l'integration Jellyfin dans Nemo. Mise a jour : 2026-03-04

## Vue d'ensemble

Nemo permet aux utilisateurs de connecter leur **serveur multimedia personnel Jellyfin** pour :

- Afficher des **badges "disponible"** sur les fiches films/series presentes dans leur bibliotheque Jellyfin.
- **Lire directement** le contenu via un lecteur video integre (HLS ou direct play).
- **Reprendre la lecture** la ou ils se sont arretes, sur n'importe quel appareil.
- Parcourir leur bibliotheque dans un **hub Jellyfin** dedie.

L'integration repose sur deux niveaux :

| Niveau | Description | Donnees |
|--------|-------------|---------|
| **Serveur** (admin) | URL + cle API admin | `jellyfin_servers`, `jellyfin_server_items` |
| **Utilisateur** | Identifiants Jellyfin | `profiles.jellyfin_user_id`, `jellyfin_user_token` |

Le niveau serveur gere la **synchronisation** (quels contenus sont disponibles), le niveau utilisateur gere la **lecture** et la **reprise**.

---

## Architecture

### Deduplication par serveur

Si plusieurs utilisateurs Nemo pointent vers le meme serveur Jellyfin, les items ne sont stockes qu'une seule fois.

```
jellyfin_servers (1 par URL)
  |
  | 1:N
  v
jellyfin_server_items (tmdb_id <-> jellyfin_item_id)
  ^
  |  FK
profiles.personal_jellyfin_server_id
  + jellyfin_user_id / jellyfin_user_token (session utilisateur)
```

### Schema de la base de donnees

**Tables principales** (migration `006_reset_to_supabase_auth.sql`) :

- **`jellyfin_servers`** : `id`, `url` (UNIQUE), `server_name`, `item_count`, `synced_at`. RLS active, acces via service role uniquement.
- **`jellyfin_server_items`** : `id`, `server_id` (FK CASCADE), `jellyfin_item_id`, `tmdb_id`, `media_type` (movie|tv), `synced_at`. Contrainte UNIQUE sur `(server_id, jellyfin_item_id)`. Index sur `(server_id, tmdb_id, media_type)` pour les lookups de badges.
- **`profiles`** (colonnes Jellyfin) : `personal_jellyfin_url`, `personal_jellyfin_api_key`, `personal_jellyfin_server_id` (FK SET NULL), `webhook_token`, `last_library_sync_at`.

**Migration complementaire** (`013_jellyfin_user_session.sql`) :

- `profiles.jellyfin_user_id` : ID utilisateur Jellyfin
- `profiles.jellyfin_user_token` : token d'acces Jellyfin
- `profiles.jellyfin_display_name` : nom affiche

---

## Flux d'authentification

### Etape 1 : Configuration du serveur

L'utilisateur fournit l'URL et la cle API admin dans `/profil/parametres`.

1. `POST /api/jellyfin/test` avec `{ url, apiKey }`
2. Le serveur appelle `GET /System/Info` sur Jellyfin pour valider la connexion
3. Upsert dans `jellyfin_servers` + synchronisation initiale des items
4. Mise a jour du profil avec l'URL, la cle API et le `server_id`

### Etape 2 : Connexion du compte utilisateur

1. `POST /api/jellyfin/user/auth` avec `{ username, password }`
2. Le serveur appelle `POST /Users/AuthenticateByName` sur Jellyfin
3. Le token retourne est stocke dans `profiles.jellyfin_user_token`
4. Deverrouille la lecture, la reprise et l'historique

### Deconnexion

`DELETE /api/jellyfin/user/auth` remet a `null` les colonnes `jellyfin_user_id`, `jellyfin_user_token`, `jellyfin_display_name`.

---

## Synchronisation de la bibliotheque

Code : `src/lib/jellyfin/sync.ts` -- `syncJellyfinServer()`

### Processus

1. `GET /System/Info` -- nom du serveur
2. Upsert `jellyfin_servers` (URL unique)
3. `GET /Items?Recursive=true&IncludeItemTypes=Movie,Series&Fields=ProviderIds` -- jusqu'a 10 000 items
4. Filtrage : seuls les items avec un `ProviderIds.Tmdb` sont indexes
5. Snapshot pagine des IDs existants (batch de 500)
6. Upsert `jellyfin_server_items` par batch de 500
7. Suppression des items absents de Jellyfin
8. Calcul du diff (nouveaux items)
9. Mise a jour stats serveur + liaison profil

### Correspondance TMDB

Chaque item Jellyfin possede un champ `ProviderIds.Tmdb`. Ce mapping permet de croiser les items Jellyfin avec les fiches TMDB de Nemo. Les items sans TMDB ID sont ignores.

### Declencheurs

| Declencheur | Route | Fonction |
|-------------|-------|----------|
| Configuration initiale | `POST /api/jellyfin/test` | `syncJellyfinServer()` |
| Resync manuelle | `POST /api/jellyfin/sync` | `syncJellyfinLibraryForUser()` |
| Webhook automatique | Via `webhook_token` | `syncJellyfinLibraryForUser()` |

---

## Streaming

Route : `GET /api/jellyfin/user/stream/[itemId]`

### Resolution de l'URL

1. Recupere le profil (URL serveur, token, userId)
2. Appels en parallele (`Promise.allSettled`) :
   - `getPlaybackInfo(token, itemId, userId)` -- sources de lecture
   - `getUserItem(token, userId, itemId)` -- position de reprise
3. Priorite de resolution de l'URL :
   - **TranscodingUrl** (HLS) -- compatibilite navigateur maximale
   - **DirectStreamUrl** -- stream direct sans transcodage
   - **Fallback** : `/Videos/{sourceId}/stream?Static=true`

### Profil de lecture

Le client negocie avec Jellyfin via un `DeviceProfile` : HLS h264/aac pour le transcodage, direct play pour mp4/mkv/webm, sous-titres externes vtt/srt/ass.

### Reponse

```json
{
  "url": "https://jellyfin.example.com/Videos/.../master.m3u8",
  "isHls": true,
  "resumePosition": 1234,
  "subtitles": [{ "index": 2, "label": "Francais", "language": "fre", "src": "...", "default": true }],
  "audioTracks": [{ "index": 0, "label": "English DTS", "language": "eng", "codec": "dts", "default": true }]
}
```

---

## Reprise de lecture

Jellyfin stocke la progression via `UserData.PlaybackPositionTicks` (1 tick = 100 ns, 10M ticks = 1 seconde).

Logique : si `PlaybackPositionTicks > 0` et `PlayedPercentage < 95%`, on calcule `resumePosition = ticks / 10_000_000` secondes. Au-dela de 95%, le contenu est considere comme termine.

La route `GET /api/jellyfin/user/resume` retourne les items en cours (endpoint Jellyfin `/Users/{userId}/Items/Resume`, limite 24). Affiches dans le hub avec une barre de progression.

---

## Routes API

Toutes dans `src/app/api/jellyfin/`. Chaque route verifie l'auth Supabase via `getAuthUser()`.

| Route | Methode | Description |
|-------|---------|-------------|
| `/api/jellyfin/test` | POST | Teste la connexion + premiere sync |
| `/api/jellyfin/sync` | POST | Re-synchronise la bibliotheque |
| `/api/jellyfin/library/items` | GET | Tous les items indexes (cache 5 min) |
| `/api/jellyfin/library/check` | GET | Verifie un item TMDB (`?tmdbId=&mediaType=`) |
| `/api/jellyfin/user/auth` | POST | Authentifie un utilisateur Jellyfin |
| `/api/jellyfin/user/auth` | DELETE | Deconnecte le compte Jellyfin |
| `/api/jellyfin/user/stream/[itemId]` | GET | URL de streaming + sous-titres + reprise |
| `/api/jellyfin/user/resume` | GET | Items en cours de lecture |
| `/api/jellyfin/user/history` | GET | Historique des items vus |
| `/api/jellyfin/user/library` | GET | Bibliotheque complete utilisateur |

Les routes `user/*` necessitent un token Jellyfin valide en plus de l'auth Supabase.

---

## Hooks

### `useJellyfinLibraryCheck`

**Fichier :** `src/hooks/use-jellyfin-library.ts`

Lookup O(1) dans le cache en memoire -- aucun appel reseau.

```typescript
function useJellyfinLibraryCheck(
  tmdbId: number,
  mediaType: "movie" | "tv"
): { data: JellyfinLibraryCheck; isLoading: boolean }

// JellyfinLibraryCheck = { inLibrary: boolean; jellyfinItemId?: string; jellyfinItemUrl?: string }
```

Utilise en interne `useJellyfinLibrary()` du contexte pour les fonctions `isInLibrary`, `getJellyfinItemId`, `getJellyfinItemUrl`.

### `useJellyfinAuth` (deprecie)

**Fichier :** `src/hooks/use-jellyfin-auth.ts`

Retourne un objet vide. L'auth Nemo se fait via Supabase Auth.

---

## Contexte et strategie de cache

### `JellyfinLibraryProvider`

**Fichier :** `src/contexts/jellyfin-library-context.tsx`

Charge la totalite de la bibliotheque en memoire et expose des lookups O(1).

### Structures de donnees

| Structure | Type | Cle | Usage |
|-----------|------|-----|-------|
| `librarySet` | `Set<string>` | `"tmdbId:mediaType"` | `Set.has()` pour les badges sur chaque carte media |
| `itemMap` | `Map<string, string>` | `"tmdbId:mediaType"` -> `jellyfinItemId` | Deep-links vers le client web Jellyfin |

Le `Set` permet un lookup O(1) sur les grilles de cartes (potentiellement des centaines a l'ecran). La `Map` n'est consultee que sur les pages de detail.

### Cycle de vie du cache

1. Attente de l'auth Supabase
2. Fetch `GET /api/jellyfin/library/items`
3. Construction `Set` + `Map` a partir des items
4. TTL en memoire : **5 minutes** (`CACHE_TTL_MS`)
5. Meme utilisateur + cache frais : skip le re-fetch
6. Changement d'utilisateur : purge + re-fetch
7. Sync manuelle (`syncLibrary()`) : re-fetch apres succes

### Interface du contexte

```typescript
interface JellyfinLibraryContextValue {
  isInLibrary(tmdbId: number | string, mediaType: "movie" | "tv"): boolean;
  getJellyfinItemId(tmdbId: number | string, mediaType: "movie" | "tv"): string | undefined;
  getJellyfinItemUrl(jellyfinItemId: string): string;
  refreshLibrary(): Promise<void>;
  syncLibrary(): Promise<{ synced?: number; error?: string }>;
  isLoading: boolean;
  isSyncing: boolean;
  count: number;
  hasPersonalJellyfin: boolean;
  jellyfinUrl: string | null;
  lastSyncedAt: string | null;
}
```

### Cache HTTP

La route `/api/jellyfin/library/items` retourne `Cache-Control: private, max-age=300, stale-while-revalidate=600` (5 min frais, 10 min acceptable). Ce cache HTTP se combine avec le TTL en memoire du contexte.
