---
title: "Phase 03: Similarity Score Implementation"
description: "Implémenter le cache similar_items et le calcul de similarité contenu (Jaccard + TMDB /similar) intégré dans scorer.ts"
skill: service-builder, postgres-expert
status: pending
group: "backend-scoring"
dependencies: ["phase-01-taste-profile-upgrade"]
tags: [phase, implementation, recommendations, similarity, jaccard]
created: 2026-03-04
updated: 2026-03-04
---

# Phase 03: Similarity Score Implementation

**Context:** [[plan|Master Plan]] | **Dependencies:** Phase 01 | **Status:** Pending

---

## Overview

Cette phase implémente le moteur de similarité contenu qui alimente le `similarity_score` réservé depuis le début du projet (0.20 du poids total dans la Phase 04). Elle crée une table `similar_items` pour mettre en cache les résultats TMDB `/similar`, un module `similarity.ts` qui calcule le score via Jaccard sur les features en cache, et intègre ce score dans `scorer.ts`.

**Goal:** Le scorer peut calculer un `similarity_score` pour chaque candidat en comparant ses features aux items aimés par l'utilisateur, en combinant les données TMDB `/similar` cachées et un fallback Jaccard sur `media_features`.

---

## Context & Workflow

### How This Phase Fits Into the Project

- **UI Layer:** Aucun changement visible en Phase 03 — le similarity_score est ajouté au pipeline de scoring mais le poids 0.20 est activé en Phase 04.

- **Server Layer:** `scorer.ts` reçoit une `similarityMap` préchargée et l'utilise dans `scoreItem()`. `route.ts` charge la map et déclenche les refreshes fire-and-forget.

- **Database Layer:** Nouvelle table `similar_items` (migration 015) avec TTL 30 jours. Admin-only en écriture — pas de RLS utilisateur (lecture via admin client depuis le moteur de recommandation).

- **Integrations:** TMDB API `/movie/{id}/similar` et `/tv/{id}/similar` — appelés uniquement pour les top 10 items likés, mis en cache 30 jours.

### User Workflow

**Trigger:** L'utilisateur charge la page "Pour vous" (`/api/recommendations`).

**Steps:**
1. Le route handler charge les top 10 liked items de l'utilisateur.
2. Pour chaque liked item, il vérifie si `similar_items` a des données < 30 jours.
3. Si le cache est frais, les similar_items sont intégrés dans la `similarityMap`.
4. Si le cache est périmé ou absent, un fetch fire-and-forget est déclenché en arrière-plan.
5. `scoreItem()` reçoit la `similarityMap` et calcule un `similarity_score` pour chaque candidat.
6. Le score final inclut maintenant le signal de similarité (0.20 × similarityScore réservé pour Phase 04, en Phase 03 il est calculé mais poids = 0 dans scorer.ts).

**Success Outcome:** Les logs serveur montrent `similarity_score` calculé pour les candidats qui figurent dans les similar_items des liked items.

### Problem Being Solved

**Pain Point:** Le scorer n'utilise pas encore la similarité contenu. Un utilisateur qui a aimé Inception ne voit pas The Prestige remonter — la recommandation repose uniquement sur les genres génériques et la popularité.

**Alternative Approach:** Sans similarity_score, le scorer doit surpondérer taste_score (genres/acteurs) ce qui génère des résultats redondants (genre Sci-Fi toujours en tête, peu de diversité).

### Integration Points

**Upstream Dependencies:**
- Phase 01 (Taste Profile Upgrade) : fournit les interactions enrichies et la liste des liked items avec poids temporels. Les top 10 liked items sont extraits depuis ce profil enrichi.
- `media_features` table (Phase 1 recommandation initiale) : features cachées utilisées pour le Jaccard fallback.

**Downstream Consumers:**
- Phase 04 (Scorer Rebalancing) : active le poids 0.20 × similarity_score dans la formule finale.
- Phase 05 (Pour Vous UI) : peut utiliser `reason_type: "similarity"` avec `reason_detail: "similar_to:12345"` pour les labels Spotify-style.

**Data Flow:**
```
route.ts
  ├── load liked_items (top 10 from interactions)
  ├── load similar_items WHERE source_tmdb_id IN (liked_ids) AND fetched_at > now()-30d
  │     → build similarityMap: Map<"candidateId-type", similarityScore>
  ├── [fire-and-forget] fetchAndCacheSimilarItems() for stale/missing liked_items
  └── scoreItem(profile, item, features, mediaType, friendLikes, friendCount, similarityMap)
        ├── getSimilarityScore(candidateId, likedItemIds, featuresMap)
        │     ├── lookup in similarityMap (TMDB /similar data)
        │     └── fallback: Jaccard(candidate_features, liked_item_features)
        └── similarity_score = max(tmdb_lookup, jaccard_fallback)
```

---

## Prerequisites & Clarifications

**Purpose:** Résoudre les ambiguïtés avant l'implémentation.

### Questions for User

1. **Numéro de migration :** La migration 014 est référencée dans MEMORY.md (interactions.not_interested, media_features, user_taste_profiles, recommendation_cache) mais n'existe pas encore sur le disque (seule 013 existe). Faut-il créer 014 en premier ou numéroter similar_items directement en 015 en supposant que 014 sera créée par une autre phase ?
   - **Context:** L'ordre des migrations détermine l'application en production. Une migration manquante cause des erreurs de déploiement.
   - **Assumptions if unanswered:** On crée `015_similar_items.sql` en supposant que la migration 014 sera créée dans Phase 01 ou une phase antérieure.
   - **Impact:** Si 014 n'est jamais créée, la migration 015 s'applique sur un schéma incomplet (media_features manquante), causant des erreurs FK.

