---
title: "Flow Audit — Recommendation System Upgrade"
plan: plans/260304-reco-upgrade
auditor: claude-sonnet-4-6
date: 2026-03-04
overall_assessment: Significant Issues
---

# Flow Audit — Recommendation System Upgrade

**Plan:** `plans/260304-reco-upgrade`
**Overall Assessment:** Significant Issues
**Critical Issues:** 3
**High Issues:** 4

---

## Summary

Le plan est structurellement solide dans son séquencement global (P01 → P02 → P03 → P04 → P05) et sa stratégie "bottom-up enhancement". Les dépendances inter-phases sont globalement bien déclarées. Cependant, plusieurs incohérences de data flow significatives ont été détectées entre les descriptions des phases et le codebase réel, dont trois sont critiques car elles causeront des erreurs de compilation ou de runtime si non résolues avant l'implémentation.

---

## Critical Issues

### CRIT-01 — Table name mismatch: `watch_history` vs `external_watch_history`

**Severity:** Critical
**Phases affectées:** Phase 01 (taste-profile-upgrade)
**Fichiers concernés:** `phase-01-taste-profile-upgrade.md` Steps 3.1–3.4

**Description:**
Phase 01 mentionne deux tables différentes dans des sections contradictoires :
- Section "Integration Points → Upstream Dependencies" (ligne 69) : `watch_history table (migration 001)` avec colonnes `user_id, tmdb_id, media_type, progress, last_watched_at`
- Section "Dependencies → Upstream" (ligne 513) : `external_watch_history table (migration 007)`
- Steps 3.1–3.4 (implémentation) : utilise `external_watch_history` avec colonnes `watched_at`, `raw_data`

**Réalité du codebase :**
- Il existe DEUX tables distinctes :
  - `watch_history` (migration 001) : colonnes `progress REAL [0-100]`, `last_watched_at`, `UNIQUE(user_id, tmdb_id, media_type)` — historique Jellyfin natif
  - `external_watch_history` (migration 007) : colonnes `watched_at`, `user_rating`, `raw_data JSONB` — imports Letterboxd/Trakt/Netflix, sans colonne `progress`

**Impact:**
- Si l'implémentation utilise `external_watch_history` (comme dans les Steps 3.1-3.4), la logique de `progress >= 80%` est impossible car `external_watch_history` n'a pas de colonne `progress`.
- Si l'implémentation utilise `watch_history` (comme dans l'Overview), la logique d'extraction de `raw_data.UserData.PlayedPercentage` décrite dans les Notes est impossible.
- Les deux tables doivent être intégrées avec des stratégies différentes.

**Correction requise:**
Décider explicitement dans Phase 01 :
1. `watch_history` → utiliser `progress >= 80%` directement (progress déjà normalisé 0-100)
2. `external_watch_history` → traiter comme 100% si `watched_at IS NOT NULL` (Letterboxd/Trakt) ou extraire depuis `raw_data` (Jellyfin — mais Jellyfin utilise `watch_history`, pas `external_watch_history`)

Les deux tables doivent être joinées séparément avec des logiques distinctes. Les Steps doivent être réécrits pour refléter les deux sources.

---

### CRIT-02 — `computeTemporalDecay` test signatures mismatch

**Severity:** Critical
**Phases affectées:** Phase 01 (TDD section, Step 0.1)
**Fichiers concernés:** `phase-01-taste-profile-upgrade.md` Step 0.1 + Step 2.1

**Description:**
Le code de la fonction dans Step 2.1 déclare :
```typescript
export function computeTemporalDecay(date: Date | string | null): number
```
Mais les tests TDD dans Step 0.1 utilisent un algorithme différent (half-life exponentiel `2^(-jours/90)`) tout en testant des valeurs qui correspondent aux paliers discrets décrits dans l'ADR-01-02 :
```typescript
// ADR-01-02 : paliers discrets ≤30j→1.0, ≤90j→0.7, >90j→0.4
// Tests TDD : expects "~0.5 for 90 days ago", "~0.25 for 180 days ago"
// Implémentation Step 2.1 : HALF_LIFE_DAYS=90, Math.pow(2, -daysSince/90)
//   → 90 jours = 2^(-1) = 0.5 ✓ mais "toBeCloseTo" avec paliers ?
```

