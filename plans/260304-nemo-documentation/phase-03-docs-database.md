---
title: "Phase 03 - Schema Base de Donnees"
description: "Documenter le schema complet de la base de donnees PostgreSQL : tables, colonnes, types, RLS, triggers et migrations"
skill: postgres-expert
status: pending
group: "database"
dependencies: []
tags: [documentation, database, schema, rls, migrations]
created: 2026-03-04
updated: 2026-03-04
---

# Phase 03: Schema Base de Donnees

**Context:** [[plan|Master Plan]] | **Dependencies:** None | **Status:** Pending

---

## Overview

Generer `docs/architecture/database.md` documentant le schema complet de la base de donnees PostgreSQL de Nemo : les 13+ tables, leurs colonnes avec types, les politiques RLS, les triggers, les fonctions SQL, et l'evolution des migrations (001-013).

**Goal:** Un agent IA peut comprendre toute la structure de la base de donnees et les regles d'acces sans lire les fichiers SQL.

---

## Context & Workflow

### How This Phase Fits Into the Project

- **UI Layer:** Aucun changement
- **Server Layer:** Aucun changement -- documente ce qui existe
- **Database Layer:** Documentation complete des tables, colonnes, RLS, triggers
- **Integrations:** Aucun changement

### User Workflow

**Trigger:** Un agent IA doit ajouter une table, modifier un schema, ou comprendre les regles d'acces.

**Steps:**
1. L'agent lit `docs/architecture/database.md`
2. Il trouve la table concernee avec toutes ses colonnes et types
3. Il comprend les politiques RLS et qui peut acceder a quoi
4. Il identifie les triggers et fonctions SQL existants
5. Il peut ecrire une migration coherente avec le schema existant

**Success Outcome:** L'agent ecrit une migration SQL correcte sans lire les 13 fichiers de migration.

### Problem Being Solved

**Pain Point:** 13 fichiers de migration SQL a lire pour comprendre l'etat actuel du schema.
**Alternative Approach:** Lire chaque migration sequentiellement et reconstituer l'etat final -- long et error-prone.

### Integration Points

**Upstream Dependencies:** Aucune

**Downstream Consumers:**
- P07 (Lists) : reference les tables `lists`, `list_items`, `list_members`
- P08 (Social) : reference `friendships`, `friend_requests`
- P16 (Supabase) : reference les patterns RLS

**Data Flow:**
```
Migrations SQL (001-013) ──> PostgreSQL Schema ──> RLS Policies ──> Supabase Client Queries
```

---

## Prerequisites & Clarifications

### Questions for User

1. **Etat cumule vs historique:** Documente-t-on l'etat final du schema ou aussi l'historique des changements ?
   - **Context:** L'etat final est le plus utile pour un agent IA. L'historique aide a comprendre les decisions.
   - **Assumptions if unanswered:** Etat final avec un resume de l'evolution par table.
   - **Impact:** Determine la taille du document.

2. **Donnees sensibles:** Documente-t-on les colonnes contenant des cles API (ex: `debrid_api_key`) ?
   - **Context:** Ces colonnes existent dans le schema mais contiennent des secrets utilisateur.
   - **Assumptions if unanswered:** On documente leur existence et type mais on note qu'elles sont sensibles.
   - **Impact:** Securite de la documentation.

3. **Diagramme ER:** Genere-t-on un diagramme entite-relation en ASCII ?
   - **Context:** Les relations entre tables (FK) sont critiques pour comprendre le schema.
   - **Assumptions if unanswered:** Oui, diagramme ASCII des relations principales.
   - **Impact:** Comprehension visuelle des relations.

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

- Toutes les tables documentees avec colonnes, types, contraintes, valeurs par defaut
- Toutes les politiques RLS documentees : nom, operation (SELECT/INSERT/UPDATE/DELETE), condition
- Tous les triggers documentes avec leur fonction associee
- Toutes les fonctions SQL documentees (ex: `handle_new_user`, `insert_friendship`, `auto_friendship_on_invite`)
- Index documentes par table
- Diagramme des relations entre tables (foreign keys)
- Resume de chaque migration (001-013) en une ligne

### Technical

- Contenu extrait des 13+ fichiers SQL de migration
- Schema represente l'etat cumule (resultat de toutes les migrations appliquees)
- Taille cible : 8-12 KB (le plus gros fichier de documentation)

---

## Decision Log

### Etat cumule comme format principal (ADR-P03-01)

**Date:** 2026-03-04
**Status:** Accepted

**Context:** Les migrations sont incrementales. L'agent IA a besoin de l'etat final pour ecrire du code. Mais l'historique aide a comprendre les decisions de design.

