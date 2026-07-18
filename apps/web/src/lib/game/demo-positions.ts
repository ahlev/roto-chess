/**
 * Constructed positions for the rules page's live demos — powered by the
 * real engine so every highlighted move is TRUE by construction.
 */
import {
  SQUARE_COUNT,
  SEATS,
  parseSquare,
  seatSetup,
  squareOf,
  STATE_SCHEMA_VERSION,
  type BoardState,
  type Piece,
  type PieceKind,
  type Seat,
} from "@rotochess/engine";

interface Spec {
  at: string;
  kind: PieceKind;
  seat: Seat;
  halo?: boolean;
  hasMoved?: boolean;
  origin?: string;
}

export function demoState(
  pieces: Spec[],
  activeSeat: Seat = 1,
  opts?: { ply?: number; startMoved?: string[] },
): BoardState {
  const board: (Piece | null)[] = new Array<Piece | null>(SQUARE_COUNT).fill(
    null,
  );
  const startPieceMoved = new Array<boolean>(SQUARE_COUNT).fill(false);
  const seated = new Set<Seat>();
  for (const p of pieces) {
    const sq = parseSquare(p.at);
    const origin = p.origin ? parseSquare(p.origin) : sq;
    const hasMoved = p.hasMoved ?? origin !== sq;
    board[sq] = {
      kind: p.kind,
      seat: p.seat,
      halo: p.halo ?? false,
      hasMoved,
      promoted: false,
      origin,
    };
    if (p.kind === "K") seated.add(p.seat);
    if (hasMoved) startPieceMoved[origin] = true;
  }
  for (const seat of SEATS) {
    if (!seated.has(seat)) {
      const home = squareOf(seatSetup(seat).kingBack, 3);
      if (!board[home]) {
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
  for (const coord of opts?.startMoved ?? []) {
    startPieceMoved[parseSquare(coord)] = true;
  }
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    board,
    activeSeat,
    ply: opts?.ply ?? 20,
    startPieceMoved,
    epTargets: [],
    halfmoveClock: 0,
    repetition: {},
  };
}
