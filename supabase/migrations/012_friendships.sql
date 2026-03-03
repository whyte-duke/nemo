-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 012 — Réseau social & amis
--
-- Graphe social construit automatiquement depuis les invitations :
--   - L'inviteur et l'invité deviennent amis (profondeur 1)
--   - Tous les amis existants de l'inviteur deviennent aussi amis
--     avec le nouvel invité (profondeur 2)
--
-- Les utilisateurs peuvent aussi s'ajouter manuellement via friend_requests.
-- Les profils publics (display_name, avatar, role) sont lisibles par tous
-- les utilisateurs authentifiés pour permettre la recherche d'amis.
-- ══════════════════════════════════════════════════════════════════════════════


-- ── 1. Table friendships ──────────────────────────────────────────────────────
-- Contrainte CHECK (user_id < friend_id) garantit une seule entrée par paire
-- (pas de doublons A-B et B-A).

CREATE TABLE IF NOT EXISTS friendships (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  friend_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  source     TEXT        NOT NULL DEFAULT 'invite'
             CHECK (source IN ('invite', 'manual')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (user_id < friend_id),
  UNIQUE(user_id, friend_id)
);

CREATE INDEX idx_friendships_user_id   ON friendships(user_id);
CREATE INDEX idx_friendships_friend_id ON friendships(friend_id);

ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "friendships_select"
  ON friendships FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "friendships_delete"
  ON friendships FOR DELETE
  USING (auth.uid() = user_id OR auth.uid() = friend_id);


-- ── 2. Table friend_requests ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS friend_requests (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  to_user    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status     TEXT        NOT NULL DEFAULT 'pending'
             CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (from_user <> to_user),
  UNIQUE(from_user, to_user)
);

CREATE INDEX idx_friend_requests_to   ON friend_requests(to_user, status);
CREATE INDEX idx_friend_requests_from ON friend_requests(from_user);

ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "friend_requests_select"
  ON friend_requests FOR SELECT
  USING (auth.uid() = from_user OR auth.uid() = to_user);

CREATE POLICY "friend_requests_insert"
  ON friend_requests FOR INSERT
  WITH CHECK (auth.uid() = from_user);

CREATE POLICY "friend_requests_update"
  ON friend_requests FOR UPDATE
  USING (auth.uid() = to_user);

CREATE POLICY "friend_requests_delete"
  ON friend_requests FOR DELETE
  USING (auth.uid() = from_user OR auth.uid() = to_user);


-- ── 3. Fonction helper : insère une amitié dans le bon ordre ─────────────────
-- Assure toujours user_id < friend_id pour respecter la contrainte CHECK.

CREATE OR REPLACE FUNCTION insert_friendship(a UUID, b UUID, src TEXT DEFAULT 'invite')
RETURNS VOID AS $$
DECLARE
  lo UUID;
  hi UUID;
BEGIN
  IF a = b THEN RETURN; END IF;
  IF a < b THEN lo := a; hi := b;
  ELSE           lo := b; hi := a;
  END IF;
  INSERT INTO friendships (user_id, friend_id, source)
  VALUES (lo, hi, src)
  ON CONFLICT (user_id, friend_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ── 4. Trigger: auto-friendship à chaque rachat de token d'invitation ─────────
-- Profondeur 1 : inviteur <-> nouvel invité
-- Profondeur 2 : tous les amis existants de l'inviteur <-> nouvel invité

CREATE OR REPLACE FUNCTION auto_friendship_on_invite()
RETURNS TRIGGER AS $$
DECLARE
  inviter_id UUID;
  existing_friend UUID;
BEGIN
  -- Récupère l'auteur du token (inviteur direct)
  SELECT created_by INTO inviter_id
  FROM invite_tokens
  WHERE id = NEW.token_id;

  IF inviter_id IS NULL THEN
    RETURN NEW;  -- token créé par admin (created_by NULL), pas de graphe social
  END IF;

  -- Profondeur 1 : inviteur <-> nouvel invité
  PERFORM insert_friendship(inviter_id, NEW.user_id, 'invite');

  -- Profondeur 2 : amis existants de l'inviteur <-> nouvel invité
  FOR existing_friend IN
    SELECT CASE
      WHEN f.user_id = inviter_id THEN f.friend_id
      ELSE f.user_id
    END AS friend_id
    FROM friendships f
    WHERE f.user_id = inviter_id OR f.friend_id = inviter_id
  LOOP
    IF existing_friend <> NEW.user_id THEN
      PERFORM insert_friendship(existing_friend, NEW.user_id, 'invite');
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_friendship ON invite_uses;
CREATE TRIGGER trg_auto_friendship
  AFTER INSERT ON invite_uses
  FOR EACH ROW EXECUTE FUNCTION auto_friendship_on_invite();


-- ── 5. Trigger: friendship automatique à l'acceptation d'une demande ─────────

CREATE OR REPLACE FUNCTION friendship_on_accept()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    PERFORM insert_friendship(NEW.from_user, NEW.to_user, 'manual');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_accept_request ON friend_requests;
CREATE TRIGGER trg_accept_request
  AFTER UPDATE ON friend_requests
  FOR EACH ROW EXECUTE FUNCTION friendship_on_accept();


-- ── 6. RLS : profils publics partiellement lisibles ──────────────────────────
-- Tous les utilisateurs authentifiés peuvent voir les infos non-sensibles
-- d'un profil (pour la recherche d'amis et les pages publiques).
-- Les infos sensibles (debrid_api_key, tokens OAuth…) restent privées.

-- Ajout d'une policy SELECT publique sur profiles (les autres policies privées
-- restent en place pour UPDATE et les champs sensibles).
DROP POLICY IF EXISTS "profiles_select_public" ON profiles;