2. **Poids similarity dans scoreItem() :** Phase 03 calcule le similarity_score mais doit-il être inclus dans la formule de score final avec un poids provisoire, ou strictement 0 jusqu'à Phase 04 ?
   - **Context:** Un poids provisoire (ex: 0.05) permet de tester l'effet de la similarité en Phase 03, mais risque d'interférer avec les tests de régression.
   - **Assumptions if unanswered:** Le similarity_score est calculé et stocké dans ScoredItem mais le poids dans la formule reste 0 (réservé Phase 04). La formule existante est inchangée.
   - **Impact:** Si on applique un poids maintenant, les scores changent immédiatement — peut casser des tests de snapshot si existants.

3. **Source des "top 10 liked items" :** Phase 01 enrichit le profil avec watch_history. Les top 10 doivent-ils venir uniquement des `interactions.type = 'like'` explicites, ou inclure les watch_history avec progress >= 80% ?
   - **Context:** Inclure watch_history donne plus de contexte pour la similarité, mais complexifie la requête.
   - **Assumptions if unanswered:** Top 10 = interactions.type = 'like', ORDER BY created_at DESC LIMIT 10. Simple et déterministe.
   - **Impact:** Si watch_history est inclus mais Phase 01 n'est pas encore implémentée, la requête échoue.

4. **Jaccard fallback — champs inclus :** Le Jaccard doit-il pondérer les features (0.30×genres + 0.25×keywords + 0.20×cast + 0.15×director comme dans features.ts) ou utiliser un Jaccard pur sur la concaténation de tous les ids ?
   - **Context:** features.ts documente un format de similarité pondéré. Un Jaccard pur est plus simple à tester et moins opaque.
   - **Assumptions if unanswered:** Jaccard pondéré : 0.40×genres + 0.35×keywords + 0.25×cast. Director ignoré (peu de directors partagés entre films différents). Arrondi à 4 décimales.
   - **Impact:** La pondération change les scores de similarité — à valider manuellement avant Phase 04.

### Validation Checklist

- [ ] Numéro de migration confirmé (014 ou 015)
- [ ] Poids provisoire similarity_score dans scorer.ts confirmé (0 ou valeur)
- [ ] Source des liked items confirmée (interactions seulement vs + watch_history)
- [ ] Formule Jaccard confirmée (pur vs pondéré)
- [ ] Dépendances Phase 01 disponibles avant démarrage

> [!CAUTION]
> Le numéro de migration est critique. Procéder avec une hypothèse non validée peut bloquer le déploiement en production si une migration intermédiaire manque.

---

## Requirements

### Functional

- La table `similar_items` cache les résultats TMDB `/similar` pendant 30 jours par source item.
- `fetchAndCacheSimilarItems(tmdbId, mediaType)` appelle TMDB, filtre les résultats, insère dans `similar_items` (upsert idempotent).
- `getSimilarityScore(candidateTmdbId, candidateMediaType, likedItemIds, featuresMap)` retourne un score [0, 1] combinant TMDB lookup et Jaccard fallback.
- `scoreItem()` dans `scorer.ts` accepte une `similarityMap` optionnelle et calcule le `similarity_score`.
- `route.ts` précharge la `similarityMap` depuis `similar_items` et déclenche les refreshes fire-and-forget pour les top 10 liked items périmés.
- Le `ScoredItem` expose un champ `similarity_score` pour débogage et pour Phase 04.

### Technical

- `import 'server-only'` en tête de `similarity.ts` — le module ne doit jamais être bundlé côté client.
- Admin client (`createAdminClient()`) pour toutes les lectures/écritures `similar_items` — pas de RLS utilisateur sur cette table.
- Jaccard = `|A ∩ B| / |A ∪ B|` sur des `Set<number>` — pas de division par zéro (retourner 0 si union vide).
- Le fetch fire-and-forget ne doit pas bloquer la réponse HTTP — utiliser `void fetchAndCacheSimilarItems(...)` sans `await`.
- Pas de régression sur `scoreItem()` : la signature accepte `similarityMap` comme paramètre optionnel (défaut `undefined`), les tests existants passent sans le fournir.
- Concurrence maximale lors du refresh : traiter les top 10 liked items par batch de 3 avec `Promise.all()` pour respecter les rate limits TMDB.

---

## Decision Log

### Hybrid TMDB + Jaccard Fallback (ADR-03-01)

**Date:** 2026-03-04
**Status:** Accepted

**Context:**
TMDB `/similar` fournit des recommandations de qualité mais est limité aux top liked items. Les candidats non couverts par TMDB /similar auraient un score de 0, perdant le signal de similarité pour la majorité du catalogue.

**Decision:**
Approche hybride : TMDB `/similar` pour les items trouvés dans la map (source primaire), Jaccard sur features pour tous les autres (fallback). Score final = `Math.max(tmdbLookupScore, jaccardScore)`.

**Consequences:**
- Positive : Couverture maximale — tous les candidats avec des features reçoivent un similarity_score.
- Negative : Jaccard sur features est moins précis que le vrai TMDB /similar (pas de métadonnées implicites TMDB).
- Neutral : Le max() favorise toujours la meilleure source disponible sans pondération complexe.

**Alternatives Considered:**
1. TMDB /similar uniquement : Couverture trop faible (~10-20% des candidats).
2. Jaccard uniquement : Ignore les données de co-occurrence TMDB, moins précis pour les items populaires.

---

### Admin-Only RLS sur similar_items (ADR-03-02)

**Date:** 2026-03-04
**Status:** Accepted

**Context:**
`similar_items` est une table de cache interne du moteur de recommandation. Aucun utilisateur ne doit y accéder directement. Le seul consommateur est le route handler `/api/recommendations` via admin client.

**Decision:**
RLS activé sur `similar_items` avec aucune policy utilisateur — seul le service role (admin client) peut lire/écrire. Identique au pattern de `media_features` et `user_taste_profiles`.

**Consequences:**
- Positive : Sécurité maximale — les users ne peuvent pas lire les similar_items d'autres.
- Negative : Aucun accès depuis le client, même en debug — passer par Supabase Studio.
- Neutral : Cohérent avec les autres tables de cache du système.

