/**
 * POST /api/games/[id]/actions — the social state machine. Inserts the
 * caller's action (RLS-equivalent checks server-side), then resolves:
 * resignation (partner confirm), draw agreement (all four), rule claims
 * (engine-verified), abandonment ladder, nudges (24h cooldown + email).
 * Resolution — actually ending a game — happens ONLY here, service-side.
 */
import { NextResponse } from "next/server";
import type { Seat } from "@rotochess/engine";
import { currentUserId, serviceClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/supabase/env";
import {
  nudgeAllowed,
  resolveAbandonment,
  resolveDrawAgreement,
  resolveDrawClaim,
  resolveResignation,
  type ActionRow,
  type Resolution,
  type SeatMap,
} from "@/lib/game/resolve-actions";
import { nudgeEmail, sendMail } from "@/lib/email";

export const runtime = "nodejs";

const KINDS = new Set([
  "resign_propose", "resign_confirm", "resign_decline",
  "draw_propose", "draw_accept", "draw_decline", "draw_claim",
  "abandon_claim", "abandon_agree", "abandon_object", "nudge",
]);

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (isDemoMode()) {
    return NextResponse.json({ error: "Demo mode" }, { status: 503 });
  }
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const { id: gameId } = await context.params;
  let kind: string;
  try {
    ({ kind } = (await request.json()) as { kind: string });
  } catch {
    return NextResponse.json({ error: "Malformed body" }, { status: 400 });
  }
  if (!KINDS.has(kind)) {
    return NextResponse.json({ error: "Unknown action" }, { status: 422 });
  }

  const supabase = serviceClient();
  const { data: players } = await supabase
    .from("game_players")
    .select("seat, user_id")
    .eq("game_id", gameId);
  const seats: SeatMap = {};
  for (const p of players ?? []) {
    seats[p.user_id as string] = p.seat as Seat;
  }
  if (!seats[userId]) {
    return NextResponse.json({ error: "No such game" }, { status: 404 });
  }
  const { data: game } = await supabase
    .from("games")
    .select(
      "id, status, state, current_ply, active_seat, last_move_at, table_id, tables(name)",
    )
    .eq("id", gameId)
    .single();
  if (!game || game.status !== "active") {
    return NextResponse.json({ error: "Game is not active" }, { status: 409 });
  }

  const { data: existing } = await supabase
    .from("game_actions")
    .select("user_id, kind, ply_at, created_at")
    .eq("game_id", gameId)
    .order("created_at");
  const rows = (existing ?? []) as ActionRow[];

  // Nudge: rate-limited, notifies the seat to move, never resolves anything.
  if (kind === "nudge") {
    if (!nudgeAllowed(rows, userId, new Date())) {
      return NextResponse.json(
        { error: "One poke per day is plenty" },
        { status: 429 },
      );
    }
    await supabase.from("game_actions").insert({
      game_id: gameId,
      user_id: userId,
      kind,
      ply_at: game.current_ply as number,
    });
    const absent = Object.entries(seats).find(
      ([, s]) => s === (game.active_seat as Seat),
    )?.[0];
    if (absent) {
      const { data: target } = await supabase.auth.admin.getUserById(absent);
      const { data: prefs } = await supabase
        .from("profiles")
        .select("email_notifications, display_name")
        .eq("id", absent)
        .single();
      const { data: sender } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", userId)
        .single();
      if (target?.user?.email && prefs?.email_notifications) {
        const tableName =
          (game as { tables?: { name?: string } }).tables?.name ?? "the board";
        await sendMail({
          to: target.user.email,
          ...nudgeEmail(
            sender?.display_name ?? "Your table",
            tableName,
            `${new URL(request.url).origin}/app/game/${gameId}`,
          ),
        });
      }
    }
    return NextResponse.json({ ok: true });
  }

  // Abandonment claims only make sense against a silent board.
  const insert = await supabase.from("game_actions").insert({
    game_id: gameId,
    user_id: userId,
    kind,
    ply_at: game.current_ply as number,
  });
  if (insert.error) {
    return NextResponse.json({ error: insert.error.message }, { status: 500 });
  }

  const { data: refreshed } = await supabase
    .from("game_actions")
    .select("user_id, kind, ply_at, created_at")
    .eq("game_id", gameId)
    .order("created_at");
  const all = (refreshed ?? []) as ActionRow[];
  const currentPly = game.current_ply as number;

  let resolution: Resolution = { kind: "none" };
  if (kind.startsWith("resign")) {
    resolution = resolveResignation(all, currentPly, seats);
  } else if (kind === "draw_claim") {
    resolution = resolveDrawClaim(JSON.stringify(game.state));
    if (resolution.kind === "none") {
      return NextResponse.json(
        { error: "No draw is claimable in this position" },
        { status: 422 },
      );
    }
  } else if (kind.startsWith("draw")) {
    resolution = resolveDrawAgreement(all, currentPly, seats);
  } else if (kind.startsWith("abandon")) {
    resolution = resolveAbandonment(
      all,
      currentPly,
      seats,
      game.active_seat as Seat,
      new Date((game.last_move_at as string) ?? (game as { created_at?: string }).created_at ?? Date.now()),
      new Date(),
    );
    if (kind === "abandon_claim" && resolution.kind === "none") {
      // Not yet closeable — surface how long remains rather than failing.
      return NextResponse.json({ ok: true, pending: true });
    }
  }

  if (resolution.kind === "complete") {
    const { error } = await supabase
      .from("games")
      .update({
        status: "complete",
        active_seat: null,
        result: resolution.result,
        result_reason: resolution.reason,
      })
      .eq("id", gameId)
      .eq("status", "active");
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, resolved: resolution });
  }
  if (resolution.kind === "dormant") {
    await supabase
      .from("games")
      .update({ status: "dormant", active_seat: null })
      .eq("id", gameId)
      .eq("status", "active");
    return NextResponse.json({ ok: true, resolved: resolution });
  }
  return NextResponse.json({ ok: true });
}
