import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/auth/session";

const CLIENT_ID = process.env.LETTERBOXD_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.LETTERBOXD_CLIENT_SECRET ?? "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

interface LetterboxdTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

interface LetterboxdMemberResponse {
  username?: string;
  id?: string;
}

export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.redirect(`${APP_URL}/connexion`);

  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const stateRaw = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(`${APP_URL}/onboarding?step=2&error=letterboxd_denied`);
  }

  // Décoder le state
  let returnUrl = "/onboarding?step=2";
  try {
    if (stateRaw) {
      const decoded = JSON.parse(Buffer.from(stateRaw, "base64url").toString()) as {
        return?: string;
      };
      returnUrl = decoded.return ?? returnUrl;
    }
  } catch {
    // utiliser la valeur par défaut
  }

  // Échanger le code contre un token
  try {
    const tokenRes = await fetch("https://api.letterboxd.com/api/v0/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: `${APP_URL}/api/auth/letterboxd/callback`,
      }),
    });

    if (!tokenRes.ok) {
      console.error("Letterboxd token exchange failed:", await tokenRes.text());
      return NextResponse.redirect(`${APP_URL}/onboarding?step=2&error=letterboxd_token`);
    }

    const tokens = (await tokenRes.json()) as LetterboxdTokenResponse;

    // Récupérer le membre courant
    const memberRes = await fetch("https://api.letterboxd.com/api/v0/me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const member = memberRes.ok ? ((await memberRes.json()) as LetterboxdMemberResponse) : null;

    // Stocker les tokens dans Supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createAdminClient() as any;
    await supabase
      .from("profiles")
      .update({
        letterboxd_access_token: tokens.access_token,
        letterboxd_refresh_token: tokens.refresh_token,
        letterboxd_username: member?.username ?? null,
      })
      .eq("id", user.id);

    // Construire l'URL de retour avec le paramètre "connected"
    const url = new URL(returnUrl, APP_URL);
    url.searchParams.set("connected", "letterboxd");

    return NextResponse.redirect(url.toString());
  } catch (err) {
    console.error("Letterboxd callback error:", err);
    return NextResponse.redirect(`${APP_URL}/onboarding?step=2&error=letterboxd_server`);
  }
}
