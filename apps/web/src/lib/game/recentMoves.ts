/**
 * Between-turns memory: for each of the four seats, the from/to squares of
 * that seat's MOST RECENT turn. The board darkens these tiles slightly so a
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

/**
 * Each seat's most recent TURN, one entry per submove (newest turn per seat
 * wins). After the opening a turn is one move; in the opening rounds it is
 * two — one on each side of the meridian — and BOTH are returned, so the
 * board marks the whole turn rather than only where the second piece landed.
 */
export function recentMovesBySeat(
  turns: readonly Turn[],
): readonly SeatRecentMove[] {
  const out: SeatRecentMove[] = [];
  const seen = new Set<Seat>();
  for (let i = turns.length - 1; i >= 0 && seen.size < 4; i--) {
    const seat = ((i % 4) + 1) as Seat;
    if (seen.has(seat)) continue;
    const turn = turns[i];
    if (!turn) continue;
    const subs: readonly Move[] = turn.submoves;
    if (subs.length === 0) continue;
    seen.add(seat);
    for (const sub of subs) out.push({ seat, from: sub.from, to: sub.to });
  }
  return out;
}
