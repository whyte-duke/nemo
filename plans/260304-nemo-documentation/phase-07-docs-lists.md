---
title: "Phase 07 - Listes Collaboratives"
description: "Documenter le systeme de multi-listes collaboratives avec partage, roles owner/member, et RLS"
skill: none
status: pending
group: "features"
dependencies: ["phase-03"]
tags: [documentation, lists, collaborative, sharing]
created: 2026-03-04
updated: 2026-03-04
---

# Phase 07: Listes Collaboratives

**Context:** [[plan|Master Plan]] | **Dependencies:** P03 | **Status:** Pending

---

## Overview

Generer `docs/features/lists.md` documentant le systeme complet de listes collaboratives de Nemo : liste par defaut ("Ma Liste"), listes personnalisees avec emoji, roles owner/member, partage avec amis, RLS pour l'acces, et les routes API associees.

**Goal:** Un agent IA comprend le systeme de listes -- creation, partage, collaboration, et securite -- pour pouvoir le modifier ou l'etendre.

---

## Context & Workflow

### How This Phase Fits Into the Project

- **UI Layer:** Page `/ma-liste`, composants `CreateListModal`, `ListPickerSheet`, `ListSelector`
- **Server Layer:** Routes `/api/lists/*`, `/api/my-list`, `/api/suggestions-list`
- **Database Layer:** Tables `lists`, `list_items`, `list_members` avec RLS
- **Integrations:** Aucune externe

### User Workflow

**Trigger:** L'utilisateur veut sauvegarder un film/serie pour le voir plus tard.

**Steps:**
1. L'utilisateur swipe "list" ou clique "Ajouter a une liste" depuis un media
2. `ListPickerSheet` affiche ses listes
3. Il choisit une liste ou en cree une nouvelle (nom + emoji)
4. L'item est ajoute via POST `/api/lists/[id]/items`
5. Il peut partager la liste avec des amis (ajout de members)
6. Les membres peuvent aussi ajouter/retirer des items

**Success Outcome:** L'utilisateur a des listes organisees qu'il peut partager avec ses amis.

### Problem Being Solved

**Pain Point:** Le systeme de listes implique 3 tables, des RLS complexes (owner vs member vs public vs friends), et des triggers automatiques.
**Alternative Approach:** Lire les migrations 001 + 011 + 012 et les routes API pour comprendre les interactions.

### Integration Points

**Upstream Dependencies:**
- P03 (Database) : schema des tables lists, list_items, list_members

**Downstream Consumers:**
- P08 (Social) : les amis peuvent voir les listes

---

## Prerequisites & Clarifications

### Questions for User

1. **Liste suggestions:** La route `/api/suggestions-list` est-elle liee au systeme de listes principal ou est-ce un concept separe ?
   - **Context:** Le swipe "list" appelle cette route.
   - **Assumptions if unanswered:** C'est la liste par defaut de suggestions (is_default = true).
   - **Impact:** Documentation de la relation entre suggestions et listes.

2. **Limite de listes:** Y a-t-il une limite au nombre de listes par utilisateur ?
   - **Context:** Le code ne semble pas avoir de limite explicite.
   - **Assumptions if unanswered:** Pas de limite documentee.
   - **Impact:** Documentation des contraintes.

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