**Alternatives Considered:**
1. RLS avec accès en lecture pour auth.uid() : Inutile — le client ne consomme jamais ces données directement.

---

## Implementation Steps

### Step 0: Test Definition (TDD)

**Purpose:** Définir les tests d'acceptance avant d'écrire le code d'implémentation.

#### 0.1: Backend Unit Tests

- [ ] Créer `__tests__/recommendations/similarity.test.ts`
- [ ] Écrire les tests avec mocks Supabase admin client + fetch TMDB

```typescript
// __tests__/recommendations/similarity.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock Supabase admin client ────────────────────────────────────────────────
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpsert = vi.fn();
const mockEq = vi.fn();
const mockIn = vi.fn();
const mockGt = vi.fn();
const mockFrom = vi.fn();

const { mockAdminClient } = vi.hoisted(() => {
  const mockAdminClient = {
    from: mockFrom,
  };
  return { mockAdminClient };
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockAdminClient,
}));

// ── Mock fetch global ─────────────────────────────────────────────────────────
global.fetch = vi.fn();

import {
  computeJaccard,
  getSimilarityScore,
  fetchAndCacheSimilarItems,
} from "@/lib/recommendations/similarity";
import type { CandidateFeatures } from "@/lib/recommendations/scorer";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const featureA: CandidateFeatures = {
  tmdb_id: 1,
  media_type: "movie",
  genre_ids: [28, 12, 878],
  keyword_ids: [100, 200, 300, 400],
  cast_ids: [1001, 1002],
  director_ids: [2001],
};

const featureB: CandidateFeatures = {
  tmdb_id: 2,
  media_type: "movie",
  genre_ids: [28, 878],     // 2 genres communs sur 4 union
  keyword_ids: [100, 500],  // 1 keyword commun sur 5 union
  cast_ids: [1001, 1003],   // 1 cast commun sur 3 union
  director_ids: [9999],
};

// ── Tests computeJaccard ──────────────────────────────────────────────────────

describe("computeJaccard", () => {
  it("retourne 0 si les deux sets sont vides", () => {
    expect(computeJaccard([], [])).toBe(0);
  });

  it("retourne 1.0 si les deux sets sont identiques", () => {
    expect(computeJaccard([1, 2, 3], [1, 2, 3])).toBe(1.0);
  });

  it("retourne 0 si les sets sont disjoints", () => {
    expect(computeJaccard([1, 2], [3, 4])).toBe(0);
  });

  it("calcule correctement l'intersection sur union", () => {
    // intersection = {1,2}, union = {1,2,3,4} → 2/4 = 0.5
    const result = computeJaccard([1, 2, 3], [1, 2, 4]);
    expect(result).toBeCloseTo(2 / 3, 4); // intersection {1,2}, union {1,2,3,4}
  });
});

// ── Tests getSimilarityScore ──────────────────────────────────────────────────

describe("getSimilarityScore", () => {
  it("retourne 0 si aucun liked item ni features", () => {
    const score = getSimilarityScore(99, "movie", [], new Map(), new Map());
    expect(score).toBe(0);
  });

  it("utilise le score TMDB si le candidat est dans la similarityMap", () => {
    const similarityMap = new Map([["99-movie", 0.85]]);
    const score = getSimilarityScore(99, "movie", [], new Map(), similarityMap);
    expect(score).toBeCloseTo(0.85);
  });

  it("calcule un Jaccard fallback si le candidat n'est pas dans la similarityMap", () => {
    const featuresMap = new Map([
      ["1-movie", featureA],
      ["2-movie", featureB],
    ]);
    // candidat = item 2, liked = [item 1]
    const score = getSimilarityScore(2, "movie", [{ tmdb_id: 1, media_type: "movie" as const }], featuresMap, new Map());
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("retourne le max entre TMDB score et Jaccard si les deux sont disponibles", () => {
    const similarityMap = new Map([["2-movie", 0.3]]);
    const featuresMap = new Map([
      ["1-movie", featureA],
      ["2-movie", featureB],
    ]);
    const score = getSimilarityScore(2, "movie", [{ tmdb_id: 1, media_type: "movie" as const }], featuresMap, similarityMap);
    // Doit être >= 0.3 (TMDB lookup)
    expect(score).toBeGreaterThanOrEqual(0.3);
  });
});

// ── Tests fetchAndCacheSimilarItems ──────────────────────────────────────────

describe("fetchAndCacheSimilarItems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skip si le cache est frais (fetched_at < 30 jours)", async () => {
    const freshDate = new Date().toISOString();
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [{ fetched_at: freshDate }] }),
          }),
        }),
      }),
    });

    await fetchAndCacheSimilarItems(12345, "movie");
    // fetch TMDB ne doit pas être appelé
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("appelle TMDB /movie/{id}/similar si cache absent ou périmé", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [] }),
          }),
        }),
      }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    });

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          { id: 111, title: "Film A", poster_path: null, vote_average: 7.5, popularity: 100 },
          { id: 222, title: "Film B", poster_path: null, vote_average: 6.8, popularity: 80 },
        ],
      }),
    });

    await fetchAndCacheSimilarItems(12345, "movie");
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/movie/12345/similar"),
      expect.any(Object)
    );
  });

  it("ne plante pas si TMDB retourne une erreur", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [] }),
          }),
        }),
      }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    });

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 404 });

    // Ne doit pas throw
    await expect(fetchAndCacheSimilarItems(99999, "tv")).resolves.toBeUndefined();
  });
});
```

#### 0.2: Tests scorer.ts avec similarityMap

- [ ] Créer `__tests__/recommendations/scorer.test.ts`
- [ ] Tester que scoreItem() accepte similarityMap sans régression

