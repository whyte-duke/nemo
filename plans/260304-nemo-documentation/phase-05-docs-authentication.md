---
title: "Phase 05 - Authentification"
description: "Documenter les flux d'authentification Supabase Auth + Jellyfin et le systeme de roles dans docs/architecture/authentication.md"
skill: none
status: pending
group: "architecture"
dependencies: []
tags: [documentation, auth, roles, supabase, jellyfin]
created: 2026-03-04
updated: 2026-03-04
---

# Phase 05: Authentification

**Context:** [[plan|Master Plan]] | **Dependencies:** None | **Status:** Pending

---

## Overview

Generer `docs/architecture/authentication.md` documentant les flux d'authentification de Nemo : inscription/connexion via Supabase Auth, authentification Jellyfin, systeme de roles (free/sources/vip/admin), tokens d'invitation, middleware de protection des routes, et session management.

**Goal:** Un agent IA comprend comment l'authentification fonctionne a chaque niveau : UI, middleware, API, et base de donnees.

---

## Context & Workflow

### How This Phase Fits Into the Project

- **UI Layer:** Pages `(auth)/connexion` et `(auth)/inscription`, redirection middleware
- **Server Layer:** `src/lib/auth/session.ts`, `src/lib/auth/jellyfin-session.ts`, middleware Supabase
- **Database Layer:** Table `profiles` (creation auto), `invite_tokens`, `invite_uses`, colonne `role`
- **Integrations:** Supabase Auth (JWT), Jellyfin server auth

### User Workflow

**Trigger:** Un utilisateur arrive sur l'application pour la premiere fois ou se reconnecte.

**Steps:**
1. L'utilisateur accede a `/connexion` ou `/inscription`
2. Supabase Auth gere l'inscription/connexion (email/password)
3. Un JWT est stocke dans un cookie HttpOnly
4. Le middleware verifie le JWT sur chaque requete vers `(main)/`
5. Le trigger `handle_new_user` cree automatiquement un profil dans `profiles`
6. Si l'utilisateur a un token d'invitation, `invite_uses` est rempli et les amities sont creees automatiquement

**Success Outcome:** L'utilisateur est authentifie, son profil existe, et ses amities sont etablies.

### Problem Being Solved

**Pain Point:** Le flux d'auth implique plusieurs couches (UI, middleware, DB triggers) et deux systemes (Supabase + Jellyfin) -- difficile a comprendre sans documentation.
**Alternative Approach:** Lire 6+ fichiers source pour reconstituer le flux.

### Integration Points

**Upstream Dependencies:** Aucune

**Downstream Consumers:**
- Toutes les routes API utilisent `getAuthUser()` ou `getAuthUserWithRole()`
- P08 (Social) : les invitations declenchent la creation d'amities

---

## Prerequisites & Clarifications

### Questions for User

1. **OAuth externe:** Les flux Trakt et Letterboxd sont-ils des flux d'import de donnees ou d'authentification ?
   - **Context:** Les routes `/api/auth/trakt` et `/api/auth/letterboxd` existent.
   - **Assumptions if unanswered:** Ce sont des flux OAuth pour import de donnees, pas d'auth primaire.
   - **Impact:** Determine si on les documente dans Auth ou dans Integrations.

2. **Jellyfin auth:** La session Jellyfin est-elle independante de Supabase Auth ?
   - **Context:** `src/lib/auth/jellyfin-session.ts` existe separement de `session.ts`.
   - **Assumptions if unanswered:** Oui, c'est un systeme parallele pour acceder aux fonctionnalites Jellyfin.
   - **Impact:** Complexite du diagramme d'auth.

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

- Diagramme du flux d'inscription (UI -> Supabase Auth -> trigger handle_new_user -> profiles)
- Diagramme du flux de connexion (UI -> Supabase Auth -> JWT cookie -> middleware)
- Documentation du systeme de roles : free < sources < vip < admin
- Documentation des fonctions helper : `getAuthUser`, `getAuthUserWithName`, `getAuthUserWithRole`, `requireRole`
- Documentation du middleware Supabase (protection des routes)
- Documentation du flux d'invitation (token -> invite_uses -> auto-friendship)
- Documentation de la session Jellyfin
- Tous les flux en francais

### Technical

- Contenu extrait de : `src/lib/auth/session.ts`, `src/lib/auth/jellyfin-session.ts`, `src/lib/supabase/middleware.ts`, `src/app/(auth)/*.tsx`, migrations 001, 006, 007, 008, 009, 010
- Taille cible : 5-8 KB

---

## Decision Log

### Auth Supabase comme source de verite (ADR-P05-01)

**Date:** 2026-03-04
**Status:** Accepted

**Context:** Nemo utilise Supabase Auth comme systeme d'authentification primaire. Jellyfin auth est secondaire et optionnel.

**Decision:** Documenter Supabase Auth comme flux principal et Jellyfin comme flux optionnel.

**Consequences:**
- **Positive:** Hierarchie claire des systemes d'auth
- **Negative:** La session Jellyfin est documentee comme "secondaire" meme si elle est importante pour le streaming
- **Neutral:** Les deux systemes sont documentes

---

## Implementation Steps

### Step 0: Test Definition (TDD)

#### 0.1: Verification de contenu

- [ ] Le fichier documente les 4 fonctions helper d'auth
- [ ] Le flux d'inscription et de connexion sont presents
- [ ] Le systeme de roles est documente avec l'ordre (free < sources < vip < admin)
- [ ] Le middleware est documente

