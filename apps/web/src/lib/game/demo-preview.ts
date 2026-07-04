import type { Move } from "@rotochess/engine";

/**
 * When a tapped square has more than one route to it — a rook on the ring can
 * reach the same square the short way OR the long way around — preview the one
 * a player actually intends: never an evaporating loop when a clean route
 * exists, and otherwise the SHORTEST path. Tapping a square two away means the
 * two-square move, not the thirty-square loop that happens to land there and
 * crosses your meridian.
 */
export function bestPreview(moves: readonly Move[]): Move | null {
  let best: Move | null = null;
  let bestScore = Infinity;
  for (const move of moves) {
    const score = (move.evaporates ? 1e6 : 0) + move.path.length;
    if (score < bestScore) {
      best = move;
      bestScore = score;
    }
  }
  return best;
}
