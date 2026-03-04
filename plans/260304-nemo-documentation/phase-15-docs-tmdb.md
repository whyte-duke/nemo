---
title: "Phase 15 - TMDB"
description: "Documenter le client TMDB, le cache de features, la gestion des genres, et les patterns d'appel"
skill: none
status: pending
group: "integrations"
dependencies: []
tags: [documentation, tmdb, api-client, genres]
created: 2026-03-04
updated: 2026-03-04
---

# Phase 15: TMDB

**Context:** [[plan|Master Plan]] | **Dependencies:** None | **Status:** Pending

---

## Overview

Generer `docs/integrations/tmdb.md` documentant l'integration TMDB de Nemo : client API, gestion des genres (mapping ID -> nom), extraction de features (keywords, cast, directors), cache des features en DB, et les patterns d'appel (language fr-FR, region FR, revalidation).

**Goal:** Un agent IA comprend comment Nemo utilise TMDB et peut ajouter de nouveaux appels API.

---

## Context & Workflow

### How This Phase Fits Into the Project

- **UI Layer:** Hook use-tmdb pour les donnees de films/series
- **Server Layer:** Appels TMDB depuis les routes API (recommendations, discover/cards)
- **Database Layer:** Table media_features (cache des features TMDB)
- **Integrations:** API TMDB v3 (api.themoviedb.org/3)

### User Workflow

**Trigger:** L'application affiche des donnees de films/series (titres, affiches, genres, acteurs).

**Steps:**
1. Le client ou l'API fait un appel TMDB (via client.ts ou directement)
2. Les donnees sont retournees en francais (language=fr-FR)
3. Pour les recommandations, les features sont cachees dans media_features
4. Les genres sont mappes via genres.ts (ID -> nom en francais)

**Success Outcome:** Les donnees TMDB sont disponibles en francais avec cache.

### Problem Being Solved

**Pain Point:** TMDB est utilise dans de nombreux endroits du code avec des patterns differents.
**Alternative Approach:** Chercher tous les appels TMDB dans le codebase.

### Integration Points

**Upstream Dependencies:** Aucune

**Downstream Consumers:**
- P06 (Recommendations) : utilise les features TMDB

---

## Prerequisites & Clarifications

### Questions for User

1. **Cle API:** La cle TMDB est-elle dans NEXT_PUBLIC_TMDB_API_KEY ?
   - **Context:** Les appels TMDB utilisent `api_key=` dans l'URL.
   - **Assumptions if unanswered:** Oui, variable NEXT_PUBLIC_TMDB_API_KEY.
   - **Impact:** Documentation des variables d'environnement.

### Validation Checklist

- [ ] All questions answered or assumptions explicitly approved
- [ ] User has reviewed phase deliverables and confirmed expectations
- [ ] Dependencies from prior phases are confirmed available
- [ ] Environment variables and credentials are documented
- [ ] Any third-party services/APIs are registered and configured

> [!CAUTION]
> The user configured this checkpoint because proceeding with unresolved questions leads to incorrect implementations requiring rework. Verify all items are checked before continuing.

---

## Requirements

### Functional

- Client TMDB documente (base URL, auth, parametres par defaut)
- Mapping genres (ID -> nom, en francais)
- Extraction de features (genres, keywords, cast, directors)
- Cache media_features documente
- Variables d'environnement listees
- Patterns d'appel (revalidation, language, region)
- Hook use-tmdb documente

### Technical

- Contenu extrait de : src/lib/tmdb/client.ts, src/lib/tmdb/features.ts, src/lib/tmdb/genres.ts, src/types/tmdb.ts, src/hooks/use-tmdb.ts
- Taille cible : 4-6 KB

---

## Decision Log

### Documentation centree patterns (ADR-P15-01)

**Date:** 2026-03-04
**Status:** Accepted

**Context:** L'agent IA a surtout besoin de savoir comment faire un appel TMDB correctement dans ce projet.

**Decision:** Documenter les patterns d'appel (parametres, headers, cache) en plus du client.

**Consequences:**
- **Positive:** L'agent peut creer de nouveaux appels TMDB correctement
- **Negative:** Aucun

---

## Implementation Steps

### Step 0: Test Definition (TDD)