Le vrai problème : les tests utilisent `toBeCloseTo(0.5, 1)` pour 90 jours, ce qui correspond à l'exponentiel, mais l'ADR-01-02 dit explicitement "trois paliers discrets" pour que les tests aient des assertions exactes. L'implémentation finale (exponentielle) et la description (paliers) sont contradictoires.

**Impact:**
- Le développeur qui implémente les paliers discrets passera les assertions `toBeCloseTo` pour 90 jours (0.7 ≠ 0.5) et échouera
- Le développeur qui implémente l'exponentiel obtient 0.5 à 90j et 0.25 à 180j — cohérent avec les tests mais contradictoire avec l'ADR

**Correction requise:**
Choisir une implémentation et aligner ADR + tests + code :
- **Option A (recommandée) :** Garder l'exponentiel `2^(-days/90)` (implémentation Step 2.1) et mettre à jour l'ADR-01-02 pour retirer la mention des "paliers discrets"
- **Option B :** Garder les paliers discrets (ADR) et mettre à jour les tests pour `expect(...).toBe(0.7)` à 90j et `expect(...).toBe(0.4)` à 180j

---

### CRIT-03 — `reason_detail` format incompatible entre Phase 03/04 (objet) et Phase 05 (string)

**Severity:** Critical
**Phases affectées:** Phase 03, Phase 04, Phase 05
**Fichiers concernés:** `phase-03-similarity-score.md`, `phase-04-scorer-rebalancing.md`, `phase-05-pour-vous-ui.md`

**Description:**
Phase 04 (ADR-04-01 et Step 2.2) remplace `reason_detail: string` par `reason_detail: ReasonDetail` (objet TypeScript structuré avec `sourceTitle`, `sourceTmdbId`, `friendCount`, `topGenre`).

Mais Phase 05 accède à `reason_detail` comme une **string** dans toute son implémentation :
- `context.tsx` Step 1.1 : `reason_detail?.startsWith("similarity:")` → string parsing
- `page.tsx` Step 2.2 : `item.reason_detail?.startsWith("similarity:")` → string parsing
- Tests Phase 05 : `makeScoredItem(...)` avec `reasonDetail?: string`
- Signature `getRecommendationLabel(reason_type, reason_detail: string | undefined, score)`

Phase 03 utilise également `"similar_to:12345"` (string avec tmdb_id) alors que Phase 04 stocke `{ sourceTitle, sourceTmdbId }` (objet avec titre).

**Impact:**
- TypeScript error à la compilation : `reason_detail: ReasonDetail` n'a pas de méthode `.startsWith()`
- Phase 05 ne peut pas compiler après Phase 04 sans une réécriture complète de toute la logique d'accès à `reason_detail`
- Le format `"similarity:Dune"` de Phase 05 est incompatible avec `{ sourceTitle: "Dune", sourceTmdbId: 550 }` de Phase 04

**Correction requise:**
Aligner Phase 05 sur le format objet de Phase 04 :
- `context.tsx` : accéder via `item.reason_detail?.sourceTitle` au lieu de `startsWith("similarity:")`
- `page.tsx` : accéder via `group.items[0]?.reason_detail?.sourceTitle` au lieu du string parsing
- Retirer les tests qui créent `reasonDetail` comme string dans Phase 05
- Mettre à jour `ScoredItemClient` dans `context.tsx` pour `reason_detail?: ReasonDetail`

---

## High Issues

### HIGH-01 — Dépendance Phase 03 manquante sur Phase 02

**Severity:** High
**Phases affectées:** Phase 03 (similarity-score)
**Fichiers concernés:** `phase-03-similarity-score.md` header `dependencies`

**Description:**
Le header frontmatter de Phase 03 déclare `dependencies: ["phase-01-taste-profile-upgrade"]` uniquement.

