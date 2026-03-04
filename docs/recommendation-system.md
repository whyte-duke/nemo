# Système de Recommandation Nemo — Documentation Complète

> Version : Phase 1–5 implémentées
> Stack : Next.js 15 App Router, Supabase (PostgreSQL + RLS), TMDB API, TanStack Query, Framer Motion

---

## Vue d'ensemble

Le système de recommandation Nemo collecte les signaux explicites de l'utilisateur (like/dislike via interface swipe), les croise avec les features TMDB des films (genres, acteurs, réalisateurs, keywords), calcule un profil de goût agrégé, puis génère un feed personnalisé pondérant goût (45%), social (20%), tendance (10%) et qualité (5%).

```
Utilisateur swipe → interactions DB
                  → media_features (lazy TMDB fetch)
                  → user_taste_profiles (calcul async)
                  → recommendation_cache (scored, optionnel)
                  → API /recommendations → PersonalizedRow
```

---

## Base de données (migration 014)

### Table `interactions` (étendue)
```sql
ALTER TABLE interactions
  ADD COLUMN IF NOT EXISTS not_interested BOOLEAN NOT NULL DEFAULT FALSE;
```
- `type` : `'like'` | `'dislike'`
- `not_interested = TRUE` : signal fort d'exclusion (poids -2.0 dans le profil de goût)

### Table `media_features`
```sql
CREATE TABLE media_features (
  tmdb_id      INTEGER NOT NULL,
  media_type   TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
  genre_ids    INTEGER[] NOT NULL DEFAULT '{}',
  keyword_ids  INTEGER[] NOT NULL DEFAULT '{}',
  cast_ids     INTEGER[] NOT NULL DEFAULT '{}',   -- top 5 acteurs
  director_ids INTEGER[] NOT NULL DEFAULT '{}',   -- réalisateurs / créateurs TV
  language     TEXT,
  vote_average NUMERIC(4,2),
  popularity   NUMERIC(10,2),
  fetched_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tmdb_id, media_type)
);
```
- Rempli lazily après chaque swipe (fire-and-forget depuis `use-swipe-session`)
- TTL de 7 jours avant re-fetch
- RLS : SELECT authenticated, ALL service_role

### Table `user_taste_profiles`
```sql
CREATE TABLE user_taste_profiles (
  user_id         UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  genre_scores    JSONB NOT NULL DEFAULT '{}',   -- { "28": 4.5, "878": -2.0 }
  director_scores JSONB NOT NULL DEFAULT '{}',
  actor_scores    JSONB NOT NULL DEFAULT '{}',
  keyword_scores  JSONB NOT NULL DEFAULT '{}',
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```
- RLS : SELECT own + SELECT friends (via `friendships`)
- Mise à jour async après chaque batch de swipes

### Table `recommendation_cache`
```sql
CREATE TABLE recommendation_cache (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tmdb_id      INTEGER NOT NULL,
  media_type   TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
  score        NUMERIC(6,4) NOT NULL DEFAULT 0,
  reason_type  TEXT,  -- 'taste_match' | 'social' | 'trending' | 'quality'
  reason_tmdb_id INTEGER,
  computed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, tmdb_id, media_type)
);
```
- Réservé pour optimisation future — actuellement la route compute on-demand
- RLS : SELECT own, ALL service_role

---

## Fichiers clés

### Phase 1 — Interface swipe

| Fichier | Rôle |
|---------|------|
| `src/app/(main)/decouvrir/page.tsx` | Page `/decouvrir` — swipe de découverte |
| `src/components/discover/SwipeCard.tsx` | Carte animée avec `forwardRef` + `useImperativeHandle` pour `triggerSwipe()` |
| `src/components/discover/SwipeStack.tsx` | Stack de cartes + boutons ❤️ 👎 ➕ ↩ |
| `src/hooks/use-swipe-session.ts` | State machine du swipe — batch save, loading guard, fire-and-forget triggers |
| `src/app/api/discover/cards/route.ts` | `GET /api/discover/cards?genres=28,878` — sélectionne ~20 films non vus |
| `src/components/onboarding/StepDiscover.tsx` | Step 3 de l'onboarding |

### Phase 2 — Cache features TMDB

