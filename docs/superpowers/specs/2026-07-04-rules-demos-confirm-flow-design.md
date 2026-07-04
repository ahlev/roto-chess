# Rules page: remove chapter plates, route demos through the real confirm flow

**Date:** 2026-07-04
**Status:** Approved (design)

## Problem

The `/rules` page has two issues:

1. **Weird decorative images.** Each `Section` renders an AI-generated chapter
   plate (`/plates/chapter-*.webp`) above its heading. They read as off, and
   distract from the one thing on the page that IS accurate: the code-drawn,
   engine-true `DemoBoard` schematics.

2. **Interactive demos convey geometry but not consequence.** `DemoBoard` lets
   you tap a piece and see its legal targets (dots + a ghost preview), then
   stops. It never surfaces the *implication* of a move — even though the
   engine already computes it on every `Move` (`evaporates`, `earnsHalo`,
   `avenger`, `captures`). So the §5.2 haloed knight and the §5.3 unhaloed
   knight render identically; only the static caption differs. The §5.4 Avenger
   exemption has no demo at all. Distinct rules look like the same click.

## Approach (chosen)

Reproduce the **real in-game confirm flow** inside the demos. The live
`ConfirmBar` already renders every consequence we need — the amber
"This move evaporates your piece… Move anyway", the "○ earns a Halo" line, and
"Avenger — crosses your meridian penalty-free". Reusing it (not inventing demo
UI) means the rules page and the live game can never drift.

## Changes

### 1. Remove chapter plates
- `Section` (`rules/page.tsx`): delete the `plate?` prop and its `<img>`.
- Drop every `plate="chapter-…"` from the seven `Section` calls.
- Keep all `DemoBoard`s. Leave the unused `.webp` files on disk (no purge).

### 2. `ConfirmBar` gains an `embedded` mode
- Add `embedded?: boolean`. When true, render in-flow (a `relative` bordered
  block) instead of `fixed inset-x-0 bottom-0`. Everything else — the
  consequence lines, seat color, Cancel/Confirm labels, evaporate warning
  palette — is unchanged and shared. Default (`false`) preserves the live game.

### 3. `DemoBoard` becomes a small confirm-flow state machine
State: `idle → selected (targets shown) → confirming (bar open) → resolved
(consequence played)`.
- Tap own-seat piece → select; legal targets light up (unchanged).
- Tap a legal target → open the embedded `ConfirmBar` for that `Move` (no
  auto-ghost-preview jump; the chosen move is the `choice`).
- **Cancel** → back to `selected`.
- **Confirm** → `applySubmove(state, choice)` → render the resulting board with
  the consequence animation driven from the move flags:
  - `evaporates` → `evaporateSquares={[choice.to]}` (piece completes, then is
    removed by the engine — the board shows it gone).
  - `earnsHalo` → `bloomSquares={[choice.to]}` (piece lands haloed).
- Show a **Reset** control in the resolved state → restore the initial demo
  `state`, clear selection.
- Keep the read-only guarantee at the demo boundary: the parent `state` prop is
  the source of truth; internal working state resets on Reset and never
  persists.

### 4. A real §5.4 Avenger demo
- `demoState` already accepts `opts.avengeableLoss: [boolean, boolean]` — no
  builder change needed.
- Construct a position: a team-1 primary piece (e.g. a knight) still on its
  ORIGINAL square, `avengeableLoss: [true, false]`, placed so its penalty-free
  crossing of its own meridian is a legal move. The engine flags
  `move.avenger`; Confirm then shows "Avenger — crosses your meridian
  penalty-free" and the piece crosses and survives.
- Add it under §5.4 with a caption, alongside the existing evap/halo pair.
- Exact squares tuned during implementation until `move.avenger === true` is
  observed for the crossing.

## Boundaries / interfaces

- **`ConfirmBar`**: presentational; `embedded` only swaps positioning classes.
  Consumers: the live game (fixed) and `DemoBoard` (embedded). No behavior fork.
- **`DemoBoard`**: owns its transient flow state; depends on engine
  `legalMovesFrom` + `applySubmove` and on `RotoBoard`'s effect-square props.
  Read-only to the outside (parent `state` never mutated).
- **`demoState`**: unchanged.

## Testing / verification

- `pnpm typecheck && pnpm lint && pnpm build`.
- **Browser smoke test on a running server** (per this session's lesson —
  build-green ≠ works): on `/rules`, for each of the evap / halo / avenger
  demos, tap the piece → tap the crossing target → confirm the bar shows the
  correct consequence line and label, Confirm plays the right animation, Reset
  restores. Confirm no chapter plates remain and every DemoBoard renders.

## Out of scope

- Purging the `.webp` plate files from disk.
- Any change to the live game's confirm flow behavior.
- New rule content — every line still traces to Rulebook v3.1.
