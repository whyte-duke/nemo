import { NextRequest, NextResponse } from "next/server";
import { createRawAdminClient } from "@/lib/supabase/admin";
import type { WebhookPayload } from "@/types/download";

/**
 * POST /api/webhook-receiver
 *
 * Reçoit les notifications du backend Python (n8n) lorsqu'un téléchargement
 * se termine (succès ou erreur) et met à jour la file en base de données.
 *
 * Payload attendu :
 *   { status: "success"|"error", download_id: string, media_title?: string,
 *     file_path?: string, error_log?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const payload: WebhookPayload = await req.json();

    if (!payload.download_id) {
      return NextResponse.json({ error: "download_id manquant" }, { status: 400 });
    }

    const supabase = createRawAdminClient();

    const updateData: Record<string, string> = {
      status: payload.status === "success" ? "completed" : "error",
    };

    if (payload.file_path) updateData.file_path = payload.file_path;
    if (payload.error_log) updateData.error_log = payload.error_log;

    const { error } = await supabase
      .from("download_queue")
      .update(updateData)
      .eq("id", payload.download_id);

    if (error) {
      console.error("[webhook-receiver] DB update error:", error);
      return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
    }

    console.info(
      `[webhook-receiver] download_id=${payload.download_id} → ${updateData.status}`
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[webhook-receiver]", err);
    return NextResponse.json({ error: "Payload invalide" }, { status: 400 });
  }
}
