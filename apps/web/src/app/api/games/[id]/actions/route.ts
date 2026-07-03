/**
 * POST /api/games/[id]/actions — the social state machine. Inserts the
 * caller's action (validated server-side), then resolves: resignation
 * (partner confirm), draw agreement (all four), rule claims (engine-
 * verified), abandonment ladder, nudges (24h cooldown + email), and
 * dormant-game resume. Resolution — actually ending a game — happens ONLY
 * here, service-side, guarded by the current ply.
 */
import { NextResponse } from "next/server";
import { partnerOf, type Seat } from "@rotochess/engine";
import { currentUserId, serviceClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/supabase/env";
import {
  PROPOSAL_WINDOW_PLIES,
  liveRows,
  nudgeAllowed,
  resolveAbandonment,
  resolveDrawAgreement,
  resolveDrawClaim,
  resolveResignation,
  type ActionRow,
  type Resolution,
  type SeatMap,
} from "@/lib/game/resolve-actions";
import { gameOverEmail, nudgeEmail, sendMail } from "@/lib/email";

export const runtime = "nodejs";

const KINDS = new Set([
  "resign_propose", "resign_confirm", "resign_decline",
  "draw_propose", "draw_accept", "draw_decline", "draw_claim",
  "abandon_claim", "abandon_agree", "abandon_object", "nudge",
  "resume",
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
  const mySeat = seats[userId];
  if (!mySeat) {
    return NextResponse.json({ error: "No such game" }, { status: 404 });
  }
  const { data: game } = await supabase
    .from("games")
    .select(
      "id, status, state, current_ply, active_seat, last_move_at, created_at, table_id, tables(name)",
    )
    .eq("id", gameId)
    .single();
  if (!game) {
    return NextResponse.json({ error: "No such game" }, { status: 404 });
  }

  // Waking a dormant table: any participant may resume (P1's door swings
  // both ways). No action row needed — the trigger requires a live game.
  if (kind === "resume") {
    if (game.status !== "dormant") {
      return NextResponse.json({ error: "Nothing to resume" }, { status: 409 });
    }
    const activeSeat = (game.state as { activeSeat?: number })?.activeSeat ?? 1;
    const { error } = await supabase
      .from("games")
      .update({ status: "active", active_seat: activeSeat })
      .eq("id", gameId)
      .eq("status", "dormant");
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, resumed: true });
  }

  if (game.status !== "active") {
    return NextResponse.json({ error: "Game is not active" }, { status: 409 });
  }

  const { data: existing } = await supabase
    .from("game_actions")
    .select("user_id, kind, ply_at, created_at")
    .eq("game_id", gameId)
    .order("created_at");
  const rows = (existing ?? []) as ActionRow[];
  const currentPly = game.current_ply as number;
  const live = liveRows(rows, currentPly);
  const tableName =
    (game as { tables?: { name?: string } }).tables?.name ?? "the board";
  const gameUrl = `${new URL(request.url).origin}/app/game/${gameId}`;

  // Effective idle clock: a vacation flag pauses the ladder (P1) and mutes
  // pokes. The clock starts at the latest of last activity / vacation end.
  const absentUserId = Object.entries(seats).find(
    ([, s]) => s === (game.active_seat as Seat),
  )?.[0];
  let idleSince = new Date(
    (game.last_move_at as string | null) ?? (game.created_at as string),
  );
  let onVacation = false;
  if (absentUserId) {
    const { data: absentPrefs } = await supabase
      .from("profiles")
      .select("vacation_until")
      .eq("id", absentUserId)
      .single();
    const until = absentPrefs?.vacation_until
      ? new Date(absentPrefs.vacation_until as string)
      : null;
    if (until && until.getTime() > Date.now()) onVacation = true;
    if (until && until.getTime() > idleSince.getTime()) idleSince = until;
  }

  // ---- precondition checks (invalid actions are refused, not stored) ----
  if (kind === "nudge") {
    if (game.active_seat === mySeat) {
      return NextResponse.json(
        { error: "It's your own move" },
        { status: 422 },
      );
    }
    if (onVacation) {
      return NextResponse.json(
        { error: "They're away — the suitcase is on the seat" },
        { status: 422 },
      );
    }
    if (!nudgeAllowed(rows, userId, new Date())) {
      return NextResponse.json(
        { error: "One poke per day is plenty" },
        { status: 429 },
      );
    }
  }
  if (kind === "draw_propose") {
    const mine = rows.filter(
      (r) =>
        r.kind === "draw_propose" &&
        r.user_id === userId &&
        currentPly - r.ply_at < PROPOSAL_WINDOW_PLIES,
    );
    if (mine.length > 0) {
      return NextResponse.json(
        { error: "One draw offer per round, per player" },
        { status: 429 },
      );
    }
  }
  if (kind === "resign_confirm" || kind === "resign_decline") {
    const proposal = live.find((r) => r.kind === "resign_propose");
    const proposerSeat = proposal ? seats[proposal.user_id] : undefined;
    if (
      !proposal ||
      proposerSeat === undefined ||
      seats[userId] !== partnerOf(proposerSeat)
    ) {
      return NextResponse.json(
        { error: "There is no proposal of yours to answer" },
        { status: 422 },
      );
    }
  }
  if (kind === "draw_accept" || kind === "draw_decline") {
    if (!live.some((r) => r.kind === "draw_propose")) {
      return NextResponse.json(
        { error: "No draw is on the table" },
        { status: 422 },
      );
    }
  }

  const insert = await supabase.from("game_actions").insert({
    game_id: gameId,
    user_id: userId,
    kind,
    ply_at: currentPly,
  });
  if (insert.error) {
    return NextResponse.json({ error: insert.error.message }, { status: 500 });
  }

  if (kind === "nudge") {
    if (absentUserId) {
      const { data: target } = await supabase.auth.admin.getUserById(
        absentUserId,
      );
      const { data: prefs } = await supabase
        .from("profiles")
        .select("email_notifications")
        .eq("id", absentUserId)
        .single();
      const { data: sender } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", userId)
        .single();
      if (target?.user?.email && prefs?.email_notifications !== false) {
        await sendMail({
          to: target.user.email,
          ...nudgeEmail(sender?.display_name ?? "Your table", tableName, gameUrl),
        });
      }
    }
    return NextResponse.json({ ok: true });
  }

  const { data: refreshed } = await supabase
    .from("game_actions")
    .select("user_id, kind, ply_at, created_at")
    .eq("game_id", gameId)
    .order("created_at");
  const all = (refreshed ?? []) as ActionRow[];

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
      idleSince,
      new Date(),
    );
    if (kind === "abandon_claim" && resolution.kind === "none") {
      return NextResponse.json({ ok: true, pending: true });
    }
  }

  if (resolution.kind === "complete") {
    // Ply-guarded: a turn landing between our read and this update means
    // the proposal context changed — bail rather than end a moved-on game.
    const { error, count } = await supabase
      .from("games")
      .update(
        {
          status: "complete",
          active_seat: null,
          result: resolution.result,
          result_reason: resolution.reason,
        },
        { count: "exact" },
      )
      .eq("id", gameId)
      .eq("status", "active")
      .eq("current_ply", currentPly);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if ((count ?? 0) > 0) {
      await notifyGameOver(supabase, seats, resolution, tableName, gameUrl);
    }
    return NextResponse.json({ ok: true, resolved: resolution });
  }
  if (resolution.kind === "dormant") {
    await supabase
      .from("games")
      .update({ status: "dormant", active_seat: null })
      .eq("id", gameId)
      .eq("status", "active")
      .eq("current_ply", currentPly);
    return NextResponse.json({ ok: true, resolved: resolution });
  }
  return NextResponse.json({ ok: true });
}

async function notifyGameOver(
  supabase: ReturnType<typeof serviceClient>,
  seats: SeatMap,
  resolution: Extract<Resolution, { kind: "complete" }>,
  tableName: string,
  gameUrl: string,
) {
  const line =
    resolution.result === "team_13"
      ? "Red & Blue take the crown."
      : resolution.result === "team_24"
        ? "Black & Gold take the crown."
        : "A draw — the crown stays on the table.";
  for (const uid of Object.keys(seats)) {
    const { data: prefs } = await supabase
      .from("profiles")
      .select("email_notifications")
      .eq("id", uid)
      .single();
    if (prefs?.email_notifications === false) continue;
    const { data: target } = await supabase.auth.admin.getUserById(uid);
    if (target?.user?.email) {
      await sendMail({
        to: target.user.email,
        ...gameOverEmail(tableName, `${line} (${resolution.reason})`, gameUrl),
      });
    }
  }
}
