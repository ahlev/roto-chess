/**
 * POST /api/account/delete — the caller deletes THEIR OWN account.
 * Profile rows cascade from auth.users; finished games keep their records
 * (moves reference profiles only through game_players' user ids).
 */
import { NextResponse } from "next/server";
import { currentUserId, serviceClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/supabase/env";

export const runtime = "nodejs";

export async function POST() {
  if (isDemoMode()) {
    return NextResponse.json({ error: "Demo mode" }, { status: 503 });
  }
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const supabase = serviceClient();
  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
