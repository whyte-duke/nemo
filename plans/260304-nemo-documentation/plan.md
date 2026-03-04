---
title: "Documentation Technique Nemo - Plan Principal"
description: "Generation de documentation technique complete pour la plateforme de streaming Nemo, destinee aux agents IA et developpeurs humains"
status: pending
priority: P1
tags: [documentation, architecture, codebase-analysis]
created: 2026-03-04
updated: 2026-03-04
---

# Documentation Technique Nemo - Plan Principal

## Executive Summary

**The Mission:** Generer une documentation technique complete et en francais pour la plateforme de streaming Nemo, extraite directement du code source, destinee principalement aux agents IA (Claude) pour une comprehension rapide du projet en sessions futures.

**The Big Shift:** Passer d'un projet avec 3 fichiers de documentation existants et 105 fichiers non documentes vers une documentation structuree couvrant l'architecture, la base de donnees, les routes API, les fonctionnalites, les composants et les integrations externes.

> [!NOTE]
> _Chaque phase lit le code source reel et genere la documentation a partir de celui-ci. Aucun template generique, aucun placeholder -- uniquement du contenu extrait du codebase._

**Primary Deliverables:**

1. **Architecture et Base de Donnees:** Vue d'ensemble du systeme, schema complet des 13+ tables, 14 migrations, politiques RLS, et documentation des 30+ routes API
2. **Fonctionnalites:** Documentation detaillee du systeme de recommandation (5 phases), des listes collaboratives, du graphe social, du streaming et des telechargements
3. **Composants et Integrations:** Documentation des 13 hooks, contextes React, composants UI, et integrations externes (TMDB, Supabase, StreamFusion, Jellyfin, Debrid)

---

## Phasing Strategy (Roadmap)

Nous suivons une strategie de **documentation progressive par domaine**. Chaque phase produit un fichier Markdown unique dans `/docs`, en lisant les fichiers sources correspondants et en extrayant le contenu reel.

### Phase Constraints

- **Size:** 10-15KB max par document de phase
- **Scope:** Un fichier de documentation par phase
- **Dependencies:** Les phases architecture/database sont fondationnelles, les autres sont largement independantes
- **Review gate:** Validation du contenu genere contre le code source

### Phase File Naming

- Pattern: `phase-NN-descriptive-slug.md`
- Exemple: `phase-01-docs-readme-index.md`, `phase-05-docs-recommendations.md`
- Pas de sous-phases -- numerotation sequentielle plate

### Phase Table

| Phase  | Title                                              | Group              | Focus                           | Status    |
| :----- | :------------------------------------------------- | :----------------- | :------------------------------ | :-------- |
| **01** | [Index et Quick-Start](./phase-01-docs-readme.md)  | architecture       | README.md principal pour agents | Done      |
| **02** | [Architecture Generale](./phase-02-docs-architecture-overview.md) | architecture | Vue d'ensemble du systeme | Done     |
| **03** | [Schema Base de Donnees](./phase-03-docs-database.md) | database        | Tables, colonnes, RLS           | Done      |
| **04** | [Routes API](./phase-04-docs-api-routes.md)        | architecture       | 30+ endpoints documentes        | Done      |
| **05** | [Authentification](./phase-05-docs-authentication.md) | architecture    | Flux auth Supabase + Jellyfin   | Done      |
| **06** | [Systeme de Recommandation](./phase-06-docs-recommendations.md) | features | Algorithme 5 phases, poids   | Done      |
| **07** | [Listes Collaboratives](./phase-07-docs-lists.md)  | features           | Multi-listes, partage, RLS      | Pending   |
| **08** | [Graphe Social](./phase-08-docs-social.md)         | features           | Amis, auto-friending, visibilite | Pending  |
| **09** | [Streaming et Lecture](./phase-09-docs-streaming.md) | features          | StreamFusion, qualite, HLS      | Pending   |
| **10** | [Jellyfin](./phase-10-docs-jellyfin.md)            | features           | Integration, sync bibliotheque  | Pending   |
| **11** | [Telechargements](./phase-11-docs-downloads.md)    | features           | Debrid, file d'attente          | Pending   |
| **12** | [Hooks Personnalises](./phase-12-docs-hooks.md)    | components         | 13 hooks documentes             | Pending   |
| **13** | [Contextes et Providers](./phase-13-docs-contexts.md) | components      | Contextes React, state global   | Pending   |
| **14** | [Composants UI](./phase-14-docs-ui-components.md)  | components         | Composants reutilisables        | Pending   |
| **15** | [TMDB](./phase-15-docs-tmdb.md)                    | integrations       | Client TMDB, cache, genres      | Pending   |
| **16** | [Supabase](./phase-16-docs-supabase.md)            | integrations       | Clients, helpers RLS, admin     | Pending   |
| **17** | [Services Externes](./phase-17-docs-external-services.md) | integrations | Stremio, Debrid, OAuth imports | Pending   |

### Group Summary

Groups define audit boundaries -- connected phases are reviewed together after the group completes.

| Group | Phases | Description |
|-------|--------|-------------|
| architecture | P01-P02, P04-P05 | Index, vue d'ensemble, routes API, authentification |
| database | P03 | Schema complet, colonnes, RLS, triggers, migrations |
| features | P06-P11 | Recommandations, listes, social, streaming, Jellyfin, downloads |
| components | P12-P14 | Hooks, contextes, composants UI |
| integrations | P15-P17 | TMDB, Supabase, services externes |

