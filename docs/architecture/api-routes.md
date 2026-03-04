# Routes API

> Derniere mise a jour : 2026-03-04

## Resume rapide

57 endpoints REST groupes par domaine fonctionnel. Authentification via JWT Supabase (`getAuthUser()`). Certaines routes exigent un role minimum (`requireRole("vip")`). Les routes webhook utilisent un token URL.

**Pattern standard :**
```
getAuthUser() -> validation params/body -> query Supabase (admin client) -> NextResponse.json()
```

**Client Supabase :** La majorite des routes utilisent `createAdminClient()` (service role) pour contourner RLS, car l'authentification est verifiee manuellement via `getAuthUser()`.

---

## Index des Routes

| Domaine | Routes | Description |
|---------|--------|-------------|
| [Auth](#auth) | 6 | Session, deconnexion, OAuth Trakt/Letterboxd |
| [Interactions](#interactions) | 3 | Like, dislike, not_interested |
| [Decouverte](#decouverte) | 2 | Cartes swipe, suggestions Film Finder |
| [Amis](#amis) | 9 | Liste amis, recherche, demandes, profil/historique/stats ami |
| [Listes](#listes) | 7 | CRUD listes, items, membres, Ma Liste, Suggestions |
| [Recommandations](#recommandations) | 3 | Recommandations IA, profil de gout, features media |
| [Profil](#profil) | 1 | Lecture/modification profil utilisateur |
| [Historique](#historique) | 3 | Watch history, historique unifie, activite amis |
| [Streaming](#streaming) | 1 | Disponibilite sur plateformes (RapidAPI) |
| [Telechargement](#telechargement) | 4 | Demarrer, file, batch, probe (role VIP) |
| [Import](#import) | 5 | Jellyfin, Letterboxd, Letterboxd ZIP, Netflix CSV, Trakt |
| [Jellyfin](#jellyfin) | 9 | Test serveur, sync, bibliotheque, auth user, stream |
| [Invitations](#invitations) | 3 | Generer, valider, activer un token |
| [Webhooks](#webhooks) | 2 | Download receiver, Jellyfin sync |
| [Dev](#dev) | 1 | Reset onboarding (dev-only) |

---

## Auth

### GET /api/auth/me

- **Auth :** getAuthUserWithName
- **Params :** Aucun
- **Reponse :** `{ user: { id, email, display_name, ... } | null }`
- **Description :** Retourne l'utilisateur connecte avec son nom d'affichage. Retourne `{ user: null }` si non authentifie (pas d'erreur 401).
- **Fichier :** `src/app/api/auth/me/route.ts`

### POST /api/auth/logout

- **Auth :** Aucune (deconnecte la session active)
- **Params :** Aucun
- **Reponse :** `{ ok: true }`
- **Description :** Deconnecte l'utilisateur via `supabase.auth.signOut()`.
- **Fichier :** `src/app/api/auth/logout/route.ts`

### GET /api/auth/trakt

- **Auth :** getAuthUser (401 si absent)
- **Query :** `?return=/path` (optionnel, defaut `/onboarding?step=2`)
- **Reponse :** Redirect 302 vers `https://trakt.tv/oauth/authorize`
- **Description :** Demarre le flux OAuth Trakt. Encode le userId et l'URL de retour dans le `state` en base64url.
- **Fichier :** `src/app/api/auth/trakt/route.ts`

### GET /api/auth/trakt/callback

- **Auth :** getAuthUser (redirect `/connexion` si absent)
- **Query :** `code`, `state`, `error` (fournis par Trakt)
- **Reponse :** Redirect vers URL de retour avec `?connected=trakt`
- **Description :** Callback OAuth Trakt. Echange le code contre des tokens, recupere le profil Trakt, stocke les tokens dans `profiles` via admin client.
- **Fichier :** `src/app/api/auth/trakt/callback/route.ts`

### GET /api/auth/letterboxd

- **Auth :** getAuthUser (401 si absent)
- **Query :** `?return=/path` (optionnel)
- **Reponse :** Redirect 302 vers `https://letterboxd.com/api/v0/auth/authorize`
- **Description :** Demarre le flux OAuth Letterboxd. Meme pattern que Trakt.
- **Fichier :** `src/app/api/auth/letterboxd/route.ts`

### GET /api/auth/letterboxd/callback

- **Auth :** getAuthUser (redirect `/connexion` si absent)
- **Query :** `code`, `state`, `error` (fournis par Letterboxd)
- **Reponse :** Redirect vers URL de retour avec `?connected=letterboxd`
- **Description :** Callback OAuth Letterboxd. Echange le code, recupere le profil membre, stocke les tokens dans `profiles`.
- **Fichier :** `src/app/api/auth/letterboxd/callback/route.ts`

---

## Interactions

### GET /api/interactions

- **Auth :** getAuthUser (401)
- **Query :** `tmdbId` (number), `mediaType` ("movie" | "tv")
- **Reponse :** `{ type: "like" | "dislike" | null }`
- **Description :** Retourne le type d'interaction de l'utilisateur pour un media donne.
- **Fichier :** `src/app/api/interactions/route.ts`

### POST /api/interactions

- **Auth :** getAuthUser (401)
- **Body :** `{ tmdbId: number, mediaType: "movie"|"tv", type: "like"|"dislike"|null, notInterested?: boolean }`
- **Reponse :** `{ ok: true }`
- **Description :** Cree, met a jour ou supprime une interaction. Si `type === null` et pas `notInterested`, supprime. Sinon upsert sur `(user_id, tmdb_id, media_type)`.
- **Fichier :** `src/app/api/interactions/route.ts`

### GET /api/interactions/all

- **Auth :** getAuthUser (401)
- **Params :** Aucun
- **Reponse :** `{ interactions: Record<string, "like"|"dislike"|"not_interested"> }` (cle : `"tmdbId-mediaType"`)
- **Description :** Retourne toutes les interactions de l'utilisateur en un seul appel. Utilise pour pre-charger l'etat des cartes.
- **Fichier :** `src/app/api/interactions/all/route.ts`

### GET /api/interactions/count

- **Auth :** getAuthUser (401)
- **Params :** Aucun
- **Reponse :** `{ count: number }`
- **Description :** Nombre total d'interactions like/dislike de l'utilisateur.
- **Fichier :** `src/app/api/interactions/count/route.ts`

---

## Decouverte

### GET /api/discover/cards

- **Auth :** getAuthUser (401)
- **Query :** `exclude` (optionnel, IDs deja vus cote client, format `"tmdbId-mediaType,..."`)
- **Reponse :** `{ cards: TMDbMovie[] }` (max 25 cartes)
- **Description :** Genere un feed de cartes pour le swipe. Combine 4 buckets ponderes :
  - Affinite (genres favoris du profil de gout) : 9 cartes
  - Exploration (genres inconnus) : 6 cartes
  - Tendances : 6 cartes
  - Qualite (vote_average eleve) : 4 cartes
  Exclut les medias deja interagis, dans l'historique, les imports externes, et la liste Suggestions.
- **Services externes :** TMDB Discover API (films + series)
- **Fichier :** `src/app/api/discover/cards/route.ts`

### POST /api/finder/suggest

- **Auth :** getAuthUser (401)
- **Body :**
  ```json
  {
    "friendIds": ["uuid"],
    "genreIds": [28, 35],
    "minRating": 7.5,
    "onlyJellyfin": false,
    "limit": 5,
    "excludeMovieIds": [123],
    "releaseYearFrom": 2000,
    "releaseYearTo": 2025
  }
  ```
- **Reponse :** `{ movies: [{ id, title, poster_path, backdrop_path, vote_average, vote_count, release_date, overview, inJellyfin? }] }`
- **Description :** Film Finder -- suggestions de films filtrees par genres, note minimum, annees, amis (films non vus par tous), et optionnellement filtres par bibliotheque Jellyfin.
- **Services externes :** TMDB Discover API
- **Fichier :** `src/app/api/finder/suggest/route.ts`

---

## Amis

### GET /api/friends

- **Auth :** getAuthUser (401)
- **Params :** Aucun
- **Reponse :** `FriendProfile[]` avec `{ friendship_id, source, friends_since, id, display_name, avatar_url, role, films_watched }`
- **Description :** Liste tous les amis de l'utilisateur avec leur nombre de films vus.
- **Fichier :** `src/app/api/friends/route.ts`

### GET /api/friends/search

- **Auth :** getAuthUser (401)
- **Query :** `q` (recherche, min 2 caracteres)
- **Reponse :** `[{ id, display_name, avatar_url, role, is_friend, request_pending }]`
- **Description :** Recherche d'utilisateurs par nom d'affichage (ilike). Indique si deja ami ou demande en attente.
- **Fichier :** `src/app/api/friends/search/route.ts`

### GET /api/friends/request

- **Auth :** getAuthUser (401)
- **Params :** Aucun
- **Reponse :** `[{ id, created_at, from: { id, display_name, avatar_url, role } }]`
- **Description :** Liste les demandes d'amitie recues en attente.
- **Fichier :** `src/app/api/friends/request/route.ts`

### POST /api/friends/request

- **Auth :** getAuthUser (401)
- **Body :** `{ toUserId: string }`
- **Reponse :** `{ id: string }` (201) ou erreur
- **Description :** Envoie une demande d'amitie. Verifie que les utilisateurs ne sont pas deja amis. Erreur 400 si demande dupliquee (code 23505).
- **Fichier :** `src/app/api/friends/request/route.ts`

### PATCH /api/friends/request/[id]

- **Auth :** getAuthUser (401)
- **Param URL :** `id` (ID de la demande)
- **Body :** `{ status: "accepted" | "declined" }`
- **Reponse :** `{ id, status }`
- **Description :** Accepte ou refuse une demande d'amitie. Seul le destinataire peut repondre.
- **Fichier :** `src/app/api/friends/request/[id]/route.ts`

### DELETE /api/friends/request/[id]

- **Auth :** getAuthUser (401)
- **Param URL :** `id` (ID de la demande)
- **Reponse :** `{ ok: true }`
- **Description :** Annule sa propre demande d'amitie envoyee.
- **Fichier :** `src/app/api/friends/request/[id]/route.ts`

### GET /api/friends/[userId]/profile

- **Auth :** getAuthUser (401)
- **Param URL :** `userId`
- **Reponse :** `{ id, display_name, avatar_url, role, created_at, is_friend, friends_since, friendship_source, request_pending, request_direction, request_id }`
- **Description :** Profil public d'un utilisateur avec statut de la relation (ami, demande en attente, direction).
- **Fichier :** `src/app/api/friends/[userId]/profile/route.ts`

### GET /api/friends/[userId]/history

- **Auth :** getAuthUser (401)
- **Param URL :** `userId`
- **Reponse :** `[{ tmdb_id, media_type, progress, last_watched_at, title, poster_path }]` (max 50)
- **Description :** Historique de visionnage d'un ami (progress >= 80%). Enrichi avec titres/posters TMDB.
- **Fichier :** `src/app/api/friends/[userId]/history/route.ts`

### GET /api/friends/[userId]/likes

- **Auth :** getAuthUser (401)
- **Param URL :** `userId`
- **Reponse :** `[{ tmdb_id, media_type, created_at, title, poster_path }]` (max 50)
- **Description :** Films/series likes par un ami. Enrichi via TMDB.
- **Fichier :** `src/app/api/friends/[userId]/likes/route.ts`

### GET /api/friends/[userId]/lists

- **Auth :** getAuthUser (401)
- **Param URL :** `userId`
- **Reponse :** `[{ id, name, icon, is_public, item_count }]`
- **Description :** Listes d'un ami avec le nombre d'items dans chacune.
- **Fichier :** `src/app/api/friends/[userId]/lists/route.ts`

### GET /api/friends/[userId]/stats

- **Auth :** getAuthUser (401)
- **Param URL :** `userId`
- **Reponse :** `{ total_watched, total_likes, total_dislikes, total_lists, top_genres: [{ name, count }], recent_watched: [{ tmdb_id, media_type, last_watched_at }] }`
- **Description :** Statistiques d'un ami : totaux, top 5 genres (via enrichissement TMDB), 5 derniers vus.
- **Fichier :** `src/app/api/friends/[userId]/stats/route.ts`

---

## Listes

### GET /api/lists

- **Auth :** getAuthUser (401)
- **Params :** Aucun
- **Reponse :** `ListSummary[]` avec items, membres, role
- **Description :** Toutes les listes dont l'utilisateur est membre (owner ou member). Inclut les items et les profils des membres.
- **Fichier :** `src/app/api/lists/route.ts`

### POST /api/lists

- **Auth :** getAuthUser (401)
- **Body :** `{ name: string, icon?: string, friendIds?: string[] }`
- **Reponse :** `{ id, name, icon, is_default, is_public, created_at }` (201)
- **Description :** Cree une nouvelle liste. Nom max 30 caracteres. Ajoute optionnellement des amis comme membres.
- **Fichier :** `src/app/api/lists/route.ts`

### GET /api/lists/[id]

- **Auth :** getAuthUser (401) + membre de la liste (404)
- **Param URL :** `id`
- **Reponse :** `{ id, name, icon, is_default, is_public, user_id, role, items: ListDetailItem[], members }`
- **Description :** Detail d'une liste avec items enrichis via TMDB (titre, poster) et membres.
- **Fichier :** `src/app/api/lists/[id]/route.ts`

### PATCH /api/lists/[id]

- **Auth :** getAuthUser (401) + owner (403)
- **Param URL :** `id`
- **Body :** `{ name?: string, icon?: string, is_public?: boolean }`
- **Reponse :** `{ id, name, icon, is_default, is_public }`
- **Description :** Modifie le nom, l'icone ou la visibilite d'une liste. Seul le proprietaire peut modifier.
- **Fichier :** `src/app/api/lists/[id]/route.ts`

### DELETE /api/lists/[id]

- **Auth :** getAuthUser (401) + owner (403)
- **Param URL :** `id`
- **Reponse :** `{ ok: true }`
- **Description :** Supprime une liste. La liste par defaut et les listes `non_deletable` ne peuvent pas etre supprimees.
- **Fichier :** `src/app/api/lists/[id]/route.ts`

### POST /api/lists/[id]/items

- **Auth :** getAuthUser (401) + membre (403)
- **Param URL :** `id` (list ID)
- **Body :** `{ tmdbId: number, mediaType: "movie"|"tv" }`
- **Reponse :** `{ ok: true }`
- **Description :** Ajoute un media a une liste. Ignore les doublons (code 23505).
- **Fichier :** `src/app/api/lists/[id]/items/route.ts`

### DELETE /api/lists/[id]/items

- **Auth :** getAuthUser (401) + membre (403)
- **Param URL :** `id` (list ID)
- **Query :** `tmdbId`, `mediaType`
- **Reponse :** `{ ok: true }`
- **Description :** Retire un media d'une liste.
- **Fichier :** `src/app/api/lists/[id]/items/route.ts`

### POST /api/lists/[id]/members

- **Auth :** getAuthUser (401) + owner (403)
- **Param URL :** `id` (list ID)
- **Body :** `{ userId: string }`
- **Reponse :** `{ ok: true }`
- **Description :** Ajoute un ami comme membre d'une liste. Verifie l'amitie avant l'ajout.
- **Fichier :** `src/app/api/lists/[id]/members/route.ts`

### DELETE /api/lists/[id]/members

- **Auth :** getAuthUser (401) + owner ou soi-meme (403)
- **Param URL :** `id` (list ID)
- **Query :** `userId`
- **Reponse :** `{ ok: true }`
- **Description :** Retire un membre d'une liste. Un membre peut se retirer soi-meme ; le proprietaire peut retirer n'importe qui.
- **Fichier :** `src/app/api/lists/[id]/members/route.ts`

### GET /api/lists/preview

- **Auth :** getAuthUser (401)
- **Params :** Aucun
- **Reponse :** `{ lists: ListPreview[] }` avec items enrichis TMDB (max 20 items/liste)
- **Description :** Apercu de toutes les listes de l'utilisateur avec les items enrichis (titre, poster, note, genres). Utilise pour l'affichage rapide sur la page d'accueil.
- **Fichier :** `src/app/api/lists/preview/route.ts`

### GET /api/my-list

- **Auth :** getAuthUser (401)
- **Params :** Aucun
- **Reponse :** `MyListItem[]` (items enrichis avec titre et poster)
- **Description :** Retourne les items de "Ma Liste" (liste par defaut de l'utilisateur).
- **Fichier :** `src/app/api/my-list/route.ts`

### POST /api/my-list

- **Auth :** getAuthUser (401)
- **Body :** `{ tmdbId: number, mediaType: "movie"|"tv", action: "add"|"remove" }`
- **Reponse :** `{ ok: true }`
- **Description :** Ajoute ou retire un media de "Ma Liste". Cree automatiquement la liste si elle n'existe pas.
- **Fichier :** `src/app/api/my-list/route.ts`

### GET /api/suggestions-list

- **Auth :** getAuthUser (401)
- **Params :** Aucun
- **Reponse :** `[{ id, tmdb_id, media_type, added_at }]`
- **Description :** Retourne les items de la liste "Suggestions" (medias swipes positivement).
- **Fichier :** `src/app/api/suggestions-list/route.ts`

### POST /api/suggestions-list

- **Auth :** getAuthUser (401)
- **Body :** `{ tmdbId: number, mediaType: "movie"|"tv", action: "add"|"remove" }`
- **Reponse :** `{ ok: true }`
- **Description :** Ajoute ou retire un media de la liste Suggestions. Cree automatiquement la liste `non_deletable` si absente.
- **Fichier :** `src/app/api/suggestions-list/route.ts`

---

## Recommandations

### GET /api/recommendations

- **Auth :** getAuthUser (401)
- **Query :** `?limit=20` (max 50, defaut 20)
- **Reponse :** `{ items: ScoredItem[], hasProfile: boolean }`
- **Description :** Recommandations personnalisees. Pipeline :
  1. Charge le profil de gout (`user_taste_profiles`)
  2. Charge les exclusions (interactions existantes)
  3. Recupere les likes des amis (score social)
  4. Fetch 2 pages films populaires + 2 pages series depuis TMDB
  5. Charge les features depuis `media_features`
  6. Score chaque candidat et trie par score decroissant
- **Services externes :** TMDB Popular API
- **Fichier :** `src/app/api/recommendations/route.ts`

### GET /api/taste-profile

- **Auth :** getAuthUser (401)
- **Params :** Aucun
- **Reponse :** `{ profile: TasteProfile | null }`
- **Description :** Retourne le profil de gout courant (genre_scores, director_scores, etc.).
- **Fichier :** `src/app/api/taste-profile/route.ts`

### POST /api/taste-profile

- **Auth :** getAuthUser (401)
- **Params :** Aucun
- **Reponse :** `{ ok: true, profile: TasteProfile }`
- **Description :** Recalcule et sauvegarde le profil de gout. Declenche apres un batch de swipes.
- **Fichier :** `src/app/api/taste-profile/route.ts`

### POST /api/media-features/fetch

- **Auth :** getAuthUser (401)
- **Body :** `{ tmdbId: number, mediaType: "movie"|"tv" }`
- **Reponse :** `{ ok: true, cached: boolean }` ou `{ ok: false, error: "TMDB unavailable" }`
- **Description :** Recupere les features TMDB d'un media (genres, mots-cles, casting, realisateurs) et les stocke dans `media_features`. Idempotent avec cache de 7 jours. Declenche apres chaque like/dislike.
- **Services externes :** TMDB Details/Credits/Keywords API
- **Fichier :** `src/app/api/media-features/fetch/route.ts`

---

## Profil

### GET /api/profile

- **Auth :** getAuthUser (retourne `{ profile: null }` si absent)
- **Params :** Aucun
- **Reponse :** `{ profile: { id, name, email, avatar_url, debrid_api_key, debrid_type, preferred_quality, preferred_language, streaming_services, show_paid_options, phone_number, personal_jellyfin_url, personal_jellyfin_api_key, webhook_token, last_library_sync_at, onboarding_completed, letterboxd_username, trakt_username, role, jellyfin_user_id, jellyfin_display_name } }`
- **Description :** Retourne le profil complet de l'utilisateur avec toutes les preferences et connexions externes.
- **Fichier :** `src/app/api/profile/route.ts`

### PATCH /api/profile

- **Auth :** getAuthUser (401)
- **Body :** Partiel de `{ debrid_api_key, debrid_type, preferred_quality, preferred_language, streaming_services, show_paid_options, phone_number, personal_jellyfin_url, personal_jellyfin_api_key, onboarding_completed }`
- **Reponse :** `{ ok: true }`
- **Description :** Met a jour les preferences du profil. Valide le format du numero de telephone. Genere automatiquement un `webhook_token` si Jellyfin est configure.
- **Fichier :** `src/app/api/profile/route.ts`

---

## Historique

### GET /api/watch-history

- **Auth :** getAuthUser (401)
- **Params :** Aucun
- **Reponse :** `WatchHistory[]` (max 50, trie par date)
- **Description :** Historique de visionnage interne (table `watch_history`).
- **Fichier :** `src/app/api/watch-history/route.ts`

### POST /api/watch-history

- **Auth :** getAuthUser (401)
- **Body :** `{ tmdbId: number, mediaType: "movie"|"tv", progress: number, duration?: number, seasonNumber?: number, episodeNumber?: number }`
- **Reponse :** `{ ok: true }`
- **Description :** Enregistre ou met a jour la progression de visionnage. Upsert sur `(user_id, tmdb_id, media_type)`.
- **Fichier :** `src/app/api/watch-history/route.ts`

### GET /api/historique

- **Auth :** getAuthUser (401)
- **Query :** `cursor` (ISO date, pagination), `source` ("all" | "nemo" | "letterboxd" | "netflix_csv" | "trakt")
- **Reponse :** `{ items: HistoryItem[], nextCursor: string | null }`
- **Description :** Historique unifie combinant `watch_history` (interne) et `external_watch_history` (imports). Pagination par curseur, enrichissement TMDB, tri chronologique.
- **Fichier :** `src/app/api/historique/route.ts`

### GET /api/activity

- **Auth :** getAuthUser (401)
- **Query :** `type` ("watched" | "liked" | "added_to_list" | null pour tout), `cursor` (ISO date)
- **Reponse :** `{ events: ActivityEvent[], hasMore: boolean }`
- **Description :** Fil d'activite des amis : films vus, likes/dislikes, ajouts a des listes. Enrichi avec les infos TMDB et les profils des amis.
- **Fichier :** `src/app/api/activity/route.ts`

---

## Streaming

### GET /api/streaming/[imdbId]

- **Auth :** Aucune
- **Param URL :** `imdbId` (ex: `tt1234567`)
- **Query :** `country` (defaut "fr")
- **Reponse :** `StreamingOption[]` avec service, type (subscription/free/rent/buy/addon), lien, qualite, sous-titres
- **Description :** Disponibilite d'un media sur les plateformes de streaming. Dedoublonne par service+type. Cache Next.js 1h.
- **Services externes :** RapidAPI Streaming Availability
- **Fichier :** `src/app/api/streaming/[imdbId]/route.ts`

---

## Telechargement

> Toutes les routes de telechargement necessitent le role **VIP** (`requireRole("vip")`).

### POST /api/download/start

- **Auth :** requireRole("vip") (403)
- **Body :** `DownloadRequest & { quality?, audio_languages?, sub_languages?, tmdb_id?, season_number?, episode_number? }`
- **Reponse :** `{ status: "success", message, download_id }`
- **Description :** Lance un telechargement unique. Insere dans `download_queue`, envoie au backend Python, met a jour le statut.
- **Services externes :** Backend Nemo Downloader (`/api/download`)
- **Fichier :** `src/app/api/download/start/route.ts`

### POST /api/download/batch

- **Auth :** requireRole("vip") (403)
- **Body :** `BatchDownloadRequest & { quality?, audio_languages?, sub_languages?, tmdb_id?, season_number? }`
- **Reponse :** `{ status: "success", message, download_id }`
- **Description :** Lance un telechargement en lot (saison complete). Meme pipeline que `/download/start` avec `is_batch: true`.
- **Services externes :** Backend Nemo Downloader (`/api/batch-download`)
- **Fichier :** `src/app/api/download/batch/route.ts`

### GET /api/download/queue

- **Auth :** getAuthUser (401)
- **Query :** `limit` (max 100, defaut 50), `offset` (defaut 0)
- **Reponse :** `{ downloads: DownloadQueueRow[] }`
- **Description :** Liste la file de telechargement de l'utilisateur, triee par date decroissante.
- **Fichier :** `src/app/api/download/queue/route.ts`

### POST /api/download/probe

- **Auth :** requireRole("vip") (403)
- **Body :** (transmis tel quel au backend)
- **Reponse :** `ProbeResponse` (structure du torrent/fichier)
- **Description :** Proxy vers le backend de telechargement pour inspecter un lien avant telechargement.
- **Services externes :** Backend Nemo Downloader (`/api/probe`)
- **Fichier :** `src/app/api/download/probe/route.ts`

---

## Import

### POST /api/import/jellyfin

- **Auth :** getAuthUser (401)
- **Params :** Aucun
- **Reponse :** `{ count: number }`
- **Description :** Importe l'historique de visionnage depuis Jellyfin. Recupere les items joues via le client Jellyfin, resout les IDs TMDB/IMDb, insere dans `external_watch_history`. Batch de 500.
- **Services externes :** Jellyfin API (via profil utilisateur)
- **Fichier :** `src/app/api/import/jellyfin/route.ts`

### POST /api/import/letterboxd

- **Auth :** getAuthUser (401)
- **Params :** Aucun
- **Reponse :** `{ count: number }`
- **Description :** Importe l'historique depuis l'API Letterboxd (necessite token OAuth). Pagine les log entries, resout les TMDB IDs, insere dans `external_watch_history`.
- **Services externes :** Letterboxd API, TMDB Find/Search
- **Fichier :** `src/app/api/import/letterboxd/route.ts`

### POST /api/import/letterboxd-zip

- **Auth :** getAuthUser (401)
- **Body :** FormData avec `file` (ZIP ou CSV)
- **Reponse :** `{ count, total, notMatched }`
- **Description :** Importe un export Letterboxd (ZIP contenant ratings.csv, watched.csv, diary.csv, reviews.csv). Merge intelligent des sources, resolution TMDB par recherche titre+annee.
- **Services externes :** TMDB Search API
- **Fichier :** `src/app/api/import/letterboxd-zip/route.ts`

### POST /api/import/netflix-csv

- **Auth :** getAuthUser (401)
- **Body :** `{ entries: [{ title: string, date: "YYYY-MM-DD" }] }` (max 5000)
- **Reponse :** `{ count: number }`
- **Description :** Importe un historique Netflix (CSV parse cote client). Detecte films vs series par analyse du titre, resolution TMDB, insertion dans `external_watch_history`.
- **Services externes :** TMDB Search/TV API
- **Fichier :** `src/app/api/import/netflix-csv/route.ts`

### POST /api/import/trakt

- **Auth :** getAuthUser (401)
- **Params :** Aucun
- **Reponse :** `{ count: number }`
- **Description :** Importe l'historique depuis Trakt (necessite token OAuth). Pagine films + series separement, deduplique par IMDb ID, insere dans `external_watch_history`.
- **Services externes :** Trakt Sync History API
- **Fichier :** `src/app/api/import/trakt/route.ts`

---

## Jellyfin

### POST /api/jellyfin/test

- **Auth :** getAuthUser (401)
- **Body :** `{ url: string, apiKey: string }`
- **Reponse :** `{ ok: true, serverName, movieCount, tvCount, totalSynced }` ou `{ ok: true, syncError }`
- **Description :** Teste la connexion a un serveur Jellyfin et lance la premiere synchronisation si la connexion reussit.
- **Services externes :** Jellyfin API
- **Fichier :** `src/app/api/jellyfin/test/route.ts`

### POST /api/jellyfin/sync

- **Auth :** getAuthUser (401)
- **Params :** Aucun
- **Reponse :** `{ ok: true, synced: number }`
- **Description :** Synchronise la bibliotheque Jellyfin de l'utilisateur (met a jour `jellyfin_server_items`).
- **Fichier :** `src/app/api/jellyfin/sync/route.ts`

### GET /api/jellyfin/library/check

- **Auth :** getAuthUser (retourne `{ inLibrary: false }` si absent)
- **Query :** `tmdbId`, `mediaType` ("movie" | "tv")
- **Reponse :** `{ inLibrary: boolean, jellyfinItemId?: string }`
- **Description :** Verifie si un media est dans le cache Jellyfin de l'utilisateur (table `jellyfin_server_items`).
- **Fichier :** `src/app/api/jellyfin/library/check/route.ts`

### GET /api/jellyfin/library/items

- **Auth :** getAuthUser (retourne structure vide si absent)
- **Params :** Aucun
- **Reponse :** `{ hasPersonalJellyfin, jellyfinUrl, lastSyncedAt, items: [{ tmdb_id, media_type, jellyfin_item_id }] }`
- **Description :** Retourne tous les items du cache Jellyfin. Pagination interne (boucle 1000 par 1000). Cache navigateur 5 min.
- **Fichier :** `src/app/api/jellyfin/library/items/route.ts`

### POST /api/jellyfin/user/auth

- **Auth :** getAuthUser (401)
- **Body :** `{ username: string, password: string, serverUrl?: string }`
- **Reponse :** `{ ok: true, displayName, userId }`
- **Description :** Authentifie un utilisateur Jellyfin par nom/mot de passe. Stocke le token et l'ID dans `profiles`.
- **Services externes :** Jellyfin AuthenticateByName API
- **Fichier :** `src/app/api/jellyfin/user/auth/route.ts`

### DELETE /api/jellyfin/user/auth

- **Auth :** getAuthUser (401)
- **Params :** Aucun
- **Reponse :** `{ ok: true }`
- **Description :** Deconnecte l'utilisateur Jellyfin (efface token/ID du profil).
- **Fichier :** `src/app/api/jellyfin/user/auth/route.ts`

### GET /api/jellyfin/user/history

- **Auth :** getAuthUser (401) + compte Jellyfin connecte
- **Query :** `limit` (defaut 200)
- **Reponse :** Items Jellyfin joues avec `serverUrl`
- **Description :** Historique de visionnage via l'API Jellyfin directe (pas le cache local).
- **Services externes :** Jellyfin API (getPlayedItems)
- **Fichier :** `src/app/api/jellyfin/user/history/route.ts`

### GET /api/jellyfin/user/library

- **Auth :** getAuthUser (401) + compte Jellyfin connecte
- **Params :** Aucun
- **Reponse :** Items de la bibliotheque Jellyfin avec `serverUrl`
- **Description :** Liste la bibliotheque Jellyfin via l'API directe.
- **Services externes :** Jellyfin API (getLibraryItems)
- **Fichier :** `src/app/api/jellyfin/user/library/route.ts`

### GET /api/jellyfin/user/resume

- **Auth :** getAuthUser (401) + compte Jellyfin connecte
- **Params :** Aucun
- **Reponse :** Items en cours de visionnage avec `serverUrl`
- **Description :** Items a reprendre (en cours) via l'API Jellyfin.
- **Services externes :** Jellyfin API (getResumeItems)
- **Fichier :** `src/app/api/jellyfin/user/resume/route.ts`

### GET /api/jellyfin/user/stream/[itemId]

- **Auth :** getAuthUser (401) + compte Jellyfin connecte
- **Param URL :** `itemId` (ID Jellyfin de l'item)
- **Reponse :** `{ url, sourceId, container, isHls, subtitles: [{ index, label, language, src, default }], audioTracks: [{ index, label, language, codec, default }], resumePosition }`
- **Description :** Genere l'URL de lecture pour un item Jellyfin. Priorite : HLS transcoding > Direct stream > Fallback manuel. Inclut la position de reprise, les pistes de sous-titres et audio.
- **Services externes :** Jellyfin PlaybackInfo API, UserItem API
- **Fichier :** `src/app/api/jellyfin/user/stream/[itemId]/route.ts`

---

## Invitations

### POST /api/invite/generate

- **Auth :** `requireRole("sources")` (403) OU header `X-Admin-Secret`
- **Body :** `{ role?: "free"|"sources"|"vip", label?: string, max_uses?: number }`
- **Reponse :** `{ token, url, role, label, max_uses }`
- **Description :** Genere un token d'invitation. Trois modes d'acces :
  1. Header `X-Admin-Secret` : tous les roles
  2. Role DB `admin` : tous les roles (free/sources/vip)
  3. Role DB `sources`/`vip` : uniquement le role "sources"
  Les tokens "admin" ne sont jamais distribuables.
- **Fichier :** `src/app/api/invite/generate/route.ts`

### GET /api/invite/validate

- **Auth :** Aucune
- **Query :** `token`
- **Reponse :** `{ valid: true, role, label }` ou `{ valid: false, reason }`
- **Description :** Verifie si un token d'invitation est valide sans le consommer. Utilise par la page d'inscription.
- **Fichier :** `src/app/api/invite/validate/route.ts`

### POST /api/invite/redeem

- **Auth :** getAuthUser (401)
- **Body :** `{ token: string }`
- **Reponse :** `{ ok: true, role, vip_configured }`
- **Description :** Active un token d'invitation. Met a jour le role, configure Jellyfin partage pour VIP, enregistre l'utilisation. Verifie expiration, nombre d'utilisations, et usage unique par compte.
- **Fichier :** `src/app/api/invite/redeem/route.ts`

---

## Webhooks

### POST /api/webhook-receiver

- **Auth :** Aucune (appele par le backend Python)
- **Body :** `{ status: "success"|"error", download_id: string, file_path?, error_log? }`
- **Reponse :** `{ ok: true }`
- **Description :** Recoit les notifications du backend de telechargement lorsqu'un telechargement se termine. Met a jour le statut dans `download_queue`.
- **Fichier :** `src/app/api/webhook-receiver/route.ts`

### GET /api/webhooks/jellyfin

- **Auth :** Token webhook via query `?token=XXX`
- **Reponse :** `{ ok: true, message, user }`
- **Description :** Verification de l'URL webhook Jellyfin (test navigateur / plugin).
- **Fichier :** `src/app/api/webhooks/jellyfin/route.ts`

### POST /api/webhooks/jellyfin

- **Auth :** Token webhook via query `?token=XXX`
- **Reponse :** `{ ok: true, synced, newCount, newItems: [{ tmdbId, mediaType, jellyfinItemId, appUrl }] }`
- **Description :** Declenche par le plugin Jellyfin Webhook a chaque ajout de media. Lance une sync et retourne les nouveaux items avec des deep-links vers l'application.
- **Fichier :** `src/app/api/webhooks/jellyfin/route.ts`

---

## Dev

### GET /api/dev/reset-onboarding

- **Auth :** getAuthUser (401)
- **Params :** Aucun
- **Reponse :** Redirect 302 vers `/onboarding`
- **Description :** **Dev-only.** Reinitialise le flag `onboarding_completed` et supprime le cookie `nemo_onboarding_done`. Redirige vers la page d'onboarding.
- **Fichier :** `src/app/api/dev/reset-onboarding/route.ts`

---

## Patterns d'authentification

| Pattern | Utilisation | Description |
|---------|-------------|-------------|
| `getAuthUser()` | Majorite des routes | Retourne l'utilisateur ou `null`. La route decide du comportement (401 ou valeur par defaut). |
| `getAuthUserWithName()` | `/api/auth/me` | Variante qui inclut le `display_name` depuis les metadata. |
| `requireRole("vip")` | Routes download | Retourne l'utilisateur avec son role. Retourne `null` si le role est insuffisant. |
| `requireRole("sources")` | `/api/invite/generate` | Minimum role "sources" pour generer des invitations. |
| Token webhook | `/api/webhooks/jellyfin` | Authentification par token URL (`?token=XXX`), verifie dans `profiles.webhook_token`. |
| `X-Admin-Secret` header | `/api/invite/generate` | Acces admin externe via secret partage (CLI/curl). |
| Aucune auth | `/api/streaming/[imdbId]`, `/api/invite/validate`, `/api/auth/logout` | Routes publiques ou auto-deconnexion. |

## Fichiers sources

Tous les fichiers route se trouvent dans `src/app/api/`. Total : 57 fichiers `route.ts` couvrant 15 domaines fonctionnels.
