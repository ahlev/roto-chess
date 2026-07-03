/**
 * DELETE /api/games/[id] — the CREATOR removes a game they set up.
 * Server authority (service role): only the user in games.created_by may
 * delete, and the delete cascades to that game's players, moves, actions,
 * and game-scoped chat (schema ON DELETE CASCADE). The table and its
 * series-level chat survive — one deleted episode never erases the club.
 */
import { NextResponse } from "next/server";
import { currentUserId, serviceClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/supabase/env";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (isDemoMode()) {
    return NextResponse.json(
      { error: "Server play is not configured (demo mode)" },
      { status: 503 },
    );
  }
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const { id: gameId } = await context.params;

  const supabase = serviceClient();
  const { data: game, error: readErr } = await supabase
    .from("games")
    .select("id, created_by")
    .eq("id", gameId)
    .single();
  if (readErr || !game) {
    // Absent (or already deleted) — nothing to do; report not-found without
    // leaking whether the id ever existed.
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }
  if (game.created_by !== userId) {
    return NextResponse.json(
      { error: "Only the game's creator can delete it" },
      { status: 403 },
    );
  }

  const { error: delErr } = await supabase
    .from("games")
    .delete()
    .eq("id", gameId);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
