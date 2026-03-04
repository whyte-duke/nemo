---
title: "Phase 05: Pour Vous UI Enhancement"
description: "Enrichir la page Pour Vous avec des sections contextuelles (Parce que vous avez regardé X), la séparation Films/Séries, des labels enrichis par raison, un skeleton loading et un bouton Pas intéressé."
skill: vercel-react-best-practices
status: pending
group: "frontend-ui"
dependencies: ["phase-04-scorer-rebalancing"]
tags: [phase, implementation, frontend, recommendations, ui]
created: 2026-03-04
updated: 2026-03-04
---

<!--
PHASE SIZE CONSTRAINTS:
- Target: 10-15KB file max
- If getting large, split into multiple phases
- Each phase = single implementation session

GROUP FIELD:
- Connected phases share a group name
- Groups define audit boundaries
- A phase belongs to exactly one group
-->

# Phase 05: Pour Vous UI Enhancement

**Context:** [[plan|Master Plan]] | **Dependencies:** Phase 04 | **Status:** Pending

---

## Overview

Cette phase enrichit la page `/pour-vous` avec une expérience utilisateur personnalisée et visuellement riche. Elle exploite les nouveaux `reason_type` (`similarity`) et `reason_detail` (`similarity:sourceTitle`, `genre:28`, `social:3`) produits par les phases backend précédentes.

**Goal:** Transformer la page Pour Vous en un feed personnalisé avec sections contextuelles ("Parce que vous avez regardé Dune"), séparation Films/Séries, labels enrichis par raison, skeleton loading et bouton "Pas intéressé" discret sur chaque carte.

---

## Context & Workflow

### How This Phase Fits Into the Project

- **UI Layer:** `src/app/(main)/pour-vous/page.tsx` — refactoring complet du composant `PourVousPage`
  - Ajout d'une section `SimilarityRow` pour le `reason_type = "similarity"`
  - Onglets ou sections Films / Séries filtrés par `media_type`
  - Labels enrichis dans `REASON_CONFIG` et `context.tsx`
  - Skeleton loading via `isLoading` prop de `MediaRow` (déjà supporté)
  - Bouton "Pas intéressé" via `onNotInterested` prop de `MediaRow` (déjà supporté)

- **Server Layer:** Aucune modification du backend nécessaire. La page consomme `/api/recommendations?limit=50` qui retourne déjà des `ScoredItem[]` avec `reason_type` et `reason_detail`.

- **Database Layer:** Aucune migration requise. `interactions.not_interested` existe déjà (Migration 014). L'API `/api/interactions` POST avec `notInterested: true` est déjà implémentée.

- **Integrations:** Aucune nouvelle intégration externe. `TMDB_GENRE_NAMES` dans `src/lib/tmdb/genres.ts` est utilisé pour les labels genre.

### User Workflow

**Trigger:** L'utilisateur navigue vers `/pour-vous`.

**Steps:**
1. La page affiche un skeleton loading pendant le fetch (`useQuery` isLoading = true)
2. Les recommandations arrivent et sont groupées : d'abord une section "Parce que vous avez regardé X" (similarity), puis Films → sections par raison, puis Séries → sections par raison
3. Chaque section affiche un label enrichi (ex : "Correspondance avec vos goûts • Action", "2 amis ont aimé")
4. L'utilisateur peut survoler une carte et cliquer le bouton "Pas intéressé" (icône EyeOff discrète) — la carte disparaît via le contexte `UserInteractions`

**Success Outcome:** L'utilisateur voit un feed organisé et compréhensible, avec une section dédiée aux contenus similaires à ce qu'il a regardé, et peut signaler rapidement qu'un titre ne l'intéresse pas.

### Problem Being Solved

**Pain Point:** Actuellement, toutes les recommandations sont dans des sections génériques ("Correspondant à vos goûts", "Tendances") sans contexte. L'utilisateur ne comprend pas pourquoi un titre lui est recommandé.

**Alternative Approach:** Sans cette phase, les nouvelles données de similarité (Phase 03) et le nouveau scoring (Phase 04) seraient invisibles pour l'utilisateur — leur valeur serait perdue.

### Integration Points

**Upstream Dependencies:**
- Phase 04 (Scorer Rebalancing) : produit des `ScoredItem` avec `reason_type = "similarity"` et `reason_detail = { sourceTitle: "Titre Source", sourceTmdbId: 123 }` (objet `ReasonDetail` de `@/types/recommendations`)
- `MediaRow` (existant) : prop `onNotInterested` déjà disponible, prop `isLoading` pour skeleton
- `UserInteractionsContext` (existant) : `markNotInterested()` et `isExcluded()` déjà implémentés

**Downstream Consumers:**
- Aucun — c'est la dernière phase du plan.

**Data Flow:**
```
/api/recommendations?limit=50
         │
         ▼
  RecommendationsResponse { items: ScoredItem[], hasProfile: boolean }
         │
         ├─ filter(media_type === "movie")
         │      ├─ group by reason_type
         │      │      ├─ similarity → MediaRow("Parce que vous avez regardé [reason_detail.sourceTitle]")
         │      │      ├─ taste_match → MediaRow("Correspondance • [genre]")
         │      │      ├─ social → MediaRow("[N] amis ont aimé")
         │      │      ├─ quality → MediaRow("Hautement noté")
         │      │      └─ trending → MediaRow("Populaire en ce moment")
         │
         └─ filter(media_type === "tv")
                └─ (même structure)
```

---

## Prerequisites & Clarifications

