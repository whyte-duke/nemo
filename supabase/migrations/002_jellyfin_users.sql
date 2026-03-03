-- ─── Utilisateurs Jellyfin (identifiés par leur ID Jellyfin) ───────────────────
CREATE TABLE IF NOT EXISTS jellyfin_users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  debrid_api_key TEXT,
  debrid_type TEXT CHECK (debrid_type IN ('alldebrid', 'realdebrid')),
  preferred_quality TEXT DEFAULT '1080p',
  preferred_language TEXT DEFAULT 'VF',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ─── Supprimer les politiques RLS qui dépendent de user_id (avant ALTER COLUMN) ─
DROP POLICY IF EXISTS "Les utilisateurs voient leur historique" ON watch_history;
DROP POLICY IF EXISTS "Les utilisateurs insèrent dans leur historique" ON watch_history;
DROP POLICY IF EXISTS "Les utilisateurs mettent à jour leur historique" ON watch_history;
DROP POLICY IF EXISTS "Les utilisateurs suppriment leur historique" ON watch_history;

DROP POLICY IF EXISTS "Les utilisateurs voient leurs listes et les listes publiques" ON lists;
DROP POLICY IF EXISTS "Les utilisateurs créent leurs listes" ON lists;
DROP POLICY IF EXISTS "Les utilisateurs modifient leurs listes" ON lists;
DROP POLICY IF EXISTS "Les utilisateurs suppriment leurs listes" ON lists;

DROP POLICY IF EXISTS "Visibilité des items selon la liste" ON list_items;
DROP POLICY IF EXISTS "Insertion dans ses propres listes" ON list_items;
DROP POLICY IF EXISTS "Suppression dans ses propres listes" ON list_items;

DROP POLICY IF EXISTS "Les utilisateurs voient leurs interactions" ON interactions;
DROP POLICY IF EXISTS "Les utilisateurs créent leurs interactions" ON interactions;
DROP POLICY IF EXISTS "Les utilisateurs mettent à jour leurs interactions" ON interactions;
DROP POLICY IF EXISTS "Les utilisateurs suppriment leurs interactions" ON interactions;

-- ─── Passage des tables utilisateur à jellyfin_users (user_id = id Jellyfin) ─
-- On vide les données existantes (auth Supabase) pour repartir sur Jellyfin.

TRUNCATE list_items CASCADE;
TRUNCATE watch_history CASCADE;
TRUNCATE interactions CASCADE;
TRUNCATE lists CASCADE;

ALTER TABLE watch_history
  DROP CONSTRAINT IF EXISTS watch_history_user_id_fkey;

ALTER TABLE lists
  DROP CONSTRAINT IF EXISTS lists_user_id_fkey;

ALTER TABLE interactions
  DROP CONSTRAINT IF EXISTS interactions_user_id_fkey;

ALTER TABLE watch_history
  ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

ALTER TABLE lists
  ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

ALTER TABLE interactions
  ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

ALTER TABLE watch_history
  ADD CONSTRAINT watch_history_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES jellyfin_users(id) ON DELETE CASCADE;

ALTER TABLE lists
  ADD CONSTRAINT lists_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES jellyfin_users(id) ON DELETE CASCADE;

ALTER TABLE interactions
  ADD CONSTRAINT interactions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES jellyfin_users(id) ON DELETE CASCADE;

-- RLS : désactivé sur ces tables car l'accès se fait via l'API Next.js (service role)
-- qui filtre par jellyfin_user_id issu du cookie de session.
ALTER TABLE jellyfin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only (accès via API Next.js)"
  ON jellyfin_users FOR ALL
  USING (false);