**Decision:** Format principal = etat cumule par table. Section secondaire = resume de chaque migration.

**Consequences:**
- **Positive:** L'agent trouve immediatement l'etat actuel d'une table
- **Negative:** Plus long a generer (doit reconstituer l'etat cumule)
- **Neutral:** Compatible avec des mises a jour incrementales

---

## Implementation Steps

### Step 0: Test Definition (TDD)

#### 0.1: Verification de structure

- [ ] Le fichier `docs/architecture/database.md` existe
- [ ] Il contient une section par table (13+ tables)
- [ ] Chaque table a : colonnes, types, RLS, index
- [ ] Aucun placeholder

#### 0.2: Verification de contenu

- [ ] Les tables documentees incluent au minimum : `profiles`, `watch_history`, `interactions`, `lists`, `list_items`, `list_members`, `friendships`, `friend_requests`, `invite_tokens`, `invite_uses`, `jellyfin_users`, `download_queue`
- [ ] Les colonnes de `profiles` incluent : id, username, avatar_url, debrid_api_key, debrid_type, preferred_quality, preferred_language, role, onboarding_completed, created_at, updated_at
- [ ] Le trigger `handle_new_user` est documente
- [ ] La contrainte `CHECK (user_id < friend_id)` de `friendships` est documentee

---

### Step 1: Lire toutes les migrations SQL

#### 1.1: Fichiers a lire (dans l'ordre)

- [ ] `supabase/migrations/001_initial_schema.sql` -- profiles, watch_history, lists, list_items, interactions, trigger handle_new_user
- [ ] `supabase/migrations/002_jellyfin_users.sql` -- table jellyfin_users
- [ ] `supabase/migrations/003_streaming_preferences.sql` -- modifications sur profiles
- [ ] `supabase/migrations/004_download_queue.sql` -- table download_queue
- [ ] `supabase/migrations/005_personal_jellyfin.sql` -- colonnes jellyfin sur profiles
- [ ] `supabase/migrations/005_phone_number.sql` -- colonne phone sur profiles
- [ ] `supabase/migrations/006_reset_to_supabase_auth.sql` -- refactoring auth
- [ ] `supabase/migrations/007_onboarding.sql` -- colonne onboarding_completed
- [ ] `supabase/migrations/008_roles_and_invites.sql` -- tables invite_tokens, invite_uses, colonne role
- [ ] `supabase/migrations/009_invite_tokens_created_by.sql` -- colonne created_by sur invite_tokens
- [ ] `supabase/migrations/010_admin_role.sql` -- role admin
- [ ] `supabase/migrations/011_multi_lists.sql` -- table list_members, colonnes icon/is_default sur lists, RLS mise a jour
- [ ] `supabase/migrations/012_friendships.sql` -- tables friendships, friend_requests, fonctions SQL, triggers, RLS social
- [ ] `supabase/migrations/013_jellyfin_user_session.sql` -- session Jellyfin

#### 1.2: Pour chaque migration, extraire

- [ ] Tables creees (CREATE TABLE)
- [ ] Colonnes ajoutees (ALTER TABLE ADD COLUMN)
- [ ] Policies RLS (CREATE POLICY)
- [ ] Triggers (CREATE TRIGGER)
- [ ] Fonctions SQL (CREATE FUNCTION)
- [ ] Index (CREATE INDEX)
- [ ] Contraintes (CHECK, UNIQUE, REFERENCES)

---

### Step 2: Reconstituer l'etat cumule

#### 2.1: Par table, compiler l'etat final

- [ ] Fusionner toutes les colonnes ajoutees au fil des migrations
- [ ] Lister les policies RLS actives (certaines sont DROP + re-CREATE)
- [ ] Lister les index actifs
- [ ] Lister les contraintes actives

---

### Step 3: Rediger la documentation

#### 3.1: Structure du fichier genere

```markdown
# Base de Donnees -- Schema Complet

> Derniere mise a jour : 2026-03-04 | Fichiers sources : supabase/migrations/001-013

## Resume rapide

[2-3 lignes : 13+ tables PostgreSQL, RLS sur toutes les tables, triggers automatiques]

## Diagramme des Relations

profiles ──< watch_history (user_id)
profiles ──< interactions (user_id)
profiles ──< lists (user_id)
lists    ──< list_items (list_id)
lists    ──< list_members (list_id)
profiles ──< list_members (user_id)
profiles ──< friendships (user_id, friend_id)
profiles ──< friend_requests (from_user, to_user)
profiles ──< invite_tokens (created_by)
profiles ──< invite_uses (user_id)
invite_tokens ──< invite_uses (token_id)
profiles ──< jellyfin_users (user_id)
profiles ──< download_queue (user_id)

## Tables

### profiles
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK, FK auth.users | Identifiant unique lie a Supabase Auth |
| username | TEXT | UNIQUE | Nom d'affichage |
| ... | ... | ... | ... |

**RLS:**
| Policy | Operation | Condition |
|--------|-----------|-----------|
| "Les utilisateurs voient leur propre profil" | SELECT | auth.uid() = id |
| ... | ... | ... |

**Index:** ...

[Repeter pour chaque table]

## Triggers et Fonctions

### handle_new_user()
- **Declencheur:** AFTER INSERT ON auth.users
- **Action:** Cree un profil dans profiles avec username et avatar
- **Security:** SECURITY DEFINER

### insert_friendship(a, b, src)
- **Action:** Insere dans friendships en ordonnant user_id < friend_id
- ...

## Historique des Migrations

| # | Fichier | Description |
|---|---------|-------------|
| 001 | initial_schema.sql | Tables de base : profiles, watch_history, lists, list_items, interactions |
| 002 | jellyfin_users.sql | Table jellyfin_users |
| ... | ... | ... |

## Fichiers Sources
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_jellyfin_users.sql
[... tous les fichiers lus]
```

#### 3.2: Redaction

- [ ] Documenter chaque table avec toutes ses colonnes et types
- [ ] Documenter chaque politique RLS active
- [ ] Documenter chaque trigger et fonction SQL
- [ ] Creer le diagramme de relations en ASCII
- [ ] Creer le resume des migrations

---

## Verifiable Acceptance Criteria

**Critical Path:**

- [ ] `docs/architecture/database.md` existe avec contenu reel
- [ ] Les 13+ tables sont toutes documentees
- [ ] Les politiques RLS sont listees par table
- [ ] Les triggers et fonctions SQL sont documentes

**Quality Gates:**

- [ ] Les colonnes de chaque table correspondent exactement aux migrations
- [ ] Les noms de policies correspondent exactement au SQL
- [ ] Le diagramme de relations est present et correct

**Integration:**

- [ ] Lien valide depuis `docs/README.md`
- [ ] Coherent avec les details de P07 (Lists) et P08 (Social)

---

## Quality Assurance

### Test Plan

#### Manual Testing

- [ ] **Completude:** Chaque table du schema est documentee
  - Expected: 13+ tables presentes
  - Actual: [To be filled during testing]

- [ ] **Exactitude:** Les colonnes de `profiles` matchent le SQL
  - Expected: id, username, avatar_url, debrid_api_key, debrid_type, preferred_quality, preferred_language, role, onboarding_completed, phone, jellyfin_*, created_at, updated_at
  - Actual: [To be filled during testing]

#### Automated Testing

```bash
ls docs/architecture/database.md
pnpm exec grep -c '\[TODO\]\|\[TBD\]\|XXX' docs/architecture/database.md && echo "FAIL" || echo "PASS"
```

#### Performance Testing

- [ ] **Taille du fichier:** Target: 8-12 KB, Actual: [To be measured]

### Review Checklist

- [ ] **Code Quality:** Markdown valide
- [ ] **Security:** Colonnes sensibles marquees comme telles
- [ ] **Documentation:** Contenu extrait des migrations reelles

---

## Dependencies

### Upstream (Required Before Starting)

- Aucune

### Downstream (Will Use This Phase)

- P07 (Lists) : utilise la documentation des tables lists, list_items, list_members
- P08 (Social) : utilise la documentation de friendships, friend_requests
- P16 (Supabase) : reference les helpers RLS

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
- [ ] Committed: `docs(database): phase 03 complete -- schema complet`

---

## Notes

### Technical Considerations

- Deux fichiers portent le numero 005 (`005_personal_jellyfin.sql` et `005_phone_number.sql`). Les deux doivent etre lus.
- Certaines policies sont DROP + re-CREATE dans des migrations ulterieures. L'etat final est le seul pertinent.
- Les tables `user_taste_profiles`, `media_features`, `recommendation_cache` ne semblent pas avoir de migration explicite dans les fichiers listes. Verifier si elles sont creees via une autre methode.

### Known Limitations

- Le schema documente est celui des migrations. Si des modifications manuelles ont ete faites directement en DB, elles ne seront pas documentees.

### Future Enhancements

- Schema interactif avec Mermaid ER diagram
- Documentation des performances des index

---

**Previous:** [[phase-02-docs-architecture-overview|Phase 02: Architecture Generale]]
**Next:** [[phase-04-docs-api-routes|Phase 04: Routes API]]
