/**
 * Layer 3 — Status: check, checkmate, stalemate, draw detection.
 *
 * THE §7.3 TIMING RULE: it is not checkmate until the threatened player is
 * to move and has no legal turn. Terminal evaluation is therefore a function
 * of (state, state.activeSeat) — run for the NEW active player after every
 * turn, never "did this move deliver mate." A check declared on another
 * player's turn may be resolved on intervening turns.
 */

import { type Seat, type Team, SEATS, teamOf } from "./geometry.js";
import { type BoardState } from "./state.js";
import { hasAnyLegalTurn, isInCheck, positionKey } from "./legal.js";

export type GameStatus =
  | { kind: "active"; inCheck: readonly Seat[] }
  | { kind: "checkmate"; matedSeat: Seat; winningTeam: Team }
  | { kind: "stalemate"; stalematedSeat: Seat };

/**
 * Evaluate the position for the player to move (§7.3, §8.4):
 * - in check with no legal turn → CHECKMATE; the opposing team wins (§1.2)
 * - not in check with no legal turn → STALEMATE, a draw for all four (§8.4)
 * - otherwise active — even if some OTHER player sits in a hopeless check;
 *   their §7.3 moment arrives only when their own turn does.
 *
 * `inCheck` lists every currently-checked seat for UI/banners; only the
 * active seat's check state has rules significance here.
 */
export function evaluateStatus(state: BoardState): GameStatus {
  const seat = state.activeSeat;
  if (!hasAnyLegalTurn(state)) {
    if (isInCheck(state, seat)) {
      const winningTeam: Team = teamOf(seat) === 1 ? 2 : 1;
      return { kind: "checkmate", matedSeat: seat, winningTeam };
    }
    return { kind: "stalemate", stalematedSeat: seat };
  }
  return {
    kind: "active",
    inCheck: SEATS.filter((s) => isInCheck(state, s)),
  };
}

export interface ClaimableDraws {
  /** §8.5 — current position has occurred ≥3 times. Any player may claim. */
  threefold: boolean;
  /** §8.6 — ≥50 player-turns without a pawn move or capture. Any player may claim. */
  fiftyMove: boolean;
}

/**
 * Draws by rule are CLAIMS, not automatic ends (§8.5–8.6 both say "any
 * player may claim"). The engine detects; a player claims; the server
 * verifies by re-running this.
 */
export function claimableDraws(state: BoardState): ClaimableDraws {
  return {
    threefold: (state.repetition[positionKey(state)] ?? 0) >= 3,
    fiftyMove: state.halfmoveClock >= 50,
  };
}
