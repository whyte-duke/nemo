import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("interactions")
    .select("tmdb_id, media_type, type, not_interested")
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const interactions: Record<string, "like" | "dislike" | "not_interested"> = {};
  for (const row of (data ?? []) as Array<{ tmdb_id: number; media_type: string; type: string | null; not_interested: boolean }>) {
    const key = `${row.tmdb_id}-${row.media_type}`;
    if (row.not_interested) {
      interactions[key] = "not_interested";
    } else if (row.type === "like" || row.type === "dislike") {
      interactions[key] = row.type;
    }
  }

  return NextResponse.json({ interactions });
}
