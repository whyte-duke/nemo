---
title: "Phase 08 - Graphe Social"
description: "Documenter le systeme d'amis, auto-friending profondeur 2, demandes d'amis, et visibilite sociale"
skill: none
status: pending
group: "features"
dependencies: ["phase-03"]
tags: [documentation, social, friends, graph]
created: 2026-03-04
updated: 2026-03-04
---

# Phase 08: Graphe Social

**Context:** [[plan|Master Plan]] | **Dependencies:** P03 | **Status:** Pending

---

## Overview

Generer `docs/features/social.md` documentant le graphe social de Nemo : tables `friendships` et `friend_requests`, contrainte bidirectionnelle (`user_id < friend_id`), auto-friending profondeur 2 via invitations, demandes d'amis manuelles, visibilite sociale (historique, interactions, listes des amis), et RLS associees.

**Goal:** Un agent IA comprend le modele social complet et peut le modifier ou l'etendre.

---

## Context & Workflow

### How This Phase Fits Into the Project

- **UI Layer:** Page `/amis`, composant `FriendCard`, profil ami `/profil/[userId]`
- **Server Layer:** Routes `/api/friends/*`, hook `use-friends`
- **Database Layer:** Tables `friendships`, `friend_requests`, fonctions SQL, triggers
- **Integrations:** Lie au systeme d'invitation (invite_tokens, invite_uses)

### User Workflow

**Trigger:** Un utilisateur partage un token d'invitation ou envoie une demande d'ami.

**Steps (via invitation):**
1. L'inviteur genere un token via POST `/api/invite/generate`
2. L'invite utilise le token a l'inscription
3. Le trigger `auto_friendship_on_invite` cree automatiquement les amities
4. Profondeur 1 : inviteur <-> invite
5. Profondeur 2 : tous les amis de l'inviteur <-> invite

**Steps (via demande manuelle):**
1. L'utilisateur cherche un ami via `/api/friends/search`
2. Il envoie une demande via POST `/api/friends/request`
3. Le destinataire accepte via PATCH `/api/friends/request/[id]`
4. Le trigger `friendship_on_accept` cree l'amitie

**Success Outcome:** Les deux utilisateurs sont amis et peuvent voir leurs historiques, interactions et listes.

### Problem Being Solved

**Pain Point:** Le graphe social implique des contraintes SQL complexes (user_id < friend_id), des triggers en cascade (profondeur 2), et des RLS multi-tables.
**Alternative Approach:** Lire la migration 012 + les 10 routes API friends pour comprendre.

### Integration Points

**Upstream Dependencies:**
- P03 (Database) : schema des tables friendships, friend_requests

**Downstream Consumers:**
- P06 (Recommendations) : score social base sur les likes des amis
- P07 (Lists) : visibilite des listes entre amis

---

## Prerequisites & Clarifications

### Questions for User

1. **Suppression d'amitie:** Peut-on supprimer une amitie ? Si oui, est-ce que cela affecte les amities de profondeur 2 ?
   - **Context:** La policy `friendships_delete` autorise la suppression par l'un ou l'autre.
   - **Assumptions if unanswered:** La suppression est unitaire (ne cascade pas sur les amities de profondeur 2).
   - **Impact:** Documentation de la suppression.

2. **Profils publics:** La policy `profiles_select_public` autorise tout utilisateur authentifie a voir les profils. Quels champs sont visibles ?
   - **Context:** Le filtrage des colonnes sensibles est fait cote application, pas cote RLS.
   - **Assumptions if unanswered:** Documenter que RLS autorise l'acces, mais l'application filtre les champs sensibles.
   - **Impact:** Securite de la documentation.

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

- Modele de la table friendships avec contrainte CHECK (user_id < friend_id)
- Modele de la table friend_requests avec statuts (pending, accepted, declined)
- Fonction helper `insert_friendship(a, b, src)` documentee
- Trigger `auto_friendship_on_invite` : profondeur 1 + profondeur 2
- Trigger `friendship_on_accept` : creation d'amitie a l'acceptation
- RLS sociale : visibilite des donnees entre amis (watch_history, interactions, lists)
- Routes API friends documentees
- Diagramme du graphe social

### Technical

- Contenu extrait de : migration 012, routes friends, hook use-friends
- Taille cible : 5-8 KB

---

## Decision Log

### Contrainte bidirectionnelle documentee explicitement (ADR-P08-01)

**Date:** 2026-03-04
**Status:** Accepted

**Context:** La contrainte `CHECK (user_id < friend_id)` est subtile mais critique -- elle garantit une seule entree par paire.

**Decision:** Documenter cette contrainte avec un exemple illustratif et expliquer pourquoi elle existe.

**Consequences:**
- **Positive:** Evite des bugs d'insertion ou de requete
- **Negative:** Aucun
- **Neutral:** Pattern standard dans les graphes sociaux

---

## Implementation Steps

### Step 0: Test Definition (TDD)

#### 0.1: Verification de contenu

- [ ] La contrainte `user_id < friend_id` est documentee et expliquee
- [ ] Le mecanisme profondeur 2 est documente avec exemple
- [ ] La visibilite sociale (amis voient historique/interactions/listes) est documentee
- [ ] Les routes API friends sont listees

---

### Step 1: Lire les fichiers sources

