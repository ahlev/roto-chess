# Observer (Spectator) Role Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Invited users can watch a Roto Chess game live without taking a seat — chat (grey, "(observing)"), audio cues, move history, a visible observer list, dashboard "Observer" sections, and a confirm-gated path to claim an open seat.

**Architecture:** A new table-scoped `table_observers` membership table plus an "or is an observer" arm on every existing SELECT policy. Because Supabase realtime respects RLS, observers then receive live events with no new data paths. The client already models `mySeat: null` as a spectator; UI work is additive.

**Tech Stack:** Next.js 15 App Router, Supabase (Postgres RLS + realtime doorbells), `@rotochess/engine` workspace package, Vitest + PGlite (real migrations, stubbed auth), Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-07-06-observer-role-design.md`

## Global Constraints

- Monorepo root is `app/`; the web app is `apps/web`. Run commands from `apps/web` (`pnpm test`, `pnpm typecheck`) or root (`pnpm -C apps/web test`).
- There is NO lint script; the verification pair is `pnpm typecheck` + `pnpm test`.
- No new npm dependencies.
- Migrations are append-only files in `apps/web/supabase/migrations/`; the PGlite harness (`test/db.test.ts`) executes them verbatim and must keep passing. Guard any `alter publication` in a `do $$ ... $$` block exactly like `0002_realtime.sql` (the publication doesn't exist in PGlite).
- Copy voice: cozy club language ("The table wobbled. Try again.", "seats are warm"), never raw enums. Grey/dim text is `text-text-dim`; mono font is `var(--font-plex-mono)`; serif is `var(--font-instrument-serif)`.
- Security invariants that must survive: non-members read nothing; `team_only` chat never leaks outside the team (now: nor to observers); clients never INSERT into `moves`; profiles are not enumerable by strangers.
- Observers can never: submit turns, propose/confirm game actions, post `team_only` chat, appear in the Partners channel.
- Seat labels: 1=North(N), 2=East(E), 3=South(S), 4=West(W). Observer cap per table: 20.
- Error codes are SCREAMING_SNAKE exceptions surfaced via `rpcError.message.includes(...)` (pattern: `join/[code]/page.tsx:88-102`).
- Commit after every task; messages follow the existing `feat:`/`test:`/`docs:` convention.

---

### Task 1: Database — `0003_observers.sql` + adversarial RLS tests

**Files:**
- Create: `apps/web/supabase/migrations/0003_observers.sql`
- Modify: `apps/web/test/db.test.ts` (harness loads 0003; new `USERS`; new describe block)

**Interfaces:**
- Consumes: `0001_init.sql` schema (`tables`, `games`, `game_players`, `chat_messages`, helpers `is_table_participant`, `is_game_participant`, RPCs `join_game`, `preview_game`).
- Produces (later tasks rely on these exact names):
  - table `table_observers(table_id uuid, user_id uuid, created_at timestamptz)` PK `(table_id, user_id)`
  - functions `is_table_observer(p_table_id uuid) returns boolean`, `is_game_observer(p_game_id uuid) returns boolean`
  - RPC `join_table_observer(p_code text) returns uuid` — errors `NOT_AUTHENTICATED`, `GAME_NOT_WATCHABLE`, `TABLE_FULL_OBSERVERS`
  - `join_game` now deletes the caller's `table_observers` row on a successful seat claim
  - observers may SELECT `games`/`game_players`/`moves`/`game_actions`/`tables`, non-`team_only` `chat_messages`; may INSERT non-`team_only` chat; may DELETE their own `table_observers` row

- [ ] **Step 1: Point the harness at both migrations and add test users**

In `apps/web/test/db.test.ts`, extend `USERS` (line 38):

```ts
const USERS = {
  north: "00000000-0000-4000-8000-000000000001",
  east: "00000000-0000-4000-8000-000000000002",
  south: "00000000-0000-4000-8000-000000000003",
  west: "00000000-0000-4000-8000-000000000004",
  outsider: "00000000-0000-4000-8000-000000000099",
  watcher: "00000000-0000-4000-8000-000000000010",
  watcher2: "00000000-0000-4000-8000-000000000011",
} as const;
```

Replace the single-migration load (lines 73–78) with a loop over both files, keeping the grants AFTER the loop so `table_observers` is covered:

```ts
  // --- the real migrations, verbatim, in order ---
  for (const file of ["0001_init.sql", "0003_observers.sql"]) {
    const migration = readFileSync(
      join(__dirname, `../supabase/migrations/${file}`),
      "utf8",
    );
    await runSql(migration);
  }
