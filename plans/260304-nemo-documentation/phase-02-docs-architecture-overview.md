---
title: "Phase 02 - Architecture Generale"
description: "Documenter la vue d'ensemble de l'architecture systeme de Nemo dans docs/architecture/overview.md"
skill: none
status: pending
group: "architecture"
dependencies: []
tags: [documentation, architecture, overview]
created: 2026-03-04
updated: 2026-03-04
---

# Phase 02: Architecture Generale

**Context:** [[plan|Master Plan]] | **Dependencies:** None | **Status:** Pending

---

## Overview

Generer `docs/architecture/overview.md` decrivant l'architecture complete de Nemo : structure des dossiers, flux de donnees, patterns utilises (App Router, RLS, route handlers), et relations entre les couches (UI, Server, Database, Integrations externes).

**Goal:** Un agent IA comprend l'architecture complete de Nemo et les patterns de code en lisant ce seul fichier.

---

## Context & Workflow

### How This Phase Fits Into the Project

- **UI Layer:** Documente la structure `src/app/` (route groups `(auth)`, `(main)`), les layouts, les pages
- **Server Layer:** Documente les 30+ routes API dans `src/app/api/`, les patterns d'auth, les helpers
- **Database Layer:** Vue d'ensemble des tables et du role de RLS (details en P03)
- **Integrations:** Carte des services externes (TMDB, StreamFusion, Jellyfin, Debrid)

### User Workflow

**Trigger:** Un agent IA doit comprendre comment le projet est structure avant de modifier du code.

**Steps:**
1. L'agent lit `docs/architecture/overview.md`
2. Il comprend la structure des dossiers et le role de chaque couche
3. Il identifie les patterns de code utilises
4. Il sait ou chercher pour sa tache specifique

**Success Outcome:** L'agent peut naviguer dans le codebase et comprendre les conventions sans lire chaque fichier.

### Problem Being Solved

**Pain Point:** 175+ fichiers sans documentation architecturale rendent la comprehension du projet longue et couteuse en contexte.
**Alternative Approach:** Explorer le codebase fichier par fichier -- lent, incomplet, et consomme beaucoup de contexte IA.

### Integration Points

**Upstream Dependencies:** Aucune

**Downstream Consumers:**
- P03 (Database) : reference l'architecture pour les details schema
- P04 (API Routes) : reference l'architecture pour les conventions de route handlers
- P05 (Auth) : reference l'architecture pour les flux d'authentification

**Data Flow:**
```
src/app/(auth)/ ──> Supabase Auth ──> JWT cookie
src/app/(main)/ ──> src/hooks/ ──> src/app/api/ ──> src/lib/ ──> Supabase DB / TMDB / StreamFusion
src/app/api/ ──> src/lib/auth/session.ts ──> Supabase Auth (verification)
```

---

## Prerequisites & Clarifications

### Questions for User

1. **Niveau de detail:** Doit-on documenter chaque fichier individuellement ou grouper par dossier/fonctionnalite ?
   - **Context:** 175+ fichiers -- documenter chacun rendrait le fichier trop long.
   - **Assumptions if unanswered:** Grouper par dossier et fonctionnalite, avec comptages.
   - **Impact:** Determine la taille et la granularite du document.

2. **Diagrammes:** Utilise-t-on du Mermaid, de l'ASCII art, ou juste du texte pour les diagrammes ?
   - **Context:** Les agents IA lisent mieux le texte et l'ASCII que le Mermaid.
   - **Assumptions if unanswered:** ASCII art pour les diagrammes de flux, tableaux Markdown pour les structures.
   - **Impact:** Lisibilite pour les agents IA.

3. **Conventions de nommage:** Documente-t-on les conventions francaises du projet (routes en francais, commentaires en francais) ?
   - **Context:** Le projet utilise des routes comme `/decouvrir`, `/amis`, `/ma-liste`.
   - **Assumptions if unanswered:** Oui, on documente explicitement cette convention.
   - **Impact:** Aide les agents IA a ne pas renommer les routes en anglais.

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

- Le fichier `docs/architecture/overview.md` decrit l'architecture complete de Nemo
- Arborescence `src/` avec role de chaque dossier et sous-dossier
- Flux de donnees entre les couches (UI -> API -> Lib -> DB/External)
- Patterns de code documentes : route handlers, auth check, Supabase client creation
- Conventions du projet : nommage francais, structure de fichiers, imports
- Carte des services externes avec leurs roles

### Technical

