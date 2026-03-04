# Base de Donnees -- Schema Complet

> Derniere mise a jour : 2026-03-04 | Fichiers sources : `supabase/migrations/001-013`

## Resume rapide

Nemo utilise PostgreSQL via Supabase avec 13 tables principales. Row Level Security (RLS) est active sur toutes les tables. Les triggers automatisent la creation de profils, la gestion des roles, les amities par invitation, et la mise a jour des timestamps. L'identite repose sur `auth.users` de Supabase Auth (UUID).

---

## Vue d'ensemble des tables

| Table | Description | RLS | Migrations |
|-------|-------------|-----|------------|
| `profiles` | Profil utilisateur central (identite, preferences, debrid, Jellyfin) | Oui | 006, 007, 008, 010, 012, 013 |
| `watch_history` | Historique de visionnage interne (progression, episodes) | Oui | 006, 012 |
| `lists` | Listes de medias (films/series) avec partage collaboratif | Oui | 006, 011, 012 |
| `list_items` | Elements d'une liste (reference TMDB) | Oui | 006, 011, 012 |
| `list_members` | Membres d'une liste collaborative (owner/member) | Oui | 011 |
| `interactions` | Likes/dislikes sur des medias | Oui | 006, 012 |
| `download_queue` | File de telechargement vers Jellyfin | Oui | 006 |
| `external_watch_history` | Historique importe (Letterboxd, Trakt, Netflix, Jellyfin) | Oui | 007, 013 |
| `invite_tokens` | Tokens d'invitation (systeme de roles) | Oui (aucune policy = bloque) | 008 |
| `invite_uses` | Journal d'utilisation des tokens | Oui (aucune policy = bloque) | 008 |
| `friendships` | Graphe social (paires d'amis ordonnees) | Oui | 012 |
| `friend_requests` | Demandes d'amitie manuelles | Oui | 012 |
| `jellyfin_servers` | Serveurs Jellyfin enregistres (dedupliques par URL) | Oui (service role only) | 006 |
| `jellyfin_server_items` | Items Jellyfin indexes par serveur | Oui (service role only) | 006 |

---

## Diagramme des Relations

```
                          auth.users
                              |
                              | id (UUID)
                              v
                         +-----------+
                         | profiles  |
                         +-----------+
                              |
         +--------+-----------+-----------+----------+----------+----------+
         |        |           |           |          |          |          |
         v        v           v           v          v          v          v
   watch_     lists     interactions  download_  external_  friend-    invite_
   history      |                     queue      watch_     ships      tokens
         +------+------+                         history       |          |
         |             |                                       |          v
    list_items   list_members                           friend_     invite_
                                                        requests    uses

   profiles ──< watch_history       (user_id)
   profiles ──< lists               (user_id)
   profiles ──< interactions        (user_id)
   profiles ──< download_queue      (user_id)
   profiles ──< external_watch_history (user_id)
   profiles ──< friendships         (user_id, friend_id)
   profiles ──< friend_requests     (from_user, to_user)
   profiles ──< invite_tokens       (created_by)
   profiles ──< invite_uses         (user_id)
   profiles ──< list_members        (user_id)
   profiles --> jellyfin_servers    (personal_jellyfin_server_id)
   lists    ──< list_items          (list_id)
   lists    ──< list_members        (list_id)
   invite_tokens ──< invite_uses    (token_id)
   jellyfin_servers ──< jellyfin_server_items (server_id)
```

---

## Tables

### profiles

Table centrale utilisateur. Un profil par compte Supabase Auth. Consolide identite, preferences de lecture, configuration debrid, Jellyfin personnel et tokens OAuth.

| Colonne | Type | Nullable | Default | Contraintes | Description |
|---------|------|----------|---------|-------------|-------------|
| `id` | UUID | NON | -- | PK, FK `auth.users(id)` ON DELETE CASCADE | Identifiant unique lie a Supabase Auth |
| `display_name` | TEXT | OUI | NULL | -- | Nom d'affichage |
| `avatar_url` | TEXT | OUI | NULL | -- | URL de l'avatar |
| `debrid_api_key` | TEXT | OUI | NULL | -- | **SENSIBLE** -- Cle API AllDebrid/RealDebrid |
| `debrid_type` | TEXT | OUI | NULL | CHECK (`'alldebrid'`, `'realdebrid'`) | Type de service debrid |
| `preferred_quality` | TEXT | NON | `'1080p'` | -- | Qualite video preferee |
| `preferred_language` | TEXT | NON | `'VF'` | -- | Langue preferee |
| `streaming_services` | JSONB | OUI | NULL | -- | IDs services streaming (null=tous, []=aucun) |
| `show_paid_options` | BOOLEAN | NON | TRUE | -- | Afficher options location/achat |
| `phone_number` | TEXT | OUI | NULL | CHECK regex E.164 `^\+[1-9]\d{6,14}$` | Numero de telephone pour notifications |
| `personal_jellyfin_url` | TEXT | OUI | NULL | -- | URL du serveur Jellyfin personnel |
| `personal_jellyfin_api_key` | TEXT | OUI | NULL | -- | **SENSIBLE** -- Cle API Jellyfin |
| `personal_jellyfin_server_id` | UUID | OUI | NULL | FK `jellyfin_servers(id)` ON DELETE SET NULL | Lien vers le serveur Jellyfin enregistre |
| `webhook_token` | TEXT | OUI | NULL | UNIQUE | Token webhook pour synchronisation |
| `last_library_sync_at` | TIMESTAMPTZ | OUI | NULL | -- | Derniere synchronisation bibliotheque |
| `onboarding_completed` | BOOLEAN | OUI | FALSE | -- | Onboarding termine |
| `role` | TEXT | NON | `'free'` | CHECK (`'free'`, `'sources'`, `'vip'`, `'admin'`) | Role utilisateur |
| `letterboxd_access_token` | TEXT | OUI | NULL | -- | **SENSIBLE** -- Token OAuth Letterboxd |
| `letterboxd_refresh_token` | TEXT | OUI | NULL | -- | **SENSIBLE** -- Refresh token Letterboxd |
| `letterboxd_username` | TEXT | OUI | NULL | -- | Nom utilisateur Letterboxd |
| `trakt_access_token` | TEXT | OUI | NULL | -- | **SENSIBLE** -- Token OAuth Trakt |
| `trakt_refresh_token` | TEXT | OUI | NULL | -- | **SENSIBLE** -- Refresh token Trakt |
| `trakt_expires_at` | TIMESTAMPTZ | OUI | NULL | -- | Expiration token Trakt |
| `trakt_username` | TEXT | OUI | NULL | -- | Nom utilisateur Trakt |
| `jellyfin_user_id` | TEXT | OUI | NULL | -- | ID utilisateur Jellyfin |
| `jellyfin_user_token` | TEXT | OUI | NULL | -- | **SENSIBLE** -- Token session Jellyfin |
| `jellyfin_display_name` | TEXT | OUI | NULL | -- | Nom affiche dans Jellyfin |
| `created_at` | TIMESTAMPTZ | NON | `NOW()` | -- | Date de creation |
| `updated_at` | TIMESTAMPTZ | NON | `NOW()` | -- | Date de derniere modification |

**Politiques RLS :**

| Policy | Operation | Condition |
|--------|-----------|-----------|
| `Lecture de son propre profil` | SELECT | `auth.uid() = id` |
| `profiles_select_public` | SELECT | `auth.uid() = id` OU `auth.role() = 'authenticated'` (infos non-sensibles filtrees cote app) |
| `Mise a jour de son propre profil` | UPDATE | USING `auth.uid() = id` / WITH CHECK `auth.uid() = id` |
| `Creation du profil a l'inscription` | INSERT | WITH CHECK `auth.uid() = id` |

**Index :**

| Index | Colonnes | Condition |
|-------|----------|-----------|
| `idx_one_admin_only` | `role` | WHERE `role = 'admin'` (UNIQUE -- un seul admin) |

**Triggers :**
- `trg_profiles_updated_at` : BEFORE UPDATE -- met a jour `updated_at` via `update_updated_at_column()`
- `trg_prevent_role_escalation` : BEFORE UPDATE -- empeche la modification du role (voir section Triggers)

---

### watch_history

Historique de visionnage interne avec progression et information d'episode.

| Colonne | Type | Nullable | Default | Contraintes | Description |
|---------|------|----------|---------|-------------|-------------|
| `id` | UUID | NON | `gen_random_uuid()` | PK | Identifiant unique |
| `user_id` | UUID | NON | -- | FK `profiles(id)` ON DELETE CASCADE | Utilisateur |
| `tmdb_id` | INTEGER | NON | -- | -- | ID TMDB du media |
| `media_type` | TEXT | NON | -- | CHECK (`'movie'`, `'tv'`) | Type de media |
| `progress` | REAL | OUI | 0 | CHECK (0 <= progress <= 100) | Progression en pourcentage |
| `duration` | INTEGER | OUI | NULL | -- | Duree en secondes |
| `season_number` | INTEGER | OUI | NULL | -- | Numero de saison |
| `episode_number` | INTEGER | OUI | NULL | -- | Numero d'episode |
| `last_watched_at` | TIMESTAMPTZ | NON | `NOW()` | -- | Derniere lecture |
| `created_at` | TIMESTAMPTZ | NON | `NOW()` | -- | Date de creation |

**Contrainte UNIQUE :** `(user_id, tmdb_id, media_type)`

**Politiques RLS :**

| Policy | Operation | Condition |
|--------|-----------|-----------|
| `Historique -- lecture` | SELECT | `auth.uid() = user_id` |
| `friends_watch_history_select` | SELECT | `auth.uid() = user_id` OU amitie existante dans `friendships` |
| `Historique -- insertion` | INSERT | WITH CHECK `auth.uid() = user_id` |
| `Historique -- mise a jour` | UPDATE | `auth.uid() = user_id` |
| `Historique -- suppression` | DELETE | `auth.uid() = user_id` |

**Index :**

| Index | Colonnes |
|-------|----------|
| `idx_watch_history_user_id` | `user_id` |
| `idx_watch_history_last_watched` | `user_id, last_watched_at DESC` |

---

### lists

Listes de medias (films/series) avec support collaboratif et partage.

| Colonne | Type | Nullable | Default | Contraintes | Description |
|---------|------|----------|---------|-------------|-------------|
| `id` | UUID | NON | `gen_random_uuid()` | PK | Identifiant unique |
| `user_id` | UUID | NON | -- | FK `profiles(id)` ON DELETE CASCADE | Createur de la liste |
| `name` | TEXT | NON | -- | -- | Nom de la liste |
| `description` | TEXT | OUI | NULL | -- | Description |
| `is_public` | BOOLEAN | NON | FALSE | -- | Visibilite publique |
| `icon` | TEXT | OUI | NULL | -- | Icone emoji |
| `is_default` | BOOLEAN | NON | FALSE | -- | Liste par defaut ("Ma Liste") |
| `created_at` | TIMESTAMPTZ | NON | `NOW()` | -- | Date de creation |
| `updated_at` | TIMESTAMPTZ | NON | `NOW()` | -- | Date de modification |

**Politiques RLS :**

| Policy | Operation | Condition |
|--------|-----------|-----------|
| `Listes -- lecture (propres + publiques)` | SELECT | `auth.uid() = user_id` OU `is_public = TRUE` |
| `lists_select_member_or_public` | SELECT | `is_public = TRUE` OU membre via `list_members` |
| `lists_select_friends` | SELECT | `is_public = TRUE` OU membre OU ami dans `friendships` |
| `Listes -- creation` | INSERT | WITH CHECK `auth.uid() = user_id` |
| `lists_update_owner` | UPDATE | Owner dans `list_members` |
| `lists_delete_owner` | DELETE | Owner dans `list_members` |

**Index :**

| Index | Colonnes |
|-------|----------|
| `idx_lists_user_id` | `user_id` |

**Triggers :**
- `trg_lists_updated_at` : BEFORE UPDATE -- met a jour `updated_at`
- `trg_list_owner` : AFTER INSERT -- ajoute le createur comme owner dans `list_members`

---

### list_items

Elements d'une liste, referencant un media TMDB.

| Colonne | Type | Nullable | Default | Contraintes | Description |
|---------|------|----------|---------|-------------|-------------|
| `id` | UUID | NON | `gen_random_uuid()` | PK | Identifiant unique |
| `list_id` | UUID | NON | -- | FK `lists(id)` ON DELETE CASCADE | Liste parente |
| `tmdb_id` | INTEGER | NON | -- | -- | ID TMDB du media |
| `media_type` | TEXT | NON | -- | CHECK (`'movie'`, `'tv'`) | Type de media |
| `sort_order` | INTEGER | OUI | 0 | -- | Ordre de tri |
| `added_at` | TIMESTAMPTZ | NON | `NOW()` | -- | Date d'ajout |

**Contrainte UNIQUE :** `(list_id, tmdb_id, media_type)`

**Politiques RLS :**

| Policy | Operation | Condition |
|--------|-----------|-----------|
| `list_items_select_member_or_public` | SELECT | Liste publique OU membre via `list_members` |
| `list_items_select_friends` | SELECT | Liste publique OU membre OU ami du proprietaire |
| `list_items_insert_member` | INSERT | Membre de la liste (owner ou member) |
| `list_items_delete_member` | DELETE | Membre de la liste (owner ou member) |

**Index :**

| Index | Colonnes |
|-------|----------|
| `idx_list_items_list_id` | `list_id` |

---

### list_members

Membres d'une liste collaborative. Chaque liste a un owner (createur) et peut avoir plusieurs members.

| Colonne | Type | Nullable | Default | Contraintes | Description |
|---------|------|----------|---------|-------------|-------------|
| `id` | UUID | NON | `gen_random_uuid()` | PK | Identifiant unique |
| `list_id` | UUID | NON | -- | FK `lists(id)` ON DELETE CASCADE | Liste |
| `user_id` | UUID | NON | -- | FK `profiles(id)` ON DELETE CASCADE | Membre |
| `role` | TEXT | NON | `'member'` | CHECK (`'owner'`, `'member'`) | Role dans la liste |
| `joined_at` | TIMESTAMPTZ | NON | `now()` | -- | Date d'adhesion |

**Contrainte UNIQUE :** `(list_id, user_id)`

**Politiques RLS :**

| Policy | Operation | Condition |
|--------|-----------|-----------|
| `list_members_select` | SELECT | `auth.uid() = user_id` OU membre de la meme liste |
| `list_members_insert_owner` | INSERT | Owner de la liste OU rejoint sa propre liste |
| `list_members_delete_owner` | DELETE | Se retirer soi-meme OU owner de la liste |

**Index :**

| Index | Colonnes |
|-------|----------|
| `idx_list_members_user_id` | `user_id` |
| `idx_list_members_list_id` | `list_id` |

---

### interactions

Likes et dislikes sur des medias (films/series).

| Colonne | Type | Nullable | Default | Contraintes | Description |
|---------|------|----------|---------|-------------|-------------|
| `id` | UUID | NON | `gen_random_uuid()` | PK | Identifiant unique |
| `user_id` | UUID | NON | -- | FK `profiles(id)` ON DELETE CASCADE | Utilisateur |
| `tmdb_id` | INTEGER | NON | -- | -- | ID TMDB du media |
| `media_type` | TEXT | NON | -- | CHECK (`'movie'`, `'tv'`) | Type de media |
| `type` | TEXT | NON | -- | CHECK (`'like'`, `'dislike'`) | Type d'interaction |
| `created_at` | TIMESTAMPTZ | NON | `NOW()` | -- | Date de creation |

**Contrainte UNIQUE :** `(user_id, tmdb_id, media_type)`

**Politiques RLS :**

| Policy | Operation | Condition |
|--------|-----------|-----------|
| `Interactions -- lecture` | SELECT | `auth.uid() = user_id` |
| `friends_interactions_select` | SELECT | `auth.uid() = user_id` OU ami dans `friendships` |
| `Interactions -- creation` | INSERT | WITH CHECK `auth.uid() = user_id` |
| `Interactions -- mise a jour` | UPDATE | `auth.uid() = user_id` |
| `Interactions -- suppression` | DELETE | `auth.uid() = user_id` |

**Index :**

| Index | Colonnes |
|-------|----------|
| `idx_interactions_user_id` | `user_id` |

---

### download_queue

File de telechargement vers un serveur Jellyfin. Les ecritures de statut (webhook Python) passent par le service role.

| Colonne | Type | Nullable | Default | Contraintes | Description |
|---------|------|----------|---------|-------------|-------------|
| `id` | UUID | NON | `gen_random_uuid()` | PK | Identifiant unique |
| `user_id` | UUID | NON | -- | FK `profiles(id)` ON DELETE CASCADE | Utilisateur |
| `user_name` | TEXT | NON | -- | -- | Nom de l'utilisateur (denormalise) |
| `media_title` | TEXT | NON | -- | -- | Titre du media |
| `media_type` | TEXT | NON | -- | CHECK (`'movie'`, `'tv'`) | Type de media |
| `tmdb_id` | INTEGER | OUI | NULL | -- | ID TMDB |
| `season_number` | INTEGER | OUI | NULL | -- | Saison |
| `episode_number` | INTEGER | OUI | NULL | -- | Episode |
| `quality` | TEXT | OUI | NULL | -- | Qualite demandee (1080p, 4K) |
| `audio_languages` | TEXT[] | OUI | `'{}'` | -- | Langues audio (fre, eng) |
| `sub_languages` | TEXT[] | OUI | `'{}'` | -- | Langues sous-titres |
| `selected_indices` | INTEGER[] | OUI | `'{}'` | -- | Indices FFmpeg selectionnes |
| `destination_path` | TEXT | NON | -- | -- | Chemin NAS destination |
| `source_urls` | JSONB | NON | -- | -- | URLs source (1 ou N) |
| `is_batch` | BOOLEAN | NON | FALSE | -- | Telechargement par lot |
| `status` | TEXT | NON | `'pending'` | CHECK (`'pending'`, `'downloading'`, `'completed'`, `'error'`) | Statut |
| `error_log` | TEXT | OUI | NULL | -- | Journal d'erreurs |
| `file_path` | TEXT | OUI | NULL | -- | Chemin fichier final |
| `created_at` | TIMESTAMPTZ | NON | `NOW()` | -- | Date de creation |
| `updated_at` | TIMESTAMPTZ | NON | `NOW()` | -- | Date de modification |

**Politiques RLS :**

| Policy | Operation | Condition |
|--------|-----------|-----------|
| `File DL -- lecture` | SELECT | `auth.uid() = user_id` |
| `File DL -- creation` | INSERT | WITH CHECK `auth.uid() = user_id` |

Note : les mises a jour de statut (webhook Python) utilisent le service role pour contourner RLS.

**Index :**

| Index | Colonnes |
|-------|----------|
| `idx_download_queue_user_id` | `user_id` |
| `idx_download_queue_status` | `status` |
| `idx_download_queue_created` | `created_at DESC` |

**Triggers :**
- `trg_download_queue_updated_at` : BEFORE UPDATE -- met a jour `updated_at`

---

### external_watch_history

Historique importe depuis des services externes (Letterboxd, Trakt, Netflix CSV, Jellyfin).

| Colonne | Type | Nullable | Default | Contraintes | Description |
|---------|------|----------|---------|-------------|-------------|
| `id` | UUID | NON | `gen_random_uuid()` | PK | Identifiant unique |
| `user_id` | UUID | NON | -- | FK `profiles(id)` ON DELETE CASCADE | Utilisateur |
| `source` | TEXT | NON | -- | -- | Source (`'letterboxd'`, `'trakt'`, `'netflix_csv'`, `'jellyfin'`) |
| `tmdb_id` | INTEGER | OUI | NULL | -- | ID TMDB (resolu via TMDB API) |
| `imdb_id` | TEXT | OUI | NULL | -- | ID IMDB |
| `media_type` | TEXT | NON | -- | -- | Type (`'movie'`, `'tv'`) |
| `title` | TEXT | NON | -- | -- | Titre du media |
| `watched_at` | TIMESTAMPTZ | OUI | NULL | -- | Date de visionnage |
| `user_rating` | NUMERIC(3,1) | OUI | NULL | -- | Note utilisateur (0.5 a 10) |
| `review` | TEXT | OUI | NULL | -- | Critique ecrite |
| `raw_data` | JSONB | OUI | NULL | -- | Donnees brutes de la source |
| `created_at` | TIMESTAMPTZ | OUI | `NOW()` | -- | Date d'import |

**Politiques RLS :**

| Policy | Operation | Condition |
|--------|-----------|-----------|
| `Users own their external history` | ALL | `auth.uid() = user_id` |

**Index :**

| Index | Colonnes | Condition |
|-------|----------|-----------|
| `ewh_imdb_unique` | `user_id, source, imdb_id` (UNIQUE) | WHERE `imdb_id IS NOT NULL` |
| `ewh_netflix_unique` | `user_id, source, title, watched_at` (UNIQUE) | WHERE `imdb_id IS NULL` |
| `ewh_user_source_idx` | `user_id, source` | -- |
| `ewh_tmdb_idx` | `tmdb_id` | WHERE `tmdb_id IS NOT NULL` |
| `ewh_jellyfin_tmdb_unique` | `user_id, source, tmdb_id` (UNIQUE) | WHERE `tmdb_id IS NOT NULL AND source = 'jellyfin'` |

---

### invite_tokens

Tokens d'invitation generes par l'admin ou les utilisateurs avec permission. Table inaccessible via JWT utilisateur (RLS active sans aucune policy = acces refuse).

| Colonne | Type | Nullable | Default | Contraintes | Description |
|---------|------|----------|---------|-------------|-------------|
| `id` | UUID | NON | `gen_random_uuid()` | PK | Identifiant unique |
| `token` | TEXT | NON | `encode(gen_random_bytes(16), 'hex')` | UNIQUE | Token hexadecimal 32 caracteres |
| `role` | TEXT | NON | `'vip'` | CHECK (`'free'`, `'sources'`, `'vip'`) | Role attribue a l'utilisation |
| `label` | TEXT | OUI | NULL | -- | Memo admin (ex: "Pour Pierre") |
| `created_by` | UUID | OUI | NULL | FK `profiles(id)` ON DELETE SET NULL | Createur (NULL = admin) |
| `max_uses` | INTEGER | NON | 1 | -- | Nombre max d'utilisations (0 = illimite) |
| `use_count` | INTEGER | NON | 0 | -- | Compteur d'utilisations |
| `expires_at` | TIMESTAMPTZ | OUI | NULL | -- | Date d'expiration (NULL = jamais) |
| `created_at` | TIMESTAMPTZ | NON | `NOW()` | -- | Date de creation |

**Politiques RLS :** Aucune policy definie. RLS active = acces refuse pour tout utilisateur authentifie. Seul le service role peut lire/ecrire.

---

### invite_uses

Journal de chaque utilisation d'un token d'invitation. Inaccessible via JWT utilisateur.

| Colonne | Type | Nullable | Default | Contraintes | Description |
|---------|------|----------|---------|-------------|-------------|
| `id` | UUID | NON | `gen_random_uuid()` | PK | Identifiant unique |
| `token_id` | UUID | NON | -- | FK `invite_tokens(id)` ON DELETE CASCADE | Token utilise |
| `user_id` | UUID | NON | -- | FK `profiles(id)` ON DELETE CASCADE | Utilisateur ayant utilise le token |
| `used_at` | TIMESTAMPTZ | NON | `NOW()` | -- | Date d'utilisation |

**Contrainte UNIQUE :** `(token_id, user_id)`

**Politiques RLS :** Aucune policy definie. RLS active = acces refuse. Seul le service role peut lire/ecrire.

**Triggers :**
- `trg_auto_friendship` : AFTER INSERT -- cree des amities automatiques (voir section Triggers)

---

### friendships

Graphe social des amities. La contrainte `CHECK (user_id < friend_id)` garantit une seule entree par paire (pas de doublons A-B et B-A).

| Colonne | Type | Nullable | Default | Contraintes | Description |
|---------|------|----------|---------|-------------|-------------|
| `id` | UUID | NON | `gen_random_uuid()` | PK | Identifiant unique |
| `user_id` | UUID | NON | -- | FK `profiles(id)` ON DELETE CASCADE | Utilisateur A (le plus petit UUID) |
| `friend_id` | UUID | NON | -- | FK `profiles(id)` ON DELETE CASCADE | Utilisateur B (le plus grand UUID) |
| `source` | TEXT | NON | `'invite'` | CHECK (`'invite'`, `'manual'`) | Origine de l'amitie |
| `created_at` | TIMESTAMPTZ | NON | `now()` | -- | Date de creation |

**Contraintes :**
- `CHECK (user_id < friend_id)` -- ordonne la paire pour eviter les doublons
- `UNIQUE (user_id, friend_id)`

**Politiques RLS :**

| Policy | Operation | Condition |
|--------|-----------|-----------|
| `friendships_select` | SELECT | `auth.uid() = user_id` OU `auth.uid() = friend_id` |
| `friendships_delete` | DELETE | `auth.uid() = user_id` OU `auth.uid() = friend_id` |

Note : pas de policy INSERT -- les insertions passent par les fonctions `SECURITY DEFINER` (`insert_friendship`, `auto_friendship_on_invite`, `friendship_on_accept`).

**Index :**

| Index | Colonnes |
|-------|----------|
| `idx_friendships_user_id` | `user_id` |
| `idx_friendships_friend_id` | `friend_id` |

---

### friend_requests

Demandes d'amitie manuelles entre utilisateurs.

| Colonne | Type | Nullable | Default | Contraintes | Description |
|---------|------|----------|---------|-------------|-------------|
| `id` | UUID | NON | `gen_random_uuid()` | PK | Identifiant unique |
| `from_user` | UUID | NON | -- | FK `profiles(id)` ON DELETE CASCADE | Demandeur |
| `to_user` | UUID | NON | -- | FK `profiles(id)` ON DELETE CASCADE | Destinataire |
| `status` | TEXT | NON | `'pending'` | CHECK (`'pending'`, `'accepted'`, `'declined'`) | Statut |
| `created_at` | TIMESTAMPTZ | NON | `now()` | -- | Date de creation |

**Contraintes :**
- `CHECK (from_user <> to_user)` -- empeche de s'envoyer une demande a soi-meme
- `UNIQUE (from_user, to_user)`

**Politiques RLS :**

| Policy | Operation | Condition |
|--------|-----------|-----------|
| `friend_requests_select` | SELECT | `auth.uid() = from_user` OU `auth.uid() = to_user` |
| `friend_requests_insert` | INSERT | WITH CHECK `auth.uid() = from_user` |
| `friend_requests_update` | UPDATE | `auth.uid() = to_user` (seul le destinataire accepte/decline) |
| `friend_requests_delete` | DELETE | `auth.uid() = from_user` OU `auth.uid() = to_user` |

**Index :**

| Index | Colonnes |
|-------|----------|
| `idx_friend_requests_to` | `to_user, status` |
| `idx_friend_requests_from` | `from_user` |

**Triggers :**
- `trg_accept_request` : AFTER UPDATE -- cree une amitie quand le statut passe de `'pending'` a `'accepted'`

---

### jellyfin_servers

Serveurs Jellyfin enregistres. Plusieurs utilisateurs Nemo peuvent pointer vers le meme serveur (items dedupliques).

| Colonne | Type | Nullable | Default | Contraintes | Description |
|---------|------|----------|---------|-------------|-------------|
| `id` | UUID | NON | `gen_random_uuid()` | PK | Identifiant unique |
| `url` | TEXT | NON | -- | UNIQUE | URL du serveur |
| `server_name` | TEXT | OUI | NULL | -- | Nom du serveur |
| `item_count` | INTEGER | OUI | 0 | -- | Nombre d'items indexes |
| `synced_at` | TIMESTAMPTZ | OUI | NULL | -- | Derniere synchronisation |
| `created_at` | TIMESTAMPTZ | NON | `NOW()` | -- | Date de creation |

**Politiques RLS :** RLS active sans policy. Ecriture et lecture via service role uniquement (API Next.js).

---

### jellyfin_server_items

Items Jellyfin indexes par serveur. Si 5 utilisateurs Nemo utilisent le meme serveur, une seule copie des items est stockee.

| Colonne | Type | Nullable | Default | Contraintes | Description |
|---------|------|----------|---------|-------------|-------------|
| `id` | UUID | NON | `gen_random_uuid()` | PK | Identifiant unique |
| `server_id` | UUID | NON | -- | FK `jellyfin_servers(id)` ON DELETE CASCADE | Serveur parent |
| `jellyfin_item_id` | TEXT | NON | -- | -- | ID item Jellyfin |
| `tmdb_id` | TEXT | NON | -- | -- | ID TMDB |
| `media_type` | TEXT | NON | -- | CHECK (`'movie'`, `'tv'`) | Type de media |
| `synced_at` | TIMESTAMPTZ | NON | `NOW()` | -- | Date de synchronisation |

**Contrainte UNIQUE :** `(server_id, jellyfin_item_id)`

**Politiques RLS :** RLS active sans policy. Ecriture et lecture via service role uniquement.

**Index :**

| Index | Colonnes |
|-------|----------|
| `idx_jellyfin_server_items_tmdb` | `server_id, tmdb_id, media_type` |

---

## Triggers et Fonctions SQL

### handle_new_user()

- **Declencheur :** `on_auth_user_created` -- AFTER INSERT ON `auth.users`
- **Action :** Cree automatiquement un profil dans `profiles` a chaque inscription
- **Donnees extraites :** `display_name` (depuis `raw_user_meta_data` : `display_name` > `full_name` > `name` > partie locale de l'email), `avatar_url`
- **Securite :** `SECURITY DEFINER` (execute avec les privileges du createur de la fonction)
- **Gestion conflit :** `ON CONFLICT (id) DO NOTHING`

### update_updated_at_column()

- **Declencheur :** Utilise par `trg_profiles_updated_at`, `trg_lists_updated_at`, `trg_download_queue_updated_at`
- **Action :** Met a jour la colonne `updated_at` a `NOW()` avant chaque UPDATE
- **Langage :** plpgsql

### prevent_role_escalation()

- **Declencheur :** `trg_prevent_role_escalation` -- BEFORE UPDATE ON `profiles`
- **Regle A :** JWT utilisateur (`auth.role() = 'authenticated'`) -- bloque silencieusement tout changement de role (reversion a l'ancienne valeur)
- **Regle B :** Service role (`auth.role() = 'service_role'`) -- empeche l'attribution du role `'admin'` (leve une exception)
- **Regle C :** Dashboard SQL (`auth.role() IS NULL`) -- seul moyen d'attribuer le role admin
- **Langage :** plpgsql

### add_list_owner()

- **Declencheur :** `trg_list_owner` -- AFTER INSERT ON `lists`
- **Action :** Ajoute automatiquement le createur de la liste comme membre avec role `'owner'` dans `list_members`
- **Securite :** `SECURITY DEFINER`
- **Gestion conflit :** `ON CONFLICT (list_id, user_id) DO NOTHING`

### insert_friendship(a UUID, b UUID, src TEXT)

- **Type :** Fonction helper (pas un trigger)
- **Action :** Insere une paire d'amis dans `friendships` en s'assurant que `user_id < friend_id` (respect de la contrainte CHECK)
- **Parametres :** `a` et `b` = les deux utilisateurs, `src` = source (`'invite'` par defaut ou `'manual'`)
- **Securite :** `SECURITY DEFINER`
- **Gestion conflit :** `ON CONFLICT DO NOTHING`
- **Protection :** Retourne immediatement si `a = b`

### auto_friendship_on_invite()

- **Declencheur :** `trg_auto_friendship` -- AFTER INSERT ON `invite_uses`
- **Action :**
  - Profondeur 1 : cree une amitie entre l'inviteur (`invite_tokens.created_by`) et le nouvel invite
  - Profondeur 2 : cree une amitie entre tous les amis existants de l'inviteur et le nouvel invite
- **Cas special :** Si `created_by` est NULL (token admin), aucune amitie n'est creee
- **Securite :** `SECURITY DEFINER`

### friendship_on_accept()

- **Declencheur :** `trg_accept_request` -- AFTER UPDATE ON `friend_requests`
- **Action :** Quand `status` passe de `'pending'` a `'accepted'`, cree une amitie via `insert_friendship()` avec source `'manual'`
- **Securite :** `SECURITY DEFINER`

---

## Hierarchie des Roles

Les roles utilisateurs suivent une hierarchie stricte :

```
free < sources < vip < admin
```

| Role | Acces |
|------|-------|
| `free` | Site, services officiels, Jellyfin personnel |
| `sources` | free + StreamFusion API / sources de streaming / M3U |
| `vip` | sources + Download API (telechargement sur Jellyfin partage) |
| `admin` | Tout. Un seul admin possible (index unique `idx_one_admin_only`) |

**Protection :**
1. Trigger `prevent_role_escalation` empecche les modifications via JWT ou service role
2. Index unique `idx_one_admin_only` limite a un seul admin en base
3. Seul le dashboard SQL (connexion directe) peut attribuer le role admin

---

## Extensions

| Extension | Description |
|-----------|-------------|
| `uuid-ossp` | Generation d'UUID (`uuid_generate_v4()`) -- note : les migrations recentes utilisent `gen_random_uuid()` natif |

---

## Historique des Migrations

| # | Fichier | Description |
|---|---------|-------------|
| 001 | `001_initial_schema.sql` | Tables de base : profiles, watch_history, lists, list_items, interactions + trigger `handle_new_user` |
| 002 | `002_jellyfin_users.sql` | Table `jellyfin_users` + migration des FK de UUID vers TEXT (Jellyfin IDs) |
| 003 | `003_streaming_preferences.sql` | Colonnes `streaming_services` et `show_paid_options` sur `jellyfin_users` |
| 004 | `004_download_queue.sql` | Table `download_queue` avec trigger `updated_at` |
| 005a | `005_personal_jellyfin.sql` | Colonnes Jellyfin personnel sur `jellyfin_users` + table `jellyfin_library` |
| 005b | `005_phone_number.sql` | Colonne `phone_number` (format E.164) sur `jellyfin_users` |
| 006 | `006_reset_to_supabase_auth.sql` | **Refonte majeure** -- retour a Supabase Auth (UUID), drop `jellyfin_users`/`jellyfin_library`, recreation de toutes les tables + `jellyfin_servers`/`jellyfin_server_items` |
| 007 | `007_onboarding.sql` | Flag `onboarding_completed`, tokens OAuth Letterboxd/Trakt, table `external_watch_history` |
| 008 | `008_roles_and_invites.sql` | Colonne `role` sur profiles, trigger anti-escalade, tables `invite_tokens`/`invite_uses` |
| 009 | `009_invite_tokens_created_by.sql` | Colonne `created_by` sur `invite_tokens` (idempotente, deja creee en 008) |
| 010 | `010_admin_role.sql` | Role admin, contrainte unicite, trigger `prevent_role_escalation` renforce |
| 011 | `011_multi_lists.sql` | Colonnes `icon`/`is_default` sur lists, table `list_members`, trigger `add_list_owner`, policies collaboratives |
| 012 | `012_friendships.sql` | Tables `friendships`/`friend_requests`, fonctions `insert_friendship`/`auto_friendship_on_invite`/`friendship_on_accept`, policies sociales |
| 013 | `013_jellyfin_user_session.sql` | Colonnes session Jellyfin sur profiles (`jellyfin_user_id`, `jellyfin_user_token`, `jellyfin_display_name`), index `ewh_jellyfin_tmdb_unique` |

---

## Fichiers Sources

```
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_jellyfin_users.sql
supabase/migrations/003_streaming_preferences.sql
supabase/migrations/004_download_queue.sql
supabase/migrations/005_personal_jellyfin.sql
supabase/migrations/005_phone_number.sql
supabase/migrations/006_reset_to_supabase_auth.sql
supabase/migrations/007_onboarding.sql
supabase/migrations/008_roles_and_invites.sql
supabase/migrations/009_invite_tokens_created_by.sql
supabase/migrations/010_admin_role.sql
supabase/migrations/011_multi_lists.sql
supabase/migrations/012_friendships.sql
supabase/migrations/013_jellyfin_user_session.sql
```
