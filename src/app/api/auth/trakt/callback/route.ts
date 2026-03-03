import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/auth/session";

const CLIENT_ID = process.env.TRAKT_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.TRAKT_CLIENT_SECRET ?? "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

interface TraktTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

interface TraktUserSettings {
  user?: { username?: string };
}

export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.redirect(`${APP_URL}/connexion`);

  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const stateRaw = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(`${APP_URL}/onboarding?step=2&error=trakt_denied`);
  }

  let returnUrl = "/onboarding?step=2";
  try {
    if (stateRaw) {
      const decoded = JSON.parse(Buffer.from(stateRaw, "base64url").toString()) as {
        return?: string;
      };
      returnUrl = decoded.return ?? returnUrl;
    }
  } catch {
    // valeur par défaut
  }

  try {
    const tokenRes = await fetch("https://api.trakt.tv/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: `${APP_URL}/api/auth/trakt/callback`,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      console.error("Trakt token exchange failed:", await tokenRes.text());
      return NextResponse.redirect(`${APP_URL}/onboarding?step=2&error=trakt_token`);
    }

    const tokens = (await tokenRes.json()) as TraktTokenResponse;
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Récupérer le profil utilisateur Trakt
    const settingsRes = await fetch("https://api.trakt.tv/users/settings", {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        "trakt-api-version": "2",
        "trakt-api-key": CLIENT_ID,
      },
    });
    const settings = settingsRes.ok
      ? ((await settingsRes.json()) as TraktUserSettings)
      : null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createAdminClient() as any;
    await supabase
      .from("profiles")
      .update({
        trakt_access_token: tokens.access_token,
        trakt_refresh_token: tokens.refresh_token,
        trakt_expires_at: expiresAt,
        trakt_username: settings?.user?.username ?? null,
      })
      .eq("id", user.id);

    const url = new URL(returnUrl, APP_URL);
    url.searchParams.set("connected", "trakt");

    return NextResponse.redirect(url.toString());
  } catch (err) {
    console.error("Trakt callback error:", err);
    return NextResponse.redirect(`${APP_URL}/onboarding?step=2&error=trakt_server`);
  }
}