| Fichier | Rôle |
|---------|------|
| `src/lib/tmdb/features.ts` | `fetchMediaFeatures(tmdbId, mediaType)` — extrait genre_ids, keyword_ids, cast_ids, director_ids |
| `src/app/api/media-features/fetch/route.ts` | `POST /api/media-features/fetch` — upsert dans media_features (TTL 7j) |

### Phase 3 — Profil de goût

| Fichier | Rôle |
|---------|------|
| `src/lib/recommendations/taste-profile.ts` | `computeAndSaveTasteProfile(userId)`, `getTasteProfile(userId)`, `computeTasteScore(profile, ...)` |
| `src/app/api/taste-profile/route.ts` | `GET` (lire profil) + `POST` (recalculer) |

### Phase 4 — Feed de recommandations

| Fichier | Rôle |
|---------|------|
| `src/lib/recommendations/scorer.ts` | `scoreItem(profile, item, features, mediaType, friendLikes?, friendCount?)` |
| `src/app/api/recommendations/route.ts` | `GET /api/recommendations?limit=20` — compute + retourne items scorés |
| `src/components/home/PersonalizedRow.tsx` | Rangée "Pour vous" dans HomeContent (avec gestion "Pas intéressé") |
| `src/app/(main)/pour-vous/page.tsx` | Page `/pour-vous` — 50 recommandations groupées par raison |

### Phase 5 — Signaux sociaux + polishing

| Fichier | Rôle |
|---------|------|
| `src/components/media/MediaCard.tsx` | Ajout prop `onNotInterested` + bouton EyeOff au hover |
| `src/components/media/MediaRow.tsx` | Ajout prop `onNotInterested` passée aux MediaCard |
| `src/app/(main)/profil/enrichir/page.tsx` | Page `/profil/enrichir` — stats du profil de goût + CTA swipe |

---

## Flux de données complet

```
[Utilisateur swipe ❤️/👎 sur /decouvrir]
  │
  ├── use-swipe-session.ts
  │     ├── Batch de 5 → POST /api/interactions (like/dislike)
  │     ├── Fire-and-forget → POST /api/media-features/fetch
  │     │     └── fetchMediaFeatures() → TMDB API → upsert media_features
  │     └── Si like/dislike → POST /api/taste-profile
  │           └── computeAndSaveTasteProfile(userId)
  │                 ├── SELECT interactions WHERE user_id
  │                 ├── SELECT media_features WHERE tmdb_id IN (...)
  │                 └── UPSERT user_taste_profiles
  │
[Utilisateur visite la home]
  │
  ├── PersonalizedRow → GET /api/recommendations?limit=20
  │     ├── getTasteProfile(userId) → SELECT user_taste_profiles
  │     ├── SELECT interactions (exclusions)
  │     ├── SELECT friendships + SELECT interactions de amis (social score)
  │     ├── TMDB popular movies p1+p2 + popular TV p1+p2 (en parallèle)
  │     ├── SELECT media_features WHERE tmdb_id IN (candidates)
  │     ├── scoreItem() pour chaque candidat
  │     └── Retourne top 20 triés par score desc
  │
[Utilisateur clique EyeOff sur une carte]
  │
  └── POST /api/interactions { notInterested: true }
        └── Invalidate React Query ["recommendations"]
```

---

## Formule de scoring

```
score(U, M) =
  0.45 × taste_score(U, M)      // profil de goût vs features du film
+ 0.20 × social_score(U, M)     // fraction d'amis ayant liké M
+ 0.10 × trending_score(M)      // popularité TMDB / 500 (capped à 1.0)
+ 0.05 × quality_score(M)       // vote_average/10 × vote_penalty
(+ 0.20 similarity_score réservé Phase 6)
```

### taste_score détail
Calculé par `computeTasteScore()` dans `taste-profile.ts` :
```
taste_score = Σ(matched features × weight) / count_matched
  - genre match      : poids ×1.0
  - director match   : poids ×1.5  (signal fort)
  - actor match      : poids ×0.8
  - keyword match    : poids ×0.5  (bruit élevé)
Normalisé en [-1, 1], puis converti en [0, 1] pour le score final
```

### Poids des signaux utilisateur (profil de goût)
| Signal | Poids |
|--------|-------|
| like | +1.0 |
| dislike | -1.0 |
| not_interested | -2.0 |
| list (ajout) | non utilisé dans le profil |
| keywords | ×0.5 (dampening supplémentaire) |

