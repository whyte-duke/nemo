import { NextResponse, type NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth/session";

const CLIENT_ID = process.env.TRAKT_CLIENT_ID ?? "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  if (!CLIENT_ID) {
    return NextResponse.json(
      { error: "Trakt non configuré (TRAKT_CLIENT_ID manquant)" },
      { status: 503 }
    );
  }

  const returnUrl = request.nextUrl.searchParams.get("return") ?? "/onboarding?step=2";
  const state = Buffer.from(JSON.stringify({ userId: user.id, return: returnUrl })).toString(
    "base64url"
  );

  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: `${APP_URL}/api/auth/trakt/callback`,
    state,
  });

  return NextResponse.redirect(
    `https://trakt.tv/oauth/authorize?${params.toString()}`
  );
}