```typescript
// __tests__/recommendations/scorer.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/recommendations/taste-profile", () => ({
  computeTasteScore: vi.fn(() => 0.5), // retourne [0.5] → normalisé 0.75
}));

import { scoreItem } from "@/lib/recommendations/scorer";
import type { TasteProfile } from "@/lib/recommendations/taste-profile";

const mockProfile: TasteProfile = {
  genre_scores: { "28": 0.8, "12": 0.5 },
  director_scores: {},
  actor_scores: {},
  keyword_scores: {},
};

const mockItem = {
  id: 100,
  title: "Test Movie",
  poster_path: null,
  backdrop_path: null,
  vote_average: 7.5,
  vote_count: 1000,
  popularity: 250,
  genre_ids: [28, 12],
  overview: "A test movie",
};

const mockFeatures = {
  tmdb_id: 100,
  media_type: "movie" as const,
  genre_ids: [28, 12],
  keyword_ids: [101, 202],
  cast_ids: [301],
  director_ids: [401],
};

describe("scoreItem", () => {
  it("fonctionne sans similarityMap (régression)", () => {
    const result = scoreItem(mockProfile, mockItem, mockFeatures, "movie");
    expect(result.tmdb_id).toBe(100);
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  it("fonctionne avec similarityMap vide", () => {
    const result = scoreItem(mockProfile, mockItem, mockFeatures, "movie", undefined, undefined, new Map());
    expect(result.score).toBeGreaterThan(0);
  });

  it("expose similarity_score dans le résultat", () => {
    const similarityMap = new Map([["100-movie", 0.75]]);
    const result = scoreItem(mockProfile, mockItem, mockFeatures, "movie", undefined, undefined, similarityMap);
    expect(result).toHaveProperty("similarity_score");
    expect(result.similarity_score).toBeCloseTo(0.75);
  });

  it("similarity_score = 0 si candidat absent de la map et pas de features", () => {
    const result = scoreItem(null, mockItem, undefined, "movie", undefined, undefined, new Map());
    expect(result.similarity_score).toBe(0);
  });
});
```

#### 0.3: Run Tests

- [ ] Exécuter `pnpm test -- --run __tests__/recommendations/` (rouge attendu en phase TDD)
- [ ] Vérifier que l'infrastructure de test fonctionne (pas d'erreurs de configuration)

> [!WARNING]
> Les tests doivent être rouges avant l'implémentation. Si un test passe sans implémentation, il teste mal le comportement attendu.

---

### Step 1: Migration SQL — Table similar_items

#### 1.1: Créer la migration

- [ ] Créer `supabase/migrations/015_similar_items.sql`

```sql
-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 015 — Cache de similarité TMDB
--
-- Table similar_items : stocke les résultats TMDB /movie/{id}/similar
-- et /tv/{id}/similar avec un TTL de 30 jours.
--
-- Pattern : admin-only (service role). Aucune RLS utilisateur — seul le moteur
-- de recommandation (admin client) lit et écrit cette table.
-- ══════════════════════════════════════════════════════════════════════════════


-- ── 1. Table similar_items ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS similar_items (
  source_tmdb_id    INTEGER     NOT NULL,
  source_media_type TEXT        NOT NULL CHECK (source_media_type IN ('movie', 'tv')),
  similar_tmdb_id   INTEGER     NOT NULL,
  similar_media_type TEXT       NOT NULL CHECK (similar_media_type IN ('movie', 'tv')),
  -- Score normalisé [0,1] : position dans la liste TMDB /similar (1er = 1.0, dernier = ~0.5)
  score             NUMERIC(4,3) NOT NULL DEFAULT 0.5,
  fetched_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (source_tmdb_id, source_media_type, similar_tmdb_id)
);

-- Index pour la requête principale : charger tous les similar d'un ensemble de sources
CREATE INDEX IF NOT EXISTS idx_similar_items_source
  ON similar_items (source_tmdb_id, source_media_type);

-- Index pour vérifier le TTL (fetched_at) lors du cache check
CREATE INDEX IF NOT EXISTS idx_similar_items_fetched_at
  ON similar_items (fetched_at);

-- Index pour chercher les items similaires à un candidat donné
CREATE INDEX IF NOT EXISTS idx_similar_items_similar
  ON similar_items (similar_tmdb_id, similar_media_type);


-- ── 2. RLS : admin-only ───────────────────────────────────────────────────────
-- RLS activé mais aucune policy utilisateur — seul le service role peut accéder.
-- Lecture et écriture via createAdminClient() dans le moteur de recommandation.

ALTER TABLE similar_items ENABLE ROW LEVEL SECURITY;

-- Pas de policy SELECT/INSERT/UPDATE/DELETE pour les utilisateurs.
-- Le service role bypasse RLS par défaut — c'est le comportement souhaité.
```

#### 1.2: Vérifier l'idempotence

- [ ] Toutes les instructions utilisent `IF NOT EXISTS`
- [ ] La migration peut être rejouée sans erreur

---

### Step 2: Module similarity.ts

#### 2.1: Créer src/lib/recommendations/similarity.ts

- [ ] Créer le fichier avec `import 'server-only'`
- [ ] Implémenter `computeJaccard()`, `getSimilarityScore()`, `fetchAndCacheSimilarItems()`

