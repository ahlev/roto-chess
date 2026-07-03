/**
 * M5 verification — the REAL migration executed against an in-process
 * Postgres (PGlite; Docker is unavailable on this machine), with a stubbed
 * auth schema so RLS policies run exactly as written:
 *
 *  - adversarial RLS: non-participants read nothing; clients cannot INSERT
 *    into moves; cross-team team_only chat stays invisible
 *  - racing double-submit: exactly one winner, loser gets TURN_CONFLICT
 *  - a scripted full game driven through prepareTurn + submit_turn equals
 *    the engine-only replay, ply for ply
 *
 * Cloud verification against real Supabase is the founder's GOING-LIVE
 * step — this harness proves the SQL and the authority logic themselves.
 */
import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  ENGINE_VERSION,
  applyTurn,
  initialState,
  legalMoves,
  legalSecondSubmoves,
  serializeState,
  type BoardState,
  type Move,
  type Seat,
  type TurnRef,
} from "@rotochess/engine";
import { prepareTurn } from "../src/lib/game/prepare-turn";

let db: PGlite;
/** Multi-statement SQL runner (PGlite batch API, aliased). */
let runSql: (sql: string) => Promise<unknown>;

const USERS = {
  north: "00000000-0000-4000-8000-000000000001",
  east: "00000000-0000-4000-8000-000000000002",
  south: "00000000-0000-4000-8000-000000000003",
  west: "00000000-0000-4000-8000-000000000004",
  outsider: "00000000-0000-4000-8000-000000000099",
} as const;

/** Run a block as a specific authenticated user (RLS applies). */
async function asUser<T>(uid: string | null, fn: () => Promise<T>): Promise<T> {
  await runSql(
    `set role authenticated; select set_config('request.jwt.claim.sub', '${uid ?? ""}', false);`,
  );
  try {
    return await fn();
  } finally {
    await runSql(`reset role;`);
  }
}

beforeAll(async () => {
  db = new PGlite({ extensions: { citext } });
  runSql = (db["exec"] as (sql: string) => Promise<unknown>).bind(db);
  await runSql(`create extension if not exists citext;`);
  // --- auth stub (Supabase provides these in production) ---
  await runSql(`
    create schema if not exists auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create role authenticated nologin;
    create role anon nologin;
    grant usage on schema auth to authenticated, anon;
    grant usage on schema public to authenticated, anon;
  `);
  // --- the real migration, verbatim ---
  const migration = readFileSync(
    join(__dirname, "../supabase/migrations/0001_init.sql"),
    "utf8",
  );
  await runSql(migration);
  await runSql(`
    grant select, insert, update, delete on all tables in schema public to authenticated;
    grant execute on all functions in schema auth to authenticated, anon;
  `);
  // --- seed users + profiles (service context) ---
  for (const uid of Object.values(USERS)) {
    await runSql(`insert into auth.users (id) values ('${uid}');`);
    await runSql(
      `insert into profiles (id, display_name) values ('${uid}', 'u-${uid.slice(-2)}');`,
    );
  }
}, 120_000);

/** Service-context game creation mirroring the create route. */
async function createGame(): Promise<{ gameId: string; tableId: string }> {
  const t = await db.query<{ id: string }>(
    `insert into tables (name, created_by) values ('The Test Board', $1) returning id`,
    [USERS.north],
  );
  const tableId = t.rows[0]!.id;
  const state = serializeState(initialState());
  const g = await db.query<{ id: string }>(
    `insert into games (table_id, join_code, status, engine_version, state, current_ply, created_by)
     values ($1, $2, 'lobby', $3, $4::jsonb, 0, $5) returning id`,
    [
      tableId,
      Math.random().toString(36).slice(2, 7).toUpperCase().padEnd(5, "X"),
      ENGINE_VERSION,
      state,
      USERS.north,
    ],
  );
  const gameId = g.rows[0]!.id;
  await db.query(
    `insert into game_players (game_id, seat, user_id) values ($1, 1, $2)`,
    [gameId, USERS.north],
  );
  return { gameId, tableId };
}

async function joinAll(gameId: string): Promise<void> {
  const code = (
    await db.query<{ join_code: string }>(
      `select join_code from games where id = $1`,
      [gameId],
    )
  ).rows[0]!.join_code;
  for (const [seat, uid] of [
    [2, USERS.east],
    [3, USERS.south],
    [4, USERS.west],
  ] as const) {
    await asUser(uid, async () => {
      await db.query(`select join_game($1, $2)`, [code, seat]);
    });
  }
}

