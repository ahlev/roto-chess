# Observer (Spectator) Role — Design

**Date:** 2026-07-06
**Status:** Draft — awaiting founder review (see Assumptions §2; user was away during brainstorming, so flagged decisions default to the recommendation and are easy to flip before implementation).

## 1. Overview

Add a non-playing **observer** role to online Roto Chess. An invited person may open the same `/join/{code}` link and choose **"Watch as spectator"** instead of a seat. Observers can:

- Watch the board live (realtime updates), follow move history and captures.
- Hear game audio cues (moves, captures, halos — everything except "your turn").
- Use table chat — their messages render grey with an **"(observing)"** suffix on the display name; they never see or post to the Partners (team-only) channel.
- See and be seen: the game room shows a small inline row `Observing: Alice, Bob` (comma-separated, single line).
- **Claim an open seat** while the game is still forming (lobby): tap a flagged open seat, confirm "Take North (N)?", and become a player.
- Find observed games in the dashboard under a distinct **Observer** grouping, separated from games they play in.

## 2. Assumptions (decisions made in founder's absence — confirm or flip)

| # | Decision | Default chosen | Alternative |
|---|----------|----------------|-------------|
| A1 | Scope of observer membership | **Table-scoped** — observer follows the table's whole series, incl. rematches, until they stop watching. Matches table-scoped chat; one row covers the series. | Game-scoped (re-invite per rematch) |
| A2 | Mid-game spectating | **Allowed** — the join link works for `lobby` and `active` games (spectate path only; seats remain lobby-only by nature). | Lobby-only |
| A3 | Observer list semantics | **Membership list** (everyone who joined as observer), not live presence. Supabase presence is unused in the codebase; live "who's watching now" is a future enhancement. | Realtime presence |
| A4 | Leaving | A minimal **"Stop watching"** action (deletes own observer row) so observed tables don't clutter My Games forever. | No leave (forever member) |
| A5 | Chat history rendering | Sender's flag is judged against the **current** seat map: not seated + in observer list → grey "(observing)". A person who later claims a seat will have their older messages re-render as seated. Accepted for V1. | Store role-at-send-time on each message |

## 3. Approaches considered

1. **`table_observers` table + RLS extension (chosen).** New membership table; add an `is_game_observer()` / `is_table_observer()` arm to existing SELECT policies. Observers get full realtime parity for free (Supabase `postgres_changes` respects RLS). Smallest client delta — `useOnlineGame` already models `mySeat: null` as "spectator" (`useOnlineGame.ts:46`).
2. **Game-scoped `game_observers`.** Same mechanics, but membership dies with each game; re-invite friction on every rematch and diverges from table-scoped chat. Only wins if per-game observer history must be exact. Rejected (A1).
3. **Server-mediated reads (service-role API, no RLS change).** No migration, but observers get no realtime events (RLS blocks their subscription), forcing polling; every read gains a bespoke authorization path. Rejected — larger blast radius, worse UX.

## 4. Data model — migration `0003_observers.sql`

```sql
create table table_observers (
  table_id   uuid not null references tables(id) on delete cascade,
  user_id    uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  primary key (table_id, user_id)
);
```

Helpers (mirroring existing style — `security definer stable`, `search_path` pinned):

- `is_table_observer(p_table_id uuid)` — exists row for `auth.uid()`.
- `is_game_observer(p_game_id uuid)` — join `games.table_id` → `table_observers`.

Sanity cap: `join_table_observer` rejects when the table already has **20** observers (`TABLE_FULL_OBSERVERS`).

## 5. RLS changes

RLS on `table_observers` itself:
- SELECT: `is_table_participant(table_id) or is_table_observer(table_id)` (players and fellow observers see the list).
- DELETE: `user_id = auth.uid()` ("Stop watching"). No client INSERT/UPDATE — joining goes through the RPC.

Extend existing SELECT policies with an observer arm:

| Policy | Change |
|--------|--------|
| `tables_select` | `or is_table_observer(id)` |
| `games_select` | `or is_game_observer(id)` |
| `game_players_select` | `or is_game_observer(game_id)` |
| `moves_select` | `or is_game_observer(game_id)` |
| `game_actions_select` | `or is_game_observer(game_id)` (observers see resign/draw proposals happen — part of watching) |
| `chat_select` | `or (is_table_observer(table_id) and not team_only)` — observers **never** read Partners messages; extend the CI leak test |
| `profiles_select` | add two arms: viewer observes a table one of whose games includes `profiles.id` as player, and the mirror (viewer plays a game at a table `profiles.id` observes). Keeps the enumeration guard intact |

`chat_insert`: add `or (is_table_observer(table_id) and not team_only)` — observers may post to The table, never team-only. `game_actions_propose` is **unchanged** (observers cannot nudge, propose draws, etc. — participant-only arm already enforces this).

## 6. RPCs

