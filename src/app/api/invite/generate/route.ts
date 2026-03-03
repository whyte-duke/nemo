import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { createRawAdminClient } from "@/lib/supabase/admin";

const ADMIN_SECRET = process.env.ADMIN_INVITE_SECRET ?? "";

/**
 * POST /api/invite/generate
 *
 * Trois modes d'accès (hiérarchie stricte) :
 *  1. X-Admin-Secret header (curl/admin externe) → tous les rôles
 *  2. Rôle DB 'admin' (toi, via UI)              → tous les rôles (free | sources | vip)
 *  3. Rôle DB 'sources' ou 'vip' (user invité)   → sources uniquement, jamais vip/admin
 *
 * Body : { role?: string, label?: string, max_uses?: number }
 * Réponse : { token, url, role, label }
 */
export async function POST(req: NextRequest) {
  // ── Mode 1 : secret admin via header (CLI/curl) ────────────────────────────
  const headerSecret = req.headers.get("x-admin-secret");
  const isHeaderAdmin = Boolean(ADMIN_SECRET && headerSecret === ADMIN_SECRET);

  let generatorUserId: string | null = null;
  let isDbAdmin = false;

  if (!isHeaderAdmin) {
    // ── Mode 2 & 3 : utilisateur authentifié ──────────────────────────────────
    const user = await requireRole("sources");
    if (!user) {
      return NextResponse.json(
        { error: "Accès refusé — rôle sources ou supérieur requis" },
        { status: 403 }
      );
    }
    generatorUserId = user.id;
    isDbAdmin = user.role === "admin";
  }

  let body: { role?: string; label?: string; max_uses?: number } = {};
  try {
    body = await req.json();
  } catch {
    // pas de body = valeurs par défaut
  }

  const requestedRole = (body.role as string | undefined) ?? "sources";

  // ── Contrôle strict des rôles autorisés ────────────────────────────────────
  // sources/vip → uniquement 'sources'
  // admin (DB ou header) → free | sources | vip (jamais 'admin' dans un token)
  const canGenerateVip = isHeaderAdmin || isDbAdmin;

  if (!canGenerateVip && requestedRole !== "sources") {
    return NextResponse.json(
      { error: "Vous ne pouvez inviter des amis qu'avec le rôle sources" },
      { status: 403 }
    );
  }

  if (!["free", "sources", "vip"].includes(requestedRole)) {
    return NextResponse.json({ error: "Rôle invalide — les tokens admin ne sont pas distribuables" }, { status: 400 });
  }

  const label = (body.label as string | undefined) ?? null;
  const max_uses = typeof body.max_uses === "number" ? body.max_uses : 1;

  const supabase = createRawAdminClient();
  const insertPayload: Record<string, unknown> = {
    role: requestedRole,
    label,
    max_uses,
  };
  if (generatorUserId) {
    insertPayload.created_by = generatorUserId;
  }

  const { data, error } = await supabase
    .from("invite_tokens")
    .insert(insertPayload)
    .select("token")
    .single();

  if (error || !data) {
    console.error("[invite/generate]", error);
    return NextResponse.json({ error: "Erreur lors de la génération" }, { status: 500 });
  }

  const token = (data as { token: string }).token;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const url = `${baseUrl}/inscription?invite=${token}`;

  return NextResponse.json({ token, url, role: requestedRole, label, max_uses });
}