```typescript
/**
 * Similarity — Module de similarité contenu pour le moteur de recommandation
 *
 * Deux sources de similarité :
 *   1. TMDB /similar : données de co-occurrence TMDB (source primaire)
 *   2. Jaccard sur features : similarité calculée sur genre_ids + keyword_ids + cast_ids
 *
 * Score final = Math.max(tmdbLookupScore, jaccardScore)
 *
 * Cache : table similar_items avec TTL 30 jours. Les refreshes sont fire-and-forget
 * — un cache périmé n'empêche pas la réponse (Jaccard fallback actif).
 */

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CandidateFeatures } from "./scorer";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LikedItemRef {
  tmdb_id: number;
  media_type: "movie" | "tv";
}

/** Clé de lookup : "{tmdb_id}-{media_type}" → similarityScore [0,1] */
export type SimilarityMap = Map<string, number>;

// ─── Constantes ───────────────────────────────────────────────────────────────

const TMDB_BASE = process.env.NEXT_PUBLIC_TMDB_BASE_URL ?? "https://api.themoviedb.org/3";
const TMDB_KEY  = process.env.NEXT_PUBLIC_TMDB_API_KEY ?? "";

/** TTL du cache similar_items : 30 jours en millisecondes */
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Nombre max de similar items à stocker par source (top N de TMDB /similar) */
const MAX_SIMILAR_ITEMS = 20;

// ─── Jaccard ──────────────────────────────────────────────────────────────────

/**
 * Calcule le coefficient de Jaccard entre deux listes d'entiers.
 * Jaccard = |A ∩ B| / |A ∪ B|
 * Retourne 0 si l'union est vide (évite la division par zéro).
 */
export function computeJaccard(a: number[], b: number[]): number {
  if (a.length === 0 && b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const id of setB) {
    if (setA.has(id)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Calcule un score Jaccard pondéré entre deux jeux de features.
 * Pondération : 0.40×genres + 0.35×keywords + 0.25×cast
 * (les directors sont ignorés — peu de réalisateurs en commun entre films différents)
 */
function jaccardFeatures(a: CandidateFeatures, b: CandidateFeatures): number {
  const genreScore   = computeJaccard(a.genre_ids, b.genre_ids);
  const keywordScore = computeJaccard(a.keyword_ids, b.keyword_ids);
  const castScore    = computeJaccard(a.cast_ids, b.cast_ids);
  return 0.40 * genreScore + 0.35 * keywordScore + 0.25 * castScore;
}

// ─── Score de similarité ──────────────────────────────────────────────────────

/**
 * Calcule le similarity_score d'un candidat par rapport aux liked items.
 *
 * Logique :
 *   1. Lookup dans similarityMap (données TMDB /similar pré-chargées)
 *   2. Fallback Jaccard sur les features disponibles
 *   3. Retourne Math.max(tmdbScore, jaccardScore)
 *
 * @param candidateTmdbId   ID TMDB du candidat à scorer
 * @param candidateMediaType Type du candidat ('movie' | 'tv')
 * @param likedItems        Liste des liked items de l'utilisateur (top 10)
 * @param featuresMap       Map "{tmdb_id}-{media_type}" → CandidateFeatures
 * @param similarityMap     Map "{similar_tmdb_id}-{media_type}" → score TMDB
 */
export function getSimilarityScore(
  candidateTmdbId: number,
  candidateMediaType: "movie" | "tv",
  likedItems: LikedItemRef[],
  featuresMap: Map<string, CandidateFeatures>,
  similarityMap: SimilarityMap
): number {
  const candidateKey = `${candidateTmdbId}-${candidateMediaType}`;

  // 1. Lookup TMDB /similar (le score est déjà agrégé dans la map par route.ts)
  const tmdbScore = similarityMap.get(candidateKey) ?? 0;

  // 2. Jaccard fallback sur features
  const candidateFeatures = featuresMap.get(candidateKey);
  let jaccardScore = 0;

  if (candidateFeatures && likedItems.length > 0) {
    let maxJaccard = 0;
    for (const liked of likedItems) {
      const likedFeatures = featuresMap.get(`${liked.tmdb_id}-${liked.media_type}`);
      if (!likedFeatures) continue;
      const score = jaccardFeatures(candidateFeatures, likedFeatures);
      if (score > maxJaccard) maxJaccard = score;
    }
    jaccardScore = maxJaccard;
  }

  return Math.max(tmdbScore, jaccardScore);
}

// ─── Cache similar_items ──────────────────────────────────────────────────────

/**
 * Vérifie si le cache similar_items est frais pour un source item donné.
 * Retourne true si des données existent et sont < 30 jours.
 */
async function isCacheFresh(tmdbId: number, mediaType: "movie" | "tv"): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;
  const cutoff = new Date(Date.now() - CACHE_TTL_MS).toISOString();

  const { data } = await supabase
    .from("similar_items")
    .select("fetched_at")
    .eq("source_tmdb_id", tmdbId)
    .eq("source_media_type", mediaType)
    .gt("fetched_at", cutoff)
    .limit(1) as { data: Array<{ fetched_at: string }> | null };

  return (data?.length ?? 0) > 0;
}

/**
 * Fetch les items similaires depuis TMDB et les stocke dans similar_items.
 * Idempotent : upsert sur la clé primaire composite.
 * Ne plante jamais — les erreurs sont silencieuses (cache best-effort).
 *
 * À appeler en fire-and-forget depuis route.ts :
 *   void fetchAndCacheSimilarItems(tmdbId, mediaType);
 */
export async function fetchAndCacheSimilarItems(
  tmdbId: number,
  mediaType: "movie" | "tv"
): Promise<void> {
  try {
    // Vérifie le TTL avant de fetcher
    const fresh = await isCacheFresh(tmdbId, mediaType);
    if (fresh) return;

    // Fetch TMDB /similar
    const endpoint = mediaType === "movie"
      ? `/movie/${tmdbId}/similar`
      : `/tv/${tmdbId}/similar`;

    const url = `${TMDB_BASE}${endpoint}?api_key=${TMDB_KEY}&language=fr-FR&page=1`;
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return;

    const data = await res.json() as {
      results: Array<{ id: number; title?: string; name?: string }>;
    };

    const results = (data.results ?? []).slice(0, MAX_SIMILAR_ITEMS);
    if (results.length === 0) return;

    // Score positionnel : premier item = 1.0, dernier ≈ 0.5 (interpolation linéaire)
    const rows = results.map((item, index) => ({
      source_tmdb_id:    tmdbId,
      source_media_type: mediaType,
      similar_tmdb_id:   item.id,
      similar_media_type: mediaType, // TMDB /similar retourne le même type
      score: Number((1.0 - (index / (results.length - 1 || 1)) * 0.5).toFixed(3)),
      fetched_at: new Date().toISOString(),
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createAdminClient() as any;
    await supabase
      .from("similar_items")
      .upsert(rows, { onConflict: "source_tmdb_id,source_media_type,similar_tmdb_id" });

  } catch {
    // Silencieux — le cache est best-effort, le Jaccard fallback prend le relais
  }
}

// ─── Chargement de la similarityMap ──────────────────────────────────────────

/**
 * Charge la similarityMap depuis similar_items pour un ensemble de liked items.
 * Pour chaque candidat potentiel, agrège le score max parmi tous les liked items
 * qui l'ont comme similar_item.
 *
 * Utilisé dans route.ts avant la boucle de scoring.
 *
 * @param likedItems  Top 10 liked items de l'utilisateur
 * @returns SimilarityMap : "{similar_tmdb_id}-{media_type}" → score max [0,1]
 */
export async function loadSimilarityMap(likedItems: LikedItemRef[]): Promise<SimilarityMap> {
  if (likedItems.length === 0) return new Map();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;
  const likedIds = likedItems.map((l) => l.tmdb_id);

  const { data } = await supabase
    .from("similar_items")
    .select("source_tmdb_id, source_media_type, similar_tmdb_id, similar_media_type, score")
    .in("source_tmdb_id", likedIds) as {
      data: Array<{
        source_tmdb_id: number;
        source_media_type: string;
        similar_tmdb_id: number;
        similar_media_type: string;
        score: number;
      }> | null;
    };

  const map: SimilarityMap = new Map();
  for (const row of data ?? []) {
    const key = `${row.similar_tmdb_id}-${row.similar_media_type}`;
    // Garde le score max si plusieurs liked items ont le même similar
    const existing = map.get(key) ?? 0;
    if (row.score > existing) {
      map.set(key, row.score);
    }
  }

  return map;
}
```