/** Execute submit_turn as the service role (definer function, like the route). */
async function callSubmitTurn(
  gameId: string,
  expectedPly: number,
  seat: number,
  prepared: Extract<ReturnType<typeof prepareTurn>, { ok: true }>,
) {
  return db.query(
    `select submit_turn($1, $2, $3, $4::jsonb, $5, $6::jsonb, $7, $8, $9, $10)`,
    [
      gameId,
      expectedPly,
      seat,
      prepared.turnJson,
      prepared.notation,
      prepared.newStateJson,
      prepared.newActiveSeat,
      prepared.newStatus,
      prepared.result,
      prepared.resultReason,
    ],
  );
}

function toRef(moves: readonly Move[]): TurnRef {
  return {
    submoves: moves.map((m) => ({
      from: m.from,
      to: m.to,
      ...(m.promotion ? { promotion: m.promotion } : {}),
      ...(m.rotDir ? { rotDir: m.rotDir } : {}),
    })) as unknown as TurnRef["submoves"],
  };
}

describe("join_game RPC", () => {
  it("fills seats race-safely and activates on the fourth", async () => {
    const { gameId } = await createGame();
    await joinAll(gameId);
    const game = await db.query<{ status: string; active_seat: number }>(
      `select status, active_seat from games where id = $1`,
      [gameId],
    );
    expect(game.rows[0]).toEqual({ status: "active", active_seat: 1 });

    await expect(
      asUser(USERS.outsider, () =>
        db.query(
          `select join_game((select join_code from games where id = '${gameId}'), 2::smallint)`,
        ),
      ),
    ).rejects.toThrow(/GAME_NOT_JOINABLE|SEAT_TAKEN/);
  });
});

describe("RLS — adversarial", () => {
  let gameId: string;
  let tableId: string;

  beforeAll(async () => {
    ({ gameId, tableId } = await createGame());
    await joinAll(gameId);
  });

  it("a non-participant reads NOTHING: no game, no moves, no players, no chat", async () => {
    await asUser(USERS.outsider, async () => {
      expect(
        (await db.query(`select id from games where id = '${gameId}'`)).rows,
      ).toHaveLength(0);
      expect(
        (await db.query(`select id from moves where game_id = '${gameId}'`))
          .rows,
      ).toHaveLength(0);
      expect(
        (
          await db.query(
            `select seat from game_players where game_id = '${gameId}'`,
          )
        ).rows,
      ).toHaveLength(0);
      expect(
        (
          await db.query(
            `select id from chat_messages where table_id = '${tableId}'`,
          )
        ).rows,
      ).toHaveLength(0);
    });
  });

  it("a participant reads the game; but can NEVER insert into moves", async () => {
    await asUser(USERS.east, async () => {
      expect(
        (await db.query(`select id from games where id = '${gameId}'`)).rows,
      ).toHaveLength(1);
      await expect(
        db.query(
          `insert into moves (game_id, ply, seat, turn, notation)
           values ('${gameId}', 1, 2, '{}'::jsonb, 'HACK')`,
        ),
      ).rejects.toThrow();
    });
  });

  it("clients cannot update game state directly", async () => {
    await asUser(USERS.east, async () => {
      await db.query(
        `update games set current_ply = 999 where id = '${gameId}'`,
      );
    });
    const ply = await db.query<{ current_ply: number }>(
      `select current_ply from games where id = '${gameId}'`,
    );
    expect(ply.rows[0]!.current_ply).not.toBe(999);
  });

  it("team_only chat NEVER leaks across teams", async () => {
    await asUser(USERS.north, async () => {
      await db.query(
        `insert into chat_messages (table_id, game_id, user_id, team_only, body)
         values ('${tableId}', '${gameId}', '${USERS.north}', true, 'secret plan')`,
      );
    });
    await asUser(USERS.south, async () => {
      const rows = await db.query(
        `select body from chat_messages where table_id = '${tableId}' and team_only`,
      );
      expect(rows.rows).toHaveLength(1); // partner sees it
    });
    for (const enemy of [USERS.east, USERS.west]) {
      await asUser(enemy, async () => {
        const rows = await db.query(
          `select body from chat_messages where table_id = '${tableId}' and team_only`,
        );
        expect(rows.rows).toHaveLength(0); // opponents never do
      });
    }
    await asUser(USERS.west, async () => {
      await db.query(
        `insert into chat_messages (table_id, user_id, body)
         values ('${tableId}', '${USERS.west}', 'gl hf')`,
      );
    });
    await asUser(USERS.east, async () => {
      const rows = await db.query(
        `select body from chat_messages where table_id = '${tableId}' and not team_only`,
      );
      expect(rows.rows).toHaveLength(1); // whole-table chat is open
    });
  });

  it("game_actions: user_id spoofing, bogus kinds, and ply forgery all fail", async () => {
    // Spoofing another user's action:
    await asUser(USERS.east, async () => {
      await expect(
        db.query(
          `insert into game_actions (game_id, user_id, kind, ply_at)
           values ('${gameId}', '${USERS.north}', 'draw_propose', 0)`,
        ),
      ).rejects.toThrow();
      // Bogus kind:
      await expect(
        db.query(
          `insert into game_actions (game_id, user_id, kind, ply_at)
           values ('${gameId}', '${USERS.east}', 'declare_victory', 0)`,
        ),
      ).rejects.toThrow();
    });
    // Non-participant can't act at all:
    await asUser(USERS.outsider, async () => {
      await expect(
        db.query(
          `insert into game_actions (game_id, user_id, kind, ply_at)
           values ('${gameId}', '${USERS.outsider}', 'draw_propose', 0)`,
        ),
      ).rejects.toThrow();
    });
    // ply_at forgery is neutralized: the trigger pins it to current_ply.
    await asUser(USERS.east, async () => {
      await db.query(
        `insert into game_actions (game_id, user_id, kind, ply_at)
         values ('${gameId}', '${USERS.east}', 'draw_propose', 2147483647)`,
      );
    });
    const pinned = await db.query<{ ply_at: number }>(
      `select ply_at from game_actions where game_id = '${gameId}' and kind = 'draw_propose'`,
    );
    const currentPly = (
      await db.query<{ current_ply: number }>(
        `select current_ply from games where id = '${gameId}'`,
      )
    ).rows[0]!.current_ply;
    expect(pinned.rows[0]!.ply_at).toBe(currentPly);
  });

  it("clients cannot call submit_turn", async () => {
    await asUser(USERS.north, async () => {
      await expect(
        db.query(
          `select submit_turn('${gameId}'::uuid, 0, 1::smallint, '{}'::jsonb, 'X'::text, '{}'::jsonb, 2::smallint, 'active'::text, null::text, null::text)`,
        ),
      ).rejects.toThrow(/permission denied/i);
    });
  });
});

