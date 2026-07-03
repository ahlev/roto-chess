/**
 * Layer 1 — BoardState.
 *
 * Immutable snapshot of a game in progress. Everything the rules need to
 * decide legality and everything §8.5 threefold repetition needs in its
 * position key lives here: placement with halo flags, has-moved tracking,
 * whose turn, en passant target, draw counters, and the Avenger rule's
 * capture memory. JSON-serializable as-is (the storage snapshot format).
 */

import {
  FILE_COUNT,
  MERIDIAN_CW_START,
  RANK_COUNT,
  SQUARE_COUNT,
  SEATS,
  type Seat,
  type Square,
  type Team,
  formatSquare,
  seatSetup,
  squareOf,
} from "./geometry.js";

export const ENGINE_VERSION = "0.1.0";
export const STATE_SCHEMA_VERSION = 1;

export type PieceKind = "K" | "Q" | "R" | "B" | "N" | "P";

/** Rooks, bishops, knights — subject to the halo restriction (§6.2). */
export function isPrimary(kind: PieceKind): boolean {
  return kind === "R" || kind === "B" || kind === "N";
}

export interface Piece {
  readonly kind: PieceKind;
  readonly seat: Seat;
  /** Halo earned (§6.2) — persists for the rest of the game. */
  readonly halo: boolean;
  /** Has this piece moved at least once? (Castling §8.2.3, Avenger §6.4.) */
  readonly hasMoved: boolean;
  /** Result of promotion (§8.3)? Promoted pieces are always haloed. */
  readonly promoted: boolean;
  /**
   * The square this piece began the game on (or, for a promoted piece, the
   * square it promoted on). With hasMoved, this powers the Avenger rule's
   * both-on-start-squares conditions.
   */
  readonly origin: Square;
}

/** En passant window (§8.1; four-player wrinkles per ruling R5). */
export interface EpTarget {
  /** The square passed over — where the capture lands. */
  readonly square: Square;
  /** The double-stepped pawn's current square. */
  readonly pawnSquare: Square;
  /** Seat that made the double step. */
  readonly bySeat: Seat;
  /** Ply (completed-turn count) at which the double step was made. */
  readonly createdAtPly: number;
}

export interface BoardState {
  schemaVersion: typeof STATE_SCHEMA_VERSION;
  /** 128 entries, rank-major (square id = index). */
  board: readonly (Piece | null)[];
  /** Whose turn it is. The engine owns this; the DB copy is denormalized. */
  activeSeat: Seat;
  /** Completed turns. Opening phase (§4.2) = ply < 20 (5 rounds × 4 seats). */
  ply: number;
  /**
   * Per-square: has the piece that STARTED the game on this square ever
   * moved? Stays false if that piece was captured in place — the distinction
   * ruling R6 needs for kingside castling ("moved away" ≠ "captured away").
   *
   * GUARD: update ONLY for non-promoted pieces (`!piece.promoted`). A
   * promoted piece's `origin` is its promotion square — on some other seat's
   * back rank — and marking it here would corrupt that seat's R6 castling
   * record. Move application must funnel through one helper that enforces
   * this.
   */
  startPieceMoved: readonly boolean[];
  /**
   * Open en passant windows. An ARRAY because an opening double-move turn
   * can double-step a pawn on EACH side of the meridian — two targets from
   * one turn. Cleared after the immediately-following player's turn (R5).
   */
  epTargets: readonly EpTarget[];
  /**
   * Avenger memory (§6.4, ruling R4): per team, has a piece been captured
   * while still unmoved on its original starting square? Permanent once set.
   * Index 0 = team 1 (seats 1,3), index 1 = team 2 (seats 2,4).
   */
  avengeableLoss: readonly [boolean, boolean];
  /**
   * Fifty-move counter (§8.6): player-turns since the last pawn move or
   * capture. A double-move opening turn increments it by 1 (one turn).
   */
  halfmoveClock: number;
  /**
   * Threefold repetition counts (§8.5): position key → times seen. The key
   * must include everything legal moves depend on: piece placement WITH halo
   * flags and per-piece unmoved status, side to move, en passant target,
   * Avenger memory, and the startPieceMoved bits castling rights derive
   * from — positions differing only in any of these are different positions.
   * Read counts with `?? 0`; keys are engine-generated strings.
   */
  repetition: Readonly<Record<string, number>>;
}

/** Is the game still in the double-move opening (§4.2)? Derived, never stored. */
export function inOpening(state: BoardState): boolean {
  return state.ply < 20;
}

/** 1-based round number (a round = four turns). */
export function roundOf(ply: number): number {
  return Math.floor(ply / 4) + 1;
}

export function avengeableLossFor(state: BoardState, team: Team): boolean {
  return state.avengeableLoss[team - 1] ?? false;
}

// ---------------------------------------------------------------------------
// Initial position (§2.5–2.7)
// ---------------------------------------------------------------------------

function makePiece(kind: PieceKind, seat: Seat, origin: Square): Piece {
  return { kind, seat, halo: false, hasMoved: false, promoted: false, origin };
}

/**
 * Build the canonical starting position:
 * per seat, the two back ranks flanking its Meridian carry R(A) B(B) N(C)
 * and K-or-Q(D) per Like-Pieces-Face; the next rank outward on each side
 * carries four pawns (§2.5–2.7). 16 pieces per seat, 64 total.
 */
