/**
 * M1 verification — the initial position checked square-by-square against an
 * INDEPENDENT transcription of §2.5–2.7 (hard-coded display coordinates,
 * not derived through seatSetup), plus census, serialization, and invariants.
 */
import { describe, expect, it } from "vitest";
import {
  type PieceKind,
  type Seat,
  deserializeState,
  initialState,
  inOpening,
  isPrimary,
  listPieces,
  parseSquare,
  printBoard,
  roundOf,
  serializeState,
  squareColor,
} from "../src/index.js";

/**
 * Expected initial placement, transcribed directly from the rulebook:
 * §2.6 back-rank order A=R, B=B, C=N, D=K-or-Q; §2.7 K/Q table;
 * §2.5 pawns on the next rank outward from each back rank.
 */
const EXPECTED: Array<[string, Seat, PieceKind]> = [
  // Player 1 (North) — back ranks 32 & 1, pawns 31 & 2. K on 32D, Q on 1D.
  ["32A", 1, "R"], ["32B", 1, "B"], ["32C", 1, "N"], ["32D", 1, "K"],
  ["1A", 1, "R"], ["1B", 1, "B"], ["1C", 1, "N"], ["1D", 1, "Q"],
  ["31A", 1, "P"], ["31B", 1, "P"], ["31C", 1, "P"], ["31D", 1, "P"],
  ["2A", 1, "P"], ["2B", 1, "P"], ["2C", 1, "P"], ["2D", 1, "P"],
  // Player 2 (East) — back ranks 8 & 9, pawns 7 & 10. K on 9D, Q on 8D.
  ["8A", 2, "R"], ["8B", 2, "B"], ["8C", 2, "N"], ["8D", 2, "Q"],
  ["9A", 2, "R"], ["9B", 2, "B"], ["9C", 2, "N"], ["9D", 2, "K"],
  ["7A", 2, "P"], ["7B", 2, "P"], ["7C", 2, "P"], ["7D", 2, "P"],
  ["10A", 2, "P"], ["10B", 2, "P"], ["10C", 2, "P"], ["10D", 2, "P"],
  // Player 3 (South) — back ranks 16 & 17, pawns 15 & 18. K on 16D, Q on 17D.
  ["16A", 3, "R"], ["16B", 3, "B"], ["16C", 3, "N"], ["16D", 3, "K"],
  ["17A", 3, "R"], ["17B", 3, "B"], ["17C", 3, "N"], ["17D", 3, "Q"],
  ["15A", 3, "P"], ["15B", 3, "P"], ["15C", 3, "P"], ["15D", 3, "P"],
  ["18A", 3, "P"], ["18B", 3, "P"], ["18C", 3, "P"], ["18D", 3, "P"],
  // Player 4 (West) — back ranks 24 & 25, pawns 23 & 26. K on 25D, Q on 24D.
  ["24A", 4, "R"], ["24B", 4, "B"], ["24C", 4, "N"], ["24D", 4, "Q"],
  ["25A", 4, "R"], ["25B", 4, "B"], ["25C", 4, "N"], ["25D", 4, "K"],
  ["23A", 4, "P"], ["23B", 4, "P"], ["23C", 4, "P"], ["23D", 4, "P"],
  ["26A", 4, "P"], ["26B", 4, "P"], ["26C", 4, "P"], ["26D", 4, "P"],
];