#### 1.1: Fichiers a lire

- [ ] `supabase/migrations/012_friendships.sql` -- schema complet du social
- [ ] `src/app/api/friends/route.ts` -- liste des amis
- [ ] `src/app/api/friends/search/route.ts` -- recherche d'utilisateurs
- [ ] `src/app/api/friends/request/route.ts` -- envoi de demande
- [ ] `src/app/api/friends/request/[id]/route.ts` -- acceptation/refus
- [ ] `src/app/api/friends/[userId]/profile/route.ts` -- profil ami
- [ ] `src/app/api/friends/[userId]/history/route.ts` -- historique ami
- [ ] `src/app/api/friends/[userId]/likes/route.ts` -- likes ami
- [ ] `src/app/api/friends/[userId]/lists/route.ts` -- listes ami
- [ ] `src/app/api/friends/[userId]/stats/route.ts` -- stats ami
- [ ] `src/hooks/use-friends.ts` -- hook friends
- [ ] `src/components/friends/FriendCard.tsx` -- composant carte ami

---

### Step 2: Rediger la documentation

#### 2.1: Structure du fichier

```markdown
# Graphe Social

> Derniere mise a jour : 2026-03-04

## Resume rapide

Graphe social bidirectionnel avec contrainte user_id < friend_id.
Auto-friending profondeur 2 via invitations. Demandes manuelles avec acceptation.
Les amis voient : historique, interactions, listes.

## Modele de Donnees

### friendships
- Contrainte : CHECK (user_id < friend_id) -- une seule entree par paire
- Source : 'invite' ou 'manual'
- Exemple : Alice (UUID-A) et Bob (UUID-B) -> si A < B : (user_id=A, friend_id=B)

### friend_requests
- Statuts : pending -> accepted | declined
- Contrainte : from_user <> to_user

## Mecanisme d'Auto-Friending (Profondeur 2)

[Diagramme ASCII]
Alice invite Bob :
1. Alice <-> Bob (profondeur 1)
2. Si Alice est amie avec Charlie : Charlie <-> Bob (profondeur 2)
3. Si Alice est amie avec David : David <-> Bob (profondeur 2)

Trigger : auto_friendship_on_invite() sur INSERT dans invite_uses

## Demande d'Ami Manuelle

1. POST /api/friends/request { to_user }
2. Status : pending
3. PATCH /api/friends/request/[id] { status: 'accepted' }
4. Trigger : friendship_on_accept() -> insert_friendship()

## Visibilite Sociale

Quand A et B sont amis, A peut voir :
- watch_history de B (RLS: friends_watch_history_select)
- interactions de B (RLS: friends_interactions_select)
- lists de B (RLS: lists_select_friends)
- list_items de B (RLS: list_items_select_friends)
- profil de B (RLS: profiles_select_public -- champs non-sensibles)

## Fonctions SQL

### insert_friendship(a, b, src)
[Description et logique]

### auto_friendship_on_invite()
[Description et logique]

### friendship_on_accept()
[Description et logique]

## Routes API
[Documentation de chaque route]

## Fichiers Sources
[Liste]
```

---

## Verifiable Acceptance Criteria

**Critical Path:**

- [ ] `docs/features/social.md` existe avec contenu reel
- [ ] La contrainte bidirectionnelle est documentee
- [ ] Le mecanisme profondeur 2 est documente
- [ ] La visibilite sociale est documentee

**Quality Gates:**

- [ ] Les noms de policies RLS correspondent au SQL
- [ ] Aucun placeholder

**Integration:**

- [ ] Lien valide depuis `docs/README.md`

---

## Quality Assurance

### Test Plan

#### Manual Testing

- [ ] **Exactitude:** Le mecanisme profondeur 2 correspond au trigger dans migration 012
  - Expected: Profondeur 1 (inviteur<->invite) + Profondeur 2 (amis inviteur<->invite)
  - Actual: [To be filled]

#### Automated Testing

```bash
ls docs/features/social.md
pnpm exec grep -c '\[TODO\]\|\[TBD\]\|XXX' docs/features/social.md && echo "FAIL" || echo "PASS"
```

### Review Checklist

- [ ] **Security:** Visibilite correctement documentee
- [ ] **Documentation:** Contenu extrait de migration 012

---

## Dependencies

### Upstream (Required Before Starting)

- P03 (Database) : schema des tables

### Downstream (Will Use This Phase)

- P06 (Recommendations) : score social
- P07 (Lists) : visibilite listes entre amis

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
- [ ] Committed: `docs(social): phase 08 complete -- graphe social`

---

## Notes

### Technical Considerations

- La policy `profiles_select_public` autorise tout authentifie a lire les profils -- le filtrage des champs sensibles est fait cote application
- Le trigger auto_friendship utilise SECURITY DEFINER pour inserer dans friendships

### Known Limitations

- La suppression d'une amitie ne cascade pas sur les amities de profondeur 2
- Pas de blocage d'utilisateurs

### Future Enhancements

- Systeme de blocage
- Niveaux de visibilite (tout, listes uniquement, rien)

---

**Previous:** [[phase-07-docs-lists|Phase 07: Listes Collaboratives]]
**Next:** [[phase-09-docs-streaming|Phase 09: Streaming et Lecture]]
