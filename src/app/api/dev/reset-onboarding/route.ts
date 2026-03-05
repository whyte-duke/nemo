import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Réinitialise l'onboarding pour re-tester le flow.
 * POST /api/dev/reset-onboarding
 * - Met onboarding_completed = false dans la BDD
 * - Supprime le cookie nemo_onboarding_done
 */
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;
  const { error } = await supabase
    .from("profiles")
    .update({ onboarding_completed: false })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Rediriger vers /onboarding?reset=1 pour que le client vide le localStorage
  const response = NextResponse.redirect(
    new URL("/onboarding?reset=1", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000")
  );
  response.cookies.delete("nemo_onboarding_done");
  return response;
}