- Contenu extrait des fichiers reels du codebase
- Arborescence generee depuis les fichiers existants (pas inventee)
- Taille cible : 5-8 KB

---

## Decision Log

### ASCII art vs Mermaid pour diagrammes (ADR-P02-01)

**Date:** 2026-03-04
**Status:** Accepted

**Context:** Les agents IA (Claude) lisent le texte brut et l'ASCII art directement. Le Mermaid necessite un rendu graphique.

**Decision:** Utiliser ASCII art pour les diagrammes de flux et les arboresences.

**Consequences:**
- **Positive:** Lisible directement dans le contexte de l'agent IA
- **Negative:** Moins esthetique que Mermaid pour les humains
- **Neutral:** Compatible avec tout viewer Markdown

---

## Implementation Steps

### Step 0: Test Definition (TDD)

#### 0.1: Verification de structure

- [ ] Le fichier `docs/architecture/overview.md` existe
- [ ] Il contient les sections : Resume, Arborescence, Flux de donnees, Patterns, Conventions, Services externes
- [ ] Aucun placeholder (`[TODO]`, `[TBD]`)

#### 0.2: Verification de contenu

- [ ] L'arborescence mentionne tous les dossiers de `src/` : app, components, contexts, hooks, lib, providers, types
- [ ] Les patterns documentes correspondent au code reel
- [ ] Les services externes sont tous listes : TMDB, Supabase, StreamFusion, Jellyfin, AllDebrid/RealDebrid

---

### Step 1: Lire les fichiers sources

#### 1.1: Structure de dossiers

- [ ] Lister `src/` recursif pour obtenir l'arborescence complete
- [ ] Compter les fichiers par dossier : `src/app/`, `src/components/`, `src/hooks/`, `src/lib/`, etc.
- [ ] Identifier les route groups : `(auth)`, `(main)`, `api/`

#### 1.2: Patterns de code

- [ ] Lire `src/lib/supabase/server.ts` -- pattern de creation du client Supabase server
- [ ] Lire `src/lib/supabase/client.ts` -- pattern de creation du client Supabase browser
- [ ] Lire `src/lib/supabase/admin.ts` -- pattern du client admin (service role)
- [ ] Lire `src/lib/auth/session.ts` -- pattern d'authentification (`getAuthUser`, `getAuthUserWithRole`, `requireRole`)
- [ ] Lire un route handler typique (ex: `src/app/api/interactions/route.ts`) -- pattern GET/POST
- [ ] Lire `src/app/(main)/layout.tsx` -- pattern de layout protege

#### 1.3: Services externes

- [ ] Lire `src/lib/tmdb/client.ts` -- integration TMDB
- [ ] Lire `src/lib/stremio/resolver.ts` -- integration StreamFusion
- [ ] Lire `src/lib/jellyfin/client.ts` -- integration Jellyfin
- [ ] Identifier les variables d'environnement utilisees (NEXT_PUBLIC_*)

---

### Step 2: Rediger la documentation

#### 2.1: Structure du fichier genere

```markdown
# Architecture de Nemo

> Derniere mise a jour : 2026-03-04 | Fichiers sources : [liste]

## Resume rapide

[3-5 lignes : Next.js App Router, Supabase, TMDB, streaming social]

## Arborescence du Projet

src/
├── app/                    # Routes Next.js App Router
│   ├── (auth)/             # Routes publiques : connexion, inscription
│   ├── (main)/             # Routes protegees : accueil, films, series, amis...
│   ├── api/                # 30+ route handlers REST
│   └── onboarding/         # Parcours d'accueil en 6 etapes
├── components/             # [N] composants React dans [M] sous-dossiers
├── contexts/               # Contextes React (Jellyfin library)
├── hooks/                  # 13 hooks personnalises (use-auth, use-swipe-session...)
├── lib/                    # Logique metier et clients externes
│   ├── auth/               # Session, roles, Jellyfin session
│   ├── jellyfin/           # Client et sync Jellyfin
│   ├── recommendations/    # Scorer, taste-profile, contexte
│   ├── stremio/            # Resolver StreamFusion
│   ├── supabase/           # Client server/browser/admin + middleware
│   └── tmdb/               # Client TMDB, features, genres
├── providers/              # Providers React globaux
└── types/                  # Types TypeScript (download, jellyfin, stremio, supabase, tmdb)

## Flux de Donnees Principal

[Diagramme ASCII montrant le flux UI -> API -> Lib -> DB/External]

## Patterns de Code

### Authentification dans les Route Handlers
[Extrait de code reel de session.ts]

### Creation du Client Supabase
[3 variantes : server, browser, admin]

### Structure d'un Route Handler Typique
[Extrait de code reel avec auth + validation + reponse]

## Conventions du Projet

- Routes en francais : /decouvrir, /amis, /ma-liste, /historique
- Commentaires en francais
- Types dans src/types/ nommes par domaine
- [Autres conventions extraites du code]

## Services Externes

| Service | Base URL | Usage | Fichier |
|---------|----------|-------|---------|
| TMDB | api.themoviedb.org/3 | Catalogue films/series | src/lib/tmdb/client.ts |
| StreamFusion | stream-fusion.stremiofr.com | Resolution de flux streaming | src/lib/stremio/resolver.ts |
| Jellyfin | [configurable] | Bibliotheque media personnelle | src/lib/jellyfin/client.ts |
| Supabase | [configurable] | PostgreSQL + Auth + Storage | src/lib/supabase/*.ts |
| AllDebrid/RealDebrid | [configurable] | Debridage de liens | src/app/api/download/*.ts |

## Variables d'Environnement

[Tableau des NEXT_PUBLIC_* et variables serveur extraites du code]

## Fichiers Sources
[Liste des fichiers lus pour generer ce document]
```

