/**
 * Layer 0 — Geometry.
 *
 * The board is an annulus: 32 RANKS (radial sectors, numbered 1–32 clockwise
 * in display form) × 4 FILES (concentric rings, A innermost → D outermost).
 *
 * Internal representation is integers only:
 *   rank 0–31  (display rank = internal + 1)
 *   file 0–3   (display file = "ABCD"[file])
 *   square 0–127, encoded rank-major: square = rank * 4 + file
 *
 * All trigonometry lives in the web renderer's path generator — never here.
 * Rulebook v3.1 references are cited per clause.
 */

export const RANK_COUNT = 32;
export const FILE_COUNT = 4;
export const SQUARE_COUNT = RANK_COUNT * FILE_COUNT;

/** Internal rank index, 0–31. Display rank is `rank + 1` (1–32). */
export type Rank = number;
/** Internal file index, 0–3 (A=0 … D=3). */
export type File = number;
/** Square id 0–127, `rank * 4 + file`. */
export type Square = number;

/** Players 1–4, clockwise (§1.1). 1=North, 2=East, 3=South, 4=West (§2.3). */
export type Seat = 1 | 2 | 3 | 4;
export const SEATS: readonly Seat[] = [1, 2, 3, 4];

/** Teams by seat parity (§1.1): seats 1,3 → team 1; seats 2,4 → team 2. */
export type Team = 1 | 2;

export function teamOf(seat: Seat): Team {
  return (((seat - 1) % 2) + 1) as Team;
}

export function partnerOf(seat: Seat): Seat {
  return ((((seat - 1) + 2) % 4) + 1) as Seat;
}

export function nextSeat(seat: Seat): Seat {
  return (((seat - 1 + 1) % 4) + 1) as Seat;
}

export function prevSeat(seat: Seat): Seat {
  return (((seat - 1 + 3) % 4) + 1) as Seat;
}

/** Compass glyph per seat (§2.3) — permanent, never communicated by hue alone. */
export const SEAT_COMPASS: Record<Seat, "N" | "E" | "S" | "W"> = {
  1: "N",
  2: "E",
  3: "S",
  4: "W",
};

/**
 * Wrap a rank index onto 0–31. JS `%` is broken for negatives
 * ((-1) % 32 === -1), so every rank wrap in the engine MUST go through here.
 */
export function wrapRank(rank: number): Rank {
  return ((rank % RANK_COUNT) + RANK_COUNT) % RANK_COUNT;
}

/**
 * Rank is wrapped; file is trusted — callers producing radial motion must
 * check `isValidFile` first (files never wrap; off-annulus is off the board).
 */
export function squareOf(rank: Rank, file: File): Square {
  return wrapRank(rank) * FILE_COUNT + file;
}

export function rankOf(square: Square): Rank {
  return square >> 2;
}

export function fileOf(square: Square): File {
  return square & 3;
}

/** Is `file` inside the annulus? (Ranks always wrap; files never do.) */
export function isValidFile(file: number): boolean {
  return file >= 0 && file < FILE_COUNT;
}

/**
 * Square color for the checkerboard pattern: (rank + file) % 2.
 * 32 ranks is even, so the coloring closes consistently around the ring.
 * Against the canonical diagram (Figure 1): parity 0 (e.g. 1A) renders
 * CREAM, parity 1 renders umber.
 */
export function squareColor(square: Square): 0 | 1 {
  return ((rankOf(square) + fileOf(square)) % 2) as 0 | 1;
}

// ---------------------------------------------------------------------------
// Meridians (§2.3, §6.1)
// ---------------------------------------------------------------------------

/**
 * Each seat's Meridian is a LINE between two ranks, not a rank (§2.3).
 * We identify it by the internal rank that begins its clockwise side:
 *   North  between display 32↔1  → clockwise side starts at internal 0
 *   East   between display  8↔9  → internal 8
 *   South  between display 16↔17 → internal 16
 *   West   between display 24↔25 → internal 24
 */