- **`join_table_observer(p_code text) returns uuid`** (new, `security definer`, grant `authenticated`): resolve code `FOR UPDATE`-free (no seat race); reject unless status in (`lobby`,`active`) → `GAME_NOT_WATCHABLE`; if caller is already a **player** in that game, just return the game id (no observer row — idempotent, mirrors `join_game`'s double-tap handling); upsert observer row (`on conflict do nothing`); enforce cap; return game id.
- **`join_game`** (modified): after a successful seat insert, `delete from table_observers where table_id = v_game.table_id and user_id = auth.uid()` — claiming a seat converts the observer to a player atomically in the same transaction.

## 7. Realtime

- Add `table_observers` to the realtime publication (follow `0002_realtime.sql` pattern).
- `subscribeToGame` (`src/lib/game/realtime.ts`) gains a `postgres_changes` listener on `table_observers` (INSERT + DELETE) → existing doorbell `refetch()`. Chat channel unchanged.

## 8. Client changes

### Join page (`src/app/join/[code]/page.tsx`)
- Stop treating `active` status as stale. Lobby → seat buttons **plus** a "Watch as spectator" button; active → spectate button only ("Game in progress — watch live"); complete/abandoned → existing stale message.
- Spectate tap → auth-gate redirect (same as seats) → `join_table_observer` → `router.push('/app/game/{id}')`.

### `useOnlineGame` (`src/components/game/useOnlineGame.ts`)
- Fetch `table_observers` (+ profiles) alongside seats; expose `observers: { userId, displayName }[]` and `isObserver: boolean` (`mySeat === null && observers.some(me)`).
- The `mySeat: null` branch already disables move interaction; verify tap/confirm paths are inert for observers.

### Game room (`src/app/app/game/[id]/page.tsx`)
- Small one-line row (dim/grey, truncating): `Observing: Alice, Bob` — hidden when empty.
- Observer banner chip ("Observing") replaces the confirm bar area affordances.
- **Claim a seat:** when `isObserver && gameStatus === 'lobby'`, open seats are flagged in the observer view (reuse North/East/South/West naming). Tap → in-app confirm dialog: "Take the North seat? You'll join this game as a player." Confirm → `join_game(joinCode, seat)` → refetch (now seated); `SEAT_TAKEN` → toast "That seat just filled." and refresh the seat flags.
- "Stop watching" (small text action) → delete own row → route to dashboard.

### Chat (`src/components/game/ChatPanel.tsx`)
- New `observers` prop. Sender resolution: seat map first (colored name, unchanged); else observer list → grey (`text-text-dim`) name + `(observing)` suffix; else existing "Player" fallback.
- Observers see only "The table" channel — Partners tab hidden (RLS is the backstop).

### Dashboard (`src/app/app/page.tsx`)
- Second query: `table_observers` for `user_id` → tables → each table's latest game (+ players' profiles).
- New **"Observing"** section for lobby/active observed games; completed observed games render under an **"Observer"** subsection within Completed — visually distinct (grey "Observer" chip on the card) from games played. Observed games are excluded from the "your turn" title-badge count.

### Audio
- Move/capture/halo/evaporation cues derive from turn-list growth in `useGameSounds` — they fire for observers with no change. `your-turn` is gated on `mySeat` and correctly never fires. `chat-receive` tick works via the existing attention bus.

## 9. Error handling & edge cases

- **Stale link states:** `GAME_NOT_WATCHABLE` → join page's stale copy. Observer viewing a game that completes → normal ceremony/end state, game moves to dashboard's Observer-completed grouping.
- **Race — seat fills during confirm dialog:** `join_game` returns `SEAT_TAKEN`; show toast, re-derive open seats from refetched `game_players`.
- **Player also tapping spectate:** RPC returns game id without inserting an observer row (players never appear in the observer list).
- **Rematch:** table-scoped row means the observer's dashboard picks up the new game automatically; game room routes them like any table member.
- **Signed-out visitor:** unchanged auth-gate redirect flow with `?redirect` survival.

## 10. Testing

- **RLS leak tests (CI, alongside the existing team-chat leak test):** observer cannot read `team_only` messages; observer cannot insert `team_only`; non-member still reads nothing; observer of table A reads nothing of table B; profiles enumeration guard holds.
- **RPC tests:** `join_table_observer` idempotency, player-no-op, cap, `GAME_NOT_WATCHABLE`; `join_game` deletes the observer row on claim.
- **Unit:** dashboard bucketing with observer games (incl. exclusion from your-turn badge count); ChatPanel sender-resolution (seated / observer / fallback).
- **E2E (Playwright):** spectate join → watch a move land → post chat (grey + suffix) → claim seat via confirm → becomes player. Existing `hotseat-golden.spec.ts` untouched.

## 11. Out of scope (V1)

- Live presence ("watching now" vs membership) — future; greenfield, no presence used anywhere yet.
- Observer role stamped per chat message (A5 accepted drift).
- Observer-specific invite links (same code serves both roles).
- Spectating completed games as a replay archive.
