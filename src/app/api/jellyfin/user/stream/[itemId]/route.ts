import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createJellyfinClient } from "@/lib/jellyfin/client";
import type { JellyfinMediaStream } from "@/types/jellyfin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const { itemId } = await params;
  if (!itemId) return NextResponse.json({ error: "itemId requis" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;
  const { data: profile } = await supabase
    .from("profiles")
    .select("personal_jellyfin_url, jellyfin_user_id, jellyfin_user_token")
    .eq("id", user.id)
    .single();

  if (!profile?.jellyfin_user_token || !profile?.jellyfin_user_id) {
    return NextResponse.json({ error: "Compte Jellyfin non connecté" }, { status: 401 });
  }
  if (!profile?.personal_jellyfin_url) {
    return NextResponse.json({ error: "Serveur Jellyfin non configuré" }, { status: 400 });
  }

  const token = profile.jellyfin_user_token as string;
  const userId = profile.jellyfin_user_id as string;

  try {
    const client = createJellyfinClient(profile.personal_jellyfin_url as string);

    // ── PlaybackInfo + UserData en parallèle ────────────────────────────────
    const [playbackInfo, itemData] = await Promise.allSettled([
      client.getPlaybackInfo(token, itemId, userId),
      client.getUserItem(token, userId, itemId),
    ]);

    if (playbackInfo.status === "rejected" || !playbackInfo.value) {
      return NextResponse.json({ error: "Aucune source de lecture disponible" }, { status: 404 });
    }

    const source = playbackInfo.value.MediaSources?.[0];
    if (!source) {
      return NextResponse.json({ error: "Aucune source de lecture disponible" }, { status: 404 });
    }

    // Diagnostic — visible dans les logs du dev server
    console.log("[Jellyfin Stream] source keys:", {
      TranscodingUrl: source.TranscodingUrl ? "✓" : "✗",
      DirectStreamUrl: source.DirectStreamUrl ? "✓" : "✗",
      Container: source.Container,
      TranscodingSubProtocol: source.TranscodingSubProtocol,
    });

    // ── URL de flux ─────────────────────────────────────────────────────────
    // Priorité 1 : HLS transcoding (compatibilité navigateur maximale)
    // Priorité 2 : Direct stream URL
    // Priorité 3 : Construire une URL de stream direct Jellyfin manuellement
    let streamUrl: string | null = null;
    if (source.TranscodingUrl) {
      streamUrl = source.TranscodingUrl.startsWith("http")
        ? source.TranscodingUrl
        : `${client.serverUrl}${source.TranscodingUrl}`;
    } else if (source.DirectStreamUrl) {
      streamUrl = source.DirectStreamUrl.startsWith("http")
        ? source.DirectStreamUrl
        : `${client.serverUrl}${source.DirectStreamUrl}`;
    } else if (source.Id) {
      // Fallback : URL de stream direct Jellyfin standard
      streamUrl = `${client.serverUrl}/Videos/${source.Id}/stream?Static=true&api_key=${token}`;
    }

    if (!streamUrl) {
      return NextResponse.json({ error: "Impossible de construire l'URL de lecture" }, { status: 502 });
    }

    // ── Position de reprise (PlaybackPositionTicks → secondes) ──────────────
    // Jellyfin utilise des ticks de 100ns (10 000 000 ticks = 1 seconde)
    let resumePosition = 0;
    if (itemData.status === "fulfilled" && itemData.value) {
      const ticks = itemData.value.UserData?.PlaybackPositionTicks ?? 0;
      const playedPct = itemData.value.UserData?.PlayedPercentage ?? 0;
      // Ne pas reprendre si quasi terminé (>= 95%)
      if (ticks > 0 && playedPct < 95) {
        resumePosition = Math.floor(ticks / 10_000_000);
      }
    }

    // ── Pistes de sous-titres ───────────────────────────────────────────────
    const subtitleTracks = (source.MediaStreams ?? [])
      .filter((s: JellyfinMediaStream) => s.Type === "Subtitle" && (s.DeliveryUrl ?? s.Path))
      .map((s: JellyfinMediaStream) => {
        const deliveryUrl = s.DeliveryUrl
          ? (s.DeliveryUrl.startsWith("http") ? s.DeliveryUrl : `${client.serverUrl}${s.DeliveryUrl}`)
          : null;
        return {
          index: s.Index,
          label: s.DisplayTitle ?? s.Language ?? `Sous-titre ${s.Index}`,
          language: s.Language ?? "und",
          src: deliveryUrl,
          default: s.IsDefault ?? false,
        };
      })
      .filter((t): t is { index: number; label: string; language: string; src: string; default: boolean } =>
        t.src !== null
      );

    // ── Pistes audio ────────────────────────────────────────────────────────
    const audioTracks = (source.MediaStreams ?? [])
      .filter((s: JellyfinMediaStream) => s.Type === "Audio")
      .map((s: JellyfinMediaStream) => ({
        index: s.Index,
        label: s.DisplayTitle ?? s.Language ?? `Audio ${s.Index}`,
        language: s.Language ?? "und",
        codec: s.Codec ?? null,
        default: s.IsDefault ?? false,
      }));

    return NextResponse.json({
      url: streamUrl,
      sourceId: source.Id,
      container: source.Container,
      isHls: source.TranscodingSubProtocol === "hls" || streamUrl.includes(".m3u8"),
      subtitles: subtitleTracks,
      audioTracks,
      resumePosition,
    });
  } catch (err) {
    console.error("[Jellyfin User Stream]", err);
    return NextResponse.json({ error: "Erreur lors de la récupération du flux" }, { status: 502 });
  }
}
