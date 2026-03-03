import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { createRawAdminClient as createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const { userId } = await params;
  const supabase = createAdminClient();

  const { data: lists } = await supabase
    .from("lists")
    .select("id, name, icon, is_public, list_items(id)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (!lists) return NextResponse.json([]);

  return NextResponse.json(
    lists.map((l: { id: string; name: string; icon: string | null; is_public: boolean; list_items: { id: string }[] }) => ({
      id: l.id,
      name: l.name,
      icon: l.icon,
      is_public: l.is_public,
      item_count: l.list_items?.length ?? 0,
    }))
  );
}