describe("submit_turn — ordering authority", () => {
  it("racing double-submit: exactly one winner, loser gets TURN_CONFLICT", async () => {
    const { gameId } = await createGame();
    await joinAll(gameId);
    const state = initialState();
    const first = legalMoves(state)[0] as Move;
    const second = legalSecondSubmoves(state, first)[0] as Move;
    const prepared = prepareTurn(
      serializeState(state),
      0,
      1,
      toRef([first, second]),
    );
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;

    await callSubmitTurn(gameId, 0, 1, prepared); // winner
    await expect(callSubmitTurn(gameId, 0, 1, prepared)).rejects.toThrow(
      /TURN_CONFLICT/,
    );
    const rows = await db.query(
      `select ply from moves where game_id = '${gameId}'`,
    );
    expect(rows.rows).toHaveLength(1); // exactly one move row
  });

  it("a scripted full API game equals the engine-only replay", async () => {
    const { gameId } = await createGame();
    await joinAll(gameId);

    let engineState: BoardState = initialState();
    const plies = 12;
    for (let i = 0; i < plies; i++) {
      const seat = engineState.activeSeat as Seat;
      const firsts = legalMoves(engineState);
      const first = firsts[i % firsts.length] as Move;
      let turn;
      let ref: TurnRef;
      if (engineState.ply < 20) {
        const seconds = legalSecondSubmoves(engineState, first);
        const secondMove = seconds[i % seconds.length] as Move;
        turn = { submoves: [first, secondMove] as const };
        ref = toRef([first, secondMove]);
      } else {
        turn = { submoves: [first] as const };
        ref = toRef([first]);
      }

      const row = (
        await db.query<{ state: unknown; current_ply: number }>(
          `select state, current_ply from games where id = '${gameId}'`,
        )
      ).rows[0]!;
      const prepared = prepareTurn(
        JSON.stringify(row.state),
        row.current_ply,
        seat,
        ref,
      );
      expect(prepared.ok, !prepared.ok ? prepared.error : "").toBe(true);
      if (!prepared.ok) return;
      await callSubmitTurn(gameId, row.current_ply, seat, prepared);

      const applied = applyTurn(engineState, turn);
      expect(applied.ok).toBe(true);
      if (!applied.ok) return;
      engineState = applied.state;
    }

    const final = (
      await db.query<{
        state: unknown;
        current_ply: number;
        active_seat: number;
      }>(
        `select state, current_ply, active_seat from games where id = '${gameId}'`,
      )
    ).rows[0]!;
    expect(final.current_ply).toBe(plies);
    expect(final.active_seat).toBe(engineState.activeSeat);
    expect(final.state).toEqual(JSON.parse(serializeState(engineState)));

    const moveRows = await db.query<{ ply: number; notation: string }>(
      `select ply, notation from moves where game_id = '${gameId}' order by ply`,
    );
    expect(moveRows.rows).toHaveLength(plies);
    expect(moveRows.rows[0]!.notation).toContain("&"); // opening turns joined
  });
});
