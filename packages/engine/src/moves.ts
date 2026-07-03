/**
 * Layer 2 — Move & Turn objects.
 *
 * The TURN is the atomic unit of submission, validation, storage, and
 * notation (§4.2). During the opening (plies 0–19) a turn is two submoves,
 * one on each side of the mover's own Meridian; afterwards it is one.
 *
 * Direction matters materially on a ring: a rook can reach the same square
 * clockwise or counterclockwise, and the two paths differ in blocking, in
 * halo-earning (§6.2's reach-or-pass), and in own-meridian crossing (§6.3).
 * Generated moves therefore carry their full PATH and computed effects; a
 * client submits a compact MoveRef which the authority matches against its
 * own generated legal moves.
 */

import type { Square } from "./geometry.js";

/** Promotion choices (§8.3). */
export type PromotionKind = "Q" | "R" | "B" | "N";

/** Rotational direction along the ring: +1 clockwise, −1 counterclockwise. */
export type RotDir = 1 | -1;

/**
 * A fully-specified single move, as produced by the generators. Includes
 * everything applyMove needs and everything the UI renders (path, effects).
 */
export interface Move {
  from: Square;
  to: Square;
  /**
   * Squares traversed in order, origin excluded, destination included.
   * For knights this is just [to]; for castles, the king's squares.
   */
  path: readonly Square[];
  /** Set when the move captures (the victim's square — differs from `to` only for en passant). */
  captures?: Square;
  /** En passant capture (§8.1)? */
  enPassant?: boolean;
  /** Promotion piece if the move promotes (§5.7, §8.3). */
  promotion?: PromotionKind;
  /** Castling (§8.2), if this move is one. */
  castle?: "kingside" | "queenside";
  /**
   * Rotational disambiguator for file-wise slides and bishop curls when the
   * same destination is reachable both ways with different effect: the
   * direction of the FIRST step along the ring. Undefined for purely radial
   * moves and knight jumps.
   */
  rotDir?: RotDir;
  // ---- computed effects (engine-authored, never client-trusted) ----
  /** The mover earns a halo at move conclusion (§6.2). */
  earnsHalo?: boolean;
  /** The mover evaporates at move conclusion (§6.3). */
  evaporates?: boolean;
  /** The move crosses the mover's own meridian exempt as an Avenger (§6.4). */
  avenger?: boolean;
}

/**
 * A turn: one move after the opening, exactly two during it (§4.2).
 * Never persisted half-complete anywhere in the system.
 */
export interface Turn {
  submoves: readonly [Move] | readonly [Move, Move];
}

/**
 * Compact client-submitted reference to a legal move. The server matches it
 * against its own generated legal set; `rotDir` is required only when two
 * generated moves share (from, to, promotion) and differ in effect.
 */
export interface MoveRef {
  from: Square;
  to: Square;
  promotion?: PromotionKind;
  rotDir?: RotDir;
}

export interface TurnRef {
  submoves: readonly [MoveRef] | readonly [MoveRef, MoveRef];
}

/** Does `move` match `ref` (ignoring rotDir when ref omits it)? */
export function moveMatchesRef(move: Move, ref: MoveRef): boolean {
  return (
    move.from === ref.from &&
    move.to === ref.to &&
    (move.promotion ?? null) === (ref.promotion ?? null) &&
    (ref.rotDir === undefined || move.rotDir === ref.rotDir)
  );
}

/**
 * Two generated moves are effect-identical if applying either yields the
 * same result AND the same record (avenger is state-inert but appears in
 * notation as ^, so it counts — otherwise the † / ^ suffix would depend on
 * which of two merged paths survived dedup).
 */
export function movesEffectIdentical(a: Move, b: Move): boolean {
  return (
    a.from === b.from &&
    a.to === b.to &&
    (a.captures ?? null) === (b.captures ?? null) &&
    (a.enPassant ?? false) === (b.enPassant ?? false) &&
    (a.promotion ?? null) === (b.promotion ?? null) &&
    (a.castle ?? null) === (b.castle ?? null) &&
    (a.earnsHalo ?? false) === (b.earnsHalo ?? false) &&
    (a.evaporates ?? false) === (b.evaporates ?? false) &&
    (a.avenger ?? false) === (b.avenger ?? false)
  );
}
