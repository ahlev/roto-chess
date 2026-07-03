/**
 * POST /api/games/[id]/turn — the authority call. Validates the caller's
 * seat, re-derives legality with the engine from the SERVER's snapshot
 * (client effects are never trusted), and commits through submit_turn's
 * optimistic lock. A racing loser gets 409 and refetches.
 */
import { NextResponse } from "next/server";
import type { Seat, TurnRef } from "@rotochess/engine";
import { currentUserId, serviceClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/supabase/env";
import { prepareTurn } from "@/lib/game/prepare-turn";

export const runtime = "nodejs";

export async function POST(
  request: Request,
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

  let ref: TurnRef;
  try {
    ref = (await request.json()) as TurnRef;
  } catch {
    return NextResponse.json({ error: "Malformed body" }, { status: 400 });
  }

  const supabase = serviceClient();
  const { data: game } = await supabase
    .from("games")
    .select("id, status, state, current_ply, active_seat")
    .eq("id", gameId)
    .single();
  if (!game) {
    return NextResponse.json({ error: "No such game" }, { status: 404 });
  }
  if (game.status !== "active") {
    return NextResponse.json({ error: "Game is not active" }, { status: 409 });
  }
  const { data: seatRow } = await supabase
    .from("game_players")
    .select("seat")
    .eq("game_id", gameId)
    .eq("user_id", userId)
    .single();
  if (!seatRow) {
    return NextResponse.json({ error: "Not a participant" }, { status: 403 });
  }

  const prepared = prepareTurn(
    JSON.stringify(game.state),
    game.current_ply as number,
    seatRow.seat as Seat,
    ref,
  );
  if (!prepared.ok) {
    return NextResponse.json({ error: prepared.error }, { status: prepared.status });
  }

  const { error } = await supabase.rpc("submit_turn", {
    p_game_id: gameId,
    p_expected_ply: game.current_ply,
    p_seat: seatRow.seat,
    p_turn: JSON.parse(prepared.turnJson) as unknown,
    p_notation: prepared.notation,
    p_new_state: JSON.parse(prepared.newStateJson) as unknown,
    p_new_active_seat: prepared.newActiveSeat,
    p_new_status: prepared.newStatus,
    p_result: prepared.result,
    p_result_reason: prepared.resultReason,
  });
  if (error) {
    const conflict = error.message.includes("TURN_CONFLICT");
    return NextResponse.json(
      { error: conflict ? "Another turn landed first" : error.message },
      { status: conflict ? 409 : 500 },
    );
  }
  return NextResponse.json({
    ply: (game.current_ply as number) + 1,
    notation: prepared.notation,
    status: prepared.newStatus,
    result: prepared.result,
  });
}
