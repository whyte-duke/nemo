import { NextResponse } from "next/server";
import { getAuthUserWithName } from "@/lib/auth/session";

export async function GET() {
  const user = await getAuthUserWithName();
  if (!user) {
    return NextResponse.json({ user: null });
  }
  return NextResponse.json({ user });
}
