# Systeme de Recommandation

> Derniere mise a jour : 2026-03-04 | Audience : Agents IA (Claude) + Developpeurs

## Resume rapide

Algorithme en 5 phases : swipe -> features TMDB -> taste profile -> scoring -> social.

Score final avec profil :
`0.45 * taste + 0.20 * social + 0.10 * trending + 0.05 * quality` (+ 0.20 reserve Phase 6 similarity).

Score fallback (sans profil) :
`0.55 * trending + 0.25 * quality + 0.20 * social`.

---

## Vue d'ensemble des 5 Phases

```
Utilisateur
    |
    v
[Phase 1] Swipe UI (like/dislike/not_interested)
    |
    v
[Phase 2] Feature Caching (TMDB -> media_features, TTL 7 jours)
    |
    v
[Phase 3] Taste Profile (agregation interactions + features -> user_taste_profiles)
    |
    v
[Phase 4] Scoring (score composite multi-facteurs)
    |
    v
[Phase 5] Social Weighting (ponderation par likes des amis)
    |
    v
Recommandations triees par score decroissant
```

| Phase | Nom | Description | Tables impliquees |
|-------|-----|-------------|-------------------|
| 1 | Swipe UI | L'utilisateur swipe (like/dislike/not_interested) sur des cartes | `interactions` |
| 2 | Feature Caching | Recupere genres, keywords, cast, directors depuis TMDB et les cache | `media_features` |
| 3 | Taste Profile | Agregation des scores par genre/realisateur/acteur/keyword | `user_taste_profiles` |
| 4 | Scoring | Score composite taste + trending + quality | -- |
| 5 | Social Weighting | Ajoute le score social base sur les likes des amis | `friendships`, `interactions` |

---

## Phase 1 : Swipe et Interactions

### Flux utilisateur

1. L'utilisateur visite la page Decouvrir
2. Des cartes de films/series sont chargees via `GET /api/discover/cards`
3. L'utilisateur swipe : like, dislike, ou not_interested
4. Chaque interaction est envoyee via `POST /api/interactions`
5. En parallele, les features TMDB sont fetchees via `POST /api/media-features/fetch`

### Source des cartes (Discover)

L'endpoint `GET /api/discover/cards` compose un deck de 25 cartes en melangeant 4 buckets :

| Bucket | Nombre | Source | Critere |
|--------|--------|--------|---------|
| Affinite | 9 | TMDB Discover | Genres favoris du profil (top 4 genres avec score > 0.3) |
| Exploration | 6 | TMDB Discover | Genres jamais vus (absents du profil) |
| Trending | 6 | TMDB Discover | Pages aleatoires (1-3) |
| Qualite | 4 | TMDB Discover | Tri par vote_average, vote_count >= 1000 |

Les cartes deja interagies, presentes dans `watch_history`, `external_watch_history`, ou dans la liste "Suggestions" sont exclues.

### Contexte client : UserInteractionsProvider

Le contexte `UserInteractionsProvider` (`src/lib/recommendations/user-interactions-context.tsx`) :
- Charge toutes les interactions au montage via `GET /api/interactions/all`
- Fournit une Map `tmdbId-mediaType -> InteractionType`
- Gere les mises a jour optimistes (UI instantanee, POST en arriere-plan)
- Expose `setInteraction()`, `getInteraction()`, `isExcluded()`

### Types d'interaction

| Type | Poids signal | Description |
|------|-------------|-------------|
| `like` | +1.0 | L'utilisateur a aime |
| `dislike` | -1.0 | L'utilisateur n'a pas aime |
| `not_interested` | -2.0 | Signal fort de rejet actif |
| `list` | 0 (ignore) | Ajout a une liste (signal faible, ambigu) |

---

## Phase 2 : Feature Caching (TMDB -> media_features)

### Objectif

Stocker les caracteristiques TMDB d'un film/serie dans la table `media_features` pour eviter des appels TMDB repetitifs lors du scoring.

### Declenchement