**Purpose:** Résoudre les ambiguïtés avant l'implémentation.

### Questions for User

1. **Séparation Films/Séries — tabs ou sections ?**
   - **Context:** Il y a deux approches : (A) deux onglets cliquables "Films" / "Séries" avec état local, ou (B) deux sections séquentielles sur la même page avec un sous-titre "Films" puis "Séries".
   - **Assumptions if unanswered:** Sections séquentielles (option B) — plus simple, pas d'état supplémentaire, correspond au pattern existant de la page.
   - **Impact:** Avec les tabs, la section Séries est cachée par défaut, ce qui peut masquer des recommandations importantes.

2. **Section similarity — une row par sourceTitle ou une seule row groupée ?**
   - **Context:** Si l'utilisateur a aimé 5 films, il pourrait y avoir 5 rows "Parce que vous avez regardé X". C'est potentiellement trop.
   - **Assumptions if unanswered:** Maximum 2 rows similarity par type de média (les 2 sourceTitles les plus fréquents parmi les items). Les items similarity restants tombent dans la section `taste_match` si applicable, sinon sont ignorés.
   - **Impact:** Si groupé en une seule row, on perd la clarté du "pourquoi". Si trop de rows, la page devient longue.

3. **Bouton "Pas intéressé" — visible au hover ou toujours visible ?**
   - **Context:** Sur mobile, le hover n'existe pas. Le bouton doit être accessible sur touch.
   - **Assumptions if unanswered:** Visible uniquement au hover sur desktop, toujours visible (petit, discret) sur mobile (via CSS `sm:opacity-0 sm:group-hover:opacity-100 opacity-100`).
   - **Impact:** Toujours visible peut alourdir visuellement les MediaCards.

4. **Label "similarity" — inclure le type (Film/Série) dans le label ?**
   - **Context:** "Parce que vous avez regardé Dune" vs "Parce que vous avez regardé Dune (Film)".
   - **Assumptions if unanswered:** Sans le type — plus concis. Le titre seul suffit dans la plupart des cas.
   - **Impact:** Pour les titres ambigus (ex : Dune existe en film et série), l'absence du type peut créer une confusion mineure.

5. **Skeleton — combien de cartes placeholder ?**
   - **Context:** `MediaRow` avec `isLoading={true}` affiche déjà 8 SkeletonCards. Faut-il afficher plusieurs rows skeleton ou une seule ?
   - **Assumptions if unanswered:** 3 rows skeleton (simulate taste_match, similarity, trending) avec `isLoading={true}` pendant le chargement.
   - **Impact:** Trop de skeleton rows peut donner une impression de lenteur.

### Validation Checklist

- [ ] Toutes les questions répondues ou hypothèses approuvées
- [ ] L'utilisateur a confirmé les attentes sur les deliverables
- [ ] Phase 04 marquée DONE (ScoredItem inclut `reason_type = "similarity"` et `reason_detail: ReasonDetail` avec `{ sourceTitle, sourceTmdbId }`)
- [ ] Aucune variable d'environnement supplémentaire requise
- [ ] `TMDB_GENRE_NAMES` accessible depuis `@/lib/tmdb/genres`

> [!CAUTION]
> La Phase 04 doit être terminée avant de commencer cette phase — le `reason_type = "similarity"` doit exister dans les données retournées par `/api/recommendations`. Vérifier les fixtures de test avant d'implémenter.

---

## Requirements

### Functional