Cependant, Phase 03 dépend implicitement de Phase 02 :
- La fonction `preFetchMissingFeatures` de Phase 02 doit être déployée pour que `media_features` ait une couverture >80% des candidats
- Phase 03 calcule la similarité Jaccard via `media_features` — si les features ne sont pas pré-chargées (Phase 02), la similarité Jaccard dégrade à 0 pour la plupart des candidats
- Le plan.md est cohérent (Phase 03 liste P01 comme dépendance), mais la dépendance implicite sur Phase 02 n'est pas documentée

**Impact:**
- Phase 03 peut être commencée sans Phase 02 et produire des scores de similarité nuls pour la plupart des candidats
- La qualité du système de recommandation sera dégradée si Phase 03 est déployée sans Phase 02

**Correction requise:**
Ajouter `"phase-02-candidate-pipeline"` aux dépendances de Phase 03 et documenter pourquoi (couverture `media_features` requise pour Jaccard).

---

### HIGH-02 — Numérotation migration incohérente : 014 vs 015

**Severity:** High
**Phases affectées:** Phase 01, Phase 03
**Fichiers concernés:** `phase-01-taste-profile-upgrade.md` Step 1.1, `phase-03-similarity-score.md` Step 1

**Description:**
- Phase 01 crée `supabase/migrations/014_recommendation_tables.sql`
- Phase 03 crée `supabase/migrations/015_similar_items.sql`
- La dernière migration sur disque est `013_jellyfin_user_session.sql`

Ce séquencement est correct en soi (014 avant 015), mais Phase 03 reconnaît explicitement l'ambiguïté dans ses "Questions for User" (question 1) sans la résoudre définitivement.

**Impact réel minimal** si implémentées dans l'ordre, mais :
- Si Phase 03 est implémentée avant Phase 01 (ordre non respecté), `015_similar_items.sql` serait appliquée avec `014_recommendation_tables.sql` manquante, causant des erreurs de FK sur `profiles(id)`
- La note dans Phase 03 suppose que "014 sera créée par Phase 01 ou une phase antérieure" sans contrainte explicite

**Correction requise:**
Ajouter une note explicite dans Phase 03 : "Phase 01 DOIT être complète (migration 014 appliquée) avant de créer 015_similar_items.sql — la FK vers `profiles(id)` requiert la présence des tables de Phase 01."

---

### HIGH-03 — `scoreItem()` accumule `likeCount` en double (variable shadowing)

**Severity:** High
**Phases affectées:** Phase 04 (scorer-rebalancing)
**Fichiers concernés:** `phase-04-scorer-rebalancing.md` Step 2.3

**Description:**
Dans le code de `scoreItem()` proposé en Phase 04, la variable `likeCount` est déclarée deux fois :
```typescript
// Ligne ~496 : déclaration externe
const likeCount = friendLikes?.get(`${item.id}-${mediaType}`) ?? 0;

// ... plus bas dans le bloc if(profile && features) ...
// reason_detail pour social utilise directement likeCount (premier)
// c'est correct, mais le codebase existant scorer.ts a un bug similaire :
```

Dans le scorer.ts **existant** (ligne 136), il y a déjà un shadowing : `likeCount` est déclarée deux fois (ligne 99 et ligne 136) dans la même fonction. Phase 04 reproduit ce pattern dans son code proposé (Step 2.3 ligne ~547). La variable shadowing cause des avertissements TypeScript strict et peut masquer des bugs.

**Impact:**
- `pnpm lint` peut échouer avec `no-shadow` ESLint rule si activée
- Le comportement est correct mais fragile

**Correction requise:**
Dans le code proposé Phase 04 Step 2.3 : supprimer la seconde déclaration `likeCount` dans le bloc social reason — utiliser directement la variable externe déjà déclarée.

---

### HIGH-04 — `getSimilarityScores()` interface non définie dans Phase 03 mais consommée dans Phase 04

**Severity:** High
**Phases affectées:** Phase 03 → Phase 04 couplage
**Fichiers concernés:** `phase-04-scorer-rebalancing.md` Step 3.1, `phase-03-similarity-score.md`

