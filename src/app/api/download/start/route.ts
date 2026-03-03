import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { createRawAdminClient } from "@/lib/supabase/admin";
import type { DownloadRequest } from "@/types/download";
import type { DownloadQueueRow } from "@/types/download";

const DOWNLOAD_API = process.env.NEXT_PUBLIC_DOWNLOAD_API_URL ?? "http://localhost:8181/api";
const API_KEY = process.env.API_SECRET_KEY_NEMO_DOWNLOADER ?? "";

export async function POST(req: NextRequest) {
  const user = await requireRole("vip");
  if (!user) {
    return NextResponse.json({ error: "Accès refusé — rôle VIP requis" }, { status: 403 });
  }

  try {
    const body: DownloadRequest & {
      quality?: string;
      audio_languages?: string[];
      sub_languages?: string[];
      tmdb_id?: number;
      season_number?: number;
      episode_number?: number;
    } = await req.json();

    const supabase = createRawAdminClient();
    const { data: queueEntry, error: dbError } = await supabase
      .from("download_queue")
      .insert({
        user_id: user.id,
        user_name: user.name,
        media_title: body.metadata.title,
        media_type: body.metadata.type,
        tmdb_id: body.tmdb_id ?? body.metadata.tmdb_id ?? null,
        season_number: body.season_number ?? body.metadata.season_number ?? null,
        episode_number: body.episode_number ?? body.metadata.episode_number ?? null,
        quality: body.quality ?? null,
        audio_languages: body.audio_languages ?? [],
        sub_languages: body.sub_languages ?? [],
        selected_indices: body.selected_indices,
        destination_path: body.destination_path,
        source_urls: [body.url],
        is_batch: false,
        status: "pending",
      })
      .select()
      .single();

    if (dbError) {
      console.error("[download/start] DB error:", dbError);
      return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
    }

    const entry = queueEntry as DownloadQueueRow;

    const payload = {
      url: body.url,
      selected_indices: body.selected_indices,
      destination_path: body.destination_path,
      metadata: {
        ...body.metadata,
        download_id: entry.id,
      },
    };

    try {
      await fetch(`${DOWNLOAD_API}/download`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        },
        body: JSON.stringify(payload),
      });
    } catch (fetchErr) {
      console.error("[download/start] Backend unreachable:", fetchErr);
      await supabase
        .from("download_queue")
        .update({ status: "error", error_log: "Backend inaccessible" })
        .eq("id", entry.id);

      return NextResponse.json(
        { error: "Serveur de téléchargement inaccessible" },
        { status: 502 }
      );
    }

    await supabase
      .from("download_queue")
      .update({ status: "downloading" })
      .eq("id", entry.id);

    return NextResponse.json({
      status: "success",
      message: "Ajouté à la file d'attente",
      download_id: entry.id,
    });
  } catch (err) {
    console.error("[download/start]", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