- Afficher une section "Parce que vous avez regardé [X]" pour le `reason_type = "similarity"`, avec `sourceTitle` extrait de `reason_detail.sourceTitle` (objet `ReasonDetail` de `@/types/recommendations`)
- Séparer Films et Séries sur la page (sections séquentielles : Films d'abord, puis Séries)
- Labels enrichis par raison : `taste_match` → "Correspondance avec vos goûts • [genre]", `social` → "[N] amis ont aimé", `similarity` → "Similaire à [titre]", `quality` → "Hautement noté", `trending` → "Populaire en ce moment"
- Skeleton loading : afficher 3 `MediaRow` avec `isLoading={true}` pendant le fetch
- Bouton "Pas intéressé" : appeler `POST /api/interactions` avec `notInterested: true`, puis invalider le cache `useQuery`

### Technical

- Utiliser les composants existants : `MediaRow`, `DetailModal`, `MovieWatchModal` — ne pas créer de nouveaux composants UI de base
- `motion/react` pour les animations si nécessaire (pas framer-motion)
- Texte UI en français
- Dériver toutes les données (groupes, labels, filtres) pendant le render — pas de `useEffect` pour état dérivé
- `data-test` attributes sur tous les éléments interactifs : bouton "Pas intéressé", tabs Films/Séries si implémentés
- `useQuery` avec `staleTime: 15 * 60 * 1000` (inchangé)
- Invalidation du cache après action "Pas intéressé" : `queryClient.invalidateQueries({ queryKey: ["recommendations", "full"] })`

---

## Decision Log

### Sections séquentielles plutôt que tabs (ADR-05-01)

**Date:** 2026-03-04
**Status:** Proposed

**Context:**
La séparation Films/Séries peut se faire via onglets ou sections. Les tabs nécessitent un état local (`activeTab`) et cachent la moitié du contenu par défaut.

**Decision:**
Sections séquentielles : Films en premier (sous-titre "Films"), puis Séries (sous-titre "Séries"). Pas d'état supplémentaire, tout le contenu visible au scroll.

**Consequences:**
- **Positive:** Pas de state management, pas de contenu caché, pattern cohérent avec la page existante
- **Negative:** Page plus longue si l'utilisateur a beaucoup de recommandations films ET séries
- **Neutral:** L'utilisateur peut toujours scroller pour voir les deux types

**Alternatives Considered:**
1. Tabs Films/Séries : rejeté — cache du contenu par défaut, ajoute de la complexité
2. Mélange actuel sans séparation : rejeté — objectif explicite de la phase est la séparation

---

### Pas de nouveau composant SimilarityRow — réutiliser MediaRow (ADR-05-02)

**Date:** 2026-03-04
**Status:** Accepted

**Context:**
La section "Parce que vous avez regardé X" pourrait justifier un composant dédié `SimilarityRow`. Mais `MediaRow` accepte déjà un `title` configurable.

**Decision:**
Passer le titre dynamique à `MediaRow` directement : `title="Parce que vous avez regardé Dune"`. Pas de nouveau composant.

**Consequences:**
- **Positive:** Aucune nouvelle dépendance, réutilisation maximale
- **Negative:** Le titre de la MediaRow encode le "sourceTitle" — si le design évolue (icône spéciale, lien vers le film source), il faudra un composant dédié
- **Neutral:** Pattern cohérent avec les autres sections de la page

**Alternatives Considered:**
1. `SimilarityRow` avec lien cliquable vers le titre source : différé — complexité hors scope Phase 05

---

### Labels enrichis dans context.tsx, pas dans page.tsx (ADR-05-03)

**Date:** 2026-03-04
**Status:** Accepted

**Context:**
Les labels de reason pourraient être définis dans `REASON_CONFIG` dans `page.tsx` (déjà présent) ou dans `context.tsx` via `useRecommendationLabel` (déjà présent pour les badges MediaCard).

**Decision:**
Mettre à jour `useRecommendationLabel` dans `context.tsx` pour supporter `similarity`. La constante `REASON_CONFIG` dans `page.tsx` garde les labels de section (icône + titre de groupe). Les deux coexistent pour des usages différents.

**Consequences:**
- **Positive:** `useRecommendationLabel` est réutilisé sur les MediaCards individuelles (badges) — mise à jour en un seul endroit
- **Negative:** Deux sources de labels (context.tsx pour cards, page.tsx pour sections) — légère duplication conceptuelle
- **Neutral:** Pattern existant — ne pas casser la cohérence du code

---

## Implementation Steps

### Step 0: Test Definition (TDD)

**Purpose:** Définir les tests d'acceptation avant d'écrire le code d'implémentation.

#### 0.1: Tests du composant PourVousPage

Créer `__tests__/pour-vous/PourVousPage.test.tsx` :

- [ ] Créer le fichier de test
- [ ] Écrire les tests avec assertions réelles (pas de `it.todo` pour les cas critiques)
- [ ] Définir les fixtures et mocks via `vi.mock()` et `vi.hoisted()`

```typescript
// @vitest-environment happy-dom
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock useQuery avant tout import
const { mockUseQuery } = vi.hoisted(() => ({
  mockUseQuery: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: mockUseQuery,
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
}));

vi.mock("@/lib/recommendations/user-interactions-context", () => ({
  useUserInteractions: vi.fn(() => ({
    isExcluded: vi.fn(() => false),
    markNotInterested: vi.fn(),
  })),
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: vi.fn(() => ({ user: { id: "user-1" } })),
}));

import PourVousPage from "@/app/(main)/pour-vous/page";

const makeScoredItem = (
  tmdbId: number,
  mediaType: "movie" | "tv",
  reasonType: string,
  reasonDetail?: string
) => ({
  tmdb_id: tmdbId,
  media_type: mediaType,
  score: 0.8,
  reason_type: reasonType,
  reason_detail: reasonDetail,
  title: mediaType === "movie" ? `Film ${tmdbId}` : undefined,
  name: mediaType === "tv" ? `Série ${tmdbId}` : undefined,
  poster_path: null,
  backdrop_path: null,
  vote_average: 7.5,
  popularity: 100,
  genre_ids: [28],
  overview: "Synopsis",
});

describe("PourVousPage", () => {
  beforeEach(() => {
    mockUseQuery.mockReturnValue({ isLoading: false, data: undefined });
  });

  it("affiche le skeleton pendant le chargement", () => {
    mockUseQuery.mockReturnValue({ isLoading: true, data: undefined });
    render(<PourVousPage />);
    // 3 sections skeleton doivent être présentes
    const skeletonSections = screen.getAllByRole("region", { name: /chargement/i });
    expect(skeletonSections.length).toBeGreaterThanOrEqual(1);
  });

  it("affiche le message vide si hasProfile est false", () => {
    mockUseQuery.mockReturnValue({
      isLoading: false,
      data: { items: [], hasProfile: false },
    });
    render(<PourVousPage />);
    expect(screen.getByText(/aucune recommandation/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /commencer à découvrir/i })).toBeInTheDocument();
  });

  it("sépare les Films et les Séries en sections distinctes", () => {
    mockUseQuery.mockReturnValue({
      isLoading: false,
      data: {
        hasProfile: true,
        items: [
          makeScoredItem(1, "movie", "taste_match", "genre:28"),
          makeScoredItem(2, "tv", "taste_match", "genre:18"),
        ],
      },
    });
    render(<PourVousPage />);
    expect(screen.getByText("Films")).toBeInTheDocument();
    expect(screen.getByText("Séries")).toBeInTheDocument();
  });

  it("affiche une section similarity avec le titre source", () => {
    mockUseQuery.mockReturnValue({
      isLoading: false,
      data: {
        hasProfile: true,
        items: [
          makeScoredItem(3, "movie", "similarity", "similarity:Dune"),
        ],
      },
    });
    render(<PourVousPage />);
    expect(screen.getByText(/parce que vous avez regardé dune/i)).toBeInTheDocument();
  });

  it("affiche le label enrichi taste_match avec genre", () => {
    mockUseQuery.mockReturnValue({
      isLoading: false,
      data: {
        hasProfile: true,
        items: [makeScoredItem(1, "movie", "taste_match", "genre:28")],
      },
    });
    render(<PourVousPage />);
    // "Action" est le nom du genre 28 dans TMDB_GENRE_NAMES
    expect(screen.getByText(/correspondance.*action/i)).toBeInTheDocument();
  });

  it("affiche le bouton Pas intéressé avec data-test attribute", () => {
    mockUseQuery.mockReturnValue({
      isLoading: false,
      data: {
        hasProfile: true,
        items: [makeScoredItem(1, "movie", "trending")],
      },
    });
    render(<PourVousPage />);
    // Le bouton est rendu par MediaCard via onNotInterested prop
    const notInterestedBtns = document.querySelectorAll("[data-test='not-interested-btn']");
    expect(notInterestedBtns.length).toBeGreaterThan(0);
  });
});
```

#### 0.2: Tests de useRecommendationLabel pour similarity

Mettre à jour `__tests__/recommendations/context.test.ts` (ou créer s'il n'existe pas) :

- [ ] Tester le nouveau cas `reason_type = "similarity"` dans `useRecommendationLabel`
- [ ] Vérifier l'extraction correcte de `sourceTitle` depuis `reason_detail = "similarity:Dune"`

```typescript
import { describe, it, expect } from "vitest";
// Note: useRecommendationLabel est un hook React — tester via renderHook
// ou extraire la logique pure dans une fonction utilitaire testable

describe("getRecommendationLabel (logique pure)", () => {
  it("retourne 'Similaire à Dune' pour reason_type similarity", () => {
    const label = getRecommendationLabel("similarity", "similarity:Dune", 0.75);
    expect(label).toBe("Similaire à Dune");
  });

  it("retourne 'Parce que vous aimez Action' pour taste_match genre:28", () => {
    const label = getRecommendationLabel("taste_match", "genre:28", 0.8);
    expect(label).toBe("Parce que vous aimez l'Action");
  });

  it("retourne '3 de vos amis ont aimé' pour social:3", () => {
    const label = getRecommendationLabel("social", "social:3", 0.6);
    expect(label).toBe("3 de vos amis ont aimé");
  });

  it("retourne 'Hautement noté' pour quality", () => {
    const label = getRecommendationLabel("quality", undefined, 0.7);
    expect(label).toBe("Hautement noté");
  });

  it("retourne 'Populaire en ce moment' pour trending", () => {
    const label = getRecommendationLabel("trending", undefined, 0.5);
    expect(label).toBe("Populaire en ce moment");
  });
});
```

#### 0.3: Exécuter les tests

- [ ] `pnpm test __tests__/pour-vous/` — doit ÉCHOUER initialement (red phase TDD)
- [ ] Confirmer que l'infrastructure de test fonctionne avant d'implémenter

> [!WARNING]
> La phase TDD est obligatoire. Écrire les tests en premier permet de définir le contrat d'interface avant de coder. Les tests doivent échouer avant que le code soit écrit.

---

### Step 1: Mettre à jour `context.tsx` — support de `similarity`

#### 1.1: Mettre à jour le type `ScoredItemClient` et `useRecommendationLabel`

Fichier : `src/lib/recommendations/context.tsx`

- [ ] Ajouter `"similarity"` au type union de `reason_type`
- [ ] Mettre à jour `useRecommendationLabel` pour gérer `similarity`
- [ ] Extraire la logique en fonction pure testable `getRecommendationLabel`

```typescript
// Mise à jour du type (ligne ~11 dans context.tsx actuel)
export interface ScoredItemClient {
  tmdb_id: number;
  media_type: "movie" | "tv";
  score: number;
  reason_type: "taste_match" | "social" | "trending" | "quality" | "similarity";
  reason_detail?: string;
}

// Fonction pure extraite pour testabilité
export function getRecommendationLabel(
  reason_type: ScoredItemClient["reason_type"],
  reason_detail: string | undefined,
  score: number
): string | null {
  if (reason_type === "similarity") {
    if (reason_detail?.startsWith("similarity:")) {
      const sourceTitle = reason_detail.slice(11);
      return `Similaire à ${sourceTitle}`;
    }
    return "Similaire à vos goûts";
  }

  if (reason_type === "taste_match") {
    if (reason_detail?.startsWith("genre:")) {
      const genreId = Number(reason_detail.slice(6));
      const genreName = TMDB_GENRE_NAMES[genreId];
      if (genreName) return `Parce que vous aimez ${genreName}`;
    }
    return score > 0.80 ? "Vous allez adorer" : "Pour vous";
  }

  if (reason_type === "social") {
    if (reason_detail?.startsWith("social:")) {
      const count = Number(reason_detail.slice(7));
      if (count === 1) return "1 de vos amis a aimé";
      if (count > 1) return `${count} de vos amis ont aimé`;
    }
    return "Vos amis ont aimé";
  }

  if (reason_type === "quality") return "Hautement noté";
  if (reason_type === "trending") return "Populaire en ce moment";

  return null;
}

// Hook réutilise la fonction pure
export function useRecommendationLabel(
  tmdbId: number,
  mediaType: string
): string | null {
  const item = useItemRecommendation(tmdbId, mediaType);
  if (!item) return null;
  return getRecommendationLabel(item.reason_type, item.reason_detail, item.score);
}
```

#### 1.2: Mettre à jour le type `ReasonType` dans `scorer.ts`

Fichier : `src/lib/recommendations/scorer.ts`

- [ ] Ajouter `"similarity"` au type union `ReasonType`

```typescript
// Ligne ~44 dans scorer.ts actuel
export type ReasonType = "taste_match" | "social" | "trending" | "quality" | "similarity";
```

---

### Step 2: Refactorer `page.tsx` — sections séquentielles Films/Séries

#### 2.1: Mettre à jour `REASON_CONFIG` avec le label `similarity`

Fichier : `src/app/(main)/pour-vous/page.tsx`

- [ ] Ajouter `similarity` à `REASON_CONFIG`
- [ ] Utiliser `Film` (Lucide) ou `Link2` comme icône pour `similarity`

```typescript
import { Sparkles, TrendingUp, Star, Users, Link2 } from "lucide-react";

const REASON_CONFIG = {
  similarity:  { icon: Link2,      color: "text-purple-400"  },
  taste_match: { icon: Sparkles,   color: "text-indigo-400"  },
  social:      { icon: Users,      color: "text-green-400"   },
  trending:    { icon: TrendingUp, color: "text-blue-400"    },
  quality:     { icon: Star,       color: "text-amber-400"   },
} as const;
```

#### 2.2: Définir les fonctions de groupage (dérivées pendant le render)

- [ ] Créer la fonction `groupByReason` qui regroupe les items par `reason_type`, en extrayant `sourceTitle` pour `similarity`
- [ ] Pas de `useEffect` — tout dérivé pendant le render

```typescript
type ReasonGroup = {
  reason: keyof typeof REASON_CONFIG;
  /** Pour reason_type = "similarity" uniquement */
  sourceTitle?: string;
  /** Label affiché dans le sous-titre de section */
  label: string;
  items: ScoredItem[];
};

/**
 * Groupe les items par reason_type.
 * Pour "similarity", crée une group par sourceTitle distinct (max 2).
 * Retourne les groupes dans l'ordre d'affichage voulu.
 */
function buildReasonGroups(items: ScoredItem[]): ReasonGroup[] {
  const groups: ReasonGroup[] = [];

  // 1. Sections similarity — une par sourceTitle (max 2)
  const similarityItems = items.filter((i) => i.reason_type === "similarity");
  const sourceTitlesMap = new Map<string, ScoredItem[]>();
  for (const item of similarityItems) {
    const sourceTitle = item.reason_detail?.startsWith("similarity:")
      ? item.reason_detail.slice(11)
      : "un titre que vous aimez";
    if (!sourceTitlesMap.has(sourceTitle)) sourceTitlesMap.set(sourceTitle, []);
    sourceTitlesMap.get(sourceTitle)!.push(item);
  }
  let simCount = 0;
  for (const [sourceTitle, simItems] of sourceTitlesMap) {
    if (simCount >= 2) break;
    groups.push({
      reason: "similarity",
      sourceTitle,
      label: `Parce que vous avez regardé ${sourceTitle}`,
      items: simItems,
    });
    simCount++;
  }

  // 2. Sections standard dans l'ordre voulu
  const standardReasons = ["taste_match", "social", "quality", "trending"] as const;
  for (const reason of standardReasons) {
    const reasonItems = items.filter((i) => i.reason_type === reason);
    if (reasonItems.length === 0) continue;

    let label: string;
    if (reason === "taste_match") {
      // Genre dominant du premier item
      const firstDetail = reasonItems[0]?.reason_detail;
      if (firstDetail?.startsWith("genre:")) {
        const genreId = Number(firstDetail.slice(6));
        const genreName = TMDB_GENRE_NAMES[genreId];
        label = genreName ? `Correspondance avec vos goûts • ${genreName}` : "Correspondance avec vos goûts";
      } else {
        label = "Correspondance avec vos goûts";
      }
    } else if (reason === "social") {
      // Nombre d'amis depuis le premier item avec social: detail
      const socialDetail = reasonItems.find((i) => i.reason_detail?.startsWith("social:"))?.reason_detail;
      const count = socialDetail ? Number(socialDetail.slice(7)) : 0;
      label = count > 1 ? `${count} amis ont aimé` : count === 1 ? "1 ami a aimé" : "Aimé par vos amis";
    } else if (reason === "quality") {
      label = "Hautement noté";
    } else {
      label = "Populaire en ce moment";
    }

    groups.push({ reason, label, items: reasonItems });
  }

  return groups;
}
```

#### 2.3: Implémenter la fonction `handleNotInterested`

- [ ] Appeler `POST /api/interactions` avec `notInterested: true`
- [ ] Invalider le cache `useQuery` via `queryClient`
- [ ] Utiliser `useQueryClient` de `@tanstack/react-query`

```typescript
import { useQuery, useQueryClient } from "@tanstack/react-query";

// Dans PourVousPage :
const queryClient = useQueryClient();

const handleNotInterested = useCallback(
  async (item: { id: number }, type: "movie" | "tv") => {
    // Fire-and-forget — l'UI se met à jour via UserInteractionsContext
    void fetch("/api/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tmdbId: item.id,
        mediaType: type,
        type: null,
        notInterested: true,
      }),
    }).then(() => {
      void queryClient.invalidateQueries({ queryKey: ["recommendations", "full"] });
    });
  },
  [queryClient]
);
```

#### 2.4: Reconstruire le JSX de la page avec sections Films/Séries

- [ ] Afficher 3 `MediaRow` skeleton pendant `isLoading`
- [ ] Séparer les items par `media_type` : films d'abord, puis séries
- [ ] Appeler `buildReasonGroups` pour chaque type — dérivé pendant le render (pas d'useEffect)
- [ ] Passer `onNotInterested` à chaque `MediaRow`
- [ ] Ajouter `data-test` sur les éléments interactifs

```typescript
// ─── Skeleton loading ─────────────────────────────────────────────────────────
if (isLoading) {
  return (
    <div className="pt-6 pb-12 space-y-10" data-test="pour-vous-page-loading">
      {/* En-tête */}
      <div className="px-4 sm:px-6 flex items-center gap-3">
        <Sparkles className="size-5 text-indigo-400" />
        <h1 className="text-white text-xl font-bold">Pour vous</h1>
      </div>
      {/* 3 rows skeleton */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-3" aria-label="chargement">
          <div className="px-4 sm:px-6">
            <div className="h-4 w-48 skeleton rounded-full" />
          </div>
          <MediaRow
            title=""
            items={[]}
            mediaType="movie"
            isLoading={true}
          />
        </div>
      ))}
    </div>
  );
}

// ─── Données disponibles ────────────────────────────────────────────────────
const items = data?.items ?? [];

// Dérivé pendant le render — pas de useEffect
const movieItems = items.filter((i) => i.media_type === "movie");
const tvItems    = items.filter((i) => i.media_type === "tv");
const movieGroups = buildReasonGroups(movieItems);
const tvGroups    = buildReasonGroups(tvItems);

// ─── Rendu d'un groupe de section ──────────────────────────────────────────
function renderGroup(group: ReasonGroup, keyPrefix: string) {
  const config = REASON_CONFIG[group.reason];
  const Icon = config.icon;
  return (
    <div key={`${keyPrefix}-${group.reason}-${group.sourceTitle ?? ""}`} className="space-y-3">
      <div className="px-4 sm:px-6 flex items-center gap-2">
        <Icon className={`size-4 ${config.color}`} />
        <span className="text-white/60 text-sm font-medium">{group.label}</span>
      </div>
      <MediaRow
        title=""
        items={group.items.map(toMediaItem) as unknown as Parameters<typeof MediaRow>[0]["items"]}
        mediaType={group.reason === "similarity" ? (group.items[0]?.media_type ?? "movie") : keyPrefix === "movie" ? "movie" : "tv"}
        onPlay={(item) => {
          const scored = group.items.find((s) => s.tmdb_id === item.id);
          if (scored) handlePlay({ id: item.id }, scored.media_type);
        }}
        onMoreInfo={(item) => {
          const scored = group.items.find((s) => s.tmdb_id === item.id);
          if (scored) handleMoreInfo({ id: item.id }, scored.media_type);
        }}
        onNotInterested={(item) => {
          const scored = group.items.find((s) => s.tmdb_id === item.id);
          if (scored) void handleNotInterested({ id: item.id }, scored.media_type);
        }}
        hideIfSeen={true}
      />
    </div>
  );
}

return (
  <div className="pt-6 pb-12 space-y-10" data-test="pour-vous-page">
    {/* En-tête */}
    <div className="px-4 sm:px-6 flex items-center gap-3">
      <Sparkles className="size-5 text-indigo-400" />
      <h1 className="text-white text-xl font-bold">Pour vous</h1>
      <span className="text-white/30 text-sm">— {items.length} titres</span>
    </div>

    {/* Section Films */}
    {movieGroups.length > 0 && (
      <div className="space-y-8">
        <div className="px-4 sm:px-6">
          <h2 className="text-white/40 text-xs font-semibold uppercase tracking-widest">Films</h2>
        </div>
        {movieGroups.map((g) => renderGroup(g, "movie"))}
      </div>
    )}

    {/* Section Séries */}
    {tvGroups.length > 0 && (
      <div className="space-y-8">
        <div className="px-4 sm:px-6">
          <h2 className="text-white/40 text-xs font-semibold uppercase tracking-widest">Séries</h2>
        </div>
        {tvGroups.map((g) => renderGroup(g, "tv"))}
      </div>
    )}

    {/* Lien enrichir le profil */}
    <div className="px-4 sm:px-6">
      <Link
        href="/decouvrir"
        data-test="swipe-more-link"
        className="flex items-center gap-2 text-white/40 hover:text-white/70 text-sm transition-colors"
      >
        <Sparkles className="size-4" />
        Swiper plus de films pour améliorer vos recommandations
      </Link>
    </div>

    {detailId && (
      <DetailModal
        media={(activeDetail as TMDbMovieDetail | TMDbTVShowDetail) ?? null}
        open={!!detailId}
        onClose={() => setDetailId(null)}
        mediaType={detailId.type}
        onPlay={(media) => {
          setDetailId(null);
          handlePlay(media as { id: number }, detailId.type);
        }}
      />
    )}

    <MovieWatchModal
      open={watchMovieId !== null}
      onClose={() => setWatchMovieId(null)}
      movieId={watchMovieId ?? 0}
    />
  </div>
);
```

---

### Step 3: Vérifier `TMDB_GENRE_NAMES` et import dans `page.tsx`

#### 3.1: Ajouter l'import de `TMDB_GENRE_NAMES` dans `page.tsx`

Fichier : `src/app/(main)/pour-vous/page.tsx`

- [ ] Importer `TMDB_GENRE_NAMES` depuis `@/lib/tmdb/genres`

```typescript
import { TMDB_GENRE_NAMES } from "@/lib/tmdb/genres";
```

---

### Step 4: Vérifier le `data-test` sur le bouton "Pas intéressé" dans `MediaCard`

#### 4.1: Localiser `MediaCard` et vérifier/ajouter `data-test`

Fichier : `src/components/media/MediaCard.tsx` (à localiser avec Glob)

- [ ] Chercher le bouton "Pas intéressé" existant dans `MediaCard`
- [ ] Ajouter `data-test="not-interested-btn"` s'il n'est pas déjà présent
- [ ] Vérifier que le bouton appelle correctement `onNotInterested`

```typescript
// Dans MediaCard, le bouton Pas intéressé (pattern attendu) :
<button
  data-test="not-interested-btn"
  aria-label="Pas intéressé"
  onClick={(e) => {
    e.stopPropagation();
    onNotInterested?.(item);
  }}
  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 opacity-100 transition-opacity"
>
  <EyeOff className="size-4 text-white/60 hover:text-white" />
</button>
```

---

### Step 5: Tests finaux et vérification

#### 5.1: Exécuter la suite complète

- [ ] `pnpm test __tests__/pour-vous/` — tous les tests doivent PASSER (green phase)
- [ ] `pnpm test __tests__/recommendations/` — pas de régression sur context.tsx
- [ ] `pnpm typecheck` — pas d'erreurs TypeScript
- [ ] `pnpm lint` — pas d'erreurs ESLint

#### 5.2: Test manuel dans le navigateur

- [ ] Naviguer vers `/pour-vous` avec un compte qui a des interactions
- [ ] Vérifier que les sections Films et Séries apparaissent séparément
- [ ] Vérifier que les sections "Parce que vous avez regardé X" apparaissent si des items `similarity` sont présents
- [ ] Vérifier que le skeleton s'affiche pendant le chargement initial
- [ ] Tester le bouton "Pas intéressé" — la carte doit disparaître de la row

---

## Verifiable Acceptance Criteria

**Critical Path:**

- [ ] La page `/pour-vous` sépare visuellement les Films et les Séries en deux sections distinctes avec sous-titre
- [ ] Les items `reason_type = "similarity"` s'affichent dans une section titrée "Parce que vous avez regardé [sourceTitle]"
- [ ] Les labels de section correspondent aux valeurs définies : `taste_match` → "Correspondance avec vos goûts • [genre]", `social` → "[N] amis ont aimé", `quality` → "Hautement noté", `trending` → "Populaire en ce moment"
- [ ] Un skeleton loading s'affiche pendant le fetch (`isLoading = true`)
- [ ] Le bouton "Pas intéressé" sur une MediaCard envoie `POST /api/interactions` avec `notInterested: true` et invalide le cache

**Quality Gates:**

- [ ] Aucun appel réseau fait dans un `useEffect` — les données dérivées sont calculées pendant le render
- [ ] `pnpm typecheck` passe sans erreur
- [ ] `pnpm lint` passe sans erreur
- [ ] Tests unitaires passent (`pnpm test`)
- [ ] Pas de `framer-motion` importé — uniquement `motion/react`

**Integration:**

- [ ] La page fonctionne avec les données réelles de Phase 04 (`reason_type = "similarity"` dans les réponses API)
- [ ] `MediaRow` avec `hideIfSeen={true}` masque correctement les items signalés "Pas intéressé" via `UserInteractionsContext`
- [ ] `DetailModal` et `MovieWatchModal` continuent de fonctionner normalement après le refactoring

---

## Quality Assurance

### Test Plan

#### Manual Testing

- [ ] **Skeleton loading :** Throttler la connexion en DevTools → Network tab → Slow 3G, naviguer vers `/pour-vous`
  - Expected: 3 lignes de skeleton cards s'affichent, puis le contenu réel apparaît
  - Actual: À remplir pendant les tests

- [ ] **Sections Films/Séries :** Vérifier avec un compte ayant des recommendations film ET série
  - Expected: Sous-titre "Films" suivi de ses sections, puis sous-titre "Séries" suivi des siennes
  - Actual: À remplir pendant les tests

- [ ] **Section similarity :** Vérifier avec un compte ayant > 10 items likés (nécessite Phase 03 + 04 actifs)
  - Expected: Une ou deux rows "Parce que vous avez regardé [titre]" apparaissent en premier
  - Actual: À remplir pendant les tests

- [ ] **Bouton Pas intéressé :** Survoler une carte, cliquer l'icône EyeOff
  - Expected: La carte disparaît de la row, une requête POST `/api/interactions` est envoyée dans Network tab
  - Actual: À remplir pendant les tests

- [ ] **Labels enrichis :** Vérifier les labels de chaque section
  - Expected: Labels en français correspondant aux `reason_type`
  - Actual: À remplir pendant les tests

#### Automated Testing

```bash
# Tests unitaires de la page et du context
pnpm test __tests__/pour-vous/
pnpm test __tests__/recommendations/

# Suite complète
pnpm test

# TypeScript
pnpm typecheck

# Lint
pnpm lint
```

#### Performance Testing

- [ ] **Render dérivé :** Confirmer que `buildReasonGroups` ne s'exécute pas dans un `useEffect` — inspecter le code source après implémentation
- [ ] **Pas de waterfall :** Le fetch unique `/api/recommendations?limit=50` est le seul appel réseau déclenché par la page (pas d'appels supplémentaires pour les labels ou genres)
- [ ] **staleTime 15min :** Naviguer hors de la page puis revenir — aucun refetch pendant 15 minutes

### Review Checklist

- [ ] **Code Review Gate:**
  - [ ] Lancer `/code-review plans/260304-reco-upgrade/phase-05-pour-vous-ui.md`
  - [ ] Fichiers concernés : `src/app/(main)/pour-vous/page.tsx`, `src/lib/recommendations/context.tsx`, `src/components/media/MediaCard.tsx`
  - [ ] Lire le review dans `reviews/code/phase-05.md`
  - [ ] Findings critiques adressés (0 restants)
  - [ ] Phase approuvée pour complétion

- [ ] **Code Quality:**
  - [ ] Tous les tests passent (`pnpm test`)
  - [ ] TypeScript check passe (`pnpm typecheck`)
  - [ ] Pas d'erreurs ESLint
  - [ ] Couverture >80% pour les chemins critiques

- [ ] **Error Handling:**
  - [ ] `handleNotInterested` est fire-and-forget — les erreurs réseau sont silencieuses côté UI (la carte disparaît localement immédiatement)
  - [ ] Si `/api/recommendations` échoue, `useQuery` retourne `isError` — afficher un state d'erreur gracieux

- [ ] **Project Pattern Compliance:**
  - [ ] Utilise `motion/react` et non `framer-motion`
  - [ ] Classes CSS `glass`, `glass-tile`, `nemo-accent` utilisées si pertinentes
  - [ ] `data-test` sur tous les éléments interactifs
  - [ ] Texte UI en français
  - [ ] Données dérivées calculées pendant le render (pas de `useEffect` pour état dérivé)

---

## Dependencies

### Upstream (Required Before Starting)

- **Phase 04 (Scorer Rebalancing):** Doit produire des `ScoredItem` avec `reason_type = "similarity"` et `reason_detail = "similarity:SourceTitle"` dans `/api/recommendations`
- **`MediaRow`** (existant) : props `onNotInterested`, `isLoading`, `hideIfSeen` déjà disponibles — vérifier avant de commencer
- **`UserInteractionsContext`** (existant) : `isExcluded()` doit filtrer les items `not_interested: true` — vérifier que l'API est déjà connectée
- **`TMDB_GENRE_NAMES`** : `src/lib/tmdb/genres.ts` doit exporter un Record `number → string`

### Downstream (Will Use This Phase)

- Aucune phase dépendante — Phase 05 est la dernière du plan.

### External Services

- **`/api/recommendations`** : Route GET existante, retourne `{ items: ScoredItem[], hasProfile: boolean }`
- **`/api/interactions`** : Route POST existante, accepte `{ tmdbId, mediaType, type, notInterested }` — déjà implémentée (Phase 1)

---

## Completion Gate

### Sign-off

- [ ] Tous les critères d'acceptation satisfaits
- [ ] Tous les tests passent
- [ ] Code review passé (voir Review Checklist ci-dessus)
- [ ] Documentation mise à jour (MEMORY.md — statut Phase 05 mis à jour)
- [ ] Phase marquée DONE dans `plan.md`
- [ ] Commit : `feat(pour-vous): phase 05 complete — UI enrichie avec sections similaires, films/séries, labels et pas intéressé`

---

## Notes

### Technical Considerations

- `renderGroup` est une fonction interne à `PourVousPage` — elle capture `handlePlay`, `handleMoreInfo`, `handleNotInterested` par closure. Si les performances deviennent un problème, extraire en composant mémoïsé `ReasonSection`.
- `buildReasonGroups` est une fonction pure — elle peut être facilement unit-testée sans setup React.
- `TMDB_GENRE_NAMES` est un Map statique importé — pas de coût réseau, pas d'effet sur le bundle (tree-shakeable).
- Le champ `reason_detail = "similarity:SourceTitle"` suppose que Phase 04 stocke le titre du film source dans ce format. Vérifier la spec de Phase 04 avant d'implémenter l'extraction.

### Known Limitations

- **Titre source du similarity :** Si `reason_detail` est absent ou malformé, le label dégradé est "Similaire à vos goûts" (acceptable).
- **Maximum 2 sections similarity :** Les items similarity au-delà des 2 premiers sourceTitles sont silencieusement ignorés. Une future phase pourrait ajouter une row "Autres similaires".
- **Bouton Pas intéressé sur mobile :** Sans hover, l'affordance du bouton doit être gérée dans `MediaCard` (toujours visible ou accessible via long press). Cette phase suppose que `MediaCard` gère déjà ce cas — vérifier pendant l'implémentation (Step 4).

### Future Enhancements

- Section "Récemment ajouté" pour les nouvelles sorties
- Personnalisation de l'ordre des sections par l'utilisateur (drag-and-drop)
- Lien cliquable sur le titre source dans la section similarity → ouvre le `DetailModal` du film source
- Tabs Films/Séries si le scroll vertical devient trop long avec beaucoup de recommandations

---

**Previous:** [[phase-04-scorer-rebalancing|Phase 04: Scorer Rebalancing]]
**Next:** Fin du plan — Phase 05 est la dernière phase de ce plan.