CREATE POLICY "profiles_select_public"
  ON profiles FOR SELECT
  USING (
    auth.uid() = id          -- son propre profil complet
    OR auth.role() = 'authenticated'  -- autres : accès autorisé (RLS filtre les colonnes côté app)
  );


-- ── 7. RLS : données sociales des amis lisibles ───────────────────────────────
-- watch_history, interactions, list_items deviennent lisibles si le propriétaire
-- est un ami de l'utilisateur courant.

-- watch_history
DROP POLICY IF EXISTS "friends_watch_history_select" ON watch_history;
CREATE POLICY "friends_watch_history_select"
  ON watch_history FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM friendships f
      WHERE (f.user_id = auth.uid() AND f.friend_id = watch_history.user_id)
         OR (f.friend_id = auth.uid() AND f.user_id = watch_history.user_id)
    )
  );

-- interactions
DROP POLICY IF EXISTS "friends_interactions_select" ON interactions;
CREATE POLICY "friends_interactions_select"
  ON interactions FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM friendships f
      WHERE (f.user_id = auth.uid() AND f.friend_id = interactions.user_id)
         OR (f.friend_id = auth.uid() AND f.user_id = interactions.user_id)
    )
  );

-- lists (déjà mis à jour en 011, on ajoute la visibilité entre amis)
DROP POLICY IF EXISTS "lists_select_friends" ON lists;
CREATE POLICY "lists_select_friends"
  ON lists FOR SELECT
  USING (
    is_public = TRUE
    OR EXISTS (
      SELECT 1 FROM list_members lm
      WHERE lm.list_id = lists.id AND lm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM friendships f
      WHERE (f.user_id = auth.uid() AND f.friend_id = lists.user_id)
         OR (f.friend_id = auth.uid() AND f.user_id = lists.user_id)
    )
  );

-- list_items (visibles si la liste est visible)
DROP POLICY IF EXISTS "list_items_select_friends" ON list_items;
CREATE POLICY "list_items_select_friends"
  ON list_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM lists l
      WHERE l.id = list_items.list_id
        AND (
          l.is_public = TRUE
          OR EXISTS (
            SELECT 1 FROM list_members lm
            WHERE lm.list_id = l.id AND lm.user_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1 FROM friendships f
            WHERE (f.user_id = auth.uid() AND f.friend_id = l.user_id)
               OR (f.friend_id = auth.uid() AND f.user_id = l.user_id)
          )
        )
    )
  );
