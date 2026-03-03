-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 011 — Multi-listes collaboratives
--
-- Permet à chaque utilisateur de créer plusieurs listes nommées avec une
-- icône emoji. Les listes peuvent être partagées avec des amis (membres),
-- tous les membres pouvant ajouter/retirer des médias sans validation.
-- ══════════════════════════════════════════════════════════════════════════════


-- ── 1. Nouvelles colonnes sur lists ───────────────────────────────────────────

ALTER TABLE lists
  ADD COLUMN IF NOT EXISTS icon       TEXT,           -- emoji libre ex: 🎬
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false NOT NULL;


-- ── 2. Table list_members ─────────────────────────────────────────────────────
-- Chaque liste a un owner (le créateur) et peut avoir plusieurs members.
-- Les members ont les mêmes droits d'écriture que l'owner sur les items.

CREATE TABLE IF NOT EXISTS list_members (
  id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id   UUID        NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  user_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role      TEXT        NOT NULL DEFAULT 'member'
            CHECK (role IN ('owner', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(list_id, user_id)
);

CREATE INDEX idx_list_members_user_id ON list_members(user_id);
CREATE INDEX idx_list_members_list_id ON list_members(list_id);

ALTER TABLE list_members ENABLE ROW LEVEL SECURITY;

-- Visible si on est membre de la liste
CREATE POLICY "list_members_select"
  ON list_members FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM list_members lm2
      WHERE lm2.list_id = list_members.list_id
        AND lm2.user_id = auth.uid()
    )
  );

-- Seul l'owner peut ajouter/retirer des membres
CREATE POLICY "list_members_insert_owner"
  ON list_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM list_members lm
      WHERE lm.list_id = list_members.list_id
        AND lm.user_id = auth.uid()
        AND lm.role = 'owner'
    )
    OR list_members.user_id = auth.uid()  -- on peut rejoindre sa propre liste
  );

CREATE POLICY "list_members_delete_owner"
  ON list_members FOR DELETE
  USING (
    auth.uid() = user_id  -- se retirer soi-même
    OR EXISTS (
      SELECT 1 FROM list_members lm
      WHERE lm.list_id = list_members.list_id
        AND lm.user_id = auth.uid()
        AND lm.role = 'owner'
    )
  );


-- ── 3. Trigger: ajout automatique du créateur comme owner ────────────────────

CREATE OR REPLACE FUNCTION add_list_owner()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO list_members (list_id, user_id, role)
  VALUES (NEW.id, NEW.user_id, 'owner')
  ON CONFLICT (list_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_list_owner ON lists;
CREATE TRIGGER trg_list_owner
  AFTER INSERT ON lists
  FOR EACH ROW EXECUTE FUNCTION add_list_owner();


-- ── 4. Migration one-shot des listes existantes ───────────────────────────────
-- Rattache toutes les listes existantes à leur user_id comme owner.
-- Et marque la "Ma Liste" par défaut comme is_default = true.

INSERT INTO list_members (list_id, user_id, role)
SELECT id, user_id, 'owner'
FROM lists
ON CONFLICT (list_id, user_id) DO NOTHING;

UPDATE lists SET is_default = true WHERE name = 'Ma Liste';


-- ── 5. Mise à jour des policies RLS sur lists ─────────────────────────────────
-- Ancienne policy: uniquement owner ou is_public
-- Nouvelle policy: tous les membres peuvent voir + is_public

DROP POLICY IF EXISTS "Les utilisateurs voient leurs listes et les listes publiques" ON lists;

CREATE POLICY "lists_select_member_or_public"
  ON lists FOR SELECT
  USING (
    is_public = TRUE
    OR EXISTS (
      SELECT 1 FROM list_members lm
      WHERE lm.list_id = lists.id
        AND lm.user_id = auth.uid()
    )
  );

-- UPDATE/DELETE: owner uniquement
DROP POLICY IF EXISTS "Les utilisateurs modifient leurs listes" ON lists;
DROP POLICY IF EXISTS "Les utilisateurs suppriment leurs listes" ON lists;

CREATE POLICY "lists_update_owner"
  ON lists FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM list_members lm
      WHERE lm.list_id = lists.id
        AND lm.user_id = auth.uid()
        AND lm.role = 'owner'
    )
  );

CREATE POLICY "lists_delete_owner"
  ON lists FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM list_members lm
      WHERE lm.list_id = lists.id
        AND lm.user_id = auth.uid()
        AND lm.role = 'owner'
    )
  );


-- ── 6. Mise à jour des policies RLS sur list_items ───────────────────────────
-- Tous les membres (owner ET member) peuvent ajouter/retirer des items.

DROP POLICY IF EXISTS "Visibilité des items selon la liste" ON list_items;
DROP POLICY IF EXISTS "Insertion dans ses propres listes" ON list_items;
DROP POLICY IF EXISTS "Suppression dans ses propres listes" ON list_items;

CREATE POLICY "list_items_select_member_or_public"
  ON list_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM lists l
      LEFT JOIN list_members lm ON lm.list_id = l.id AND lm.user_id = auth.uid()
      WHERE l.id = list_items.list_id
        AND (l.is_public = TRUE OR lm.user_id IS NOT NULL)
    )
  );

CREATE POLICY "list_items_insert_member"
  ON list_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM list_members lm
      WHERE lm.list_id = list_items.list_id
        AND lm.user_id = auth.uid()
    )
  );

CREATE POLICY "list_items_delete_member"
  ON list_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM list_members lm
      WHERE lm.list_id = list_items.list_id
        AND lm.user_id = auth.uid()
    )
  );
