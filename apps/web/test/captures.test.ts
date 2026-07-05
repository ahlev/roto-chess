/**
 * The fallen-piece ledger (captures tray derivation). Hand-built positions
 * drive real engine move generation to produce genuine capture, en-passant
 * (victim ≠ destination), and evaporation (§6.3) turns, then assert the
 * fold records the right owner/captor for each.
 */
import { describe, expect, it } from "vitest";
import {
  SEATS,
  SQUARE_COUNT,
  STATE_SCHEMA_VERSION,
  applyTurn,
  legalMovesFrom,
  parseSquare,
  seatSetup,
  squareOf,
  type BoardState,
  type EpTarget,
  type Move,
  type Piece,
  type PieceKind,
  type Seat,
  type Turn,
} from "@rotochess/engine";
import { fallenLabel, fallenPieces } from "../src/lib/game/captures";

// A local position builder mirroring the engine test harness: auto-places
// every seat's king at its §2.7 home unless one is given, so isInCheck (run
// inside legal-move generation) always finds four kings.
interface Spec {
  pieces: Array<{
    at: string;
    kind: PieceKind;
    seat: Seat;
    halo?: boolean;
    hasMoved?: boolean;
    origin?: string;
  }>;
  activeSeat?: Seat;
  ply?: number;
  epTargets?: EpTarget[];
  avengeableLoss?: [boolean, boolean];
}

function buildState(spec: Spec): BoardState {
  const board: (Piece | null)[] = new Array<Piece | null>(SQUARE_COUNT).fill(
    null,
  );
  const startPieceMoved = new Array<boolean>(SQUARE_COUNT).fill(false);
  const withKing = new Set<Seat>();

  for (const p of spec.pieces) {
    const sq = parseSquare(p.at);
    const origin = p.origin !== undefined ? parseSquare(p.origin) : sq;
    const hasMoved = p.hasMoved ?? (p.origin !== undefined && origin !== sq);
    board[sq] = {
      kind: p.kind,
      seat: p.seat,
      halo: p.halo ?? false,
      hasMoved,
      promoted: false,
      origin,
    };
    if (p.kind === "K") withKing.add(p.seat);
    if (hasMoved) startPieceMoved[origin] = true;
  }
  for (const seat of SEATS) {
    if (withKing.has(seat)) continue;
    const home = squareOf(seatSetup(seat).kingBack, 3);
    board[home] = {
      kind: "K",
      seat,
      halo: false,
      hasMoved: false,
      promoted: false,
      origin: home,
    };
  }

  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    board,
    activeSeat: spec.activeSeat ?? 1,
    ply: spec.ply ?? 20,
    startPieceMoved,
    epTargets: spec.epTargets ?? [],
    avengeableLoss: spec.avengeableLoss ?? [false, false],
    halfmoveClock: 0,
    repetition: {},
  };
}

/** The unique legal move from→to (throws if absent/ambiguous), like the engine harness. */
function findMove(
  state: BoardState,
  from: string,
  to: string,
  opts?: { rotDir?: 1 | -1 },
): Move {
  const cands = legalMovesFrom(state, parseSquare(from)).filter(
    (m) =>
      m.to === parseSquare(to) &&
      (opts?.rotDir === undefined || m.rotDir === opts.rotDir),
  );
  if (cands.length !== 1) {
    throw new Error(`Expected one move ${from}->${to}, got ${cands.length}`);
  }
  return cands[0] as Move;
}

const turn = (move: Move): Turn => ({ submoves: [move] });

/** Apply a full turn (bumps ply/active seat — needed for a live EP window). */
function afterTurn(state: BoardState, move: Move): BoardState {
  const res = applyTurn(state, { submoves: [move] });
  if (!res.ok) throw new Error(res.error);
  return res.state;
}

describe("fallenPieces — normal captures", () => {
  it("records the victim's kind/owner and credits the mover as captor", () => {
    // Seat 1 (North, team 1) haloed rook captures a seat-2 (East, team 2)
    // bishop. Haloed so it does not evaporate crossing.
    const state = buildState({
      pieces: [
        { at: "5B", kind: "R", seat: 1, halo: true },
        { at: "8B", kind: "B", seat: 2 },
      ],
      activeSeat: 1,
    });
    const move = findMove(state, "5B", "8B", { rotDir: 1 });
    expect(move.captures).toBe(parseSquare("8B"));

    const fallen = fallenPieces([turn(move)], state);
    expect(fallen).toHaveLength(1);
    expect(fallen[0]).toMatchObject({
      kind: "B",
      ownerSeat: 2,
      by: 1,
      ply: 20,
    });
    expect(fallenLabel(fallen[0]!)).toBe("East's bishop — taken by North");
  });

  it("records a captured piece's earned halo, and names it in the label", () => {
    // The victim bishop wears an earned halo (§6.2) when it falls.
    const state = buildState({
      pieces: [
        { at: "5B", kind: "R", seat: 1, halo: true },
        { at: "8B", kind: "B", seat: 2, halo: true },
      ],
      activeSeat: 1,
    });
    const move = findMove(state, "5B", "8B", { rotDir: 1 });
    const fallen = fallenPieces([turn(move)], state);
    expect(fallen[0]?.haloed).toBe(true);
    expect(fallenLabel(fallen[0]!)).toBe(
      "East's haloed bishop — taken by North",
    );
  });

  it("empty for a game with no captures", () => {
    const state = buildState({
      pieces: [{ at: "5B", kind: "R", seat: 1 }],
      activeSeat: 1,
    });
    const quiet = findMove(state, "5B", "5A"); // radial: unambiguous, no capture
    expect(fallenPieces([turn(quiet)], state)).toEqual([]);
  });
});