#### 2.2: Vérifications

- [ ] `import 'server-only'` présent en première ligne
- [ ] Toutes les fonctions exportées ont un JSDoc
- [ ] Aucun `console.log` — erreurs silencieuses via try/catch
- [ ] `computeJaccard` ne divise jamais par zéro

---

### Step 3: Mise à jour scorer.ts

#### 3.1: Ajouter similarity_score à ScoredItem et scoreItem()

- [ ] Modifier `src/lib/recommendations/scorer.ts`

Ajouter `similarity_score` à `ScoredItem` et `similarityMap` comme paramètre optionnel à `scoreItem()` :

```typescript
// Dans ScoredItem — ajouter le champ
export interface ScoredItem {
  tmdb_id: number;
  media_type: "movie" | "tv";
  score: number;
  reason_type: ReasonType;
  reason_detail?: string;
  /** Score de similarité contenu [0,1] — calculé en Phase 03, pondéré en Phase 04 */
  similarity_score: number;
  // ── Champs d'affichage ──
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

```typescript
// Nouvelle signature de scoreItem() — similarityMap est optionnel pour la rétrocompatibilité
import { getSimilarityScore } from "./similarity";
import type { LikedItemRef, SimilarityMap } from "./similarity";

export function scoreItem(
  profile: TasteProfile | null,
  item: TMDbCandidateItem,
  features: CandidateFeatures | undefined,
  mediaType: "movie" | "tv",
  friendLikes?: Map<string, number>,
  friendCount?: number,
  similarityMap?: SimilarityMap,
  likedItems?: LikedItemRef[],
  featuresMap?: Map<string, CandidateFeatures>
): ScoredItem {
  // ... (logique existante inchangée) ...

  // Similarity score — calculé mais poids = 0 jusqu'à Phase 04
  const similarityScore = similarityMap !== undefined
    ? getSimilarityScore(
        item.id,
        mediaType,
        likedItems ?? [],
        featuresMap ?? new Map(),
        similarityMap
      )
    : 0;

  // ... (reste de la logique de scoring inchangée) ...
  // buildItem reçoit similarityScore en plus
}
```

```typescript
// buildItem mis à jour — ajoute similarity_score
function buildItem(
  item: TMDbCandidateItem,
  mediaType: "movie" | "tv",
  score: number,
  reason_type: ReasonType,
  reason_detail?: string,
  similarity_score = 0
): ScoredItem {
  return {
    tmdb_id: item.id,
    media_type: mediaType,
    score,
    reason_type,
    reason_detail,
    similarity_score,
    title: item.title,
    name: item.name,
    poster_path: item.poster_path,
    backdrop_path: item.backdrop_path,
    vote_average: item.vote_average,
    popularity: item.popularity,
    genre_ids: item.genre_ids ?? [],
    overview: item.overview ?? "",
    release_date: item.release_date,
    first_air_date: item.first_air_date,
  };
}
```

#### 3.2: Vérifications scorer.ts

- [ ] Signature `scoreItem()` rétrocompatible — 4 premiers paramètres obligatoires inchangés
- [ ] `similarity_score` dans tous les chemins de `buildItem()` (avec profil et sans profil)
- [ ] Import de `getSimilarityScore` depuis `./similarity`
- [ ] Les poids existants (0.45 taste + 0.20 social + 0.10 trending + 0.05 quality) sont INCHANGÉS

---

### Step 4: Mise à jour route.ts

#### 4.1: Charger la similarityMap et déclencher les refreshes

- [ ] Modifier `src/app/api/recommendations/route.ts`
- [ ] Ajouter le chargement `loadSimilarityMap` en parallèle avec les autres requêtes
- [ ] Ajouter le fire-and-forget pour les top 10 liked items

```typescript
// Ajout des imports en tête de route.ts
import {
  loadSimilarityMap,
  fetchAndCacheSimilarItems,
} from "@/lib/recommendations/similarity";
import type { LikedItemRef } from "@/lib/recommendations/similarity";
```

```typescript
// Dans le handler GET — après le chargement des interactions (étape 2)

// Top 10 liked items — base du calcul de similarité
const likedItems: LikedItemRef[] = (interacted ?? [])
  .filter((r) => r.type === "like")  // à adapter selon le schéma interactions
  .slice(0, 10)
  .map((r) => ({ tmdb_id: r.tmdb_id, media_type: r.media_type as "movie" | "tv" }));

