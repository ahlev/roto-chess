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
  type Move,
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
  /** Whether the piece wore an earned halo (§6.2) when it fell. */
  haloed: boolean;
}

/**
 * Fold a turn list (from `initial`, by default the game start) into the
 * ordered record of fallen pieces. Pure; throws on a turn that does not
 * mechanically replay — corrupt records are surfaced loudly, like playGame.
 */
export function fallenPieces(
  turns: readonly Turn[],
  initial: BoardState = initialState(),
  pending: readonly Move[] = [],
): FallenPiece[] {
  const fallen: FallenPiece[] = [];
  let state = initial;
  let mover = initial.activeSeat;
  let ply = initial.ply;

  // Record a fallen piece for one submove, then advance the board past it.
  // `mover`/`ply` are read live from the enclosing fold.
  const record = (move: Move): void => {
    if (move.captures !== undefined) {
      const victim = state.board[move.captures];
      if (victim) {
        fallen.push({
          kind: victim.kind,
          ownerSeat: victim.seat,
          by: mover,
          ply,
          haloed: victim.halo,
        });
      }
    }
    if (move.evaporates) {
      // §6.3: the MOVING piece is the victim; the move completes (including
      // any capture recorded above), then it evaporates.
      const doomed = state.board[move.from];
      if (doomed) {
        fallen.push({
          kind: doomed.kind,
          ownerSeat: doomed.seat,
          by: "evaporated",
          ply,
          haloed: doomed.halo,
        });
      }
    }
    state = applySubmove(state, move);
  };

  for (const turn of turns) {
    for (const move of turn.submoves) record(move);
    mover = nextSeat(mover);
    ply += 1;
  }

  // Staged/pending submoves of the IN-PROGRESS turn (e.g. the opening's first
  // move, already applied to the board's displayState): the piece must fall in
  // the ledger the MOMENT it's taken, not when the whole turn commits. The turn
  // hasn't passed, so `mover`/`ply` still point at the current, in-progress turn.
  for (const move of pending) record(move);

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
  const piece = fallen.haloed ? `haloed ${KIND_NAME[fallen.kind]}` : KIND_NAME[fallen.kind];
  return fallen.by === "evaporated"
    ? `${owner}'s ${piece} — evaporated at the meridian`
    : `${owner}'s ${piece} — taken by ${SEAT_NAME[fallen.by]}`;
}