Apres chaque swipe (like/dislike), le client appelle `POST /api/media-features/fetch` avec `{ tmdbId, mediaType }`.

### Logique de cache

1. Verifier si les features existent dans `media_features` avec `fetched_at`
2. Si existantes et fetchees il y a moins de 7 jours (`CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000`) -> retourner `{ ok: true, cached: true }`
3. Sinon, appeler TMDB pour recuperer les features

### Extraction des features depuis TMDB

Le module `src/lib/tmdb/features.ts` extrait les donnees suivantes :

**Pour un film** (`fetchMovieFeatures`) :
- `genre_ids` : tous les genres du film
- `keyword_ids` : jusqu'a 30 keywords (limite pour equilibre precision/taille)
- `cast_ids` : top 5 acteurs (tries par ordre au generique, filtres sur `known_for_department === "Acting"`)
- `director_ids` : membres du crew avec `job === "Director"`
- `language` : langue originale
- `vote_average`, `popularity` : metriques TMDB

**Pour une serie TV** (`fetchTVFeatures`) :
- `genre_ids` : tous les genres
- `keyword_ids` : jusqu'a 30 (dans `keywords.results` pour les series, pas `keywords.keywords`)
- `cast_ids` : top 5 acteurs
- `director_ids` : `created_by` en priorite, sinon `Creator` ou `Executive Producer` du crew (limite a 3)
- `language`, `vote_average`, `popularity`

### Upsert en base

L'ecriture utilise le client admin (`service_role`) pour contourner le RLS. La cle d'unicite est `(tmdb_id, media_type)`.

---

## Phase 3 : Calcul du Taste Profile

### Objectif

Agreger toutes les interactions d'un utilisateur avec les features des medias pour produire un profil de gout numerique.

### Declenchement

`POST /api/taste-profile` appelle `computeAndSaveTasteProfile(userId)`.

### Algorithme (`src/lib/recommendations/taste-profile.ts`)

```
Pour chaque interaction de l'utilisateur :
  1. Recuperer les features du media (depuis media_features)
  2. Determiner le poids du signal :
     - like        -> +1.0
     - dislike     -> -1.0
     - not_interested -> -2.0
     - list        -> 0 (ignore)
  3. Accumuler le poids sur chaque feature du media :
     - genre_scores[genre_id]       += poids
     - director_scores[director_id] += poids
     - actor_scores[actor_id]       += poids
     - keyword_scores[keyword_id]   += poids * 0.5  (KEYWORD_DAMPING)
```

### Damping des keywords

Les keywords sont ponderes a `x0.5` car ils sont plus bruites et moins discriminants que les genres ou le cast. Un film d'action et un drame peuvent partager des keywords comme "revenge" ou "betrayal".

### Structure du profil

```typescript
interface TasteProfile {
  genre_scores: Record<string, number>;     // { "28": 4.5, "18": 2.0, "27": -3.0 }
  director_scores: Record<string, number>;  // { "525": 2.0 }  (ex: Nolan)
  actor_scores: Record<string, number>;     // { "6193": 1.5 } (ex: DiCaprio)
  keyword_scores: Record<string, number>;   // { "4344": 2.0 } (ex: mind-bending)
}
```

Les scores sont bruts (non normalises) -- la normalisation est faite dans le scorer (Phase 4).

### Persistance

Le profil est upsert dans `user_taste_profiles` avec cle d'unicite `user_id`. L'ecriture utilise le client admin (`service_role`).

---

## Phase 4 : Scoring

### Objectif

Attribuer un score composite a chaque candidat TMDB en combinant le gout de l'utilisateur, la popularite, la qualite et le score social.

### Fichier source

`src/lib/recommendations/scorer.ts` -- fonction `scoreItem()`

### Formule avec profil de gout

Quand l'utilisateur a un profil (au moins des `genre_scores` ou `director_scores` non vides) :

```
score(U, M) = 0.45 * taste_score
            + 0.20 * social_score
            + 0.10 * trending_score
            + 0.05 * quality_score
```