// Charger la similarityMap en parallèle avec les candidats TMDB
const [moviesP1, moviesP2, tvP1, tvP2, similarityMap] = await Promise.all([
  tmdbPage<TMDbCandidateItem>("/movie/popular", 1),
  tmdbPage<TMDbCandidateItem>("/movie/popular", 2),
  tmdbPage<TMDbCandidateItem>("/tv/popular", 1),
  tmdbPage<TMDbCandidateItem>("/tv/popular", 2),
  loadSimilarityMap(likedItems),
]);

// Fire-and-forget : refresh similar_items pour les liked items périmés
// Limité à 3 concurrent pour respecter les rate limits TMDB
for (let i = 0; i < likedItems.length; i += 3) {
  const batch = likedItems.slice(i, i + 3);
  void Promise.all(batch.map((item) => fetchAndCacheSimilarItems(item.tmdb_id, item.media_type)));
}
```

```typescript
// Dans la boucle de scoring — passer similarityMap et likedItems
for (const m of movieCandidates) {
  scored.push(scoreItem(
    hasProfile ? profile : null,
    m,
    featureMap.get(`${m.id}-movie`),
    "movie",
    friendLikeMap,
    friendCount,
    similarityMap,
    likedItems,
    featureMap
  ));
}
for (const m of tvCandidates) {
  scored.push(scoreItem(
    hasProfile ? profile : null,
    m,
    featureMap.get(`${m.id}-tv`),
    "tv",
    friendLikeMap,
    friendCount,
    similarityMap,
    likedItems,
    featureMap
  ));
}
```

#### 4.2: Vérifications route.ts

- [ ] `loadSimilarityMap` appelé en parallèle (dans le `Promise.all` des candidats TMDB)
- [ ] Fire-and-forget utilise `void` — pas de `await` qui bloquerait la réponse
- [ ] Batch de 3 pour le refresh — pas de boucle qui appelle 10 TMDB en parallel
- [ ] La requête `interacted` sélectionne maintenant aussi le champ `type` (ajout dans le select)

---

### Step 5: Validation finale

#### 5.1: Tests et typecheck

- [ ] `pnpm test -- --run __tests__/recommendations/` — tous les tests passent
- [ ] `pnpm typecheck` — 0 erreurs TypeScript
- [ ] `pnpm lint` — 0 avertissements nouveaux

#### 5.2: Test manuel

- [ ] Charger `/api/recommendations` en étant connecté avec des interactions
- [ ] Vérifier dans les logs serveur que `similarity_score` est calculé
- [ ] Vérifier dans Supabase Studio que `similar_items` se peuple après le premier appel

---

## Verifiable Acceptance Criteria

**Critical Path:**

- [ ] La migration `015_similar_items.sql` s'applique sans erreur sur un schéma frais
- [ ] `fetchAndCacheSimilarItems(550, 'movie')` insère des lignes dans `similar_items` (vérifiable via Supabase Studio)
- [ ] `computeJaccard([28, 12], [28, 878])` retourne `0.333...` (1 intersection sur 3 union)
- [ ] `scoreItem()` sans `similarityMap` retourne le même résultat qu'avant Phase 03 (régression)
- [ ] `scoreItem()` avec `similarityMap` retourne un `ScoredItem` avec `similarity_score > 0` si le candidat est dans la map
- [ ] `/api/recommendations` retourne sans erreur après les modifications de route.ts

**Quality Gates:**

- [ ] Tests unitaires : couverture >80% des fonctions de `similarity.ts`
- [ ] Aucune fuite d'erreur TMDB vers le client — toutes les erreurs sont silencieuses dans `fetchAndCacheSimilarItems`
- [ ] Pas de régression sur les scores existants (le poids similarity_score dans la formule reste 0)
- [ ] Temps de réponse `/api/recommendations` < 4s en cold cache (similarityMap chargement parallèle)

**Integration:**

- [ ] `loadSimilarityMap([])` retourne `new Map()` sans appel Supabase
- [ ] Après 3+ appels à `/api/recommendations`, `similar_items` contient des lignes avec `fetched_at` récent
- [ ] `ScoredItem.similarity_score` est exposé dans la réponse JSON (Phase 04 et 05 pourront l'utiliser)

---

## Quality Assurance

### Test Plan

#### Manual Testing

- [ ] **Cache TTL :** Appeler `/api/recommendations` deux fois. Le deuxième appel ne doit pas fetch TMDB (logs silencieux). Vider `similar_items` dans Supabase Studio, appeler à nouveau — TMDB doit être fetché.
  - Expected: Premier appel = fetch TMDB ; deuxième appel = cache hit (pas de fetch)
  - Actual: À mesurer

- [ ] **Similarité visible :** Avec un utilisateur qui a liké Inception (tmdb_id=27205), vérifier que The Dark Knight (ou films similaires TMDB) remonte dans les recommandations avec `similarity_score > 0`.
  - Expected: Les films dans similar_items d'Inception ont similarity_score proche de 1.0
  - Actual: À mesurer

- [ ] **Régression :** Avec un utilisateur sans interactions, `/api/recommendations` retourne les mêmes items qu'avant Phase 03 (popularité + qualité).
  - Expected: Même ordre que pré-Phase-03
  - Actual: À mesurer

#### Automated Testing

```bash
# Unit tests
pnpm test -- --run __tests__/recommendations/

# Typecheck complet
pnpm typecheck

