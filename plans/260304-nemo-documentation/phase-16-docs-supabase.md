---
title: "Phase 16 - Supabase"
description: "Documenter les clients Supabase (server, browser, admin), le middleware, les types generes, et les helpers RLS"
skill: none
status: pending
group: "integrations"
dependencies: []
tags: [documentation, supabase, client, middleware, rls]
created: 2026-03-04
updated: 2026-03-04
---

# Phase 16: Supabase

**Context:** [[plan|Master Plan]] | **Dependencies:** None | **Status:** Pending

---

## Overview

Generer `docs/integrations/supabase.md` documentant l'integration Supabase de Nemo : les 3 variantes de client (server, browser, admin), le middleware de session, les types generes, les patterns d'utilisation, et les bonnes pratiques RLS.

**Goal:** Un agent IA sait quel client Supabase utiliser dans quel contexte et comprend les implications de chaque choix.

---

## Context & Workflow

### How This Phase Fits Into the Project

- **UI Layer:** Client browser pour les composants client
- **Server Layer:** Client server pour les Server Components et route handlers, client admin pour contourner RLS
- **Database Layer:** Tous les acces DB passent par un client Supabase
- **Integrations:** Supabase Auth (JWT, session), Supabase Realtime (potentiel)

### User Workflow

**Trigger:** Un agent IA doit faire une requete a la base de donnees.

**Steps:**
1. L'agent consulte `docs/integrations/supabase.md`
2. Il identifie le bon client (server vs browser vs admin)
3. Il comprend les implications RLS de chaque client
4. Il ecrit sa requete en utilisant le bon pattern

**Success Outcome:** L'agent utilise le bon client Supabase avec les bonnes implications de securite.

### Problem Being Solved

**Pain Point:** 3 clients differents avec des implications de securite differentes -- le mauvais choix peut causer des fuites de donnees ou des erreurs d'auth.
**Alternative Approach:** Deviner quel client utiliser et risquer des bugs de securite.

### Integration Points

**Upstream Dependencies:** Aucune

**Downstream Consumers:**
- Toutes les phases qui interagissent avec la DB

---

## Prerequisites & Clarifications

### Questions for User

1. **Types generes:** Les types Supabase sont-ils generes automatiquement (supabase gen types) ou manuels ?
   - **Context:** `src/types/supabase.ts` existe.
   - **Assumptions if unanswered:** Verifier le contenu du fichier pour determiner si c'est genere ou manuel.
   - **Impact:** Documentation de la maintenance des types.

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

- Les 3 clients documentes : server (createClient), browser (createBrowserClient), admin (createAdminClient)
- Pour chaque client : quand l'utiliser, implications RLS, exemples
- Middleware documente (session refresh, protection routes)
- Types Supabase documentes
- Variables d'environnement Supabase listees
- Patterns d'utilisation dans les route handlers et server components
- Bonnes pratiques (quand utiliser admin vs server)

### Technical

- Contenu extrait de : src/lib/supabase/server.ts, client.ts, admin.ts, middleware.ts, types/supabase.ts
- Taille cible : 4-6 KB

---

## Decision Log

### Documentation centree securite (ADR-P16-01)

**Date:** 2026-03-04
**Status:** Accepted

**Context:** Le choix du client Supabase a des implications de securite critiques (RLS vs no RLS).

**Decision:** Documenter explicitement les implications de securite de chaque client.

**Consequences:**
- **Positive:** L'agent comprend les risques de chaque choix
- **Negative:** Aucun

---

## Implementation Steps

### Step 0: Test Definition (TDD)

#### 0.1: Verification de contenu

- [ ] Les 3 clients sont documentes avec quand les utiliser
- [ ] Le middleware est documente
- [ ] Les implications RLS sont explicites pour chaque client

---

### Step 1: Lire les fichiers sources

#### 1.1: Fichiers a lire

- [ ] `src/lib/supabase/server.ts` -- client server
- [ ] `src/lib/supabase/client.ts` -- client browser
- [ ] `src/lib/supabase/admin.ts` -- client admin
- [ ] `src/lib/supabase/middleware.ts` -- middleware
- [ ] `src/types/supabase.ts` -- types
- [ ] `middleware.ts` (racine du projet si existe) -- configuration Next.js middleware

---

### Step 2: Rediger la documentation