**Note** : le total fait 0.80. Les 0.20 restants sont reserves pour un futur `similarity_score` (Phase 6, non implementee).

### Formule fallback (sans profil)

Quand l'utilisateur n'a pas de profil ou que les features du media sont manquantes :

```
score(U, M) = 0.55 * trending_score
            + 0.25 * quality_score
            + 0.20 * social_score
```

### Composantes detaillees

#### taste_score (poids : 0.45)

Calcule par `computeTasteScore()` dans `taste-profile.ts`.

```
Pour chaque feature du candidat M :
  - Genres :      score += profile.genre_scores[id]          (x1.0)
  - Directors :   score += profile.director_scores[id] * 1.5 (realisateur = signal fort)
  - Cast :        score += profile.actor_scores[id]  * 0.8
  - Keywords :    score += profile.keyword_scores[id] * 0.5

raw = somme_ponderee / nombre_de_features_matchantes
taste_raw = clamp(raw, -1, 1)
```

Le score brut est dans `[-1, 1]`, puis normalise en `[0, 1]` par le scorer :

```
taste_norm = (taste_raw + 1) / 2
```

Si aucune feature ne matche le profil, `taste_raw = 0` -> `taste_norm = 0.5` (neutre).

#### social_score (poids : 0.20)

Fraction des amis de l'utilisateur ayant like ce titre :

```
social_score = min(like_count / max(friend_count, 3), 1.0)
```

- `like_count` : nombre d'amis ayant une interaction `type = "like"` sur ce `tmdb_id-media_type`
- `friend_count` : nombre total d'amis (les deux sens de la relation dans `friendships`)
- Le denominateur est plafonne a `max(3, friend_count)` pour eviter l'inflation avec peu d'amis
- Plafonne a 1.0
- Nouvel utilisateur sans amis : `social_score = 0`

#### trending_score (poids : 0.10)

Popularite TMDB normalisee :

```
trending_score = min(popularity / 500, 1.0)
```

Les blockbusters ont une popularite autour de 500-1000. Le plafond a 500 assure que les films tres populaires obtiennent le score maximum.

#### quality_score (poids : 0.05)

Note TMDB avec penalite si peu de votes :

```
quality_raw = vote_average / 10

vote_penalty :
  vote_count < 100   -> 0.5
  vote_count < 500   -> 0.8
  vote_count >= 500  -> 1.0

quality_score = quality_raw * vote_penalty
```

---

## Phase 5 : Social Weighting

### Objectif

Integrer les preferences des amis dans le score final pour creer un effet de decouverte sociale.

### Source des donnees sociales

1. Charger les amis depuis `friendships` (relation bidirectionnelle : `user_id` ou `friend_id`)
2. Charger les interactions de type `like` de tous les amis
3. Construire une Map `tmdb_id-media_type -> nombre d'amis ayant like`

### Integration dans le scoring

Le `social_score` est calcule dans `scoreItem()` (voir Phase 4) et pese 0.20 du score final. Il est inclus a la fois dans la formule avec profil et dans le fallback.

### Impact

- Avec peu d'amis (< 3), le denominateur est plafonne a 3 pour eviter qu'un seul like d'ami donne un score social de 1.0
- Avec beaucoup d'amis, le score social est plus discriminant : 3 likes sur 20 amis = 0.15
- Un titre like par tous les amis obtient `social_score = 1.0`

---

## Classification des Raisons

Chaque recommandation est accompagnee d'un label explicatif (style Spotify) determine par des seuils :

### Avec profil

| ReasonType | Condition | reason_detail | Label affiche |
|------------|-----------|---------------|---------------|
| `taste_match` | `taste_norm > 0.65` | `genre:{id}` (genre dominant du profil present dans les features) | "Parce que vous aimez {genre}" ou "Pour vous" |
| `social` | `social_score > 0.4` | `social:{count}` | "{count} de vos amis ont aime" |
| `quality` | `quality_score > 0.82` | -- | "Film tres bien note" |
| `trending` | defaut | -- | "Populaire en ce moment" |

