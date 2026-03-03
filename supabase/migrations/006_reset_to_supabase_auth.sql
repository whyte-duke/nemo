-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 006 — Retour à Supabase Auth natif
--
-- Supprime l'architecture Jellyfin-as-auth (migrations 002-005) et reconstruit
-- toutes les tables proprement avec auth.users (UUID) comme source d'identité.
--
-- COMMANDE DE NETTOYAGE (à exécuter AVANT cette migration dans le dashboard Supabase)
-- pour supprimer tous les utilisateurs de test :
--
--   DELETE FROM auth.users;
--
-- Cette commande supprime en cascade toutes les données liées.
-- ══════════════════════════════════════════════════════════════════════════════


-- ── 1. Nettoyage complet ───────────────────────────────────────────────────────

DROP TABLE IF EXISTS jellyfin_library  CASCADE;
DROP TABLE IF EXISTS download_queue    CASCADE;
DROP TABLE IF EXISTS interactions      CASCADE;
DROP TABLE IF EXISTS list_items        CASCADE;
DROP TABLE IF EXISTS lists             CASCADE;
DROP TABLE IF EXISTS watch_history     CASCADE;
DROP TABLE IF EXISTS profiles          CASCADE;
DROP TABLE IF EXISTS jellyfin_users    CASCADE;

DROP TRIGGER  IF EXISTS on_auth_user_created         ON auth.users;
DROP TRIGGER  IF EXISTS trg_profiles_updated_at      ON profiles;
DROP TRIGGER  IF EXISTS trg_lists_updated_at         ON lists;
DROP TRIGGER  IF EXISTS trg_download_queue_updated_at ON download_queue;

DROP FUNCTION IF EXISTS public.handle_new_user()              CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column()     CASCADE;
DROP FUNCTION IF EXISTS public.update_download_queue_updated_at() CASCADE;


-- ── 2. Fonctions utilitaires ───────────────────────────────────────────────────

-- Trigger générique updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ── 3. profiles ────────────────────────────────────────────────────────────────
-- Table centrale utilisateur. Un profil par compte Supabase Auth.
-- Consolide tout : préférences, debrid, Jellyfin personnel.

CREATE TABLE profiles (
  id              UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identité
  display_name    TEXT,
  avatar_url      TEXT,

  -- Debrid (AllDebrid / RealDebrid)
  debrid_api_key  TEXT,
  debrid_type     TEXT        CHECK (debrid_type IN ('alldebrid', 'realdebrid')),

  -- Préférences de lecture
  preferred_quality   TEXT    DEFAULT '1080p'  NOT NULL,
  preferred_language  TEXT    DEFAULT 'VF'     NOT NULL,

  -- Abonnements streaming (null = tous, [] = aucun, sinon liste d'IDs)
  streaming_services  JSONB   DEFAULT NULL,
  show_paid_options   BOOLEAN DEFAULT TRUE     NOT NULL,

  -- Notifications
  phone_number    TEXT        CONSTRAINT phone_e164 CHECK (
    phone_number IS NULL OR phone_number ~ '^\+[1-9]\d{6,14}$'
  ),

  -- Jellyfin personnel (connexion bibliothèque)
  personal_jellyfin_url       TEXT,
  personal_jellyfin_api_key   TEXT,
  -- personal_jellyfin_server_id ajouté après la création de jellyfin_servers (ci-dessous)
  webhook_token               TEXT    UNIQUE,
  last_library_sync_at        TIMESTAMPTZ,

  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lecture de son propre profil"
  ON profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Mise à jour de son propre profil"
  ON profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "Création du profil à l'inscription"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);


-- ── 4. Trigger : création automatique du profil à l'inscription ───────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ── 5. watch_history ──────────────────────────────────────────────────────────

CREATE TABLE watch_history (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tmdb_id         INTEGER     NOT NULL,
  media_type      TEXT        NOT NULL CHECK (media_type IN ('movie', 'tv')),
  progress        REAL        DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  duration        INTEGER,
  season_number   INTEGER,
  episode_number  INTEGER,
  last_watched_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (user_id, tmdb_id, media_type)
);

CREATE INDEX idx_watch_history_user_id     ON watch_history(user_id);
CREATE INDEX idx_watch_history_last_watched ON watch_history(user_id, last_watched_at DESC);

ALTER TABLE watch_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Historique — lecture"    ON watch_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Historique — insertion"  ON watch_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Historique — mise à jour" ON watch_history FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Historique — suppression" ON watch_history FOR DELETE USING (auth.uid() = user_id);


-- ── 6. lists ──────────────────────────────────────────────────────────────────

CREATE TABLE lists (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  description     TEXT,
  is_public       BOOLEAN     DEFAULT FALSE NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_lists_user_id ON lists(user_id);

CREATE TRIGGER trg_lists_updated_at
  BEFORE UPDATE ON lists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Listes — lecture (propres + publiques)"
  ON lists FOR SELECT USING (auth.uid() = user_id OR is_public = TRUE);
CREATE POLICY "Listes — création"     ON lists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Listes — mise à jour"  ON lists FOR UPDATE  USING (auth.uid() = user_id);
CREATE POLICY "Listes — suppression"  ON lists FOR DELETE  USING (auth.uid() = user_id);


-- ── 7. list_items ─────────────────────────────────────────────────────────────

CREATE TABLE list_items (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id     UUID        NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  tmdb_id     INTEGER     NOT NULL,
  media_type  TEXT        NOT NULL CHECK (media_type IN ('movie', 'tv')),
  sort_order  INTEGER     DEFAULT 0,
  added_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (list_id, tmdb_id, media_type)
);

CREATE INDEX idx_list_items_list_id ON list_items(list_id);

ALTER TABLE list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Items — lecture (selon visibilité de la liste)"
  ON list_items FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = list_items.list_id
        AND (lists.user_id = auth.uid() OR lists.is_public = TRUE)
    )
  );