export const MERIDIAN_CW_START: Record<Seat, Rank> = {
  1: 0,
  2: 8,
  3: 16,
  4: 24,
};

/** Side of a seat's own Meridian. The ring splits 16/16 at the partner's Meridian (the antipode). */
export type MeridianSide = "cw" | "ccw";

/**
 * Which side of `seat`'s Meridian a rank sits on.
 * cw  = the 16 ranks clockwise of the Meridian (for North: display 1–16)
 * ccw = the 16 ranks counterclockwise      (for North: display 17–32)
 * No square is ever ON a Meridian — it is a line between ranks (§2.3).
 */
export function meridianSide(seat: Seat, rank: Rank): MeridianSide {
  const offset = wrapRank(rank - MERIDIAN_CW_START[seat]);
  return offset < 16 ? "cw" : "ccw";
}

/**
 * Does a file-wise step from rank `from` in direction `dir` (+1 cw / −1 ccw)
 * cross `seat`'s own Meridian? True when the step traverses the boundary.
 */
export function stepCrossesOwnMeridian(
  seat: Seat,
  from: Rank,
  dir: 1 | -1,
): boolean {
  const boundary = MERIDIAN_CW_START[seat];
  return dir === 1
    ? wrapRank(from + 1) === boundary
    : from === boundary;
}

/**
 * Does a traversal of `steps` ranks from `from` in direction `dir` cross
 * `seat`'s own Meridian anywhere along the way? The single audited primitive
 * for slides, knight jumps (rank displacement ≤ 2), and pawn double-steps —
 * every "did this movement cross my meridian" question funnels through here.
 */
export function spanCrossesOwnMeridian(
  seat: Seat,
  from: Rank,
  steps: number,
  dir: 1 | -1,
): boolean {
  let rank = from;
  for (let i = 0; i < steps; i++) {
    if (stepCrossesOwnMeridian(seat, rank, dir)) return true;
    rank = wrapRank(rank + dir);
  }
  return false;
}

// ---------------------------------------------------------------------------
// Quadrants (§2.3)
// ---------------------------------------------------------------------------

/**
 * Quadrant ownership by display rank (§2.3):
 *   P1 (N): 29,30,31,32,1,2,3,4 · P2 (E): 5–12 · P3 (S): 13–20 · P4 (W): 21–28
 * Each quadrant is the 8 ranks CENTERED on its Meridian (4 each side).
 */
export function quadrantOwner(rank: Rank): Seat {
  for (const seat of SEATS) {
    if (wrapRank(rank - MERIDIAN_CW_START[seat] + 4) < 8) return seat;
  }
  /* istanbul ignore next -- unreachable: the four quadrants tile the ring */
  throw new Error(`quadrantOwner: unreachable rank ${rank}`);
}

// ---------------------------------------------------------------------------
// Back ranks, pawn ranks, K/Q placement (§2.5–2.7)
// ---------------------------------------------------------------------------

export interface SeatSetup {
  /** Back rank on the ccw side of the Meridian (internal). */
  backCcw: Rank;
  /** Back rank on the cw side of the Meridian (internal). */
  backCw: Rank;
  /** Pawn rank outward of backCcw (internal). */
  pawnCcw: Rank;
  /** Pawn rank outward of backCw (internal). */
  pawnCw: Rank;
  /** Which back rank carries the King on file D (§2.7). */
  kingBack: Rank;
  /** Which back rank carries the Queen on file D (§2.7). */
  queenBack: Rank;
}

/**
 * §2.7 anchors Player 1: K on 32D, Q on 1D; the rest follow Like-Pieces-Face:
 *   P1: K 32D, Q 1D · P2: K 9D, Q 8D · P3: K 16D, Q 17D · P4: K 25D, Q 24D
 * (Display ranks; internal = display − 1.)
 */