#### 2.1: Structure du fichier

```markdown
# Integration Supabase

> Derniere mise a jour : 2026-03-04

## Resume rapide

3 clients Supabase : server (RLS active), browser (RLS active), admin (RLS contournee).
Middleware rafraichit la session JWT sur chaque requete.

## Clients Supabase

### createClient() -- Server
- **Fichier:** src/lib/supabase/server.ts
- **Usage:** Server Components, route handlers
- **RLS:** Active -- le JWT de l'utilisateur est utilise
- **Quand utiliser:** Toute requete DB dans un contexte serveur authentifie
- **Pattern:**
  const supabase = await createClient();
  const { data } = await supabase.from('table').select('*');

### createBrowserClient() -- Browser
- **Fichier:** src/lib/supabase/client.ts
- **Usage:** Client Components (use client)
- **RLS:** Active
- **Quand utiliser:** Acces DB direct depuis le navigateur (rare -- preferer les route handlers)

### createAdminClient() -- Admin (Service Role)
- **Fichier:** src/lib/supabase/admin.ts
- **Usage:** Operations administratives, OAuth callbacks, triggers serveur
- **RLS:** CONTOURNEE -- acces complet a toutes les donnees
- **Quand utiliser:** UNIQUEMENT quand RLS doit etre contournee (ex: lire le role d'un autre utilisateur)
- **ATTENTION:** Ne jamais utiliser dans du code client

## Middleware

- **Fichier:** src/lib/supabase/middleware.ts
- **Role:** Rafraichit la session JWT sur chaque requete
- **Routes protegees:** /(main)/*
- **Routes publiques:** /(auth)/*

## Variables d'Environnement

| Variable | Contexte | Description |
|----------|----------|-------------|
| NEXT_PUBLIC_SUPABASE_URL | Public | URL du projet Supabase |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Public | Cle anonyme (RLS active) |
| SUPABASE_SERVICE_ROLE_KEY | Serveur | Cle service role (RLS contournee) |

## Types Supabase
[Description du fichier types/supabase.ts]

## Bonnes Pratiques

1. Preferer `createClient()` (server) -- RLS protege automatiquement
2. Utiliser `createAdminClient()` uniquement avec justification
3. Ne jamais exposer SUPABASE_SERVICE_ROLE_KEY cote client
4. Toujours verifier l'auth avec getAuthUser() avant les mutations

## Fichiers Sources
[Liste]
```

---

## Verifiable Acceptance Criteria

**Critical Path:**

- [ ] `docs/integrations/supabase.md` existe avec contenu reel
- [ ] Les 3 clients documentes avec implications RLS
- [ ] Le middleware documente
- [ ] Variables d'environnement listees

**Quality Gates:**

- [ ] Aucun placeholder
- [ ] Pas de cle de service role documentee

**Integration:**

- [ ] Lien valide depuis `docs/README.md`

---

## Quality Assurance

### Test Plan

#### Manual Testing

- [ ] **Securite:** Les implications RLS sont explicites
  - Expected: admin = RLS contournee, server = RLS active
  - Actual: [To be filled]

#### Automated Testing

```bash
ls docs/integrations/supabase.md
pnpm exec grep -c '\[TODO\]\|\[TBD\]\|XXX' docs/integrations/supabase.md && echo "FAIL" || echo "PASS"
```

### Review Checklist

- [ ] **Security:** Implications RLS correctement documentees
- [ ] **Documentation:** Contenu extrait du code reel

---

## Dependencies

### Upstream (Required Before Starting)

- Aucune

### Downstream (Will Use This Phase)

- Toutes les phases qui documentent des interactions DB

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
- [ ] Committed: `docs(supabase): phase 16 complete -- integration Supabase`

---

## Notes

### Technical Considerations

- Le client admin utilise `as any` dans certains endroits pour contourner les types stricts
- Le middleware est critique pour la securite -- une mauvaise configuration expose les routes protegees

### Known Limitations

- Les types Supabase peuvent etre desynchronises avec le schema reel

### Future Enhancements

- Documentation de Supabase Realtime (si utilise)
- Guide de migration des types apres changement de schema

---

**Previous:** [[phase-15-docs-tmdb|Phase 15: TMDB]]
**Next:** [[phase-17-docs-external-services|Phase 17: Services Externes]]
