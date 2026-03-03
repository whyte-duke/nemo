import { NextRequest, NextResponse } from "next/server";
import { createRawAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/invite/validate?token=XXX
 *
 * Vérifie si un token d'invitation est valide (sans le consommer).
 * Utilisé par la page d'inscription pour afficher le rôle associé.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ valid: false, reason: "Token manquant" }, { status: 400 });
  }

  const supabase = createRawAdminClient();
  const { data, error } = await supabase
    .from("invite_tokens")
    .select("id, role, max_uses, use_count, expires_at, label")
    .eq("token", token)
    .single();

  if (error || !data) {
    return NextResponse.json({ valid: false, reason: "Token invalide" });
  }

  const row = data as {
    id: string;
    role: string;
    max_uses: number;
    use_count: number;
    expires_at: string | null;
    label: string | null;
  };

  // Vérification expiration
  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    return NextResponse.json({ valid: false, reason: "Token expiré" });
  }

  // Vérification nombre d'utilisations (0 = illimité)
  if (row.max_uses > 0 && row.use_count >= row.max_uses) {
    return NextResponse.json({ valid: false, reason: "Token déjà utilisé" });
  }

  return NextResponse.json({ valid: true, role: row.role, label: row.label });
}