#### 0.1: Verification de contenu

- [ ] Le client TMDB est documente avec base URL et auth
- [ ] Le mapping genres est present
- [ ] Les patterns d'appel sont documentes

---

### Step 1: Lire les fichiers sources

#### 1.1: Fichiers a lire

- [ ] `src/lib/tmdb/client.ts` -- client principal
- [ ] `src/lib/tmdb/features.ts` -- extraction de features
- [ ] `src/lib/tmdb/genres.ts` -- mapping genres
- [ ] `src/types/tmdb.ts` -- types TypeScript
- [ ] `src/hooks/use-tmdb.ts` -- hook
- [ ] `src/app/api/media-features/fetch/route.ts` -- cache des features

---

### Step 2: Rediger la documentation

#### 2.1: Structure du fichier

```markdown
# Integration TMDB

> Derniere mise a jour : 2026-03-04

## Resume rapide

API TMDB v3. Langue fr-FR, region FR. Cache features en DB (media_features).
Mapping genres ID -> nom francais.

## Configuration

| Variable | Description |
|----------|-------------|
| NEXT_PUBLIC_TMDB_API_KEY | Cle API TMDB |
| NEXT_PUBLIC_TMDB_BASE_URL | URL de base (defaut: api.themoviedb.org/3) |

## Client TMDB (src/lib/tmdb/client.ts)
[Fonctions exportees, parametres par defaut]

## Patterns d'Appel

### Appel standard
fetch(`${TMDB_BASE}/movie/popular?api_key=${KEY}&language=fr-FR&region=FR&page=1`, {
  next: { revalidate: 3600 }
})

### Parametres par defaut
- language=fr-FR
- region=FR
- revalidation: 3600s (1h) pour les listes, 300s (5min) pour les flux

## Mapping des Genres
[Tableau ID -> Nom en francais]

## Features TMDB
[Description de l'extraction et du cache]

## Types TypeScript
[Types principaux de tmdb.ts]

## Hook use-tmdb
[Signature et usage]

## Fichiers Sources
[Liste]
```

---

## Verifiable Acceptance Criteria

**Critical Path:**

- [ ] `docs/integrations/tmdb.md` existe avec contenu reel
- [ ] Client documente avec configuration
- [ ] Mapping genres present
- [ ] Patterns d'appel documentes

**Quality Gates:**

- [ ] Aucun placeholder
- [ ] Variables d'environnement listees

**Integration:**

- [ ] Lien valide depuis `docs/README.md`

---

## Quality Assurance

### Test Plan

#### Manual Testing

- [ ] **Exactitude:** Les parametres par defaut correspondent au code
  - Expected: language=fr-FR, region=FR
  - Actual: [To be filled]

#### Automated Testing

```bash
ls docs/integrations/tmdb.md
pnpm exec grep -c '\[TODO\]\|\[TBD\]\|XXX' docs/integrations/tmdb.md && echo "FAIL" || echo "PASS"
```

### Review Checklist

- [ ] **Security:** Pas de cle API en clair
- [ ] **Documentation:** Contenu extrait du code reel

---

## Dependencies

### Upstream (Required Before Starting)

- Aucune

### Downstream (Will Use This Phase)

- P06 (Recommendations) : utilise les features TMDB

### External Services

- Aucun

---

## Completion Gate

### Sign-off

- [ ] All acceptance criteria met
- [ ] All tests passing
- [ ] Code review passed
- [ ] Documentation updated
- [ ] Phase marked DONE in plan.md
- [ ] Committed: `docs(tmdb): phase 15 complete -- integration TMDB`

---

## Notes

### Technical Considerations

- La cle TMDB est prefixee NEXT_PUBLIC_ (visible cote client) -- standard pour TMDB
- Les appels TMDB utilisent le cache Next.js (revalidate)

### Known Limitations

- Documentation basee sur le code, pas sur la doc API TMDB complete

### Future Enhancements

- Endpoints TMDB utilises (liste complete)
- Rate limiting et gestion d'erreurs

---

**Previous:** [[phase-14-docs-ui-components|Phase 14: Composants UI]]
**Next:** [[phase-16-docs-supabase|Phase 16: Supabase]]