export function initialBoard(): (Piece | null)[] {
  const board: (Piece | null)[] = new Array<Piece | null>(SQUARE_COUNT).fill(
    null,
  );
  for (const seat of SEATS) {
    const setup = seatSetup(seat);
    for (const back of [setup.backCcw, setup.backCw]) {
      const dPiece: PieceKind = back === setup.kingBack ? "K" : "Q";
      const order: PieceKind[] = ["R", "B", "N", dPiece];
      for (let file = 0; file < FILE_COUNT; file++) {
        const sq = squareOf(back, file);
        board[sq] = makePiece(order[file] as PieceKind, seat, sq);
      }
    }
    for (const pawnRank of [setup.pawnCcw, setup.pawnCw]) {
      for (let file = 0; file < FILE_COUNT; file++) {
        const sq = squareOf(pawnRank, file);
        board[sq] = makePiece("P", seat, sq);
      }
    }
  }
  return board;
}

export function initialState(): BoardState {
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    board: initialBoard(),
    activeSeat: 1,
    ply: 0,
    startPieceMoved: new Array<boolean>(SQUARE_COUNT).fill(false),
    epTargets: [],
    avengeableLoss: [false, false],
    halfmoveClock: 0,
    repetition: {},
  };
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

/** BoardState is plain data; JSON round-trips it exactly. */
export function serializeState(state: BoardState): string {
  return JSON.stringify(state);
}

/**
 * Parse and structurally validate a snapshot. This is the one boundary where
 * external data enters the engine — shape is checked; per-piece deep
 * validation is the caller's replay determinism check.
 */
export function deserializeState(json: string): BoardState {
  const parsed: unknown = JSON.parse(json);
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Invalid state: not an object");
  }
  const state = parsed as BoardState;
  if (state.schemaVersion !== STATE_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported state schemaVersion ${String(state.schemaVersion)}`,
    );
  }
  if (!Array.isArray(state.board) || state.board.length !== SQUARE_COUNT) {
    throw new Error("Invalid state: board must have 128 entries");
  }
  if (
    !Array.isArray(state.startPieceMoved) ||
    state.startPieceMoved.length !== SQUARE_COUNT
  ) {
    throw new Error("Invalid state: startPieceMoved must have 128 entries");
  }
  if (!SEATS.includes(state.activeSeat)) {
    throw new Error(`Invalid state: activeSeat ${String(state.activeSeat)}`);
  }
  if (!Array.isArray(state.epTargets)) {
    throw new Error("Invalid state: epTargets must be an array");
  }
  for (const raw of state.epTargets as readonly unknown[]) {
    const t = raw as Partial<EpTarget> | null;
    if (
      typeof t !== "object" || t === null ||
      typeof t.square !== "number" || typeof t.pawnSquare !== "number" ||
      typeof t.createdAtPly !== "number" ||
      !SEATS.includes(t.bySeat as Seat)
    ) {
      throw new Error("Invalid state: malformed epTarget");
    }
  }
  if (typeof state.ply !== "number" || state.ply < 0) {
    throw new Error("Invalid state: ply");
  }
  if (typeof state.halfmoveClock !== "number" || state.halfmoveClock < 0) {
    throw new Error("Invalid state: halfmoveClock");
  }
  if (
    typeof state.repetition !== "object" ||
    state.repetition === null ||
    Array.isArray(state.repetition)
  ) {
    throw new Error("Invalid state: repetition");
  }
  if (
    !Array.isArray(state.avengeableLoss) ||
    state.avengeableLoss.length !== 2 ||
    (state.avengeableLoss as readonly unknown[]).some(
      (b) => typeof b !== "boolean",
    )
  ) {
    throw new Error("Invalid state: avengeableLoss");
  }
  for (const raw of state.board as readonly unknown[]) {
    if (raw === null) continue;
    const piece = raw as Partial<Piece>;
    if (
      typeof piece !== "object" ||
      typeof piece.kind !== "string" ||
      !"KQRBNP".includes(piece.kind) ||
      !SEATS.includes(piece.seat as Seat) ||
      typeof piece.origin !== "number"
    ) {
      throw new Error("Invalid state: malformed piece");
    }
  }
  return state;
}

// ---------------------------------------------------------------------------
// Debug rendering (verification aid — reviewers read this against §2.5–2.7)
// ---------------------------------------------------------------------------

/**
 * Render the position as a rank-by-rank table, display rank 1→32, files A–D.
 * Each cell: seat number + piece letter (e.g. "1R"), "·" when empty,
 * "*" suffix for a halo.
 */
export function printBoard(state: BoardState): string {
  const meridianStarts = new Set(Object.values(MERIDIAN_CW_START));
  const lines: string[] = ["rank  A    B    C    D"];
  for (let rank = 0; rank < RANK_COUNT; rank++) {
    const cells: string[] = [];
    for (let file = 0; file < FILE_COUNT; file++) {
      const piece = state.board[squareOf(rank, file)];
      cells.push(
        piece
          ? `${piece.seat}${piece.kind}${piece.halo ? "*" : " "}`
          : "·  ",
      );
    }
    lines.push(
      `${String(rank + 1).padStart(4)}  ${cells.join("  ")}  ${
        meridianStarts.has(rank) ? "← meridian above" : ""
      }`.trimEnd(),
    );
  }
  return lines.join("\n");
}

/** Compact piece list, e.g. "1K@32D 1Q@1D …" — handy in test failures. */
export function listPieces(state: BoardState): string {
  const out: string[] = [];
  state.board.forEach((piece, sq) => {
    if (piece) out.push(`${piece.seat}${piece.kind}@${formatSquare(sq)}`);
  });
  return out.join(" ");
}