#### 2.2: Redaction

- [ ] Rediger chaque section avec du contenu extrait du code reel
- [ ] Creer l'arborescence avec les comptages reels
- [ ] Documenter les patterns avec des extraits de code reels
- [ ] Lister les services externes avec leurs URLs et fichiers

---

## Verifiable Acceptance Criteria

**Critical Path:**

- [ ] `docs/architecture/overview.md` existe avec contenu reel
- [ ] Arborescence complete de `src/` documentee
- [ ] Au moins 3 patterns de code documentes avec extraits reels
- [ ] Tous les services externes listes avec leurs fichiers

**Quality Gates:**

- [ ] Taille entre 5 et 8 KB
- [ ] Contenu en francais
- [ ] Aucun placeholder

**Integration:**

- [ ] Lien valide depuis `docs/README.md`
- [ ] References coherentes avec les autres fichiers d'architecture

---

## Quality Assurance

### Test Plan

#### Manual Testing

- [ ] **Completude:** Toutes les sections sont presentes et remplies
  - Expected: Resume, Arborescence, Flux, Patterns, Conventions, Services, Variables, Sources
  - Actual: [To be filled during testing]

- [ ] **Exactitude:** Les comptages correspondent au codebase reel
  - Expected: Nombre de fichiers, hooks, composants matchent `find` results
  - Actual: [To be filled during testing]

#### Automated Testing

```bash
# Verifier existence
ls docs/architecture/overview.md

# Verifier absence de placeholders
pnpm exec grep -c '\[TODO\]\|\[TBD\]\|XXX' docs/architecture/overview.md && echo "FAIL" || echo "PASS"
```

#### Performance Testing

- [ ] **Taille du fichier:** Target: 5-8 KB, Actual: [To be measured]

### Review Checklist

- [ ] **Code Quality:** Markdown valide, liens internes corrects
- [ ] **Documentation:** Contenu extrait du code, pas generique
- [ ] **Project Pattern Compliance:** Conventions du projet respectees

---

## Dependencies

### Upstream (Required Before Starting)

- Aucune (P01 cree les dossiers, mais on peut creer `docs/architecture/` dans cette phase)

### Downstream (Will Use This Phase)

- P03 (Database) : reference cette vue d'ensemble
- P04 (API Routes) : reference les patterns documentes ici
- P05 (Auth) : reference les flux d'authentification

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
- [ ] Committed: `docs(architecture): phase 02 complete -- vue d'ensemble`

---

## Notes

### Technical Considerations

- L'arborescence doit etre regeneree si la structure du projet change
- Les patterns documentes doivent etre coherents avec les regles dans `.claude/rules/`

### Known Limitations

- Les variables d'environnement non prefixees NEXT_PUBLIC_ ne sont pas toutes listees dans le code (certaines sont dans `.env.local`)

### Future Enhancements

- Diagramme de sequence pour les flux complexes (ex: streaming pipeline)
- Section "Performance Architecture" (caching, ISR, revalidation)

---

**Previous:** [[phase-01-docs-readme|Phase 01: Index et Quick-Start]]
**Next:** [[phase-03-docs-database|Phase 03: Schema Base de Donnees]]