**Group ordering:** architecture -> database -> features + components + integrations (ces 3 derniers sont independants entre eux).

---

## Architectural North Star

### 1. Documentation extraite du code, pas generique

- **Core Principle:** Chaque fichier de documentation est genere en lisant les fichiers sources reels. Les exemples de code, les schemas de tables, les poids d'algorithme viennent directement du codebase.
- **Enforcement:** Chaque phase liste les fichiers sources a lire. Le contenu est verifie contre le code.

### 2. Documentation bilingue adaptee

- **Core Principle:** Le code et les commentaires existants sont en francais. La documentation suit cette convention.
- **Enforcement:** Tout le contenu redactionnel est en francais. Les noms de variables/fonctions restent en anglais (comme dans le code).

### 3. Structure optimisee pour agents IA

- **Core Principle:** Les agents IA ont besoin de comprendre rapidement l'architecture, les patterns et les relations. La documentation privilegie les tableaux, les listes, les diagrammes ASCII et les extraits de code.
- **Enforcement:** Format standard : Contexte rapide -> Schema/Structure -> Details -> Fichiers sources.

---

## Project Framework Alignment

### Documentation Structure Priority

1. **First:** Lire le code source directement (fichiers .ts, .tsx, .sql)
2. **Second:** Extraire les patterns, types, interfaces, poids, constantes
3. **Third:** Rediger la documentation en structurant l'information pour consultation rapide

### Required Patterns per Phase

| Task | Pattern |
|------|---------|
| Schema DB | Lire les migrations SQL -> extraire CREATE TABLE, RLS, triggers |
| Routes API | Lire les fichiers route.ts -> extraire methode, auth, parametres, reponse |
| Hooks | Lire les fichiers use-*.ts -> extraire signature, state, API calls |
| Composants | Lire les fichiers .tsx -> extraire props, comportement, integrations |
| Algorithmes | Lire les fichiers .ts -> extraire poids, formules, flux de donnees |

---

## Global Decision Log (Project ADRs)

### Documentation en Francais (ADR-G-01)

**Status:** Accepted

**Context:** Le code source de Nemo utilise le francais pour les noms de routes (/decouvrir, /amis, /ma-liste), les commentaires, les noms de politiques RLS et les messages d'erreur. La documentation doit etre coherente avec le code.

**Decision:** Toute la documentation est redigee en francais. Les noms techniques (variables, fonctions, types TypeScript) restent en anglais comme dans le code.

**Consequences:** Documentation accessible aux developpeurs francophones. Les agents IA Claude comprennent le francais sans difficulte.

### Un Fichier par Fonctionnalite (ADR-G-02)

**Status:** Accepted

**Context:** Avec 17 fichiers de documentation, chaque fichier reste focalisé et consultable independamment. Un agent IA peut lire uniquement le fichier pertinent sans charger tout le contexte.

**Decision:** Chaque phase produit exactement un fichier Markdown dans `/docs/`. Pas de fichier monolithique.

**Consequences:** Navigation rapide, chargement partiel possible, maintenance plus simple.

---

## Security Requirements

### Documentation Considerations

- Ne pas documenter les secrets, tokens ou cles API en clair
- Documenter les patterns RLS sans exposer de vulnerabilites exploitables
- Mentionner les roles (free, sources, vip, admin) et leurs permissions sans details d'implementation exploitables

### RLS Policy Documentation Rules

- Documenter la logique d'acces (qui peut voir quoi) en termes de roles et relations
- Inclure les noms de policies tels que dans le code source
- Ne pas inclure de contournements ou failles connues

---

## Implementation Standards

### Global Test Strategy

- **Documentation phases:** Pas de tests unitaires -- la validation est la comparaison contenu vs code source
- **Acceptance:** Chaque fichier de documentation reference les fichiers sources d'ou il est extrait

### Global Documentation Standard

Structure de chaque fichier genere :

```markdown
# Titre
> Derniere mise a jour : YYYY-MM-DD | Fichiers sources : [liste]

## Resume rapide (pour agents IA)
[2-3 phrases pour comprendre l'essentiel]

## [Contenu principal]
[Tables, schemas, code, diagrammes]

## Fichiers Sources
[Liste des fichiers du codebase utilises pour generer cette doc]
```

---

## Success Metrics & Quality Gates

### Project Success Metrics

- 100% des tables documentees avec colonnes, types, et RLS
- 100% des routes API documentees avec methode, parametres, et reponse
- 100% des hooks documentes avec signature et usage
- Systeme de recommandation documente avec formule exacte et poids

### Global Quality Gates (Pre-Release)

- [ ] Chaque fichier /docs/*.md reference ses fichiers sources
- [ ] Aucun placeholder ou contenu generique restant
- [ ] Les poids et formules correspondent exactement au code source
- [ ] La structure /docs est navigable depuis le README.md principal
- [ ] Documentation en francais coherente

---

## Resources & References

- **Codebase:** `/Users/whyteduke/Documents/QNAP/Home/nemo/.claude/worktrees/fervent-cori/`
- **Migrations:** `supabase/migrations/001-013`
- **Routes API:** `src/app/api/**/*.ts` (30+ routes)
- **Hooks:** `src/hooks/use-*.ts` (13 hooks)
- **Lib:** `src/lib/**/*.ts` (auth, jellyfin, recommendations, stremio, supabase, tmdb)
- **Components:** `src/components/**/*.tsx` (40+ composants)

---

**Next:** [[phase-01-docs-readme|Phase 01: Index et Quick-Start]]
