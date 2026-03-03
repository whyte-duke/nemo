import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { createRawAdminClient as createAdminClient } from "@/lib/supabase/admin";

// PATCH /api/friends/request/[id] — accepter ou refuser
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const { id } = await params;

  let body: { status: "accepted" | "declined" };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  if (!["accepted", "declined"].includes(body.status)) {
    return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("friend_requests")
    .update({ status: body.status })
    .eq("id", id)
    .eq("to_user", user.id)  // seul le destinataire peut répondre
    .eq("status", "pending")
    .select("id, status")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });
  }

  return NextResponse.json(data);
}

// DELETE /api/friends/request/[id] — annuler sa propre demande
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const { id } = await params;
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("friend_requests")
    .delete()
    .eq("id", id)
    .eq("from_user", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
