import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import type { ProbeResponse } from "@/types/download";

const DOWNLOAD_API = process.env.NEXT_PUBLIC_DOWNLOAD_API_URL ?? "http://localhost:8181/api";
const API_KEY = process.env.API_SECRET_KEY_NEMO_DOWNLOADER ?? "";

export async function POST(req: NextRequest) {
  const user = await requireRole("vip");
  if (!user) {
    return NextResponse.json({ error: "Accès refusé — rôle VIP requis" }, { status: 403 });
  }

  try {
    const body = await req.json();

    const res = await fetch(`${DOWNLOAD_API}/probe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": API_KEY,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Le backend a retourné une erreur", status: res.status },
        { status: res.status }
      );
    }

    const data: ProbeResponse = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Impossible de contacter le serveur de téléchargement" },
      { status: 502 }
    );
  }
}