# Lint
pnpm lint
```

#### Performance Testing

- [ ] **loadSimilarityMap latency :** Target < 100ms (requête Supabase avec index sur source_tmdb_id)
- [ ] **fetchAndCacheSimilarItems latency :** Target < 500ms par item (TMDB API + upsert)
- [ ] **Route handler total :** Target < 4s cold, < 1s warm (similarityMap en parallèle des candidats)

### Review Checklist

- [ ] **Code Review Gate :**
  - [ ] Lancer `/code-review plans/260304-reco-upgrade/phase-03-similarity-score.md`
  - [ ] Lire le review à `reviews/code/phase-03.md`
  - [ ] Findings critiques : 0 restant
  - [ ] Lancer `review:security-reviewer` (nouvelle table + admin client)

- [ ] **Code Quality :**
  - [ ] `pnpm test` passe (tous les tests, pas seulement les nouveaux)
  - [ ] `pnpm typecheck` : 0 erreurs
  - [ ] `pnpm lint` : 0 warnings nouveaux
  - [ ] Couverture > 80% sur `similarity.ts`

- [ ] **Error Handling :**
  - [ ] `fetchAndCacheSimilarItems` : erreurs TMDB = retour silencieux (pas de throw)
  - [ ] `loadSimilarityMap` : erreur Supabase = retourne `new Map()` (graceful)
  - [ ] Division par zéro dans Jaccard : impossible (`union === 0 → return 0`)

- [ ] **Security :**
  - [ ] `import 'server-only'` dans `similarity.ts`
  - [ ] Admin client justifié : commentaire `// Admin client — similar_items est une table de cache interne`
  - [ ] Aucune clé API dans les logs ou les réponses JSON
  - [ ] RLS activé sur `similar_items` (migration vérifiée)

- [ ] **Project Pattern Compliance :**
  - [ ] `createAdminClient()` de `@/lib/supabase/admin` (même import que route.ts existant)
  - [ ] `next: { revalidate: 86400 }` sur le fetch TMDB (même pattern que features.ts)
  - [ ] Commentaires en français pour la logique métier
  - [ ] JSDoc en anglais sur les fonctions exportées

---

## Dependencies

### Upstream (Required Before Starting)

- **Phase 01 (Taste Profile Upgrade):** Fournit les interactions enrichies avec le champ `type` et potentiellement watch_history. La requête `likedItems` dans route.ts dépend du schéma d'interactions mis à jour.
- **Migration 014 :** La table `media_features` référencée par le Jaccard fallback doit exister avant que `015_similar_items.sql` soit appliquée.
- **`src/lib/recommendations/scorer.ts` :** Doit exister et exporter `scoreItem`, `ScoredItem`, `CandidateFeatures`.

### Downstream (Will Use This Phase)

- **Phase 04 (Scorer Rebalancing) :** Activera le poids `0.20 × similarity_score` dans la formule finale. Dépend du champ `similarity_score` dans `ScoredItem`.
- **Phase 05 (Pour Vous UI) :** Pourra afficher `"Parce que vous avez regardé X"` en lisant `reason_type: "similarity"` et `reason_detail: "similar_to:tmdbId"` (Phase 04 ajoutera ce reason_type).

### External Services

- **TMDB API :** Endpoints `/movie/{id}/similar` et `/tv/{id}/similar`. Rate limit : 40 req/s. Authentification via `NEXT_PUBLIC_TMDB_API_KEY`.
- **Supabase :** Table `similar_items` via admin client (service role key `SUPABASE_SERVICE_ROLE_KEY`).

---

## Completion Gate

### Sign-off

- [ ] Migration `015_similar_items.sql` appliquée en local et vérifiée dans Supabase Studio
- [ ] Tous les tests unitaires passent (`pnpm test`)
- [ ] TypeScript propre (`pnpm typecheck`)
- [ ] Lint propre (`pnpm lint`)
- [ ] Code review passé (0 findings critiques)
- [ ] `similar_items` se peuple après appel à `/api/recommendations`
- [ ] `scoreItem()` sans `similarityMap` retourne des résultats identiques à pré-Phase-03
- [ ] Phase 03 marquée DONE dans `plan.md`
- [ ] Commit : `feat(recommendations): phase 03 — similarity score implementation`

---

## Notes

### Technical Considerations

- **Ordre des paramètres dans `scoreItem()` :** Les nouveaux paramètres (`similarityMap`, `likedItems`, `featuresMap`) sont ajoutés en fin de signature pour garantir la rétrocompatibilité. Les appels existants sans ces paramètres continuent de fonctionner avec `similarity_score = 0`.
- **`featuresMap` passé deux fois :** Le route handler construit `featureMap` pour le scoring existant. La même map est réutilisée comme `featuresMap` pour le Jaccard dans `getSimilarityScore()` — pas de duplication de requête.
- **Score positionnel TMDB :** Le premier item dans `/similar` reçoit 1.0, le dernier reçoit 0.5. Ceci reflète la pertinence décroissante dans la liste TMDB sans éliminer les items en queue.

### Known Limitations

- **similar_items cross-type :** TMDB `/movie/{id}/similar` retourne uniquement des films, `/tv/{id}/similar` retourne uniquement des séries. La similarité cross-type (liked film → similar série) n'est pas couverte en Phase 03 — le Jaccard fallback handle partiellement ce cas.
- **Pas de warm-up :** Au premier chargement pour un nouvel utilisateur, la similarityMap sera vide et le fire-and-forget alimentera le cache pour les requêtes suivantes. Les premières recommandations ne bénéficient pas du similarity_score.
- **Concurrence fire-and-forget :** Les refreshes par batch de 3 ignorent les erreurs de rate limiting TMDB. Si le rate limit est atteint, certains items ne sont pas cachés mais le Jaccard fallback reste actif.

### Future Enhancements

- **Phase 04 :** Activation du poids `0.20 × similarity_score` dans la formule finale de `scoreItem()`, et ajout du `reason_type: "similarity"` avec `reason_detail: "similar_to:{tmdbId}"`.
- **Warm-up job :** Un cron job pourrait pré-remplir `similar_items` pour tous les utilisateurs actifs toutes les nuits, éliminant le cold start du similarity_score.
- **Cross-type similarity :** Chercher dans les keywords/cast partagés entre films et séries du même univers créatif.

---

**Previous:** [[phase-02-candidate-pipeline|Phase 02: Candidate Pipeline Diversification]]
**Next:** [[phase-04-scorer-rebalancing|Phase 04: Scorer Rebalancing]]