**Description:**
Phase 04 (Step 3.1) importe et utilise `getSimilarityScores(userId)` depuis `@/lib/recommendations/similarity` avec la signature assumée :
```typescript
Promise<Map<string, { score: number; sourceTitle: string; sourceTmdbId: number }>>
```

Phase 04 documente cette assumption dans ses "Questions for User" (question 1) mais la marque comme incertaine. Phase 03 exporte bien `getSimilarityScores` mais avec une signature légèrement différente : elle retourne une `Map<string, SimilarityData>` où `SimilarityData` est défini dans `src/types/recommendations.ts` (créé dans Phase 04 Step 1.1).

**Problème circulaire :**
- Phase 03 a besoin du type `SimilarityData` pour typer son export
- `SimilarityData` est créé dans Phase 04
- Phase 03 est supposée être complète avant Phase 04

**Impact:**
- Phase 03 ne peut pas utiliser le type `SimilarityData` de `src/types/recommendations.ts` car ce fichier n'existe pas encore quand Phase 03 est implémentée
- Soit Phase 03 définit son propre type inline (duplication), soit `src/types/recommendations.ts` doit être créé dans Phase 01 ou Phase 03

**Correction requise:**
Déplacer la création de `src/types/recommendations.ts` (actuellement Step 1.1 de Phase 04) vers Phase 03, afin que Phase 03 puisse typer son export correctement. Phase 04 n'a plus qu'à importer depuis ce fichier déjà existant.

---

## Minor Issues

### MINOR-01 — `ScoredItemClient.reason_type` dans `context.tsx` non mis à jour pour `"similarity"`

**Severity:** Minor
**Phases affectées:** Phase 05 Step 1.1
**Fichiers concernés:** `src/lib/recommendations/context.tsx` (fichier existant)

**Description:**
Phase 05 Step 1.1 met à jour `ScoredItemClient.reason_type` pour ajouter `"similarity"`, mais le fichier existant `context.tsx` a `reason_type: "taste_match" | "social" | "trending" | "quality"`. Phase 05 documente bien cette modification, mais elle est bloquée sur Phase 04 qui crée `src/types/recommendations.ts` avec `ReasonType`. Phase 05 Step 1.2 met à jour `scorer.ts` pour ajouter `"similarity"` au type union — mais Phase 04 crée déjà ce type dans `src/types/recommendations.ts`.

En d'autres termes, Phase 05 Step 1.2 est redondant avec Phase 04.

**Correction suggérée:**
Supprimer Step 1.2 de Phase 05 (mettre à jour `ReasonType` dans `scorer.ts`) — Phase 04 l'a déjà fait. Garder uniquement Step 1.1 (`ScoredItemClient` dans `context.tsx`).

---

### MINOR-02 — Fallback score avec profil ne somme pas à 1.0 dans le scorer existant

**Severity:** Minor
**Phases affectées:** Phase 04 (contexte)
**Fichiers concernés:** `src/lib/recommendations/scorer.ts` (fichier existant)

**Description:**
Dans le `scorer.ts` actuel (ligne 119-123), les poids avec profil sont :
```
0.45 * tasteNorm + 0.20 * socialScore + 0.10 * trendingScore + 0.05 * qualityScore = 0.80
```
Soit 0.80, pas 1.0. C'est intentionnel selon le commentaire JSDoc ("0.20 similarity_score réservé Phase 6"), mais Phase 04 devra corriger cela. Phase 04 le documente bien dans son Overview.

**Note :** Phase 04 résout correctement ce problème. Ce n'est pas un problème du plan, juste une observation pour mémoire.

---

### MINOR-03 — `asyncPool` dans Phase 02 : bug potentiel d'ordre de résultats

**Severity:** Minor
**Phases affectées:** Phase 02 (candidate-pipeline)
**Fichiers concernés:** `phase-02-candidate-pipeline.md` Step 1.1

