/**
 * Event-feedback derivation (turnFeedback): the last committed turn →
 * board-effect squares, mover ghosts, Avenger visuals, and captions for
 * every viewer. Positions are hand-built and driven through real engine
 * move generation, like the captures-tray suite.
 */
import { describe, expect, it } from "vitest";
import {
  SEATS,
  SQUARE_COUNT,
  STATE_SCHEMA_VERSION,
  legalMovesFrom,
  parseSquare,
  seatSetup,
  squareOf,
  type BoardState,
  type Move,
  type Piece,
  type PieceKind,
  type Seat,
  type Turn,
} from "@rotochess/engine";
import { EMPTY_FEEDBACK, turnFeedback } from "../src/lib/game/turnEvents";

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
    epTargets: [],
    halfmoveClock: 0,
    repetition: {},
  };
}

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

describe("turnFeedback — halo earned", () => {
  it("blooms the destination and captions the earner for everyone", () => {
    const state = buildState({
      pieces: [
        { at: "5B", kind: "R", seat: 1 },
        { at: "8B", kind: "B", seat: 2 },
      ],
      activeSeat: 1,
    });
    const move = findMove(state, "5B", "8B", { rotDir: 1 });
    const fb = turnFeedback([turn(move)], state);
    expect(fb.bloomSquares).toEqual([parseSquare("8B")]);
    expect(fb.evaporateSquares).toEqual([]);
    expect(fb.evaporateGhosts).toEqual([]);
    expect(fb.avengerSquares).toEqual([]);
    expect(fb.captions).toHaveLength(1);
    expect(fb.captions[0]?.tone).toBe("halo");
    expect(fb.captions[0]?.text).toBe(
      "North's rook earns its halo — the meridian is open to it, forever.",
    );
  });
});

describe("turnFeedback — evaporation owns the moment (mixed-signal rule)", () => {
  it("an evaporating capture gets NO halo bloom; the ghost is the MOVER's sprite", () => {
    // Moved knight captures across its own meridian: halo earned, then the
    // meridian claims it (§6.2/§6.3 ordering). The celebration is suppressed
    // and the dissolving sprite must be the knight, not the victim pawn.
    const state = buildState({
      pieces: [
        { at: "2B", kind: "N", seat: 1, hasMoved: true, origin: "1C" },
        { at: "32C", kind: "P", seat: 2, hasMoved: true, origin: "10C" },
      ],
      activeSeat: 1,
    });
    const move = findMove(state, "2B", "32C");
    expect(move.earnsHalo).toBe(true);
    expect(move.evaporates).toBe(true);
    const fb = turnFeedback([turn(move)], state);
    expect(fb.bloomSquares).toEqual([]); // suppressed
    expect(fb.evaporateSquares).toEqual([parseSquare("32C")]);
    expect(fb.evaporateGhosts).toEqual([
      { square: parseSquare("32C"), kind: "N", seat: 1 },
    ]);
    expect(fb.captions).toHaveLength(1);
    expect(fb.captions[0]?.tone).toBe("evaporation");
    expect(fb.captions[0]?.text).toBe(
      "North's knight takes the pawn, then evaporates — the meridian claims it.",
    );
  });

  it("a quiet crossing evaporation captions without a victim", () => {
    const state = buildState({
      pieces: [{ at: "2B", kind: "N", seat: 1, hasMoved: true, origin: "1C" }],
      activeSeat: 1,
    });
    const move = findMove(state, "2B", "32C");
    expect(move.evaporates).toBe(true);
    const fb = turnFeedback([turn(move)], state);
    expect(fb.captions[0]?.text).toBe(
      "North's knight crosses its own meridian unhaloed — evaporated.",
    );
    expect(fb.evaporateGhosts[0]).toEqual({
      square: parseSquare("32C"),
      kind: "N",
      seat: 1,
    });
  });
});

describe("turnFeedback — the Avenger moment", () => {
  it("marks the grave square, carries the crossing path, and captions the revenge", () => {
    // §6.4 (ruled 2026-07-18): unmoved knight takes the intruder standing on
    // its fallen pawn's home square, crossing penalty-free.
    const state = buildState({
      pieces: [
        { at: "1C", kind: "N", seat: 1 },
        { at: "31B", kind: "N", seat: 2, hasMoved: true, origin: "9C" },
      ],
      activeSeat: 1,
    });
    const move = findMove(state, "1C", "31B");
    expect(move.avenger).toBe(true);
    const fb = turnFeedback([turn(move)], state);
    expect(fb.avengerSquares).toEqual([parseSquare("31B")]);
    expect(fb.avengerPaths).toHaveLength(1);
    expect(fb.avengerPaths[0]?.[0]).toBe(parseSquare("1C")); // starts at from
    expect(fb.avengerPaths[0]?.at(-1)).toBe(parseSquare("31B")); // ends on the grave
    // The capture also earns the halo and the piece SURVIVES — bloom plays.
    expect(fb.bloomSquares).toEqual([parseSquare("31B")]);
    expect(fb.evaporateSquares).toEqual([]);
    // One combined caption — the Avenger story includes the capture.
    expect(fb.captions).toHaveLength(1);
    expect(fb.captions[0]?.tone).toBe("avenger");
    expect(fb.captions[0]?.text).toBe(
      "North's knight avenges the fallen pawn — takes the knight and crosses penalty-free.",
    );
  });
});

describe("turnFeedback — edges", () => {
  it("no turns → the shared empty feedback", () => {
    expect(turnFeedback([])).toBe(EMPTY_FEEDBACK);
  });

  it("an ordinary quiet move produces no feedback", () => {
    const state = buildState({
      pieces: [{ at: "5B", kind: "R", seat: 1, halo: true }],
      activeSeat: 1,
    });
    const move = findMove(state, "5B", "5A");
    const fb = turnFeedback([turn(move)], state);
    expect(fb.bloomSquares).toEqual([]);
    expect(fb.evaporateSquares).toEqual([]);
    expect(fb.avengerSquares).toEqual([]);
    expect(fb.captions).toEqual([]);
  });
});
