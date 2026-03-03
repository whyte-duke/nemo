import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ profile: null }, { status: 200 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;
  const { data: raw } = await supabase
    .from("profiles")
    .select(
      "id, display_name, avatar_url, debrid_api_key, debrid_type, preferred_quality, preferred_language, streaming_services, show_paid_options, phone_number, personal_jellyfin_url, personal_jellyfin_api_key, webhook_token, last_library_sync_at, onboarding_completed, letterboxd_username, trakt_username, role, jellyfin_user_id, jellyfin_display_name"
    )
    .eq("id", user.id)
    .single();

  const data = raw as {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    debrid_api_key: string | null;
    debrid_type: string | null;
    preferred_quality: string | null;
    preferred_language: string | null;
    streaming_services: string[] | null;
    show_paid_options: boolean | null;
    phone_number: string | null;
    personal_jellyfin_url: string | null;
    personal_jellyfin_api_key: string | null;
    webhook_token: string | null;
    last_library_sync_at: string | null;
    onboarding_completed: boolean | null;
    letterboxd_username: string | null;
    trakt_username: string | null;
    role: "free" | "sources" | "vip" | "admin" | null;
    jellyfin_user_id: string | null;
    jellyfin_display_name: string | null;
  } | null;

  const meta = user.user_metadata ?? {};
  const displayName =
    data?.display_name ??
    (meta.display_name as string | undefined) ??
    (meta.full_name as string | undefined) ??
    user.email?.split("@")[0] ??
    "Utilisateur";

  if (!data) {
    return NextResponse.json({
      profile: {
        id: user.id,
        name: displayName,
        email: user.email ?? null,
        debrid_api_key: null,
        debrid_type: null,
        preferred_quality: "1080p",
        preferred_language: "VF",
        streaming_services: null,
        show_paid_options: true,
        personal_jellyfin_url: null,
        personal_jellyfin_api_key: null,
        webhook_token: null,
        last_library_sync_at: null,
        onboarding_completed: false,
      letterboxd_username: null,
      trakt_username: null,
      role: "free",
      jellyfin_user_id: null,
      jellyfin_display_name: null,
    },
  });
}

  return NextResponse.json({
    profile: {
      id: data.id,
      name: displayName,
      email: user.email ?? null,
      avatar_url: data.avatar_url ?? null,
      debrid_api_key: data.debrid_api_key ?? null,
      debrid_type: data.debrid_type ?? null,
      preferred_quality: data.preferred_quality ?? "1080p",
      preferred_language: data.preferred_language ?? "VF",
      streaming_services: data.streaming_services ?? null,
      show_paid_options: data.show_paid_options ?? true,
      phone_number: data.phone_number ?? null,
      personal_jellyfin_url: data.personal_jellyfin_url ?? null,
      personal_jellyfin_api_key: data.personal_jellyfin_api_key ?? null,
      webhook_token: data.webhook_token ?? null,
      last_library_sync_at: data.last_library_sync_at ?? null,
      onboarding_completed: data.onboarding_completed ?? false,
      letterboxd_username: data.letterboxd_username ?? null,
      trakt_username: data.trakt_username ?? null,
      role: data.role ?? "free",
      jellyfin_user_id: data.jellyfin_user_id ?? null,
      jellyfin_display_name: data.jellyfin_display_name ?? null,
    },
  });
}

export async function PATCH(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  let body: Partial<{
    debrid_api_key: string | null;
    debrid_type: "alldebrid" | "realdebrid" | null;
    preferred_quality: string;
    preferred_language: string;
    streaming_services: string[] | null;
    show_paid_options: boolean;
    phone_number: string | null;
    personal_jellyfin_url: string | null;
    personal_jellyfin_api_key: string | null;
    onboarding_completed: boolean;
  }>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body && "debrid_api_key" in body) updates.debrid_api_key = body.debrid_api_key ?? null;
  if (body && "debrid_type" in body) updates.debrid_type = body.debrid_type ?? null;
  if (body?.preferred_quality !== undefined) updates.preferred_quality = body.preferred_quality;
  if (body?.preferred_language !== undefined) updates.preferred_language = body.preferred_language;
  if (body && "streaming_services" in body) updates.streaming_services = body.streaming_services ?? null;
  if (body && "show_paid_options" in body) updates.show_paid_options = body.show_paid_options;
  if (body && "phone_number" in body) {
    const raw = body.phone_number ?? null;
    if (raw !== null) {
      // Strip leading + and whitespace, store digits only (ex: 33768117912)
      const stripped = raw.replace(/^\+/, "").replace(/\s/g, "");
      if (!/^[1-9]\d{6,14}$/.test(stripped)) {
        return NextResponse.json({ error: "Format invalide — ex: +33768117912" }, { status: 400 });
      }
      updates.phone_number = stripped;
    } else {
      updates.phone_number = null;
    }
  }
  if (body && "personal_jellyfin_url" in body) {
    updates.personal_jellyfin_url = body.personal_jellyfin_url ?? null;
  }
  if (body && "personal_jellyfin_api_key" in body) {
    updates.personal_jellyfin_api_key = body.personal_jellyfin_api_key ?? null;
  }
  if (body && "onboarding_completed" in body) {
    updates.onboarding_completed = body.onboarding_completed;
  }

  // Générer un webhook_token si Jellyfin est configuré et qu'aucun token n'existe
  if (body?.personal_jellyfin_url || body?.personal_jellyfin_api_key) {
    const { data: existing } = await supabase
      .from("profiles")
      .select("webhook_token")
      .eq("id", user.id)
      .single();
    if (!existing?.webhook_token) {
      updates.webhook_token = crypto.randomUUID();
    }
  }

  const { error } = await supabase.from("profiles").update(updates).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
