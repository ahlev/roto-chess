/**
 * Fallen-piece derivation — who has been taken, and by whom.
 *
 * The game IS initialState + turns (engine layer 4), so the captures tray
 * derives from the same fold: walk each turn's submoves, read the victim
 * off the board BEFORE the submove applies (en passant victims sit on a
 * different square than the destination), and record evaporations as a
 * loss to NOBODY — the meridian claimed that piece (§6.3), not an
 * opponent. Kings never fall (R12), so they never appear here.
 */

import {
  applySubmove,
  initialState,
  nextSeat,
  type BoardState,
  type PieceKind,
  type Seat,
  type Turn,
} from "@rotochess/engine";

export interface FallenPiece {
  /** What fell, as it stood when it fell (a promoted queen falls as a queen). */
  kind: PieceKind;
  /** Whose army lost it. */
  ownerSeat: Seat;
  /** The captor's seat — or the meridian's claim, credited to nobody. */
  by: Seat | "evaporated";
  /** Ply (completed-turn count) at which it fell. */
  ply: number;
}

/**
 * Fold a turn list (from `initial`, by default the game start) into the
 * ordered record of fallen pieces. Pure; throws on a turn that does not
 * mechanically replay — corrupt records are surfaced loudly, like playGame.
 */
export function fallenPieces(
  turns: readonly Turn[],
  initial: BoardState = initialState(),
): FallenPiece[] {
  const fallen: FallenPiece[] = [];
  let state = initial;
  let mover = initial.activeSeat;
  let ply = initial.ply;
  for (const turn of turns) {
    for (const move of turn.submoves) {
      if (move.captures !== undefined) {
        const victim = state.board[move.captures];
        if (victim) {
          fallen.push({
            kind: victim.kind,
            ownerSeat: victim.seat,
            by: mover,
            ply,
          });
        }
      }
      if (move.evaporates) {
        // §6.3: the MOVING piece is the victim; the move completes
        // (including any capture recorded above), then it evaporates.
        const doomed = state.board[move.from];
        if (doomed) {
          fallen.push({
            kind: doomed.kind,
            ownerSeat: doomed.seat,
            by: "evaporated",
            ply,
          });
        }
      }
      state = applySubmove(state, move);
    }
    mover = nextSeat(mover);
    ply += 1;
  }
  return fallen;
}

const SEAT_NAME: Record<Seat, string> = {
  1: "North",
  2: "East",
  3: "South",
  4: "West",
};

const KIND_NAME: Record<PieceKind, string> = {
  K: "king",
  Q: "queen",
  R: "rook",
  B: "bishop",
  N: "knight",
  P: "pawn",
};

/** The ledger line for one fallen piece — tooltip and accessible name. */
export function fallenLabel(fallen: FallenPiece): string {
  const owner = SEAT_NAME[fallen.ownerSeat];
  const piece = KIND_NAME[fallen.kind];
  return fallen.by === "evaporated"
    ? `${owner}'s ${piece} — evaporated at the meridian`
    : `${owner}'s ${piece} — taken by ${SEAT_NAME[fallen.by]}`;
}