**Description:**
L'implémentation de `asyncPool` proposée en Phase 02 utilise `results.push(r)` dans le callback `.then()`. Avec de la concurrence, l'ordre de résolution n'est pas garanti — les résultats ne correspondent pas nécessairement à l'ordre des tâches d'entrée. Le test Phase 02 vérifie `expect(results).toEqual([2, 4, 6])` avec 3 tâches séquentielles (pas vraiment concurrentes), ce qui passe, mais avec de vraie concurrence l'ordre serait aléatoire.

**Impact :** Faible pour les cas d'usage actuels (pré-fetch de features, où l'ordre est sans importance), mais le test est trompeur.

**Correction suggérée:**
Soit documenter explicitement que `asyncPool` ne garantit pas l'ordre, soit utiliser une implémentation avec index pour préserver l'ordre.

---

## Data Flow Verification

### Flux global (P01 → P05)

```
watch_history (progress) ─┐
external_watch_history  ─ ┤→ computeAndSaveTasteProfile() → user_taste_profiles
interactions (like/dislike)┘    [Phase 01]

TMDB endpoints (6-10 sources) → candidates[] → preFetchMissingFeatures()
    [Phase 02]                                      → media_features

media_features + user_taste_profiles → getSimilarityScores()
    [Phase 03]                             → similar_items

getTasteProfile() + getSimilarityScores() + candidates + features
    [Phase 04] → scoreItem() → ScoredItem[] { reason_type, reason_detail: ReasonDetail }

ScoredItem[] → PourVousPage → sections Films/Séries + labels enrichis
    [Phase 05]
```

Le flux global est logique et bien séquencé. Les problèmes identifiés sont locaux à des interfaces spécifiques.

### Interfaces critiques à aligner avant implémentation

| Interface | Produit par | Consommé par | Problème |
|-----------|-------------|--------------|---------|
| `watch_history` vs `external_watch_history` | Migration 001/007 | Phase 01 | CRIT-01 |
| `computeTemporalDecay` signature | Phase 01 (ADR) | Phase 01 (tests) | CRIT-02 |
| `reason_detail` type (`string` vs `ReasonDetail`) | Phase 04 | Phase 05 | CRIT-03 |
| `SimilarityData` type location | Phase 03/04 | Phase 03, 04, 05 | HIGH-04 |

---

## Dependency Graph Verification

| Phase | Declared Deps | Actual Deps | Missing |
|-------|--------------|-------------|---------|
| P01   | `[]` | `[]` | — |
| P02   | `[P01]` | `[P01]` | — |
| P03   | `[P01]` | `[P01, P02]` | **P02 manquante** (HIGH-01) |
| P04   | `[P01, P02, P03]` | `[P01, P02, P03]` | — |
| P05   | `[P04]` | `[P04]` | — |

---

## Recommendations

### Actions requises avant implémentation (par ordre de priorité)

1. **[CRIT-01]** Décider de la stratégie `watch_history` vs `external_watch_history` et réécrire les Steps 3.1-3.4 de Phase 01 pour traiter les deux sources distinctement.

2. **[CRIT-03]** Aligner Phase 05 sur le format `ReasonDetail` objet : mettre à jour `context.tsx`, `page.tsx`, les types de test, et `getRecommendationLabel()` pour accéder via `.sourceTitle`, `.friendCount`, `.topGenre` plutôt que string parsing.

3. **[HIGH-04 + CRIT-03]** Déplacer la création de `src/types/recommendations.ts` (avec `ReasonType`, `ReasonDetail`, `SimilarityData`) dans Phase 03 (ou Phase 01) plutôt que Phase 04 — ceci résout la dépendance circulaire de typage.

4. **[CRIT-02]** Choisir entre paliers discrets (ADR-01-02) ou décroissance exponentielle (Step 2.1) et aligner les tests TDD en conséquence.

5. **[HIGH-01]** Ajouter `"phase-02-candidate-pipeline"` aux dépendances déclarées de Phase 03.

6. **[HIGH-03]** Corriger le variable shadowing de `likeCount` dans le code proposé de Phase 04 Step 2.3.

---

*Rapport généré le 2026-03-04 par audit structurel manuel (skill `audit-plan` indisponible dans cet environnement).*