### Sans profil (fallback)

| ReasonType | Condition | reason_detail |
|------------|-----------|---------------|
| `quality` | `quality_score > 0.85` | -- |
| `social` | `social_score > 0.4` | `social:{count}` |
| `trending` | defaut | -- |

Les labels sont generes cote client par `useRecommendationLabel()` dans `src/lib/recommendations/context.tsx`.

---

## Pipeline de Donnees Complet

```
                         UTILISATEUR
                             |
              +--------------+--------------+
              |                             |
         [Swipe UI]                    [Page d'accueil]
              |                             |
              v                             v
    POST /api/interactions          GET /api/recommendations
              |                             |
              v                             |
    table: interactions                     |
              |                             |
              +---> POST /api/media-features/fetch
              |           |                 |
              |           v                 |
              |   TMDB API (details)        |
              |           |                 |
              |           v                 |
              |   table: media_features     |
              |                             |
              +---> POST /api/taste-profile |
                          |                 |
                          v                 |
                  interactions              |
                       +                    |
                  media_features            |
                       |                    |
                       v                    |
              user_taste_profiles           |
                                            |
                    +--- Charge: ------------+
                    |  1. user_taste_profiles
                    |  2. interactions (exclusions)
                    |  3. friendships + interactions amis (social)
                    |  4. TMDB popular (candidats)
                    |  5. media_features (features candidats)
                    |
                    v
              scoreItem() pour chaque candidat
                    |
                    v
              Tri par score decroissant
                    |
                    v
              JSON { items: ScoredItem[], hasProfile: boolean }
```

---

## Types TypeScript

### TasteProfile

```typescript
// src/lib/recommendations/taste-profile.ts
interface TasteProfile {
  genre_scores: Record<string, number>;
  director_scores: Record<string, number>;
  actor_scores: Record<string, number>;
  keyword_scores: Record<string, number>;
}
```

### ScoredItem

```typescript
// src/lib/recommendations/scorer.ts
interface ScoredItem {
  tmdb_id: number;
  media_type: "movie" | "tv";
  score: number;
  reason_type: ReasonType;
  reason_detail?: string;       // "genre:28", "social:3"
  // Champs d'affichage
  title?: string;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  popularity: number;
  genre_ids: number[];
  overview: string;
  release_date?: string;
  first_air_date?: string;
}
```

### CandidateFeatures

```typescript
// src/lib/recommendations/scorer.ts
interface CandidateFeatures {
  tmdb_id: number;
  media_type: string;
  genre_ids: number[];
  keyword_ids: number[];
  cast_ids: number[];
  director_ids: number[];
}
```

### TMDbCandidateItem

```typescript
// src/lib/recommendations/scorer.ts
interface TMDbCandidateItem {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genre_ids?: number[];
  overview?: string;
  release_date?: string;
  first_air_date?: string;
}
```

### ReasonType

```typescript
type ReasonType = "taste_match" | "social" | "trending" | "quality";
```

### MediaFeatures (TMDB)

```typescript
// src/lib/tmdb/features.ts
interface MediaFeatures {
  genre_ids: number[];
  keyword_ids: number[];
  cast_ids: number[];       // top 5 acteurs principaux
  director_ids: number[];   // realisateurs (film) ou createurs (serie)
  language: string | null;
  vote_average: number;
  popularity: number;
}
```

---

## Endpoints API

### GET /api/recommendations

Retourne les recommandations personnalisees de l'utilisateur.

**Parametres query :**

| Parametre | Type | Defaut | Max | Description |
|-----------|------|--------|-----|-------------|
| `limit` | number | 20 | 50 | Nombre de resultats |

**Reponse :**

```json
{
  "items": [
    {
      "tmdb_id": 550,
      "media_type": "movie",
      "score": 0.72,
      "reason_type": "taste_match",
      "reason_detail": "genre:28",
      "title": "Fight Club",
      "poster_path": "/pB8...",
      "vote_average": 8.4,
      "popularity": 120.5,
      "genre_ids": [18, 53],
      "overview": "..."
    }
  ],
  "hasProfile": true
}
```

