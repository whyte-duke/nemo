/**
 * GET  /api/taste-profile  → renvoie le profil de goût courant de l'utilisateur
 * POST /api/taste-profile  → recalcule et sauvegarde le profil (déclenché après batch de swipes)
 */

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { computeAndSaveTasteProfile, getTasteProfile } from "@/lib/recommendations/taste-profile";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const profile = await getTasteProfile(user.id);
  return NextResponse.json({ profile });
}

export async function POST() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const profile = await computeAndSaveTasteProfile(user.id);
  return NextResponse.json({ ok: true, profile });
}