export function seatSetup(seat: Seat): SeatSetup {
  const cwStart = MERIDIAN_CW_START[seat];
  const backCw = cwStart;
  const backCcw = wrapRank(cwStart - 1);
  const pawnCw = wrapRank(cwStart + 1);
  const pawnCcw = wrapRank(cwStart - 2);
  // Like-Pieces-Face (§2.7): P1/P3 kings sit ccw of their Meridian;
  // P2/P4 kings sit cw. Encoded from the rulebook's explicit table.
  const kingCcw = seat === 1 || seat === 3;
  return {
    backCcw,
    backCw,
    pawnCcw,
    pawnCw,
    kingBack: kingCcw ? backCcw : backCw,
    queenBack: kingCcw ? backCw : backCcw,
  };
}

/** The two back ranks of a seat (the ranks flanking its Meridian, §2.5). */
export function backRanks(seat: Seat): [Rank, Rank] {
  const s = seatSetup(seat);
  return [s.backCcw, s.backCw];
}

// ---------------------------------------------------------------------------
// Pawn direction & promotion (§2.8, §5.7)
// ---------------------------------------------------------------------------

/**
 * A pawn's forward direction along its file (§2.8): away from its own
 * Meridian — pawns on the cw side advance clockwise (+1), pawns on the ccw
 * side advance counterclockwise (−1). Direction is fixed by the pawn's
 * ORIGIN side and never changes mid-game.
 */
export function pawnDirection(seat: Seat, originRank: Rank): 1 | -1 {
  return meridianSide(seat, originRank) === "cw" ? 1 : -1;
}

/**
 * Promotion rank (§5.7): the opposing player's back rank — the rank
 * immediately on the attacker's side of the opposing Meridian the pawn
 * advances toward. Derived: advancing cw, that is the rank just before the
 * next Meridian boundary; advancing ccw, the rank just after the previous.
 * The §5.7 table is transcribed verbatim in the test suite and compared.
 */
export function promotionRank(seat: Seat, originRank: Rank): Rank {
  const dir = pawnDirection(seat, originRank);
  const own = MERIDIAN_CW_START[seat];
  if (dir === 1) {
    // Next meridian clockwise sits 8 ranks on: its cw-start is own + 8.
    return wrapRank(own + 8 - 1);
  }
  // Previous meridian counterclockwise: its cw-start is own − 8.
  return wrapRank(own - 8);
}

// ---------------------------------------------------------------------------
// Display notation boundary (§2.2, §3.2)
// ---------------------------------------------------------------------------

export const FILE_LETTERS = "ABCD";

/**
 * Internal square → display coordinate, e.g. D32, A1 — file-first per the
 * founder's 2026-07-03 placeholder ruling (matches the rulebook §3.3 / TDD
 * §3.4 move EXAMPLES; rulebook §2.2 prose says rank-first, so this may flip
 * again when the inventor rules). This is the ONE emit point.
 */
export function formatSquare(square: Square): string {
  return `${FILE_LETTERS[fileOf(square)]}${rankOf(square) + 1}`;
}

/**
 * Display coordinate → internal square. Accepts BOTH orders (file-first
 * "D32" and rank-first "32D" — unambiguous by leading character) so code
 * fixtures and archived notation survive the pending coordinate ruling.
 * Throws on malformed input.
 */
export function parseSquare(text: string): Square {
  const t = text.trim();
  const m =
    t.match(/^([1-9][0-9]?)([A-Da-d])$/) ?? t.match(/^([A-Da-d])([1-9][0-9]?)$/);
  if (!m) throw new Error(`Invalid square: "${text}"`);
  const digitLed = /^[0-9]/.test(m[1] as string);
  const rankPart = digitLed ? (m[1] as string) : (m[2] as string);
  const filePart = digitLed ? (m[2] as string) : (m[1] as string);
  const rank = Number(rankPart);
  if (rank < 1 || rank > RANK_COUNT) throw new Error(`Invalid rank: "${text}"`);
  const file = FILE_LETTERS.indexOf(filePart.toUpperCase());
  return squareOf(rank - 1, file);
}