CREATE POLICY "Items — insertion (dans ses propres listes)"
  ON list_items FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM lists WHERE lists.id = list_items.list_id AND lists.user_id = auth.uid())
  );
CREATE POLICY "Items — suppression (dans ses propres listes)"
  ON list_items FOR DELETE USING (
    EXISTS (SELECT 1 FROM lists WHERE lists.id = list_items.list_id AND lists.user_id = auth.uid())
  );


-- ── 8. interactions ───────────────────────────────────────────────────────────

CREATE TABLE interactions (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tmdb_id     INTEGER     NOT NULL,
  media_type  TEXT        NOT NULL CHECK (media_type IN ('movie', 'tv')),
  type        TEXT        NOT NULL CHECK (type IN ('like', 'dislike')),
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (user_id, tmdb_id, media_type)
);

CREATE INDEX idx_interactions_user_id ON interactions(user_id);

ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Interactions — lecture"     ON interactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Interactions — création"    ON interactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Interactions — mise à jour" ON interactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Interactions — suppression" ON interactions FOR DELETE USING (auth.uid() = user_id);


-- ── 9. download_queue ─────────────────────────────────────────────────────────
-- RLS en lecture seule pour l'utilisateur.
-- Les écritures se font via le service role (API Next.js + webhook Python backend).

CREATE TABLE download_queue (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_name         TEXT        NOT NULL,

  media_title       TEXT        NOT NULL,
  media_type        TEXT        NOT NULL CHECK (media_type IN ('movie', 'tv')),
  tmdb_id           INTEGER,
  season_number     INTEGER,
  episode_number    INTEGER,

  quality           TEXT,
  audio_languages   TEXT[]      DEFAULT '{}',
  sub_languages     TEXT[]      DEFAULT '{}',
  selected_indices  INTEGER[]   DEFAULT '{}',

  destination_path  TEXT        NOT NULL,
  source_urls       JSONB       NOT NULL,
  is_batch          BOOLEAN     DEFAULT FALSE NOT NULL,

  status            TEXT        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'downloading', 'completed', 'error')),
  error_log         TEXT,
  file_path         TEXT,

  created_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_download_queue_user_id ON download_queue(user_id);
CREATE INDEX idx_download_queue_status  ON download_queue(status);
CREATE INDEX idx_download_queue_created ON download_queue(created_at DESC);

CREATE TRIGGER trg_download_queue_updated_at
  BEFORE UPDATE ON download_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE download_queue ENABLE ROW LEVEL SECURITY;

-- L'utilisateur peut voir et créer ses propres entrées.
-- Les mises à jour de statut (webhook Python) passent par le service role.
CREATE POLICY "File DL — lecture"   ON download_queue FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "File DL — création"  ON download_queue FOR INSERT WITH CHECK (auth.uid() = user_id);


-- ── 10. jellyfin_servers ──────────────────────────────────────────────────────
-- Un serveur Jellyfin = une URL unique.
-- Plusieurs utilisateurs Nemo peuvent pointer vers le même serveur → items dédupliqués.

CREATE TABLE jellyfin_servers (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  url          TEXT        NOT NULL UNIQUE,
  server_name  TEXT,
  item_count   INTEGER     DEFAULT 0,
  synced_at    TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- RLS : écriture via service role uniquement (API Next.js)
ALTER TABLE jellyfin_servers ENABLE ROW LEVEL SECURITY;


-- ── 11. jellyfin_server_items ─────────────────────────────────────────────────
-- Items Jellyfin indexés par serveur (dédupliqués).
-- Si 5 utilisateurs Nemo utilisent le même serveur → 1 seule copie des items.

CREATE TABLE jellyfin_server_items (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  server_id         UUID        NOT NULL REFERENCES jellyfin_servers(id) ON DELETE CASCADE,
  jellyfin_item_id  TEXT        NOT NULL,
  tmdb_id           TEXT        NOT NULL,
  media_type        TEXT        NOT NULL CHECK (media_type IN ('movie', 'tv')),
  synced_at         TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT jellyfin_server_items_unique UNIQUE (server_id, jellyfin_item_id)
);

-- Index pour les lookups de badges (server_id + tmdb_id + media_type)
CREATE INDEX idx_jellyfin_server_items_tmdb
  ON jellyfin_server_items(server_id, tmdb_id, media_type);

-- RLS : écriture via service role uniquement
ALTER TABLE jellyfin_server_items ENABLE ROW LEVEL SECURITY;


-- ── 12. Liaison profiles → jellyfin_servers ───────────────────────────────────
-- Ajout de la FK après création des deux tables.

ALTER TABLE profiles
  ADD COLUMN personal_jellyfin_server_id UUID
  REFERENCES jellyfin_servers(id) ON DELETE SET NULL;