**Flux interne :**

1. Authentification via `getAuthUser()`
2. Charge le profil de gout depuis `user_taste_profiles`
3. Charge les exclusions (interactions existantes) et les amis en parallele
4. Charge les likes des amis pour le score social
5. Fetch 2 pages de films populaires + 2 pages de series depuis TMDB (4 requetes en parallele)
6. Filtre les titres deja interagis
7. Charge les features depuis `media_features` (max 160 IDs)
8. Score chaque candidat via `scoreItem()`
9. Trie par score decroissant
10. Retourne les N premiers

**Cache client :** `staleTime: 15min` via React Query (cote client) et `staleTime: 20min` dans le RecommendationsProvider.

### POST /api/taste-profile

Recalcule et sauvegarde le profil de gout de l'utilisateur.

**Body :** aucun (le user_id est extrait de la session)

**Reponse :**

```json
{
  "ok": true,
  "profile": {
    "genre_scores": { "28": 4.5, "18": 2.0 },
    "director_scores": { "525": 2.0 },
    "actor_scores": { "6193": 1.5 },
    "keyword_scores": { "4344": 1.0 }
  }
}
```

### GET /api/taste-profile

Retourne le profil de gout courant sans recalcul.

**Reponse :**

```json
{
  "profile": { ... }  // TasteProfile ou null
}
```

### POST /api/media-features/fetch

Cache les features TMDB d'un media.

**Body :**

```json
{
  "tmdbId": 550,
  "mediaType": "movie"
}
```

**Reponse :**

```json
{ "ok": true, "cached": false }   // Feature fraichement fetchee
{ "ok": true, "cached": true }    // Feature deja en cache (< 7 jours)
{ "ok": false, "error": "TMDB unavailable" }  // Echec silencieux
```

### GET /api/discover/cards

Retourne un deck de cartes pour l'interface de swipe.

**Parametres query :**

| Parametre | Type | Description |
|-----------|------|-------------|
| `exclude` | string | IDs a exclure (format `tmdbId-mediaType`, separes par virgules) |

**Reponse :**

```json
{
  "cards": [
    {
      "id": 550,
      "title": "Fight Club",
      "poster_path": "/pB8...",
      "genre_ids": [18, 53],
      "vote_average": 8.4,
      "overview": "...",
      "media_type": "movie"
    }
  ]
}
```

---

## Contexte Client : RecommendationsProvider

Le composant `RecommendationsProvider` (`src/lib/recommendations/context.tsx`) :

- Fetch les recommandations au montage via `GET /api/recommendations?limit=50`
- Stocke les resultats dans une Map `tmdb_id-media_type -> ScoredItemClient`
- Rafraichissement toutes les 20 minutes (`STALE_MS = 20 * 60 * 1000`)
- Ne re-fetch pas si l'utilisateur n'a pas change

### Hooks exposes

| Hook | Signature | Retour |
|------|-----------|--------|
| `useItemRecommendation` | `(tmdbId, mediaType) -> ScoredItemClient \| null` | Score et raison d'un titre |
| `useRecommendationLabel` | `(tmdbId, mediaType) -> string \| null` | Label Spotify-style en francais |

### Labels generes par `useRecommendationLabel`

| ReasonType | Condition | Label |
|------------|-----------|-------|
| `taste_match` | `reason_detail` = `genre:{id}` | "Parce que vous aimez {nom du genre}" |
| `taste_match` | score > 0.80 | "Vous allez adorer" |
| `taste_match` | autre | "Pour vous" |
| `social` | count = 1 | "1 de vos amis a aime" |
| `social` | count > 1 | "{count} de vos amis ont aime" |
| `social` | autre | "Vos amis ont aime" |
| `quality` | -- | "Film tres bien note" |
| `trending` | -- | "Populaire en ce moment" |

