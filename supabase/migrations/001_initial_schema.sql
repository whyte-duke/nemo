-- ─── Extensions ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Profiles ─────────────────────────────────────────────────────────────────
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE,
  avatar_url TEXT,
  debrid_api_key TEXT,
  debrid_type TEXT CHECK (debrid_type IN ('alldebrid', 'realdebrid')),
  preferred_quality TEXT DEFAULT '1080p',
  preferred_language TEXT DEFAULT 'VF',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Les utilisateurs voient leur propre profil"
  ON profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Les utilisateurs mettent à jour leur propre profil"
  ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Insertion du profil à la création du compte"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- ─── Watch History ────────────────────────────────────────────────────────────
CREATE TABLE watch_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  tmdb_id INTEGER NOT NULL,
  media_type TEXT CHECK (media_type IN ('movie', 'tv')) NOT NULL,
  progress REAL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  duration INTEGER,
  season_number INTEGER,
  episode_number INTEGER,
  last_watched_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (user_id, tmdb_id, media_type)
);

CREATE INDEX idx_watch_history_user_id ON watch_history(user_id);
CREATE INDEX idx_watch_history_last_watched ON watch_history(user_id, last_watched_at DESC);

ALTER TABLE watch_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Les utilisateurs voient leur historique"
  ON watch_history FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Les utilisateurs insèrent dans leur historique"
  ON watch_history FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Les utilisateurs mettent à jour leur historique"
  ON watch_history FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Les utilisateurs suppriment leur historique"
  ON watch_history FOR DELETE USING (auth.uid() = user_id);

-- ─── Lists ────────────────────────────────────────────────────────────────────
CREATE TABLE lists (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_lists_user_id ON lists(user_id);

ALTER TABLE lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Les utilisateurs voient leurs listes et les listes publiques"
  ON lists FOR SELECT USING (auth.uid() = user_id OR is_public = TRUE);

CREATE POLICY "Les utilisateurs créent leurs listes"
  ON lists FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Les utilisateurs modifient leurs listes"
  ON lists FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Les utilisateurs suppriment leurs listes"
  ON lists FOR DELETE USING (auth.uid() = user_id);

-- ─── List Items ───────────────────────────────────────────────────────────────
CREATE TABLE list_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  list_id UUID REFERENCES lists(id) ON DELETE CASCADE NOT NULL,
  tmdb_id INTEGER NOT NULL,
  media_type TEXT CHECK (media_type IN ('movie', 'tv')) NOT NULL,
  sort_order INTEGER DEFAULT 0,
  added_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (list_id, tmdb_id, media_type)
);

CREATE INDEX idx_list_items_list_id ON list_items(list_id);

ALTER TABLE list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Visibilité des items selon la liste"
  ON list_items FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = list_items.list_id
      AND (lists.user_id = auth.uid() OR lists.is_public = TRUE)
    )
  );

CREATE POLICY "Insertion dans ses propres listes"
  ON list_items FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = list_items.list_id
      AND lists.user_id = auth.uid()
    )
  );

CREATE POLICY "Suppression dans ses propres listes"
  ON list_items FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = list_items.list_id
      AND lists.user_id = auth.uid()
    )
  );

-- ─── Interactions (like/dislike) ──────────────────────────────────────────────
CREATE TABLE interactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  tmdb_id INTEGER NOT NULL,
  media_type TEXT CHECK (media_type IN ('movie', 'tv')) NOT NULL,
  type TEXT CHECK (type IN ('like', 'dislike')) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (user_id, tmdb_id, media_type)
);

CREATE INDEX idx_interactions_user_id ON interactions(user_id);

ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Les utilisateurs voient leurs interactions"
  ON interactions FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Les utilisateurs créent leurs interactions"
  ON interactions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Les utilisateurs mettent à jour leurs interactions"
  ON interactions FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Les utilisateurs suppriment leurs interactions"
  ON interactions FOR DELETE USING (auth.uid() = user_id);

-- ─── Trigger: création du profil automatique à l'inscription ─────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
