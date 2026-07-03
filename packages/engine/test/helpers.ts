/**
 * Test fixture helpers — build arbitrary positions declaratively.
 *
 * All four kings are auto-placed at their §2.7 homes unless a king for that
 * seat is given explicitly (isInCheck requires every king to exist).
 */
import {
  SQUARE_COUNT,
  SEATS,
  type Seat,
  type Square,
  parseSquare,
  seatSetup,
  squareOf,
} from "../src/geometry.js";
import {
  type BoardState,
  type EpTarget,
  type Piece,
  type PieceKind,
  STATE_SCHEMA_VERSION,
} from "../src/state.js";
import { type Move } from "../src/moves.js";
import { legalMovesFrom } from "../src/legal.js";

export interface PieceSpec {
  at: string; // display coordinate, e.g. "14C"
  kind: PieceKind;
  seat: Seat;
  halo?: boolean;
  hasMoved?: boolean;
  promoted?: boolean;
  /** Display coordinate of the piece's origin; defaults to `at`. */
  origin?: string;
}

export interface StateSpec {
  pieces: PieceSpec[];
  activeSeat?: Seat;
  /** Completed turns; default 20 (post-opening single-move play). */
  ply?: number;
  epTargets?: EpTarget[];
  avengeableLoss?: [boolean, boolean];
  halfmoveClock?: number;
  /** Extra squares (display coords) whose game-start piece has moved away. */
  startMoved?: string[];
  /** Suppress auto-kings (only for tests that place all kings themselves). */
  noAutoKings?: boolean;
}

export function buildState(spec: StateSpec): BoardState {
  const board: (Piece | null)[] = new Array<Piece | null>(SQUARE_COUNT).fill(
    null,
  );
  const startPieceMoved = new Array<boolean>(SQUARE_COUNT).fill(false);
  const seatsWithKings = new Set<Seat>();

  for (const p of spec.pieces) {
    const sq = parseSquare(p.at);
    const origin = p.origin !== undefined ? parseSquare(p.origin) : sq;
    const hasMoved = p.hasMoved ?? (p.origin !== undefined && origin !== sq);
    if (board[sq]) throw new Error(`Two pieces at ${p.at}`);
    board[sq] = {
      kind: p.kind,
      seat: p.seat,
      halo: p.halo ?? false,
      hasMoved,
      promoted: p.promoted ?? false,
      origin,
    };
    if (p.kind === "K") seatsWithKings.add(p.seat);
    if (hasMoved && !(p.promoted ?? false)) startPieceMoved[origin] = true;
  }

  if (!spec.noAutoKings) {
    for (const seat of SEATS) {
      if (!seatsWithKings.has(seat)) {
        const home = squareOf(seatSetup(seat).kingBack, 3);
        if (board[home]) {
          throw new Error(
            `Auto-king for seat ${seat} collides at its home square; place it explicitly`,
          );
        }
        board[home] = {
          kind: "K",
          seat,
          halo: false,
          hasMoved: false,
          promoted: false,
          origin: home,
        };
      }
    }
  }

  for (const coord of spec.startMoved ?? []) {
    startPieceMoved[parseSquare(coord)] = true;
  }

  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    board,
    activeSeat: spec.activeSeat ?? 1,
    ply: spec.ply ?? 20,
    startPieceMoved,
    epTargets: spec.epTargets ?? [],
    avengeableLoss: spec.avengeableLoss ?? [false, false],
    halfmoveClock: spec.halfmoveClock ?? 0,
    repetition: {},
  };
}

/** Destinations (display coords, sorted) of a piece's legal moves. */
export function destinations(state: BoardState, from: string): string[] {
  return [
    ...new Set(
      legalMovesFrom(state, parseSquare(from)).map((m) => fmt(m.to)),
    ),
  ].sort();
}

/** Find the unique legal move from→to; throws if absent or ambiguous without rotDir. */
export function mv(
  state: BoardState,
  from: string,
  to: string,
  opts?: { rotDir?: 1 | -1; promotion?: "Q" | "R" | "B" | "N" },
): Move {
  const candidates = legalMovesFrom(state, parseSquare(from)).filter(
    (m) =>
      m.to === parseSquare(to) &&
      (opts?.rotDir === undefined || m.rotDir === opts.rotDir) &&
      (opts?.promotion === undefined || m.promotion === opts.promotion),
  );
  if (candidates.length === 0) {
    throw new Error(`No legal move ${from}→${to}`);
  }
  if (candidates.length > 1) {
    throw new Error(
      `Ambiguous move ${from}→${to}: ${candidates.length} candidates (pass rotDir/promotion)`,
    );
  }
  return candidates[0] as Move;
}

import { formatSquare } from "../src/geometry.js";
import { applyTurn, type ApplyTurnResult } from "../src/legal.js";

function fmt(sq: Square): string {
  return formatSquare(sq);
}
export { fmt };

/** Apply a turn built from explicit submoves; throw on rejection. */
export function applyOk(
  state: BoardState,
  submoves: [Move] | [Move, Move],
): Extract<ApplyTurnResult, { ok: true }> {
  const result = applyTurn(state, { submoves });
  if (!result.ok) throw new Error(`applyTurn rejected: ${result.error}`);
  return result;
}

/** Read the piece at a display coordinate. */
export function at(state: BoardState, coord: string): Piece | null {
  return state.board[parseSquare(coord)] ?? null;
}