---

### Step 1: Lire les fichiers sources

#### 1.1: Fichiers a lire

- [ ] `src/lib/auth/session.ts` -- getAuthUser, getAuthUserWithName, getAuthUserWithRole, requireRole
- [ ] `src/lib/auth/jellyfin-session.ts` -- session Jellyfin
- [ ] `src/lib/supabase/middleware.ts` -- middleware de protection
- [ ] `src/lib/supabase/server.ts` -- creation client server
- [ ] `src/lib/supabase/client.ts` -- creation client browser
- [ ] `src/lib/supabase/admin.ts` -- creation client admin
- [ ] `src/app/(auth)/connexion/page.tsx` -- page de connexion
- [ ] `src/app/(auth)/inscription/page.tsx` -- page d'inscription
- [ ] `src/app/(auth)/layout.tsx` -- layout auth
- [ ] `supabase/migrations/001_initial_schema.sql` -- trigger handle_new_user
- [ ] `supabase/migrations/008_roles_and_invites.sql` -- roles et invitations
- [ ] `supabase/migrations/010_admin_role.sql` -- role admin

---

### Step 2: Rediger la documentation

#### 2.1: Structure du fichier

```markdown
# Authentification

> Derniere mise a jour : 2026-03-04

## Resume rapide

Supabase Auth (email/password) + JWT cookie HttpOnly. Roles : free < sources < vip < admin.
Trigger automatique cree un profil a l'inscription. Session Jellyfin optionnelle.

## Flux d'Inscription

[Diagramme ASCII du flux complet]
1. Utilisateur -> /inscription
2. Supabase Auth createUser()
3. Trigger handle_new_user() -> INSERT profiles
4. Si invite token -> INSERT invite_uses -> auto_friendship_on_invite()
5. Redirection -> /onboarding ou /(main)

## Flux de Connexion

[Diagramme ASCII]
1. Utilisateur -> /connexion
2. Supabase Auth signInWithPassword()
3. JWT cookie HttpOnly
4. Middleware verifie sur chaque requete (main)

## Middleware de Protection

[Extrait de middleware.ts]
Routes protegees : /(main)/*
Routes publiques : /(auth)/*

## Fonctions Helper d'Authentification

### getAuthUser()
- Retourne User | null
- Verification locale du JWT (pas d'appel reseau)
- Fichier : src/lib/auth/session.ts

### getAuthUserWithName()
- Retourne { id, name } | null
- Extrait display_name depuis les metadonnees

### getAuthUserWithRole()
- Retourne { id, name, role } | null
- Lit le role depuis profiles via admin client

### requireRole(minRole)
- Retourne user si role >= minRole, null sinon
- Ordre : free(0) < sources(1) < vip(2) < admin(3)

## Systeme de Roles

| Role | Ordre | Permissions |
|------|-------|-------------|
| free | 0 | Acces de base |
| sources | 1 | Acces aux sources de streaming |
| vip | 2 | Fonctionnalites premium |
| admin | 3 | Administration complete |

## Tokens d'Invitation

[Documentation du flux invite_tokens -> invite_uses -> auto-friendship]

## Session Jellyfin

[Documentation de jellyfin-session.ts]

## Fichiers Sources
[Liste]
```

---

## Verifiable Acceptance Criteria

**Critical Path:**

- [ ] `docs/architecture/authentication.md` existe avec contenu reel
- [ ] Les 4 fonctions helper d'auth sont documentees
- [ ] Le systeme de roles est documente
- [ ] Les flux inscription et connexion sont decrits

**Quality Gates:**

- [ ] Taille entre 5 et 8 KB
- [ ] Aucun placeholder
- [ ] Roles et permissions correspondent au code

**Integration:**

- [ ] Lien valide depuis `docs/README.md`

---

## Quality Assurance

### Test Plan

#### Manual Testing

- [ ] **Exactitude:** L'ordre des roles correspond a `src/lib/auth/session.ts`
  - Expected: free=0, sources=1, vip=2, admin=3
  - Actual: [To be filled]

#### Automated Testing

```bash
ls docs/architecture/authentication.md
pnpm exec grep -c '\[TODO\]\|\[TBD\]\|XXX' docs/architecture/authentication.md && echo "FAIL" || echo "PASS"
```

### Review Checklist

- [ ] **Security:** Pas de secrets documentes en clair
- [ ] **Documentation:** Flux extraits du code reel

---

## Dependencies

### Upstream (Required Before Starting)

- Aucune

### Downstream (Will Use This Phase)

- Toutes les phases qui documentent des routes API protegees
- P08 (Social) : flux d'invitation

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
- [ ] Committed: `docs(auth): phase 05 complete -- authentification`

---

## Notes

### Technical Considerations

- Le client admin (`createAdminClient`) contourne RLS -- documenter quand et pourquoi il est utilise
- Les routes OAuth (Trakt, Letterboxd) sont des flux d'import, pas d'auth primaire

### Known Limitations

- Les details du JWT (claims, expiration) dependent de la configuration Supabase et ne sont pas dans le code

### Future Enhancements

- Documentation du refresh token flow
- Documentation des cas d'erreur d'auth

---

**Previous:** [[phase-04-docs-api-routes|Phase 04: Routes API]]
**Next:** [[phase-06-docs-recommendations|Phase 06: Systeme de Recommandation]]
