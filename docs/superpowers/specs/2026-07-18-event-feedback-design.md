# Event Feedback — halo / evaporation / Avenger visibility (2026-07-18)

Approved by founder (session, 2026-07-18). Follows the §6.4 Avenger correction
(engine 0.2.0): events are rarer and more meaningful; today they are invisible
to everyone except the staging mover, which is how the July tester confusion
started.

## Goal

Every viewer of a game — all four seats and observers, online and hotseat —
sees and understands the three invisible-rule events the moment they happen:

- **Halo earned** (§6.2) — gold bloom ring + caption
- **Evaporation** (§6.3) — dissolve ghost + ash motes + caption
- **Avenger** (§6.4) — NEW meridian-red shockwave on the grave square + red
  trail along the crossing path + dedicated sound cue + caption

## Architecture — derive client-side from the canonical record

No server, schema, or realtime changes. The replayed canonical turn list
(online `useReplayedTurns`; hotseat `game.turns`) already carries per-move
`earnsHalo` / `evaporates` / `avenger` flags for every move (reconstructed
from `*` / `†` / `^` notation online). A new pure helper derives everything:

`apps/web/src/lib/game/turnEvents.ts`

```ts
interface EventGhost { square: Square; kind: PieceKind; seat: Seat }
interface EventCaptionData { key: string; tone: "halo"|"evaporation"|"avenger"; text: string }
interface TurnFeedback {
  bloomSquares: Square[];
  evaporateGhosts: EventGhost[];   // the MOVER's sprite (fixes victim-ghost bug)
  avengerSquares: Square[];
  avengerPaths: (readonly Square[])[];
  captions: EventCaptionData[];
}
turnFeedback(turns: readonly Turn[]): TurnFeedback   // for the LAST turn
```

Internally replays `turns[0..n-2]` to the pre-turn state (the established
client pattern — the captures tray already mechanically replays), so the
mover's piece kind/seat are known even after it evaporated. The fallen piece
an Avenger avenges is named from the engine's initial layout (`initialBoard`).

**Mixed-signal rule** (encoded here, used by visuals, captions, AND sound):
a piece that earns a halo and evaporates on the same move gets NO halo
celebration — the evaporation owns the moment. Caption reads
"…takes the ⟨victim⟩, then evaporates — the meridian claims it."

Both hotseat and online consume this one helper (hotseat drops its
`lastEvents`-based bloom/evaporate wiring and its once-ever halo coach note,
which mis-fired on evaporating captures).

First-load guard: feedback fires only when the turn count grows by exactly
one past a seen-count ref (the `useGameSounds` resync pattern) — no replaying
the last historical move's animation on page load.

## Board effects (RotoBoard)

New optional props, all one-shot keyed like `evaporateSquares`:

- `evaporateGhosts?: readonly EventGhost[]` — when present, dissolve THIS
  sprite instead of the prev-board fallback (which today shows the victim).
  Fallback path stays for callers that pass only squares.
- `avengerSquares?: readonly Square[]` — meridian-red expanding shockwave
  ring (SVG circle, CSS keyframes) on the grave square.
- `avengerPaths?: readonly (readonly Square[])[]` — brief red trail drawn
  along the crossing path (reuses the pending-move path geometry), dash-draw
  then fade.

Keyframes live in globals.css beside the existing evaporate/bloom classes.

## Captions (all viewers)

New `EventCaptions` component near the board on both game surfaces:
transient (~4.5 s fade), `aria-live="polite"`, color-keyed (gold / ash /
meridian-red), stacked when a turn produces multiple events, replaced when
the next turn lands. Secretary voice:

- "North's rook earns its halo — the meridian is open to it, forever."
- "West's bishop crosses its own meridian unhaloed — evaporated."
- "North's knight takes the rook, then evaporates — the meridian claims it."
- "South's knight avenges its fallen pawn — takes the intruder and crosses
  penalty-free."

CoachNotes remains for once-ever tutorial notes; captions are the repeatable
announcer.

## Sound

- New `avenger` cue in the synth registry, fired by `useGameSounds` when the
  last turn contains an avenger move.
- Halo cue gated by the mixed-signal rule: fires only for a submove with
  `earnsHalo && !evaporates`.

## Reduced motion

`profiles.reduced_motion` (today a stored no-op) is applied as
`data-reduced-motion` on the document root by the authed app layout, with a
CSS block mirroring the OS `prefers-reduced-motion` collapse. New event
animations are covered by both gates automatically.

## Testing

- Unit: `turnEvents.test.ts` — halo capture blooms + caption; evaporating
  capture suppresses bloom, ghost = mover sprite, combined caption; quiet
  evaporation; Avenger squares/path/caption naming the fallen piece; empty
  turn → empty feedback; first-load guard behavior is the caller's (page)
  seen-count ref, tested implicitly by helper purity.
- Sound gating covered by extending existing useGameSounds expectations if
  present; otherwise via the helper's flags.
- Full web suite + typecheck stay green. No engine changes.

## Out of scope

Chat announcements, move-list badges (notation already carries * † ^),
observer-specific UI, replay scrubbing of historical events.