### Reason types
| Valeur | Condition | Icône |
|--------|-----------|-------|
| `taste_match` | tasteNorm > 0.65 | ✦ Sparkles |
| `social` | socialScore > 0.4 | 👥 Users |
| `trending` | défaut | 📈 TrendingUp |
| `quality` | qualityScore > 0.85 | ⭐ Star |

---

## Pistes de refactorisation / améliorations

### Refactorisation du feed Home (priorité haute)
La `HomeContent.tsx` est un monolithe de 670 lignes avec :
- Un pool statique de 60+ sections TMDB (`HOME_POOL`)
- Un générateur infini (`INFINITE_TEMPLATES`) pour l'infinite scroll
- Les sections ne tiennent pas compte des goûts de l'utilisateur

**Pour personnaliser les carousels :**

1. **Sections genre prioritaires** : lire `user_taste_profiles.genre_scores`, trier les genres par score positif, injecter les sections genre correspondantes en tête du pool (avant shuffle).

```ts
// Dans HomeContent, avant shuffleCopy(HOME_POOL) :
const genreProfile = await fetch('/api/taste-profile').then(r => r.json())
const topGenres = Object.entries(genreProfile.genre_scores)
  .filter(([, v]) => v > 0)
  .sort(([, a], [, b]) => b - a)
  .slice(0, 3)
  .map(([id]) => id)

// Injecter les sections correspondantes en premier
const prioritized = [
  ...HOME_POOL.filter(s => s.params?.with_genres && topGenres.includes(String(s.params.with_genres))),
  ...shuffleCopy(HOME_POOL.filter(s => !topGenres.includes(String(s.params?.with_genres ?? ''))))
]
```

2. **Exclusion des titres vus** : l'endpoint `/api/discover/cards` a déjà la logique d'exclusion. Créer un hook `useExcludedIds()` partageable.

3. **Section "Continuer dans [genre]"** : si l'utilisateur a un score fort sur genre 28 (Action), insérer une section "Action — Pour vous" avec `sort_by: vote_average.desc&with_genres=28` filtrant les exclusions.

4. **Historique dans les suggestions** : `watch_history` + `external_watch_history` sont déjà exclus dans `/api/discover/cards`. Connecter la même logique à HomeContent.

### Amélioration du scorer (Phase 6)
- **similarity_score** (poids 0.20) : calculer la similarité Jaccard entre le candidat et les films likés. Nécessite de charger les features des films likés et de faire le calcul en mémoire.
- **Temporal decay** : diminuer le poids des vieux likes (sigmoid sur l'âge).
- **Diversité** : MMR (Maximal Marginal Relevance) pour éviter 20 films du même genre.

### Endpoints manquants
- `DELETE /api/taste-profile` — reset complet du profil
- `GET /api/recommendations?reason=taste_match` — filtrer par raison
- `POST /api/recommendations/feedback` — feedback explicite sur une reco

### Performance
- Pré-calculer les recommandations dans un cron job (Edge Function Supabase) toutes les 2h → écrire dans `recommendation_cache` avec les champs d'affichage en JSONB
- Ajouter un `GIN index` sur les colonnes `genre_ids`, `keyword_ids` de `media_features` pour accélérer les lookups
- Le calcul de `computeAndSaveTasteProfile` est O(interactions × features) — acceptable jusqu'à ~10k interactions, ensuite passer à un agrégat incrémental

---

## Variables d'environnement requises

```env
NEXT_PUBLIC_TMDB_API_KEY=...        # Clé API TMDB v3
NEXT_PUBLIC_TMDB_BASE_URL=https://api.themoviedb.org/3
SUPABASE_SERVICE_ROLE_KEY=...       # Pour createAdminClient (bypass RLS)
```

---

## Vérification end-to-end

1. `/decouvrir` accessible → cartes de films affichées
2. Swipe droite → `interactions` row avec `type='like'`
3. Swipe gauche → `type='dislike'`
4. Swipe bas → item dans `list_items`
5. Après 5 swipes → `media_features` peuplée pour les films swipés
6. `user_taste_profiles` → ligne avec `genre_scores` non vide
7. `GET /api/recommendations` → tableau `items` trié par score
8. Home → rangée "Pour vous" visible avec les films recommandés
9. Hover sur carte "Pour vous" → bouton EyeOff visible → clic masque la carte
10. `/pour-vous` → 50 titres groupés par raison
11. `/profil/enrichir` → barres d'affinité genre visibles
