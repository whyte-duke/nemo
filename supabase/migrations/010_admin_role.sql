-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 010 — Rôle admin
--
-- Hiérarchie complète : free < sources < vip < admin
--
-- Sécurité en couches :
--   1. Trigger : JWT authentifié → ne peut JAMAIS changer son rôle
--   2. Trigger : service_role   → ne peut PAS attribuer le rôle 'admin'
--   3. Index unique             → UN SEUL utilisateur peut avoir le rôle 'admin'
--   4. Seul le dashboard SQL (connexion directe, auth.role() = NULL)
--      peut définir 'admin' → toi uniquement, manuellement.
--
-- Pour te passer admin, exécuter dans le dashboard Supabase → SQL Editor :
--   UPDATE profiles SET role = 'admin' WHERE id = 'TON_USER_ID';
-- ══════════════════════════════════════════════════════════════════════════════


-- ── 1. Mettre à jour le CHECK sur profiles.role ───────────────────────────────

ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS chk_profile_role;

ALTER TABLE profiles
  ADD CONSTRAINT chk_profile_role
  CHECK (role IN ('free', 'sources', 'vip', 'admin'));


-- ── 2. Contrainte unicité — UN SEUL admin possible ───────────────────────────
-- Garantit au niveau base de données qu'il ne peut exister qu'un seul compte
-- avec le rôle 'admin'. Tentative d'en créer un second → erreur unique violation.

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_admin_only
  ON profiles(role)
  WHERE role = 'admin';


-- ── 3. Trigger mis à jour — protection renforcée ─────────────────────────────
-- Trois règles imbriquées :
--   a) JWT utilisateur → bloque tout changement de rôle (silencieux)
--   b) service_role    → bloque l'attribution de 'admin' (erreur explicite)
--   c) Dashboard SQL   → autorisé (auth.role() IS NULL)

CREATE OR REPLACE FUNCTION prevent_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
  -- Règle A : bloquer TOUT changement de rôle via JWT utilisateur
  IF auth.role() = 'authenticated' AND (NEW.role IS DISTINCT FROM OLD.role) THEN
    NEW.role = OLD.role;
    RETURN NEW;
  END IF;

  -- Règle B : même le backend (service_role) ne peut pas attribuer 'admin'
  -- Seul le dashboard SQL (auth.role() IS NULL) peut le faire
  IF auth.role() = 'service_role'
     AND NEW.role = 'admin'
     AND OLD.role IS DISTINCT FROM 'admin'
  THEN
    RAISE EXCEPTION
      'Le rôle admin ne peut être défini que via le dashboard Supabase SQL directement. '
      'Aucune API ne peut l''attribuer.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recrée le trigger (CREATE OR REPLACE FUNCTION suffit, le trigger reste attaché)
DROP TRIGGER IF EXISTS trg_prevent_role_escalation ON profiles;
CREATE TRIGGER trg_prevent_role_escalation
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION prevent_role_escalation();
