import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { createRawAdminClient } from "@/lib/supabase/admin";

const VIP_JELLYFIN_URL = process.env.VIP_JELLYFIN_URL ?? "";
const VIP_JELLYFIN_API_KEY = process.env.VIP_JELLYFIN_API_KEY ?? "";
const VIP_JELLYFIN_SERVER_ID = process.env.VIP_JELLYFIN_SERVER_ID ?? null;

/**
 * POST /api/invite/redeem
 * Body : { token: string }
 * Auth : requiert une session valide
 *
 * Active un token d'invitation pour l'utilisateur courant :
 * - Met à jour le rôle (free | sources | vip)
 * - Pour vip : pré-configure Jellyfin partagé + services tous cochés
 * - Marque onboarding_completed = true pour les VIP (skip onboarding)
 * - Enregistre l'utilisation dans invite_uses
 */
export async function POST(req: NextRequest) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let body: { token?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  const { token } = body;
  if (!token) {
    return NextResponse.json({ error: "Token manquant" }, { status: 400 });
  }

  const supabase = createRawAdminClient();

  // ── 1. Vérifier le token ────────────────────────────────────────────────────
  const { data: tokenRow, error: tokenErr } = await supabase
    .from("invite_tokens")
    .select("id, role, max_uses, use_count, expires_at")
    .eq("token", token)
    .single();

  if (tokenErr || !tokenRow) {
    return NextResponse.json({ error: "Token invalide" }, { status: 400 });
  }

  const row = tokenRow as {
    id: string;
    role: string;
    max_uses: number;
    use_count: number;
    expires_at: string | null;
  };

  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    return NextResponse.json({ error: "Token expiré" }, { status: 400 });
  }
  if (row.max_uses > 0 && row.use_count >= row.max_uses) {
    return NextResponse.json({ error: "Token déjà utilisé" }, { status: 400 });
  }

  // ── 2. Vérifier que l'utilisateur n'a pas déjà utilisé CE token ────────────
  const { data: existingUse } = await supabase
    .from("invite_uses")
    .select("id")
    .eq("token_id", row.id)
    .eq("user_id", authUser.id)
    .maybeSingle();

  if (existingUse) {
    return NextResponse.json({ error: "Token déjà utilisé par ce compte" }, { status: 400 });
  }

  // ── 3. Préparer les mises à jour du profil ──────────────────────────────────
  const profileUpdates: Record<string, unknown> = {
    role: row.role,
    updated_at: new Date().toISOString(),
  };

  if (row.role === "vip") {
    // Services : null = tous cochés
    profileUpdates.streaming_services = null;
    profileUpdates.onboarding_completed = true;

    // Pré-configurer le Jellyfin partagé
    if (VIP_JELLYFIN_URL) {
      profileUpdates.personal_jellyfin_url = VIP_JELLYFIN_URL;
    }
    if (VIP_JELLYFIN_API_KEY) {
      profileUpdates.personal_jellyfin_api_key = VIP_JELLYFIN_API_KEY;
    }
    if (VIP_JELLYFIN_SERVER_ID) {
      profileUpdates.personal_jellyfin_server_id = VIP_JELLYFIN_SERVER_ID;
    }

    // Générer un webhook token si absent
    const { data: existing } = await supabase
      .from("profiles")
      .select("webhook_token")
      .eq("id", authUser.id)
      .single();

    if (!((existing as { webhook_token?: string } | null)?.webhook_token)) {
      profileUpdates.webhook_token = crypto.randomUUID();
    }
  }

  // ── 4. Appliquer les mises à jour en transaction ────────────────────────────
  const [profileResult, _useResult, _tokenResult] = await Promise.all([
    supabase.from("profiles").update(profileUpdates).eq("id", authUser.id),
    supabase.from("invite_uses").insert({ token_id: row.id, user_id: authUser.id }),
    supabase
      .from("invite_tokens")
      .update({ use_count: row.use_count + 1 })
      .eq("id", row.id),
  ]);

  if (profileResult.error) {
    console.error("[invite/redeem] profile update error:", profileResult.error);
    return NextResponse.json({ error: "Erreur lors de la mise à jour du profil" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    role: row.role,
    vip_configured: row.role === "vip",
  });
}
