import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { createRawAdminClient as createAdminClient } from "@/lib/supabase/admin";

const RANDOM_ICONS = ["🎬", "🎭", "🍿", "⭐", "🔥", "💫", "🎯", "🎪", "🌟", "🎥", "📽️", "🎞️"];

function randomIcon(): string {
  return RANDOM_ICONS[Math.floor(Math.random() * RANDOM_ICONS.length)];
}

export type ListSummary = {
  id: string;
  name: string;
  icon: string | null;
  is_default: boolean;
  is_public: boolean;
  item_count: number;
  role: "owner" | "member";
  members: Array<{ user_id: string; display_name: string | null; avatar_url: string | null; role: "owner" | "member" }>;
  created_at: string;
};

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const supabase = createAdminClient();

  // Récupère toutes les listes dont l'utilisateur est membre
  const { data: memberRows, error } = await supabase
    .from("list_members")
    .select(`
      role,
      list:lists (
        id, name, icon, is_default, is_public, created_at,
        list_items (id),
        list_members (
          role,
          user_id,
          profile:profiles (display_name, avatar_url)
        )
      )
    `)
    .eq("user_id", user.id)
    .order("joined_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type RowList = {
    id: string;
    name: string;
    icon: string | null;
    is_default: boolean;
    is_public: boolean;
    created_at: string;
    list_items: { id: string }[];
    list_members: Array<{ role: string; user_id: string; profile: { display_name: string | null; avatar_url: string | null } | null }>;
  };
  type MemberRow = { role: string; list: RowList | null };

  const lists: ListSummary[] = ((memberRows ?? []) as unknown as MemberRow[]).map((row) => {
    const list = row.list;

    if (!list) return null;

    return {
      id: list.id,
      name: list.name,
      icon: list.icon,
      is_default: list.is_default,
      is_public: list.is_public,
      item_count: list.list_items?.length ?? 0,
      role: row.role as "owner" | "member",
      members: (list.list_members ?? []).map((m) => ({
        user_id: m.user_id,
        display_name: m.profile?.display_name ?? null,
        avatar_url: m.profile?.avatar_url ?? null,
        role: m.role as "owner" | "member",
      })),
      created_at: list.created_at,
    };
  }).filter(Boolean) as ListSummary[];

  return NextResponse.json(lists);
}

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  let body: { name: string; icon?: string; friendIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  const { name, icon, friendIds = [] } = body;
  if (!name?.trim()) return NextResponse.json({ error: "Nom requis" }, { status: 400 });
  if (name.trim().length > 30) return NextResponse.json({ error: "Nom trop long (max 30 caractères)" }, { status: 400 });

  const supabase = createAdminClient();

  // Crée la liste
  const { data: list, error: listErr } = await supabase
    .from("lists")
    .insert({
      user_id: user.id,
      name: name.trim(),
      icon: icon ?? randomIcon(),
      is_default: false,
      is_public: false,
    })
    .select("id, name, icon, is_default, is_public, created_at")
    .single();

  if (listErr || !list) return NextResponse.json({ error: listErr?.message ?? "Erreur" }, { status: 500 });

  // Ajoute les amis sélectionnés comme membres (sans validation)
  if (friendIds.length > 0) {
    const memberInserts = friendIds.map((friendId: string) => ({
      list_id: (list as { id: string }).id,
      user_id: friendId,
      role: "member" as const,
    }));
    await supabase.from("list_members").insert(memberInserts).select();
  }

  return NextResponse.json(list, { status: 201 });
}