- Schema des 3 tables (lists, list_items, list_members) avec relations
- Systeme de roles : owner (createur) vs member (invite)
- Permissions par role : qui peut faire quoi (CRUD sur items, ajout/retrait de membres)
- RLS detaillee pour chaque operation (SELECT, INSERT, UPDATE, DELETE)
- Trigger automatique : ajout du createur comme owner
- Migration one-shot des listes existantes
- Routes API documentees (/api/lists/*, /api/my-list, /api/suggestions-list)
- Composants UI listes (CreateListModal, ListPickerSheet, ListSelector)

### Technical

- Contenu extrait de : migration 011, routes lists, composants lists, hooks use-list/use-lists
- Taille cible : 5-8 KB

---

## Decision Log

### Documentation centree sur les permissions (ADR-P07-01)

**Date:** 2026-03-04
**Status:** Accepted

**Context:** Le systeme de listes est surtout complexe par ses regles de permissions (qui voit quoi, qui peut modifier quoi).

**Decision:** Structurer la doc autour d'un tableau de permissions clair : role x operation -> autorise/refuse.

**Consequences:**
- **Positive:** Comprehension immediate des regles d'acces
- **Negative:** Peut sembler redondant avec la doc RLS de P03
- **Neutral:** P03 documente le SQL, P07 documente la logique metier

---

## Implementation Steps

### Step 0: Test Definition (TDD)

#### 0.1: Verification de contenu

- [ ] Les 3 tables sont documentees avec relations
- [ ] Le tableau de permissions role x operation est present
- [ ] Le trigger `add_list_owner` est documente
- [ ] Les routes API sont listees

---

### Step 1: Lire les fichiers sources

#### 1.1: Fichiers a lire

- [ ] `supabase/migrations/011_multi_lists.sql` -- schema complet des listes collaboratives
- [ ] `supabase/migrations/001_initial_schema.sql` -- schema initial lists/list_items
- [ ] `src/app/api/lists/route.ts` -- CRUD listes
- [ ] `src/app/api/lists/[id]/route.ts` -- operations sur une liste
- [ ] `src/app/api/lists/[id]/items/route.ts` -- gestion des items
- [ ] `src/app/api/lists/[id]/members/route.ts` -- gestion des membres
- [ ] `src/app/api/lists/preview/route.ts` -- preview de liste
- [ ] `src/app/api/my-list/route.ts` -- liste par defaut
- [ ] `src/app/api/suggestions-list/route.ts` -- liste de suggestions
- [ ] `src/hooks/use-list.ts` -- hook d'une liste
- [ ] `src/hooks/use-lists.ts` -- hook de toutes les listes
- [ ] `src/components/lists/CreateListModal.tsx`
- [ ] `src/components/lists/ListPickerSheet.tsx`
- [ ] `src/components/lists/ListSelector.tsx`

---

### Step 2: Rediger la documentation

#### 2.1: Structure du fichier

```markdown
# Listes Collaboratives

> Derniere mise a jour : 2026-03-04

## Resume rapide

Multi-listes avec emoji, roles owner/member, partage entre amis.
3 tables : lists, list_items, list_members. RLS par role et visibilite.

## Schema des Tables

### Relation
lists ──< list_items (list_id)
lists ──< list_members (list_id)
profiles ──< list_members (user_id)

### Tables detaillees
[Colonnes, types, contraintes pour lists, list_items, list_members]

## Systeme de Permissions

| Operation | Owner | Member | Ami (non-membre) | Public |
|-----------|-------|--------|-------------------|--------|
| Voir la liste | Oui | Oui | Oui (si ami) | Oui (si is_public) |
| Ajouter un item | Oui | Oui | Non | Non |
| Retirer un item | Oui | Oui | Non | Non |
| Modifier la liste | Oui | Non | Non | Non |
| Supprimer la liste | Oui | Non | Non | Non |
| Ajouter un membre | Oui | Non | Non | Non |
| Se retirer | - | Oui | - | - |

## Trigger Automatique

### add_list_owner()
A la creation d'une liste, le createur est automatiquement ajoute comme owner dans list_members.

## Routes API
[Documentation de chaque route]

## Composants UI
[Documentation de chaque composant]

## Hooks
[Documentation de use-list et use-lists]

## Fichiers Sources
[Liste]
```

---

## Verifiable Acceptance Criteria

**Critical Path:**

- [ ] `docs/features/lists.md` existe avec contenu reel
- [ ] Les 3 tables sont documentees
- [ ] Le tableau de permissions est present et correct
- [ ] Les routes API sont listees

**Quality Gates:**

- [ ] Les permissions correspondent aux policies RLS de la migration 011
- [ ] Aucun placeholder

**Integration:**

- [ ] Lien valide depuis `docs/README.md`

---

## Quality Assurance

### Test Plan

#### Manual Testing

- [ ] **Permissions:** Le tableau correspond aux policies RLS
  - Expected: Owner peut tout, Member peut lire/ajouter/retirer items, Ami peut lire
  - Actual: [To be filled]

#### Automated Testing

```bash
ls docs/features/lists.md
pnpm exec grep -c '\[TODO\]\|\[TBD\]\|XXX' docs/features/lists.md && echo "FAIL" || echo "PASS"
```

### Review Checklist

- [ ] **Security:** Permissions documentees correctement
- [ ] **Documentation:** Contenu extrait du code reel

---

## Dependencies

### Upstream (Required Before Starting)

- P03 (Database) : schema des tables (consulte, pas bloquant)

### Downstream (Will Use This Phase)

- P08 (Social) : visibilite des listes entre amis

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
- [ ] Committed: `docs(lists): phase 07 complete -- listes collaboratives`

---

## Notes

### Technical Considerations

- La liste par defaut ("Ma Liste", is_default=true) est creee a l'inscription ou au premier usage
- Le trigger `trg_list_owner` utilise SECURITY DEFINER pour inserer dans list_members

### Known Limitations

- Pas de notification quand un membre ajoute un item
- Pas de limitation du nombre de membres par liste

### Future Enhancements

- Historique des modifications par liste
- Notifications de changements

---

**Previous:** [[phase-06-docs-recommendations|Phase 06: Systeme de Recommandation]]
**Next:** [[phase-08-docs-social|Phase 08: Graphe Social]]