describe("fallenPieces — en passant (victim ≠ destination)", () => {
  it("credits the capturing pawn's seat and names the pawn that actually left the board", () => {
    // Seat 2 double-steps 10B->12B, opening a window on 11B; seat 3's pawn
    // at 12C captures en passant, landing on 11B while 12B (the victim) is
    // removed.
    const start = buildState({
      pieces: [
        { at: "10B", kind: "P", seat: 2 },
        { at: "12C", kind: "P", seat: 3, origin: "15C", hasMoved: true },
      ],
      activeSeat: 2,
      ply: 21,
    });
    const dbl = findMove(start, "10B", "12B");
    // Replay the double-step to reach the position where EP is legal, then
    // build the EP move against that mid-position via the engine.
    const mid = afterTurn(start, dbl);
    const ep = findMove(mid, "12C", "11B");
    expect(ep.enPassant).toBe(true);
    expect(ep.captures).toBe(parseSquare("12B")); // victim differs from `to`

    const fallen = fallenPieces([turn(dbl), turn(ep)], start);
    expect(fallen).toHaveLength(1);
    expect(fallen[0]).toMatchObject({ kind: "P", ownerSeat: 2, by: 3 });
    expect(fallen[0]!.ply).toBe(22); // second turn (start ply 21 → +1 → +1)
    expect(fallenLabel(fallen[0]!)).toBe("East's pawn — taken by South");
  });
});

describe("fallenPieces — evaporation (the meridian claims the mover)", () => {
  it("records the MOVING piece as fallen, captured by nobody", () => {
    // Non-haloed seat-1 knight at 2B captures across its own meridian at
    // 32C: the capture completes, then the knight evaporates (§6.3). Two
    // pieces leave the board — the East pawn (taken by North) and the
    // North knight (evaporated).
    const state = buildState({
      pieces: [
        { at: "2B", kind: "N", seat: 1 },
        { at: "32C", kind: "P", seat: 2, hasMoved: true, origin: "10C" },
      ],
      activeSeat: 1,
    });
    const move = findMove(state, "2B", "32C");
    expect(move.captures).toBe(parseSquare("32C"));
    expect(move.evaporates).toBe(true);

    const fallen = fallenPieces([turn(move)], state);
    expect(fallen).toHaveLength(2);
    // Capture recorded first, then evaporation (fold order).
    expect(fallen[0]).toMatchObject({ kind: "P", ownerSeat: 2, by: 1 });
    expect(fallen[1]).toMatchObject({
      kind: "N",
      ownerSeat: 1,
      by: "evaporated",
    });
    expect(fallenLabel(fallen[1]!)).toBe(
      "North's knight — evaporated at the meridian",
    );
  });

  it("a plain evaporation with no capture is a single fallen record", () => {
    // Unhaloed knight crosses its own meridian to an empty square and
    // evaporates; nothing is captured.
    const state = buildState({
      pieces: [{ at: "2B", kind: "N", seat: 1 }],
      activeSeat: 1,
    });
    const move = findMove(state, "2B", "32C");
    expect(move.captures).toBeUndefined();
    expect(move.evaporates).toBe(true);

    const fallen = fallenPieces([turn(move)], state);
    expect(fallen).toHaveLength(1);
    expect(fallen[0]).toMatchObject({
      kind: "N",
      ownerSeat: 1,
      by: "evaporated",
    });
  });
});

describe("fallenPieces — staged submove of the in-progress turn", () => {
  it("records a capture the instant it's staged, before the turn commits", () => {
    // The board's displayState already reflects the opening's first submove;
    // the ledger must too. A staged (not-yet-committed) capture is passed as
    // `pending` and shows immediately, credited to the CURRENT mover at the
    // CURRENT ply — the turn hasn't passed, so neither has advanced.
    const state = buildState({
      pieces: [
        { at: "5B", kind: "R", seat: 1, halo: true },
        { at: "8B", kind: "B", seat: 2 },
      ],
      activeSeat: 1,
      ply: 20,
    });
    const staged = findMove(state, "5B", "8B", { rotDir: 1 });
    expect(staged.captures).toBe(parseSquare("8B"));

    // No committed turns yet — the capture lives only in the staged submove.
    const fallen = fallenPieces([], state, [staged]);
    expect(fallen).toHaveLength(1);
    expect(fallen[0]).toMatchObject({
      kind: "B",
      ownerSeat: 2,
      by: 1, // current mover, not the next seat
      ply: 20, // current ply, not bumped
    });
  });

  it("defaults to no pending submoves (committed turns unchanged)", () => {
    const state = buildState({
      pieces: [{ at: "5B", kind: "R", seat: 1 }],
      activeSeat: 1,
    });
    const quiet = findMove(state, "5B", "5A");
    // Third arg omitted — behaves exactly as before the immediacy fix.
    expect(fallenPieces([turn(quiet)], state)).toEqual([]);
  });
});
