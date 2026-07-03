/**
 * POST /api/games — create a table + its first game (or a rematch inside an
 * existing table). Server authority: runs on the Node runtime with the
 * service role; the caller's JWT is validated first.
 */
import { NextResponse } from "next/server";
import {
  ENGINE_VERSION,
  initialState,
  serializeState,
} from "@rotochess/engine";
import { currentUserId, serviceClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/supabase/env";
import { generateJoinCode } from "@/lib/game/prepare-turn";

export const runtime = "nodejs";

interface CreateBody {
  tableName?: string;
  seat?: 1 | 2 | 3 | 4;
  /** Rematch: create the next game inside this table. */
  tableId?: string;
}

const WEEKDAYS = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

export async function POST(request: Request) {
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
  let body: CreateBody = {};
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    // empty body is fine
  }
  const seat = body.seat ?? 1;
  if (![1, 2, 3, 4].includes(seat)) {
    return NextResponse.json({ error: "Bad seat" }, { status: 422 });
  }

  const supabase = serviceClient();

  let tableId = body.tableId ?? null;
  let gameNo = 1;
  if (tableId) {
    // Rematch path: caller must be a participant of the table.
    const { data: membership } = await supabase
      .from("game_players")
      .select("game_id, games!inner(table_id)")
      .eq("user_id", userId)
      .eq("games.table_id", tableId)
      .limit(1);
    if (!membership || membership.length === 0) {
      return NextResponse.json({ error: "Not at this table" }, { status: 403 });
    }
    const { data: last } = await supabase
      .from("games")
      .select("game_no, status")
      .eq("table_id", tableId)
      .order("game_no", { ascending: false })
      .limit(1)
      .single();
    // "Run it back" starts when the previous episode has ENDED — no piles
    // of parallel lobbies inside one table.
    if (last && ["lobby", "active"].includes(last.status as string)) {
      return NextResponse.json(
        { error: "This table already has a game in progress" },
        { status: 409 },
      );
    }
    gameNo = (last?.game_no ?? 0) + 1;
  } else {
    const name =
      body.tableName?.trim() ||
      `The ${WEEKDAYS[new Date().getDay()]} Board`;
    const { data: table, error } = await supabase
      .from("tables")
      .insert({ name, created_by: userId })
      .select("id")
      .single();
    if (error || !table) {
      return NextResponse.json({ error: "Could not create table" }, { status: 500 });
    }
    tableId = table.id as string;
  }

  const state = initialState();
  // Retry a couple of times on the (unlikely) join-code collision.
  for (let attempt = 0; attempt < 3; attempt++) {
    const joinCode = generateJoinCode();
    const { data: game, error } = await supabase
      .from("games")
      .insert({
        table_id: tableId,
        game_no: gameNo,
        join_code: joinCode,
        status: "lobby",
        engine_version: ENGINE_VERSION,
        state: JSON.parse(serializeState(state)) as unknown,
        current_ply: 0,
        created_by: userId,
      })
      .select("id, join_code")
      .single();
    if (!error && game) {
      const { error: seatErr } = await supabase
        .from("game_players")
        .insert({ game_id: game.id as string, seat, user_id: userId });
      if (seatErr) {
        return NextResponse.json(
          { error: "Could not seat the creator" },
          { status: 500 },
        );
      }
      return NextResponse.json({
        gameId: game.id as string,
        tableId,
        joinCode: game.join_code as string,
      });
    }
    if (error && !error.message.includes("join_code")) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
  return NextResponse.json({ error: "Could not allocate a join code" }, { status: 500 });
}
