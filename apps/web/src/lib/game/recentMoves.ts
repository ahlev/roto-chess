/**
 * Between-turns memory: for each of the four seats, the from/to squares of
 * that seat's MOST RECENT move. The board darkens these tiles slightly so a
 * player returning to the table can see, at a glance, what every opponent just
 * did — a quiet trail of the last round, distinct from the bright highlight on
 * the single freshest move.
 *
 * Seats rotate strictly 1 → 2 → 3 → 4 with no mid-game skips (a checkmate,
 * stalemate, resignation, or abandonment ends the game rather than eliminating
 * a single player), so the mover of turn `i` is deterministically
 * `(i mod 4) + 1`. That means the last up-to-four turns already cover every
 * seat's latest move — no re-simulation needed.
 */
import type { Move, Seat, Square, Turn } from "@rotochess/engine";

export interface SeatRecentMove {
  seat: Seat;
  from: Square;
  to: Square;
}

/** Each seat's most recent move (newest turn per seat wins). */
export function recentMovesBySeat(
  turns: readonly Turn[],
): readonly SeatRecentMove[] {
  const out = new Map<Seat, SeatRecentMove>();
  for (let i = turns.length - 1; i >= 0 && out.size < 4; i--) {
    const seat = ((i % 4) + 1) as Seat;
    if (out.has(seat)) continue;
    const turn = turns[i];
    if (!turn) continue;
    // The final submove is where the piece actually came to rest this turn
    // (post-opening there is only one; in the opening we mark the last).
    const sub: Move | undefined = turn.submoves[turn.submoves.length - 1];
    if (!sub) continue;
    out.set(seat, { seat, from: sub.from, to: sub.to });
  }
  return [...out.values()];
}
