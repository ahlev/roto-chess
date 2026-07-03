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
 * 0 = dark (umber), 1 = light (cream) — labels are the renderer's concern.
 */
export function squareColor(square: Square): 0 | 1 {
  return ((rankOf(square) + fileOf(square)) % 2) as 0 | 1;
}