```

(`0002_realtime.sql` stays excluded — publication-only, guarded, nothing to test.)

- [ ] **Step 2: Write the failing tests**

Append this describe block at the end of `apps/web/test/db.test.ts`. It uses the existing `asUser`, `createGame`, `joinAll` helpers verbatim.

```ts
describe("observer role", () => {
  let gameId: string;
  let tableId: string;
  let code: string;

  const joinCodeOf = async (id: string) =>
    (
      await db.query<{ join_code: string }>(
        `select join_code from games where id = $1`,
        [id],
      )
    ).rows[0]!.join_code;

  beforeAll(async () => {
    ({ gameId, tableId } = await createGame());
    await joinAll(gameId); // four seats filled → status 'active'
    code = await joinCodeOf(gameId);
    await asUser(USERS.watcher, async () => {
      await db.query(`select join_table_observer($1)`, [code]);
    });
  });

  it("join_table_observer admits a watcher to an ACTIVE game, idempotently", async () => {
    await asUser(USERS.watcher, async () => {
      // Second call is a no-op, not an error.
      const res = await db.query<{ join_table_observer: string }>(
        `select join_table_observer($1)`,
        [code],
      );
      expect(res.rows[0]!.join_table_observer).toBe(gameId);
    });
    const rows = await db.query(
      `select user_id from table_observers where table_id = '${tableId}'`,
    );
    expect(rows.rows).toHaveLength(1);
  });

  it("a seated player calling join_table_observer gets the game id and NO observer row", async () => {
    await asUser(USERS.east, async () => {
      const res = await db.query<{ join_table_observer: string }>(
        `select join_table_observer($1)`,
        [code],
      );
      expect(res.rows[0]!.join_table_observer).toBe(gameId);
    });
    const rows = await db.query(
      `select user_id from table_observers
       where table_id = '${tableId}' and user_id = '${USERS.east}'`,
    );
    expect(rows.rows).toHaveLength(0);
  });

  it("an observer reads the game, seats, moves, and table — a stranger still reads nothing", async () => {
    await asUser(USERS.watcher, async () => {
      expect(
        (await db.query(`select id from games where id = '${gameId}'`)).rows,
      ).toHaveLength(1);
      expect(
        (
          await db.query(
            `select seat from game_players where game_id = '${gameId}'`,
          )
        ).rows,
      ).toHaveLength(4);
      expect(
        (await db.query(`select id from tables where id = '${tableId}'`)).rows,
      ).toHaveLength(1);
      // moves may be empty (no turns yet) — the point is no RLS error and
      // visibility is proven by games/game_players above.
    });
    await asUser(USERS.outsider, async () => {
      expect(
        (await db.query(`select id from games where id = '${gameId}'`)).rows,
      ).toHaveLength(0);
      expect(
        (
          await db.query(
            `select user_id from table_observers where table_id = '${tableId}'`,
          )
        ).rows,
      ).toHaveLength(0);
    });
  });

  it("observers and players can read each other's profiles", async () => {
    await asUser(USERS.watcher, async () => {
      expect(
        (
          await db.query(
            `select id from profiles where id = '${USERS.north}'`,
          )
        ).rows,
      ).toHaveLength(1);
    });
    await asUser(USERS.north, async () => {
      expect(
        (
          await db.query(
            `select id from profiles where id = '${USERS.watcher}'`,
          )
        ).rows,
      ).toHaveLength(1);
    });
    // Strangers still can't enumerate.
    await asUser(USERS.outsider, async () => {
      expect(
        (
          await db.query(
            `select id from profiles where id = '${USERS.watcher}'`,
          )
        ).rows,
      ).toHaveLength(0);
    });
  });

  it("an observer reads table chat but team_only NEVER leaks to observers", async () => {
    await asUser(USERS.north, async () => {
      await db.query(
        `insert into chat_messages (table_id, game_id, user_id, team_only, body)
         values ('${tableId}', '${gameId}', '${USERS.north}', true, 'observer-proof secret')`,
      );
      await db.query(
        `insert into chat_messages (table_id, user_id, body)
         values ('${tableId}', '${USERS.north}', 'hello everyone')`,
      );
    });
    await asUser(USERS.watcher, async () => {
      const open = await db.query(
        `select body from chat_messages where table_id = '${tableId}' and not team_only`,
      );
      expect(open.rows.length).toBeGreaterThanOrEqual(1);
      const secret = await db.query(
        `select body from chat_messages where table_id = '${tableId}' and team_only`,
      );
      expect(secret.rows).toHaveLength(0);
    });
  });

  it("an observer can post to the table channel but NOT team_only", async () => {
    await asUser(USERS.watcher, async () => {
      await db.query(
        `insert into chat_messages (table_id, user_id, body)
         values ('${tableId}', '${USERS.watcher}', 'great move!')`,
      );
      await expect(
        db.query(
          `insert into chat_messages (table_id, game_id, user_id, team_only, body)
           values ('${tableId}', '${gameId}', '${USERS.watcher}', true, 'sneaking in')`,
        ),
      ).rejects.toThrow();
    });
  });

  it("an observer cannot insert game_actions", async () => {
    await asUser(USERS.watcher, async () => {
      await expect(
        db.query(
          `insert into game_actions (game_id, user_id, kind, ply_at)
           values ('${gameId}', '${USERS.watcher}', 'draw_propose', 0)`,
        ),
      ).rejects.toThrow();
    });
  });

  it("claiming a seat via join_game deletes the observer row", async () => {
    // A fresh LOBBY game: creator seated at 1, seats 2-4 open.
    const fresh = await createGame();
    const freshCode = await joinCodeOf(fresh.gameId);
    await asUser(USERS.watcher2, async () => {
      await db.query(`select join_table_observer($1)`, [freshCode]);
      const seen = await db.query(
        `select user_id from table_observers where table_id = '${fresh.tableId}'`,
      );
      expect(seen.rows).toHaveLength(1);
      await db.query(`select join_game($1, 3::smallint)`, [freshCode]);
    });
    const after = await db.query(
      `select user_id from table_observers where table_id = '${fresh.tableId}'`,
    );
    expect(after.rows).toHaveLength(0);
    const seated = await db.query(
      `select seat from game_players
       where game_id = '${fresh.gameId}' and user_id = '${USERS.watcher2}'`,
    );
    expect(seated.rows).toEqual([{ seat: 3 }]);
  });

  it("an observer can stop watching; deleting someone ELSE's row is a silent no-op", async () => {
    await asUser(USERS.watcher2, async () => {
      await db.query(
        `delete from table_observers where table_id = '${tableId}' and user_id = '${USERS.watcher}'`,
      );
    });
    expect(
      (
        await db.query(
          `select user_id from table_observers
           where table_id = '${tableId}' and user_id = '${USERS.watcher}'`,
        )
      ).rows,
    ).toHaveLength(1); // untouched — RLS delete is own-row only
    await asUser(USERS.watcher, async () => {
      await db.query(
        `delete from table_observers where table_id = '${tableId}' and user_id = '${USERS.watcher}'`,
      );
    });
    expect(
      (
        await db.query(
          `select user_id from table_observers where table_id = '${tableId}'`,
        )
      ).rows,
    ).toHaveLength(0);
  });

  it("a completed game is not watchable", async () => {
    const done = await createGame();
    const doneCode = await joinCodeOf(done.gameId);
    await db.query(
      `update games set status = 'complete', result = 'draw' where id = $1`,
      [done.gameId],
    );
    await asUser(USERS.watcher, async () => {
      await expect(
        db.query(`select join_table_observer($1)`, [doneCode]),
      ).rejects.toThrow(/GAME_NOT_WATCHABLE/);
    });
  });

  it("the 21st observer is refused", async () => {
    const packed = await createGame();
    const packedCode = await joinCodeOf(packed.gameId);
    // Service-context: seed 20 observers (auth.users + profiles first — FKs).
    for (let i = 0; i < 20; i++) {
      const uid = `00000000-0000-4000-9000-0000000000${String(i).padStart(2, "0")}`;
      await db.query(`insert into auth.users (id) values ($1)`, [uid]);
      await db.query(
        `insert into profiles (id, display_name) values ($1, $2)`,
        [uid, `crowd-${i}`],
      );
      await db.query(
        `insert into table_observers (table_id, user_id) values ($1, $2)`,
        [packed.tableId, uid],
      );
    }
    await asUser(USERS.watcher, async () => {
      await expect(
        db.query(`select join_table_observer($1)`, [packedCode]),
      ).rejects.toThrow(/TABLE_FULL_OBSERVERS/);
    });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm -C apps/web test -- db` (or from `apps/web`: `pnpm test -- db`)
Expected: FAIL — beforeAll throws reading `0003_observers.sql` (file does not exist). All pre-existing db tests still listed.

- [ ] **Step 4: Write the migration**

Create `apps/web/supabase/migrations/0003_observers.sql`:

```sql
-- ---------------------------------------------------------------------------
-- Observers (spectators) — table-scoped membership. An observer follows the
-- TABLE's whole series (rematches included) until they stop watching or
-- claim a seat. Read access rides the same RLS helpers pattern as players;
-- realtime respects RLS, so observers get live doorbells for free.
-- ---------------------------------------------------------------------------
create table table_observers (
  table_id   uuid not null references tables(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (table_id, user_id)
);
create index table_observers_user_idx on table_observers (user_id);

alter table table_observers enable row level security;

create or replace function is_table_observer(p_table_id uuid)
returns boolean language sql security definer stable
set search_path = public, pg_temp as $$
  select exists (
    select 1 from table_observers
    where table_id = p_table_id and user_id = auth.uid()
  );
$$;

create or replace function is_game_observer(p_game_id uuid)
returns boolean language sql security definer stable
set search_path = public, pg_temp as $$
  select exists (
    select 1
    from table_observers o
    join games g on g.table_id = o.table_id
    where g.id = p_game_id and o.user_id = auth.uid()
  );
$$;

-- Players and fellow observers can see who's watching; only you can leave.
-- No client INSERT/UPDATE — joining goes through join_table_observer.
create policy table_observers_select on table_observers
  for select to authenticated
  using (is_table_participant(table_id) or is_table_observer(table_id));
create policy table_observers_delete_own on table_observers
  for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Extend the read policies: everything a participant may watch, an observer
-- may watch — EXCEPT team_only chat, which stays strictly inside the team.
-- ---------------------------------------------------------------------------
drop policy tables_select on tables;
create policy tables_select on tables
  for select to authenticated
  using (is_table_participant(id) or is_table_observer(id));

drop policy games_select on games;
create policy games_select on games
  for select to authenticated
  using (is_game_participant(id) or is_game_observer(id));

drop policy game_players_select on game_players;
create policy game_players_select on game_players
  for select to authenticated
  using (is_game_participant(game_id) or is_game_observer(game_id));

drop policy moves_select on moves;
create policy moves_select on moves
  for select to authenticated
  using (is_game_participant(game_id) or is_game_observer(game_id));

drop policy game_actions_select on game_actions;
create policy game_actions_select on game_actions
  for select to authenticated
  using (is_game_participant(game_id) or is_game_observer(game_id));
-- game_actions_propose is untouched: observers cannot act, only watch.

drop policy chat_select on chat_messages;
create policy chat_select on chat_messages
  for select to authenticated
  using (
    (
      is_table_participant(table_id)
      and (
        not team_only
        or exists (
          -- Team scoping is judged in the game the message anchors to (seats
          -- can rotate between games in a series). A specific leak test in CI
          -- guards this policy.
          select 1
          from game_players me
          join game_players sender
            on sender.game_id = me.game_id and sender.user_id = chat_messages.user_id
          where me.game_id = chat_messages.game_id
            and me.user_id = auth.uid()
            and me.team = sender.team
        )
      )
    )
    -- Observers hear the table, never the partners' line.
    or (is_table_observer(table_id) and not team_only)
  );

drop policy chat_insert on chat_messages;
create policy chat_insert on chat_messages
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and (
      is_table_participant(table_id)
      or (is_table_observer(table_id) and not team_only)
    )
    -- A move anchor must reference a game of THIS table (thread integrity;
    -- also keeps team_only routing inside the right seat map).
    and (
      game_id is null
      or exists (
        select 1 from games g
        where g.id = game_id and g.table_id = chat_messages.table_id
      )
    )
  );

-- Profiles: players and observers of the same table see each other's names
-- (both directions), and observers see fellow observers. The enumeration
-- guard stands — strangers still resolve nothing.
drop policy profiles_select on profiles;
create policy profiles_select on profiles
  for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from game_players me
      join game_players them on them.game_id = me.game_id
      where me.user_id = auth.uid() and them.user_id = profiles.id
    )
    or exists (
      select 1
      from table_observers o
      join games g on g.table_id = o.table_id
      join game_players gp on gp.game_id = g.id
      where (o.user_id = auth.uid() and gp.user_id = profiles.id)
         or (gp.user_id = auth.uid() and o.user_id = profiles.id)
    )
    or exists (
      select 1
      from table_observers me
      join table_observers them on them.table_id = me.table_id
      where me.user_id = auth.uid() and them.user_id = profiles.id
    )
  );

-- ---------------------------------------------------------------------------
-- join_table_observer — spectate via the same unguessable code. Watchable
-- while the game is forming or live; a seated player just gets the game id.
-- ---------------------------------------------------------------------------
create or replace function join_table_observer(p_code text)
returns uuid language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_game games%rowtype;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select * into v_game from games where join_code = upper(p_code);
  if not found or v_game.status not in ('lobby', 'active') then
    raise exception 'GAME_NOT_WATCHABLE';
  end if;

  -- Players never double as observers — hand back the game.
  if exists (
    select 1 from game_players
    where game_id = v_game.id and user_id = auth.uid()
  ) then
    return v_game.id;
  end if;

  -- Sanity cap; idempotent re-joins pass through.
  if not exists (
    select 1 from table_observers
    where table_id = v_game.table_id and user_id = auth.uid()
  ) and (
    select count(*) from table_observers where table_id = v_game.table_id
  ) >= 20 then
    raise exception 'TABLE_FULL_OBSERVERS';
  end if;

  insert into table_observers (table_id, user_id)
  values (v_game.table_id, auth.uid())
  on conflict do nothing;

  return v_game.id;
end $$;

grant execute on function join_table_observer to authenticated;

-- ---------------------------------------------------------------------------
-- join_game — unchanged except: claiming a seat converts an observer into a
-- player atomically (delete the observer row in the same transaction).
-- ---------------------------------------------------------------------------
create or replace function join_game(p_code text, p_seat smallint)
returns uuid language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_game games%rowtype;
  v_inserted int;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if p_seat is null or p_seat < 1 or p_seat > 4 then
    raise exception 'BAD_SEAT';
  end if;

  -- FOR UPDATE serializes concurrent joiners of the same game: without it,
  -- seats 3 and 4 landing simultaneously can each count three players and
  -- neither activates — a permanent lobby wedge.
  select * into v_game from games where join_code = upper(p_code) for update;
  if not found or v_game.status <> 'lobby' then
    raise exception 'GAME_NOT_JOINABLE';
  end if;

  -- Idempotent for a user who is already seated (second tab, double-tap):
  -- just hand back the game instead of a misleading SEAT_TAKEN.
  if exists (
    select 1 from game_players
    where game_id = v_game.id and user_id = auth.uid()
  ) then
    return v_game.id;
  end if;

  insert into game_players (game_id, seat, user_id)
  values (v_game.id, p_seat, auth.uid())
  on conflict do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    raise exception 'SEAT_TAKEN';
  end if;

  -- An observer who takes a seat is a player now — one transaction, no limbo.
  delete from table_observers
   where table_id = v_game.table_id and user_id = auth.uid();

  -- Fourth seat fills → the game goes live; seat 1 opens (engine initial).
  if (select count(*) from game_players where game_id = v_game.id) = 4 then
    update games
       set status = 'active', active_seat = 1, last_move_at = now()
     where id = v_game.id and status = 'lobby';
  end if;

  return v_game.id;
end $$;

grant execute on function join_game to authenticated;

-- Realtime doorbell for the observers row (guarded: the publication does not
-- exist on plain Postgres/PGlite).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table table_observers;
  end if;
end $$;
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm -C apps/web test -- db`
Expected: PASS — all new "observer role" tests AND every pre-existing db test (join_game race, RLS adversarial, team_only leak, deletion cascade, submit_turn).

- [ ] **Step 6: Run the full suite + typecheck**

Run: `pnpm -C apps/web test && pnpm -C apps/web typecheck`
Expected: PASS, no type errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/supabase/migrations/0003_observers.sql apps/web/test/db.test.ts
git commit -m "feat(db): table_observers membership, observer RLS arms, join_table_observer RPC"
```

---

### Task 2: Join page — "Watch as spectator" (and live games stop being stale)

**Files:**
- Create: `apps/web/src/lib/game/joinView.ts`
- Create: `apps/web/test/joinView.test.ts`
- Modify: `apps/web/src/app/join/[code]/page.tsx`

**Interfaces:**
- Consumes: RPC `join_table_observer(p_code)` (Task 1); existing `preview_game` returns `{ table_name, taken_seats, game_status }`.
- Produces: `joinView(status: string | null, takenSeats: number[]): { openSeats: Seat[]; canSpectate: boolean; stale: boolean }` in `@/lib/game/joinView`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/joinView.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { joinView } from "../src/lib/game/joinView";

describe("joinView", () => {
  it("lobby: open seats are claimable and spectating is offered", () => {
    expect(joinView("lobby", [1, 3])).toEqual({
      openSeats: [2, 4],
      canSpectate: true,
      stale: false,
    });
  });

  it("active: no seats, but the game is watchable", () => {
    expect(joinView("active", [1, 2, 3, 4])).toEqual({
      openSeats: [],
      canSpectate: true,
      stale: false,
    });
  });

  it("complete/abandoned/unknown: stale", () => {
    for (const status of ["complete", "abandoned", "dormant", null]) {
      expect(joinView(status, [])).toEqual({
        openSeats: [],
        canSpectate: false,
        stale: true,
      });
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C apps/web test -- joinView`
Expected: FAIL — cannot resolve `../src/lib/game/joinView`.

- [ ] **Step 3: Implement the helper**

Create `apps/web/src/lib/game/joinView.ts`:

```ts
/**
 * What a /join/{code} visitor may do, derived from the preview. Seats are
 * claimable only while the game is forming; watching is offered while it is
 * forming OR live; anything else is a stale code.
 */
import type { Seat } from "@rotochess/engine";

export interface JoinViewState {
  openSeats: Seat[];
  canSpectate: boolean;
  stale: boolean;
}

export function joinView(
  status: string | null,
  takenSeats: number[],
): JoinViewState {
  if (status === "lobby") {
    return {
      openSeats: ([1, 2, 3, 4] as const).filter(
        (s) => !takenSeats.includes(s),
      ),
      canSpectate: true,
      stale: false,
    };
  }
  if (status === "active") {
    return { openSeats: [], canSpectate: true, stale: false };
  }
  return { openSeats: [], canSpectate: false, stale: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -C apps/web test -- joinView`
Expected: PASS (3 tests).

- [ ] **Step 5: Wire the join page**

In `apps/web/src/app/join/[code]/page.tsx`:

(a) Add the import:

```ts
import { joinView } from "@/lib/game/joinView";
```

(b) Add state after `openSeats` (line 30):

```ts
  const [canSpectate, setCanSpectate] = useState(false);
  const [liveGame, setLiveGame] = useState(false);
```

(c) Replace the preview handling (the body of the `.then(({ data }) => { ... })` at lines 45–64) with:

```ts
        const row = (
          data as Array<{
            table_name: string;
            taken_seats: number[];
            game_status: string;
          }> | null
        )?.[0];
        const view = joinView(row?.game_status ?? null, row?.taken_seats ?? []);
        if (view.stale) {
          setStale(true);
          setOpenSeats([]);
          return;
        }
        setTableName(row?.table_name ?? null);
        setOpenSeats(view.openSeats);
        setCanSpectate(view.canSpectate);
        setLiveGame(row?.game_status === "active");
```

(d) Add a `watch` handler after `take` (after line 104), mirroring its shape:

```ts
  const watch = async () => {
    if (!signedIn) {
      router.push(`/login?redirect=${encodeURIComponent(`/join/${code}`)}`);
      return;
    }
    setBusy(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc(
      "join_table_observer",
      { p_code: code },
    );
    if (rpcError) {
      setError(
        rpcError.message.includes("GAME_NOT_WATCHABLE")
          ? "This game isn't open to watchers — the code may be stale."
          : rpcError.message.includes("TABLE_FULL_OBSERVERS")
            ? "The rail is crowded — no more watchers fit at this table."
            : "The table wobbled. Try again.",
      );
      setBusy(false);
      return;
    }
    router.push(`/app/game/${data as string}`);
  };
```

(e) In the JSX, replace the "All four seats are warm." block (lines 153–157) and add the spectate button directly after the seat grid (`</div>` at line 152):

```tsx
      {liveGame && (
        <p className="pb-2 text-center text-sm text-text-dim">
          The game is under way. There's room at the rail.
        </p>
      )}
      {canSpectate && (
        <button
          type="button"
          data-testid="join-spectate"
          disabled={busy || signedIn === null}
          onClick={() => void watch()}
          className="mt-2 min-h-11 w-full rounded-lg border border-dashed border-line p-3 text-sm text-text-dim hover:bg-surface-raised disabled:opacity-50"
        >
          Watch as spectator
        </button>
      )}
```

(The old "All four seats are warm." copy is superseded: a full lobby now offers the rail instead of a dead end.)

- [ ] **Step 6: Verify**

Run: `pnpm -C apps/web test && pnpm -C apps/web typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/game/joinView.ts apps/web/test/joinView.test.ts "apps/web/src/app/join/[code]/page.tsx"
git commit -m "feat(join): spectator option on the join page; live games watchable"
```

---

### Task 3: Client data — observers in `useOnlineGame` + realtime doorbell

**Files:**
- Create: `apps/web/src/lib/game/observers.ts`
- Create: `apps/web/test/observers.test.ts`
- Modify: `apps/web/src/lib/game/realtime.ts`
- Modify: `apps/web/src/components/game/useOnlineGame.ts`

**Interfaces:**
- Consumes: `table_observers` SELECT + realtime publication (Task 1).
- Produces (Tasks 4–6 rely on these):
  - `ObserverInfo { userId: string; displayName: string }` and `resolveViewerRole(mySeat: Seat | null, myUserId: string | null, observers: ObserverInfo[]): "player" | "observer" | "none"` in `@/lib/game/observers`
  - `subscribeToObservers(supabase, tableId, onChange): RealtimeChannel` in `@/lib/game/realtime`
  - `OnlineGame` gains `observers: ObserverInfo[]` and `isObserver: boolean`

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/observers.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { resolveViewerRole } from "../src/lib/game/observers";

const obs = [{ userId: "u-watch", displayName: "Ava" }];

describe("resolveViewerRole", () => {
  it("a seat always wins — even if a stale observer row lingers", () => {
    expect(resolveViewerRole(2, "u-watch", obs)).toBe("player");
  });
  it("no seat + membership row → observer", () => {
    expect(resolveViewerRole(null, "u-watch", obs)).toBe("observer");
  });
  it("no seat + no membership → none (loading, or not yet admitted)", () => {
    expect(resolveViewerRole(null, "u-else", obs)).toBe("none");
    expect(resolveViewerRole(null, null, obs)).toBe("none");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C apps/web test -- observers`
Expected: FAIL — cannot resolve `../src/lib/game/observers`.

- [ ] **Step 3: Implement the module**

Create `apps/web/src/lib/game/observers.ts`:

```ts
/**
 * Observer (spectator) membership — table-scoped: an observer follows the
 * table's whole series until they stop watching or claim a seat.
 */
import type { Seat } from "@rotochess/engine";

export interface ObserverInfo {
  userId: string;
  displayName: string;
}

export type ViewerRole = "player" | "observer" | "none";

export function resolveViewerRole(
  mySeat: Seat | null,
  myUserId: string | null,
  observers: ObserverInfo[],
): ViewerRole {
  if (mySeat !== null) return "player";
  if (myUserId !== null && observers.some((o) => o.userId === myUserId)) {
    return "observer";
  }
  return "none";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -C apps/web test -- observers`
Expected: PASS (3 tests).

- [ ] **Step 5: Add the realtime subscription**

Append to `apps/web/src/lib/game/realtime.ts`:

```ts
/**
 * Observer-list doorbell. INSERTs filter server-side; DELETE payloads carry
 * only the old primary key and Supabase does not apply filters to them, so
 * we match table_id client-side. Either way it's the same answer: refetch.
 */
export function subscribeToObservers(
  supabase: SupabaseClient,
  tableId: string,
  onChange: () => void,
): RealtimeChannel {
  return supabase
    .channel(`observers:${tableId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "table_observers",
        filter: `table_id=eq.${tableId}`,
      },
      () => onChange(),
    )
    .on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "table_observers" },
      (payload) => {
        const old = payload.old as { table_id?: string };
        if (!old.table_id || old.table_id === tableId) onChange();
      },
    )
    .subscribe();
}
```

- [ ] **Step 6: Extend `useOnlineGame`**

In `apps/web/src/components/game/useOnlineGame.ts`:

(a) Imports — extend the realtime import and add the observers module:

```ts
import { subscribeToGame, subscribeToObservers } from "@/lib/game/realtime";
import {
  resolveViewerRole,
  type ObserverInfo,
} from "@/lib/game/observers";
```

(b) In the `OnlineGame` interface, after `mySeat: Seat | null;` (line 47):

```ts
  /** Everyone watching this table (membership, not live presence). */
  observers: ObserverInfo[];
  /** True when the signed-in viewer is a spectator, not a seat. */
  isObserver: boolean;
```

(c) State, after `const [seats, setSeats] = ...` (line 95):

```ts
  const [observers, setObservers] = useState<ObserverInfo[]>([]);
```

(d) In `refetch`, after the `game_actions` fetch (`setActions(...)`, line 158):

```ts
      const { data: watcherRows } = await supabase
        .from("table_observers")
        .select("user_id, profiles(display_name)")
        .eq("table_id", (game as { table_id: string }).table_id)
        .order("created_at");
      setObservers(
        (
          (watcherRows ?? []) as unknown as Array<{
            user_id: string;
            profiles: { display_name: string | null } | null;
          }>
        ).map((o) => ({
          userId: o.user_id,
          displayName: o.profiles?.display_name ?? "Guest",
        })),
      );
```

(e) A second doorbell effect, after the existing subscription effect (line 223):

```ts
  // Observer-list doorbell — separate channel because it's keyed by table,
  // not game (the table id only becomes known after the first fetch).
  useEffect(() => {
    if (!supabase || !row?.table_id) return;
    const channel = subscribeToObservers(supabase, row.table_id, () =>
      void refetch(),
    );
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, row?.table_id, refetch]);
```

(f) Derivation, after the `mySeat` memo (line 228):

```ts
  const isObserver =
    resolveViewerRole(mySeat, myUserId, observers) === "observer";
```

(g) Return object — after `mySeat,`:

```ts
    observers,
    isObserver,
```

- [ ] **Step 7: Verify**

Run: `pnpm -C apps/web test && pnpm -C apps/web typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/lib/game/observers.ts apps/web/test/observers.test.ts apps/web/src/lib/game/realtime.ts apps/web/src/components/game/useOnlineGame.ts
git commit -m "feat(client): observer membership in useOnlineGame with realtime doorbell"
```

---

### Task 4: Game room — observing row, observer chip, claim-a-seat confirm, stop watching

**Files:**
- Create: `apps/web/src/components/game/ObserverRail.tsx`
- Modify: `apps/web/src/app/app/game/[id]/page.tsx`

**Interfaces:**
- Consumes: `game.observers`, `game.isObserver` (Task 3); `game.joinCode`; RPC `join_game(p_code, p_seat)`; `browserClient()`.
- Produces: `<ObserverRail observers isObserver tableId myUserId />` (the one-line CSV row + "stop watching"); `<ClaimSeatButtons />` (internal to the page).

- [ ] **Step 1: Build the ObserverRail component**

Create `apps/web/src/components/game/ObserverRail.tsx`:

```tsx
"use client";

/**
 * The rail — who's watching, one quiet line: "Observing: Ava, Ben". For the
 * observer themself it also carries "stop watching" (deletes their own
 * membership row — RLS allows exactly that and nothing more).
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/lib/supabase/client";
import type { ObserverInfo } from "@/lib/game/observers";

export function ObserverRail({
  observers,
  isObserver,
  tableId,
  myUserId,
}: {
  observers: ObserverInfo[];
  isObserver: boolean;
  tableId: string | null;
  myUserId: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (observers.length === 0) return null;

  const stopWatching = async () => {
    const supabase = browserClient();
    if (!supabase || !tableId || !myUserId || busy) return;
    setBusy(true);
    await supabase
      .from("table_observers")
      .delete()
      .eq("table_id", tableId)
      .eq("user_id", myUserId);
    router.push("/app");
  };

  return (
    <p
      data-testid="observer-rail"
      className="truncate px-1 pt-1.5 text-center text-[11px] text-text-dim"
    >
      Observing: {observers.map((o) => o.displayName).join(", ")}
      {isObserver && (
        <>
          {" · "}
          <button
            type="button"
            onClick={() => void stopWatching()}
            disabled={busy}
            className="underline decoration-dotted underline-offset-2 hover:text-text"
          >
            stop watching
          </button>
        </>
      )}
    </p>
  );
}
```

- [ ] **Step 2: Wire the game room page**

In `apps/web/src/app/app/game/[id]/page.tsx`:

(a) Imports:

```ts
import { ObserverRail } from "@/components/game/ObserverRail";
import { SEAT_COMPASS } from "@rotochess/engine"; // add to the existing engine import list
import { browserClient } from "@/lib/supabase/client"; // already imported — reuse
```

(SEAT_COMPASS joins the existing `import { gameToRotoPgn, ... } from "@rotochess/engine"` list; `browserClient` is already imported at line 34 — do not duplicate.)

(b) **Lobby branch** (`if (game.gameStatus === "lobby")`, lines 190–236): after the `<SeatPlaques ... />` wrapper `</div>` (line 213), add:

```tsx
        <ObserverRail
          observers={game.observers}
          isObserver={game.isObserver}
          tableId={game.tableId}
          myUserId={game.myUserId}
        />
        {game.isObserver && <ClaimSeatButtons game={game} />}
```

And make the invite panel honest for watchers — the existing block stays for players; observers see the claim buttons instead. Change the seated count line (lines 229–232) to:

```tsx
          <p className="mt-2 text-xs text-text-dim">
            {game.seats.length}/4 seated — the game opens when the table is
            full.{game.isObserver ? " You're watching from the rail." : ""}
          </p>
```

(c) **Live/game-over branch**: after `<SeatPlaques ... />` (line 247), add:

```tsx
      <ObserverRail
        observers={game.observers}
        isObserver={game.isObserver}
        tableId={game.tableId}
        myUserId={game.myUserId}
      />
```

(d) Observer chip in the status row — inside the status `<p>` (line 250-270), prefix when observing. Replace `{isMyTurn ? (` with:

```tsx
          {game.isObserver && (
            <span className="mr-2 inline-block rounded-full border border-line px-2 py-0.5 text-[10px] uppercase tracking-wide text-text-dim">
              Observing
            </span>
          )}
          {isMyTurn ? (
```

(e) Gate the ConfirmBar to seats (observers never confirm; belt-and-braces over the hook's own guards). Change line 382 from `{game.state && (` to:

```tsx
      {game.state && game.mySeat !== null && (
```

(f) Add the claim-seat component at the bottom of the file (module scope, after `HistoryPane`):

```tsx
/**
 * The observer's path to a chair: open seats are flagged; tapping one asks
 * for explicit confirmation before join_game locks it in. SEAT_TAKEN mid-
 * dialog is survivable — the doorbell refetch redraws the open seats.
 */
function ClaimSeatButtons({
  game,
}: {
  game: ReturnType<typeof useOnlineGame>;
}) {
  const [confirmSeat, setConfirmSeat] = useState<Seat | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const openSeats = ([1, 2, 3, 4] as const).filter(
    (s) => !game.seats.some((p) => p.seat === s),
  );
  if (openSeats.length === 0) return null;

  const claim = async (seat: Seat) => {
    const supabase = browserClient();
    if (!supabase || !game.joinCode || busy) return;
    setBusy(true);
    setNote(null);
    const { error } = await supabase.rpc("join_game", {
      p_code: game.joinCode,
      p_seat: seat,
    });
    setBusy(false);
    setConfirmSeat(null);
    if (error) {
      setNote(
        error.message.includes("SEAT_TAKEN")
          ? "That seat just filled. Pick another."
          : error.message.includes("GAME_NOT_JOINABLE")
            ? "The table isn't seating anymore."
            : "The table wobbled. Try again.",
      );
    }
    void game.refetch();
  };

  return (
    <div className="mt-3 rounded-lg border border-dashed border-line p-3">
      <p className="pb-2 text-center text-xs text-text-dim">
        A seat is open — you could play this one.
      </p>
      {note && (
        <p className="pb-2 text-center text-xs text-[color:var(--danger)]">
          {note}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        {openSeats.map((seat) => (
          <button
            key={seat}
            type="button"
            data-testid={`claim-seat-${seat}`}
            disabled={busy}
            onClick={() => setConfirmSeat(seat)}
            className="min-h-11 rounded-lg border border-line p-2 text-sm text-text hover:bg-surface-raised disabled:opacity-50"
          >
            Take {SEAT_NAME[seat]} ({SEAT_COMPASS[seat]})
          </button>
        ))}
      </div>
      {confirmSeat !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Take a seat"
          onClick={() => setConfirmSeat(null)}
        >
          <div
            className="w-full max-w-sm rounded-lg border border-line bg-surface-raised p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <p
              className="text-lg text-text"
              style={{ fontFamily: "var(--font-instrument-serif)" }}
            >
              Take the {SEAT_NAME[confirmSeat]} seat?
            </p>
            <p className="mt-1 text-sm text-text-dim">
              You'll join this game as a player — the seat locks in when you
              confirm, and you leave the rail.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmSeat(null)}
                disabled={busy}
                className="rounded-full border border-line px-4 py-2 text-sm text-text-dim"
              >
                Keep watching
              </button>
              <button
                type="button"
                data-testid="claim-seat-confirm"
                onClick={() => void claim(confirmSeat)}
                disabled={busy}
                className="rounded-full bg-[color:var(--focus-ring)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)]"
              >
                {busy ? "Taking the seat…" : `Take ${SEAT_NAME[confirmSeat]}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

Note: the lobby's "RLS admits only participants" comment (page lines 204–206) is now half-true — update it to:

```tsx
          {/* RLS admits participants AND observers to this page. Seated
              players see empty plaques as invitations for the LINK; an
              observer additionally gets tap-to-claim buttons below. */}
```

- [ ] **Step 3: Verify**

Run: `pnpm -C apps/web test && pnpm -C apps/web typecheck`
Expected: PASS. (Audio needs no change: move/capture cues derive from the shared turn list; `your-turn` is gated on `mySeat` and never fires for observers.)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/game/ObserverRail.tsx "apps/web/src/app/app/game/[id]/page.tsx"
git commit -m "feat(game-room): observer rail, observing chip, confirm-gated seat claiming"
```

---

### Task 5: Chat — grey "(observing)" flag on spectator messages

**Files:**
- Create: `apps/web/src/lib/game/chatSender.ts`
- Create: `apps/web/test/chatSender.test.ts`
- Modify: `apps/web/src/components/game/ChatPanel.tsx`
- Modify: `apps/web/src/app/app/game/[id]/page.tsx` (pass the prop)

**Interfaces:**
- Consumes: `ObserverInfo` (Task 3); `PlaqueSeat` from `SeatPlaques`.
- Produces: `resolveSender(userId: string, seats: { seat: Seat; userId: string }[], observers: ObserverInfo[]): { seat: Seat | null; observing: boolean }` in `@/lib/game/chatSender`; `ChatPanelProps` gains `observers?: ObserverInfo[]`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/chatSender.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { resolveSender } from "../src/lib/game/chatSender";

const seats = [
  { seat: 1 as const, userId: "u-north" },
  { seat: 3 as const, userId: "u-south" },
];
const observers = [{ userId: "u-watch", displayName: "Ava" }];

describe("resolveSender", () => {
  it("a seated sender gets their seat and no observer flag", () => {
    expect(resolveSender("u-north", seats, observers)).toEqual({
      seat: 1,
      observing: false,
    });
  });
  it("an observer gets the flag and no seat", () => {
    expect(resolveSender("u-watch", seats, observers)).toEqual({
      seat: null,
      observing: true,
    });
  });
  it("a seat wins over a stale observer row", () => {
    expect(
      resolveSender(
        "u-north",
        seats,
        [{ userId: "u-north", displayName: "N" }],
      ),
    ).toEqual({ seat: 1, observing: false });
  });
  it("an unknown sender (departed member) gets neither", () => {
    expect(resolveSender("u-ghost", seats, observers)).toEqual({
      seat: null,
      observing: false,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C apps/web test -- chatSender`
Expected: FAIL — cannot resolve `../src/lib/game/chatSender`.

- [ ] **Step 3: Implement the helper**

Create `apps/web/src/lib/game/chatSender.ts`:

```ts
/**
 * Who is talking in chat: a seat (colored name), an observer (grey +
 * "(observing)"), or neither (a departed member — grey, unflagged). Judged
 * against the CURRENT seat map: someone who later claims a seat re-renders
 * seated (accepted V1 drift — see the design doc, assumption A5).
 */
import type { Seat } from "@rotochess/engine";
import type { ObserverInfo } from "@/lib/game/observers";

export interface ChatSender {
  seat: Seat | null;
  observing: boolean;
}

export function resolveSender(
  userId: string,
  seats: ReadonlyArray<{ seat: Seat; userId: string }>,
  observers: ReadonlyArray<ObserverInfo>,
): ChatSender {
  const seat = seats.find((s) => s.userId === userId)?.seat ?? null;
  if (seat !== null) return { seat, observing: false };
  return { seat: null, observing: observers.some((o) => o.userId === userId) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -C apps/web test -- chatSender`
Expected: PASS (4 tests).

- [ ] **Step 5: Wire ChatPanel**

In `apps/web/src/components/game/ChatPanel.tsx`:

(a) Imports:

```ts
import { resolveSender } from "@/lib/game/chatSender";
import type { ObserverInfo } from "@/lib/game/observers";
```

(b) `ChatPanelProps` — after `mySeat?: Seat | null;` (line 55):

```ts
  /** Watchers at this table — greys + flags their messages. */
  observers?: ObserverInfo[];
```

(c) Destructure with default — after `mySeat = null,` (line 74):

```ts
  observers = [],
```

(d) Replace the sender rendering inside `visibleRows.map` (lines 394–407). Old:

```tsx
            {visibleRows.map((row) => {
              const senderSeat =
                seats.find((s) => s.userId === row.user_id)?.seat ?? null;
              return (
                <div key={row.id} className="min-w-0 break-words">
                  <span
                    className={`font-semibold ${
                      senderSeat !== null
                        ? SEAT_TEXT[senderSeat]
                        : "text-text-dim"
                    }`}
                  >
                    {row.displayName}
                  </span>{" "}
```

New:

```tsx
            {visibleRows.map((row) => {
              const sender = resolveSender(row.user_id, seats, observers);
              return (
                <div key={row.id} className="min-w-0 break-words">
                  <span
                    className={`font-semibold ${
                      sender.seat !== null
                        ? SEAT_TEXT[sender.seat]
                        : "text-text-dim"
                    }`}
                  >
                    {row.displayName}
                    {sender.observing && (
                      <span className="font-normal text-text-dim">
                        {" "}
                        (observing)
                      </span>
                    )}
                  </span>{" "}
```

(No other change in the map body — the anchor button and message span stay as they are. The Partners tab is already hidden for observers: `mySeat = null` → `partnerSeat = null` → `partnersAvailable = false`.)

(e) In `apps/web/src/app/app/game/[id]/page.tsx`, pass the prop to `<ChatPanel ...>` (line 371-378):

```tsx
            observers={game.observers}
```

- [ ] **Step 6: Verify**

Run: `pnpm -C apps/web test && pnpm -C apps/web typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/game/chatSender.ts apps/web/test/chatSender.test.ts apps/web/src/components/game/ChatPanel.tsx "apps/web/src/app/app/game/[id]/page.tsx"
git commit -m "feat(chat): observer messages grey-flagged with (observing)"
```

---

### Task 6: Dashboard — "Observing" section + Observer-flagged completed games

**Files:**
- Create: `apps/web/src/lib/game/dashboardBuckets.ts`
- Create: `apps/web/test/dashboardBuckets.test.ts`
- Modify: `apps/web/src/app/app/page.tsx`

**Interfaces:**
- Consumes: `table_observers` SELECT (Task 1).
- Produces: `bucketGames<T extends Bucketable>(rows: T[]): { yourTurn: T[]; waiting: T[]; settingUp: T[]; finished: T[]; observing: T[]; observedFinished: T[] }` where `Bucketable = { status: string; active_seat: number | null; mySeat: number | null; role: "player" | "observer"; last_move_at: string | null }`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/dashboardBuckets.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { bucketGames } from "../src/lib/game/dashboardBuckets";

const g = (
  over: Partial<{
    status: string;
    active_seat: number | null;
    mySeat: number | null;
    role: "player" | "observer";
    last_move_at: string | null;
  }>,
) => ({
  status: "active",
  active_seat: 1,
  mySeat: 1,
  role: "player" as const,
  last_move_at: null,
  ...over,
});

describe("bucketGames", () => {
  it("player games bucket exactly as before", () => {
    const rows = [
      g({ status: "lobby" }),
      g({ status: "active", active_seat: 1, mySeat: 1 }),
      g({ status: "active", active_seat: 2, mySeat: 1 }),
      g({ status: "complete" }),
    ];
    const b = bucketGames(rows);
    expect(b.settingUp).toHaveLength(1);
    expect(b.yourTurn).toHaveLength(1);
    expect(b.waiting).toHaveLength(1);
    expect(b.finished).toHaveLength(1);
    expect(b.observing).toHaveLength(0);
    expect(b.observedFinished).toHaveLength(0);
  });

  it("observed games land in their own buckets and NEVER in yourTurn", () => {
    const rows = [
      g({ role: "observer", mySeat: null, status: "active", active_seat: 1 }),
      g({ role: "observer", mySeat: null, status: "lobby" }),
      g({ role: "observer", mySeat: null, status: "complete" }),
    ];
    const b = bucketGames(rows);
    expect(b.observing).toHaveLength(2); // lobby + active both "observing"
    expect(b.observedFinished).toHaveLength(1);
    expect(b.yourTurn).toHaveLength(0);
    expect(b.waiting).toHaveLength(0);
    expect(b.settingUp).toHaveLength(0);
    expect(b.finished).toHaveLength(0);
  });

  it("yourTurn sorts oldest wait first; waiting most recent first", () => {
    const b = bucketGames([
      g({ active_seat: 1, mySeat: 1, last_move_at: "2026-07-02" }),
      g({ active_seat: 1, mySeat: 1, last_move_at: "2026-07-01" }),
      g({ active_seat: 2, mySeat: 1, last_move_at: "2026-07-01" }),
      g({ active_seat: 2, mySeat: 1, last_move_at: "2026-07-02" }),
    ]);
    expect(b.yourTurn.map((r) => r.last_move_at)).toEqual([
      "2026-07-01",
      "2026-07-02",
    ]);
    expect(b.waiting.map((r) => r.last_move_at)).toEqual([
      "2026-07-02",
      "2026-07-01",
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C apps/web test -- dashboardBuckets`
Expected: FAIL — cannot resolve `../src/lib/game/dashboardBuckets`.

- [ ] **Step 3: Implement (extraction of the page's bucketing + observer buckets)**

Create `apps/web/src/lib/game/dashboardBuckets.ts`:

```ts
/**
 * Dashboard sections. Player games: Your turn → Waiting → Draft → Completed
 * (extracted verbatim from the page so it's testable). Observed games get
 * their own shelves — watching is never "your turn", and finished observed
 * games are archived apart from games you played.
 */
export interface Bucketable {
  status: string;
  active_seat: number | null;
  mySeat: number | null;
  role: "player" | "observer";
  last_move_at: string | null;
}

export interface Buckets<T> {
  yourTurn: T[];
  waiting: T[];
  settingUp: T[];
  finished: T[];
  observing: T[];
  observedFinished: T[];
}

export function bucketGames<T extends Bucketable>(rows: T[]): Buckets<T> {
  const yourTurn: T[] = [];
  const waiting: T[] = [];
  const settingUp: T[] = [];
  const finished: T[] = [];
  const observing: T[] = [];
  const observedFinished: T[] = [];
  for (const row of rows) {
    if (row.role === "observer") {
      if (row.status === "lobby" || row.status === "active") observing.push(row);
      else observedFinished.push(row);
    } else if (row.status === "lobby") settingUp.push(row);
    else if (row.status === "active" && row.active_seat === row.mySeat)
      yourTurn.push(row);
    else if (row.status === "active") waiting.push(row);
    else finished.push(row);
  }
  // Your turn: oldest wait first; waiting/observing: most recent activity first.
  yourTurn.sort((a, b) =>
    (a.last_move_at ?? "").localeCompare(b.last_move_at ?? ""),
  );
  waiting.sort((a, b) =>
    (b.last_move_at ?? "").localeCompare(a.last_move_at ?? ""),
  );
  observing.sort((a, b) =>
    (b.last_move_at ?? "").localeCompare(a.last_move_at ?? ""),
  );
  return { yourTurn, waiting, settingUp, finished, observing, observedFinished };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -C apps/web test -- dashboardBuckets`
Expected: PASS (3 tests).

- [ ] **Step 5: Wire the dashboard page**

In `apps/web/src/app/app/page.tsx`:

(a) Import:

```ts
import { bucketGames } from "@/lib/game/dashboardBuckets";
```

(b) `CardRow` (lines 26–45): change `mySeat: Seat;` to `mySeat: Seat | null;` and add:

```ts
  /** Whether the viewer plays this game or watches it from the rail. */
  role: "player" | "observer";
```

(c) In `load`, tag player rows — in the `.map((r) => ({ ... }))` (lines 101–113) add:

```ts
      role: "player" as const,
```

(d) Still in `load`, after the player `base` array is built (line 113), fetch observed games and merge:

```ts
    // Observed tables: every episode of a table I watch gets a card, shelved
    // apart from games I play. (A claimed seat deletes the observer row, so
    // a game never appears twice.)
    const { data: watchRows } = await supabase
      .from("table_observers")
      .select("table_id")
      .eq("user_id", user.id);
    const watchedTableIds = (watchRows ?? []).map(
      (w) => (w as { table_id: string }).table_id,
    );
    if (watchedTableIds.length > 0) {
      const { data: watchedGames } = await supabase
        .from("games")
        .select(
          "id, status, active_seat, state, last_move_at, result, result_reason, created_by, created_at, tables(name)",
        )
        .in("table_id", watchedTableIds);
      for (const gRow of (watchedGames ?? []) as unknown as Array<{
        id: string;
        status: string;
        active_seat: number | null;
        state: unknown;
        last_move_at: string | null;
        result: string | null;
        result_reason: string | null;
        created_by: string | null;
        created_at: string | null;
        tables: { name: string } | null;
      }>) {
        base.push({
          id: gRow.id,
          status: gRow.status,
          active_seat: gRow.active_seat,
          state: gRow.state,
          last_move_at: gRow.last_move_at,
          mySeat: null,
          tableName: gRow.tables?.name ?? "A table",
          result: gRow.result,
          resultReason: gRow.result_reason,
          createdBy: gRow.created_by,
          startedAt: gRow.created_at,
          role: "observer" as const,
        });
      }
    }
```

(`base` must therefore be declared with an explicit type: change `const base = (...)` to `const base: Array<Omit<CardRow, "participants" | "ownerName">> = (...)` so the observer push typechecks.)

(e) Replace the `sections` memo (lines 173–193) with the extracted function:

```ts
  const sections = useMemo(() => bucketGames(rows ?? []), [rows]);
```

(f) Add the two sections to the JSX after `<Section title="Completed" ... />` (line 277-282):

```tsx
          <Section
            title="Observing"
            rows={sections.observing}
            myUserId={myUserId}
            onDeleted={load}
          />
          <Section
            title="Observer · finished"
            rows={sections.observedFinished}
            myUserId={myUserId}
            onDeleted={load}
          />
```

(The title badge needs no change — it already counts only `sections.yourTurn`, and observed games can never land there.)

(g) Replace `cardStatus` (lines 367–385) in full — observer role first, and the player branch narrows `mySeat` once (`role === "player"` implies a seat):

```ts
/** Viewer-relative status copy — never a raw enum like "team_13". */
function cardStatus(row: CardRow): string {
  if (row.role === "observer") {
    if (row.status === "lobby") return "Watching — seats still filling";
    if (row.status === "active") return "Watching from the rail";
    if (row.status === "dormant") return "Watched — dormant";
    if (row.status === "abandoned") return "Watched — closed as abandoned";
    if (!row.result) return "Watched — finished";
    const reason = row.resultReason
      ? REASON_LABEL[row.resultReason]
      : undefined;
    const tail = reason ? ` · ${reason}` : "";
    if (row.result === "draw") return `Watched — drawn${tail}`;
    const winner = row.result === "team_13" ? "Red & Blue" : "Black & Gold";
    return `Watched — ${winner} took the crown${tail}`;
  }
  const mySeat = row.mySeat as Seat; // players always have a seat
  if (row.status === "lobby") return "Waiting for seats";
  if (row.status === "active") {
    return row.active_seat === mySeat
      ? "Your move. The table is watching."
      : "Another seat is thinking";
  }
  if (row.status === "dormant") return "Dormant — resumable";
  if (row.status === "abandoned") return "Closed as abandoned";
  if (!row.result) return "Finished";
  const reason = row.resultReason ? REASON_LABEL[row.resultReason] : undefined;
  const tail = reason ? ` · ${reason}` : "";
  if (row.result === "draw") return `Drawn${tail}`;
  const myTeam = ((mySeat - 1) % 2) + 1;
  const winnerTeam = row.result === "team_13" ? 1 : 2;
  const verdict =
    myTeam === winnerTeam ? "You took the crown" : "The crown went the other way";
  return `${verdict}${tail}`;
}
```

(h) `GameCard`: board orientation (line 417) becomes `orientation={row.mySeat ?? 1}`, and add a grey chip next to the table name (line 424):

```tsx
          <p className="truncate text-sm text-text">
            {row.tableName}
            {row.role === "observer" && (
              <span className="ml-1.5 rounded-full border border-line px-1.5 py-0.5 align-middle text-[9px] uppercase tracking-wide text-text-dim">
                Observer
              </span>
            )}
          </p>
```

(i) Participants second pass: include observed game ids so player names render on observer cards — the `ids` list (line 118) already derives from `base` AFTER the observer merge if step (d) pushed before it. **Ensure the observer merge happens before `const ids = base.map((c) => c.id);`.**

- [ ] **Step 6: Verify**

Run: `pnpm -C apps/web test && pnpm -C apps/web typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/game/dashboardBuckets.ts apps/web/test/dashboardBuckets.test.ts apps/web/src/app/app/page.tsx
git commit -m "feat(dashboard): Observing shelf and Observer-flagged finished games"
```

---

### Task 7: Full verification + founder go-live note

**Files:**
- Modify: `../Founder-Admin-Actions.md` (one level above the repo, at `C:\Users\ahlev\OneDrive\Desktop\CLAUDE\Roto Chess\Founder-Admin-Actions.md`)

- [ ] **Step 1: Full suite, typecheck, production build**

Run from `apps/web`: `pnpm test && pnpm typecheck && pnpm build`
Expected: all tests pass (db suite incl. 11 observer tests, joinView, observers, chatSender, dashboardBuckets, plus all pre-existing), no type errors, build succeeds.

- [ ] **Step 2: Verify the e2e suite still passes (hotseat is untouched)**

Run from `apps/web`: `pnpm test:e2e`
Expected: `hotseat-golden.spec.ts` and `demo-mode.spec.ts` pass unchanged. (No online-multiplayer e2e harness exists; live spectate flow is verified on the deployed environment per Step 3's founder note.)

- [ ] **Step 3: Append the go-live action**

Add to `Founder-Admin-Actions.md` under open items:

```markdown
- **Apply migration `0003_observers.sql` to the live Supabase project** (observer/spectator feature). Run it in the SQL editor or `supabase db push`, then verify on production: (1) a signed-in non-player opening a `/join/{code}` link can "Watch as spectator" on a lobby AND an active game; (2) the observer receives live moves + chat; (3) the observer does NOT see the Partners channel or its messages; (4) claiming an open seat converts them to a player and empties their rail entry.
```

- [ ] **Step 4: Final commit + push**

```bash
git add -A
git commit -m "chore: observer role — final verification pass" --allow-empty
git push origin main
```

(If nothing is left unstaged, the `--allow-empty` commit marks the verified checkpoint; skip it if the team prefers no empty commits — pushing the task commits is what matters.)