describe("initial position (§2.5–2.7)", () => {
  const state = initialState();

  it("places all 64 pieces exactly where the rulebook says", () => {
    for (const [coord, seat, kind] of EXPECTED) {
      const piece = state.board[parseSquare(coord)];
      expect(piece, `${coord} should hold ${seat}${kind}`).not.toBeNull();
      expect(piece?.seat, coord).toBe(seat);
      expect(piece?.kind, coord).toBe(kind);
    }
  });

  it("leaves the other 64 squares empty", () => {
    const occupied = new Set(EXPECTED.map(([coord]) => parseSquare(coord)));
    expect(occupied.size).toBe(64);
    for (let sq = 0; sq < 128; sq++) {
      if (!occupied.has(sq)) {
        expect(state.board[sq], `square ${sq} should be empty`).toBeNull();
      }
    }
  });

  it("census: 16 pieces per seat — 8P 2R 2B 2N 1K 1Q", () => {
    for (const seat of [1, 2, 3, 4] as const) {
      const counts: Record<string, number> = {};
      for (const piece of state.board) {
        if (piece?.seat === seat) {
          counts[piece.kind] = (counts[piece.kind] ?? 0) + 1;
        }
      }
      expect(counts, `seat ${seat}`).toEqual({
        P: 8, R: 2, B: 2, N: 2, K: 1, Q: 1,
      });
    }
  });

  it("each seat has one light-squared and one dark-squared bishop (§5.4)", () => {
    for (const seat of [1, 2, 3, 4] as const) {
      const colors: number[] = [];
      state.board.forEach((piece, sq) => {
        if (piece?.seat === seat && piece.kind === "B") {
          colors.push(squareColor(sq));
        }
      });
      expect(colors.sort(), `seat ${seat}`).toEqual([0, 1]);
    }
  });

  it("fresh flags: no halos, nothing moved, no promotions, origins = own squares", () => {
    state.board.forEach((piece, sq) => {
      if (!piece) return;
      expect(piece.halo).toBe(false);
      expect(piece.hasMoved).toBe(false);
      expect(piece.promoted).toBe(false);
      expect(piece.origin).toBe(sq);
    });
    expect(state.startPieceMoved.every((moved) => !moved)).toBe(true);
  });

  it("game-start bookkeeping: seat 1 to move, ply 0, opening phase, clean counters", () => {
    expect(state.activeSeat).toBe(1);
    expect(state.ply).toBe(0);
    expect(inOpening(state)).toBe(true);
    expect(roundOf(state.ply)).toBe(1);
    expect(state.epTargets).toEqual([]);
    expect(state.avengeableLoss).toEqual([false, false]);
    expect(state.halfmoveClock).toBe(0);
    expect(state.repetition).toEqual({});
  });

  it("primary-piece predicate matches §6.2 (R, B, N only)", () => {
    expect(isPrimary("R")).toBe(true);
    expect(isPrimary("B")).toBe(true);
    expect(isPrimary("N")).toBe(true);
    expect(isPrimary("K")).toBe(false);
    expect(isPrimary("Q")).toBe(false);
    expect(isPrimary("P")).toBe(false);
  });
});

describe("serialization", () => {
  it("JSON round-trips the initial state exactly", () => {
    const state = initialState();
    const restored = deserializeState(serializeState(state));
    expect(restored).toEqual(state);
  });

  it("round-trips a mid-game state with epTargets and repetition populated", () => {
    const state = {
      ...initialState(),
      activeSeat: 3 as const,
      ply: 9,
      epTargets: [
        {
          square: parseSquare("11B"),
          pawnSquare: parseSquare("12B"),
          bySeat: 2 as const,
          createdAtPly: 8,
        },
      ],
      avengeableLoss: [true, false] as const,
      halfmoveClock: 4,
      repetition: { somekey: 2, otherkey: 1 },
    };
    expect(deserializeState(serializeState(state))).toEqual(state);
  });

  it("rejects structurally broken snapshots", () => {
    expect(() => deserializeState("null")).toThrow(/not an object/);
    expect(() => deserializeState('{"schemaVersion":1}')).toThrow(/board/);
    const noSeat = serializeState(initialState()).replace(
      '"activeSeat":1',
      '"activeSeat":9',
    );
    expect(() => deserializeState(noSeat)).toThrow(/activeSeat/);
  });

  it("rejects unknown schema versions", () => {
    const state = initialState();
    const tampered = serializeState(state).replace(
      '"schemaVersion":1',
      '"schemaVersion":99',
    );
    expect(() => deserializeState(tampered)).toThrow(/schemaVersion/);
  });
});

describe("debug rendering", () => {
  it("printBoard renders all 32 ranks and marks meridians", () => {
    const text = printBoard(initialState());
    expect(text.split("\n")).toHaveLength(33); // header + 32 ranks
    expect(text).toContain("meridian");
    expect(text).toContain("1K");
    expect(text).toContain("3Q");
  });

  it("listPieces includes the four kings on their §2.7 squares", () => {
    const listed = listPieces(initialState());
    expect(listed).toContain("1K@32D");
    expect(listed).toContain("2K@9D");
    expect(listed).toContain("3K@16D");
    expect(listed).toContain("4K@25D");
  });
});
