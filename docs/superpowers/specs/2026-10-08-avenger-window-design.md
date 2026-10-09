# Avenger window — avenge only on the victim's next turn (approved 2026-10-08)

## Ruling (founder, 2026-10-08)

Avenging a lost piece must happen on the turn immediately following the loss —
specifically **the victim's own next turn**. It cannot be done in later rounds,
and a partner cannot avenge on the victim's behalf.

Amends R4 (Andrew, 2026-07-18). All three R4 conditions still hold; this adds a
fourth:

1. the avenger has never moved;
2. the move captures;
3. the destination is the grave — the home square of an own-team piece that was
   captured there before it ever moved;
4. **new:** it is the fallen piece's owner's first turn since the loss.

Seats alternate teams (1+3 vs 2+4), so between a loss and the victim's next turn
only the victim's partner and the other opponent move — the capturer never moves
again before the window. If the victim's partner takes the intruder in between,
the grave no longer holds an enemy and nothing is left to avenge.

## Design

**State.** `BoardState.avengeWindows: readonly AvengeWindow[]`, where
`AvengeWindow = { square, victimSeat }`. It is an array because a double-move
opening turn can create two graves.

**Open.** In `applySubmove`: when a capture removes a non-promoted piece that
never moved and is standing on its origin, push `{ square: captures, victimSeat }`.
(An en passant victim has always moved, so en passant never opens a window.)

**Close.** In `applyTurn` bookkeeping: drop every window whose `victimSeat` is
the seat that just moved, whether or not it avenged. A seat cannot lose a piece
by capture on its own turn, so windows opened during the turn always survive.
Both submoves of an opening turn see the window, because closing happens at the
end of the turn.

**Eligibility.** `avengerEligible` = unmoved, non-promoted avenger AND the move
captures AND `avengeWindows` has `{ square: to, victimSeat: piece.seat }`. The
window implies the grave conditions, so the stateless grave check is replaced.

**Repetition.** Windows are part of `positionKey` (sorted), the same way EP targets are.

**Back-compat.** `deserializeState` defaults a missing `avengeWindows` to `[]`, so
live 0.2.0 snapshots keep loading. A grave opened in the last 1–3 plies before the
deploy loses its window. That edge case is accepted.

**Version.** `ENGINE_VERSION` 0.2.0 → 0.3.0. `STATE_SCHEMA_VERSION` stays at 1
because the field is additive and defaulted.

## Surfaces

- Oracle `test/naive.ts`: same fourth condition (reads `state.avengeWindows`).
- Test builders (`test/helpers.ts`, web `demoState`): accept `avengeWindows`.
- Rules page §5.4 copy and demo (the demo seeds an open window); RULINGS.md R4 amendment;
  `rulings.ts` comment.

## Tests

- Avenging on the victim's next turn is penalty-free (window seeded).
- With no window (avenging a round later), the same capture evaporates.
- A partner can no longer avenge (reverses the old partner test).
- Full sequence through `applyTurn`: seat 4 captures seat 1's unmoved piece in place → the window opens →
  seat 1 avenges. Variant: seat 1 plays a different move instead → the window closes and a later attempt evaporates.
- A capture by seat 2 → the window survives seats 3 and 4 and is open on seat 1's turn.
- Opening double-move: the window is visible to the second submove.
- `deserializeState` without the field yields `[]`; `positionKey` differs with/without a window.

## Rollout risk

Replay determinism: a stored game in which someone avenged later than their own
next turn will no longer replay under 0.3.0. Before deploying, scan production
games for avenger moves (`^` in the record) and check each one against the window.
