# Checkmate victory moment + archive verification

**Date:** 2026-07-04
**Status:** Approved (design)

## Problem

When a game ends, there is no real "victory moment." Hotseat shows a quiet
inline panel plus a *subtle* board ceremony (slow rotation, gold rim, losers
dim); online shows a text `ResultSheet` and — notably — never wires the board
ceremony at all, so it just freezes. Neither names who was mated, the mating
piece, or the game's shape. The founder wants an impactful, playful-but-clear
signal that the game is won, with "clever context about the game," and wants
completed games to reach every participant's Completed history.

## Decisions (from brainstorming)

- **Form:** a prominent animated victory **overlay over the board**, with the
  board ceremony playing behind — AND wire the existing ceremony into the
  online room (currently missing).
- **Context:** **rich** — winner, mated player, mating piece/square, turn count,
  one playful line.
- **Archive:** **verify end-to-end** (online already persists to the shared row;
  no known bug). No schema changes.

## Architecture

### `lib/game/victory.ts` — pure derivation (tested)
```
type VictoryReason = "checkmate" | "stalemate" | "draw" | "resignation" | "abandoned";

interface VictoryContext {
  reason: VictoryReason;
  winningTeam: 1 | 2 | null;      // null = draw/no winner
  winnerLabel: string | null;     // "Red & Blue" | "Black & Gold"
  matedSeat: Seat | null;         // checkmate/resignation
  matedName: string | null;       // "West"
  matingSeat: Seat | null;
  matingName: string | null;      // "North"
  matingPieceName: string | null; // "rook"
  matingSquare: string | null;    // display square, e.g. "B7"
  turns: number;                  // state.ply
  headline: string;               // "The crown is taken."
  detail: string;                 // "North's rook closed the ring on West's king — checkmate on turn 34."
}

function victoryContext(args: {
  reason: VictoryReason;
  winningTeam: 1 | 2 | null;
  turns: readonly Turn[];
  initial?: BoardState;   // default initialState()
}): VictoryContext
```
Derivation, all from existing data (no new DB columns):
- **matingSeat** = mover of the last turn (fold `initial.activeSeat` through
  `turns` with `nextSeat`). **matedSeat** = `nextSeat(matingSeat)`. This also
  fixes the online case where the DB `active_seat` is nulled on complete — we
  recompute from turns, never from the row.
- **matingPiece / matingSquare** = the last submove's piece kind and `to`
  (replay to read the piece as it stood; `formatSquare` for display).
- **turns** = `state.ply` after folding (or `turns.length`, opening-aware —
  use the folded terminal state's `ply`).
- **copy** = `headline` + `detail` chosen by `reason` (see Copy). For
  non-checkmate reasons the piece/square fields are null and copy adapts.

### `components/game/VictoryOverlay.tsx` — presentational (dumb)
Props: `context: VictoryContext`, `actions?: ReactNode`, `tally?: ReactNode`.
Renders an animated card over the board:
- a band in the winners' hues + a crown glyph,
- `headline`, the winner line, the `detail` line,
- `tally` (online series count) if provided,
- `actions` (page-specific buttons),
- a "View the final board" toggle that collapses the card to a slim banner and
  restores on tap.
Choreography: ceremony starts on mate; the card animates in ~700ms later so the
board's reaction reads first. Motion respects `prefers-reduced-motion` (fade
only). No data logic — both surfaces get one look. Structured so a victory
sound can attach later (task #6); none now.

### Wire ceremony into online
`app/game/[id]/page.tsx`: pass `ceremonyWinner={result==="team_13"?1:result==="team_24"?2:null}`
to `RotoBoard`. Machinery (rotation, gold rim, loser-dim) already exists.

### Page wiring
- **Hotseat** (`app/hotseat/page.tsx`): build context from `game.status`
  (matedSeat/winningTeam), `game.turns`; render `<VictoryOverlay>` with the
  existing reset/export as `actions`. Replaces the current inline end panel.
- **Online** (`app/app/game/[id]/page.tsx`): build context from `game.result` +
  `replay.turns` + `game.state`; render `<VictoryOverlay>` with the current
  `ResultSheet` content (series tally → `tally`, buttons → `actions`). Fold
  `ResultSheet` into the overlay rather than keeping two end panels.

## Copy (crown & ring voice, fixed phrasing)

- **checkmate:** headline `"The crown is taken."`; detail
  `"{Mater}'s {piece} closed the ring on {Mated}'s king — checkmate on turn {N}."`;
  winner line `"{winnerLabel} reign."`
- **stalemate / draw:** headline `"The crown stays on the table."`; detail
  `"A draw — all four hands empty."`
- **resignation:** headline `"{winnerLabel} take it."`; detail
  `"{Mated}'s king tips."`
- **abandoned:** headline `"Closed as abandoned."`; detail neutral.

## Archive (verify end-to-end)

Trace the finalize path (`/api/games/[id]/turn` → `submit_turn` RPC writes
`status='complete'`, `result`, `result_reason` on the shared `games` row) and
confirm all four `game_players` join rows surface it under Completed on the
dashboard. Browser-verify a completed game shows in Completed with correct
per-viewer copy ("You took the crown" / "The crown went the other way").
Optionally surface `result_reason` ("· checkmate") on the Completed card if it
reads better. No schema changes.

## Testing

- **Unit** (`test/victory.test.ts`): a constructed one-from-mate position played
  to mate → assert `matedSeat`, `matingSeat`, `matingPieceName`, `matingSquare`,
  `turns`, and the composed `detail`/`headline`. Reuse the engine's
  checkmate fixture style (`checkmate-timing.test.ts`).
- **Visual**: render `VictoryOverlay` with a sample context in a running browser
  (temporary preview) and screenshot; verify the online `ceremonyWinner` wiring
  and the Completed-list path. (Per this session's lesson: build-green ≠ works.)
- typecheck + lint + build.

## Out of scope

- Victory sound (task #6, parked).
- New end-of-game stats beyond the rich line (that was the "Max" option).
- Hardening the dropped-mating-submit finalize gap (archive scope was
  "verify," not "harden").
- Hotseat history (local-only, no accounts — by design).

## Boundaries

- `victory.ts`: derivation only, pure, unit-tested; depends on engine
  (`nextSeat`, `applyTurn`/replay, `formatSquare`).
- `VictoryOverlay`: presentation only; depends on a `VictoryContext` + slots.
- Pages: wiring; own their action buttons.