---

## Tables de la base de donnees

### interactions

Stocke chaque interaction utilisateur-media.

| Colonne | Type | Description |
|---------|------|-------------|
| `user_id` | uuid | Utilisateur |
| `tmdb_id` | integer | ID TMDB du media |
| `media_type` | text | `movie` ou `tv` |
| `type` | text | `like`, `dislike`, ou null |
| `not_interested` | boolean | Signal de rejet fort |

### user_taste_profiles

Profil de gout agrege d'un utilisateur.

| Colonne | Type | Description |
|---------|------|-------------|
| `user_id` | uuid (PK) | Utilisateur |
| `genre_scores` | jsonb | Scores par genre |
| `director_scores` | jsonb | Scores par realisateur |
| `actor_scores` | jsonb | Scores par acteur |
| `keyword_scores` | jsonb | Scores par keyword |
| `updated_at` | timestamptz | Derniere mise a jour |

### media_features

Cache des features TMDB pour un media.

| Colonne | Type | Description |
|---------|------|-------------|
| `tmdb_id` | integer | ID TMDB |
| `media_type` | text | `movie` ou `tv` |
| `genre_ids` | integer[] | Genres |
| `keyword_ids` | integer[] | Keywords (max 30) |
| `cast_ids` | integer[] | Top 5 acteurs |
| `director_ids` | integer[] | Realisateurs/createurs |
| `language` | text | Langue originale |
| `vote_average` | float | Note moyenne |
| `popularity` | float | Popularite TMDB |
| `fetched_at` | timestamptz | Date du dernier fetch |

Cle d'unicite : `(tmdb_id, media_type)`.

### friendships

Relation d'amitie bidirectionnelle.

| Colonne | Type | Description |
|---------|------|-------------|
| `user_id` | uuid | Premier utilisateur |
| `friend_id` | uuid | Second utilisateur |

---

## Limitations connues

- **Source de candidats limitee** : seules les pages 1-2 de TMDB popular sont utilisees (environ 40 films + 40 series). Le deck de decouverte utilise TMDB Discover avec plus de diversite (affinite, exploration, trending, qualite).
- **Pas de decay temporel** : le profil de gout traite toutes les interactions de maniere egale, quelle que soit leur anciennete.
- **Poids reserves** : 0.20 du score total est reserve pour un futur `similarity_score` (Phase 6). Le score maximum actuel est donc 0.80.
- **Nouvel utilisateur** : sans interactions ni amis, le scoring utilise uniquement trending (0.55) et quality (0.25).

## Evolutions prevues

- **Phase 6 (similarity_score)** : score base sur la similarite entre utilisateurs (collaborative filtering). Redistribuerait les 0.20 reserves.
- **Diversification des sources** : ajouter trending, top rated, par genre comme sources de candidats pour l'endpoint recommandations.
- **Decay temporel** : ponderer les interactions recentes plus fortement.

---

## Fichiers sources

| Fichier | Role |
|---------|------|
| `src/lib/recommendations/scorer.ts` | Formule de scoring, types `ScoredItem`, `CandidateFeatures`, `ReasonType` |
| `src/lib/recommendations/taste-profile.ts` | Calcul et persistance du profil de gout, `computeTasteScore()` |
| `src/lib/recommendations/context.tsx` | Contexte React client, labels Spotify-style |
| `src/lib/recommendations/user-interactions-context.tsx` | Contexte des interactions utilisateur (optimistic updates) |
| `src/lib/tmdb/features.ts` | Extraction des features TMDB (genres, keywords, cast, directors) |
| `src/app/api/recommendations/route.ts` | Endpoint principal `GET /api/recommendations` |
| `src/app/api/taste-profile/route.ts` | Endpoints `GET/POST /api/taste-profile` |
| `src/app/api/media-features/fetch/route.ts` | Endpoint `POST /api/media-features/fetch` |
| `src/app/api/discover/cards/route.ts` | Endpoint `GET /api/discover/cards` (deck de swipe) |
