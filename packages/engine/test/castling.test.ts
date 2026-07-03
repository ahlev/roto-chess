/**
 * M2 fixtures — castling (§8.2): the queenside K↔Q swap across the meridian,
 * the kingside radial slide, every §8.2.3 condition, and ruling R6
 * ("moved away" ≠ "captured away").
 */
import { describe, expect, it } from "vitest";
import { parseSquare } from "../src/geometry.js";
import { legalMovesFrom } from "../src/legal.js";
import { buildState, mv, applyOk, at } from "./helpers.js";

function castlesFrom(state: ReturnType<typeof buildState>, from: string) {
  return legalMovesFrom(state, parseSquare(from)).filter((m) => m.castle);
}

describe("queenside castling (§8.2.1: K↔Q swap across the meridian)", () => {
  it("swaps king and queen on file D", () => {
    const state = buildState({
      pieces: [
        { at: "32D", kind: "K", seat: 1 },
        { at: "1D", kind: "Q", seat: 1 },
      ],
      activeSeat: 1,
    });
    const move = mv(state, "32D", "1D");
    expect(move.castle).toBe("queenside");
    const { state: after } = applyOk(state, [move]);
    expect(at(after, "1D")?.kind).toBe("K");
    expect(at(after, "32D")?.kind).toBe("Q");
    expect(at(after, "1D")?.hasMoved).toBe(true);
    expect(at(after, "32D")?.hasMoved).toBe(true);
  });

  it("illegal while in check (§8.2.3)", () => {
    const state = buildState({
      pieces: [
        { at: "32D", kind: "K", seat: 1 },
        { at: "1D", kind: "Q", seat: 1 },
        { at: "32A", kind: "R", seat: 2 }, // radial attack down rank 32 to the K
      ],
      activeSeat: 1,
    });
    expect(castlesFrom(state, "32D")).toHaveLength(0);
  });

  it("illegal when the king would land on an attacked square", () => {
    const state = buildState({
      pieces: [
        { at: "32D", kind: "K", seat: 1 },
        { at: "1D", kind: "Q", seat: 1 },
        { at: "1A", kind: "R", seat: 2 }, // attacks 1B,1C,1D radially
      ],
      activeSeat: 1,
    });
    expect(castlesFrom(state, "32D")).toHaveLength(0);
  });

  it("illegal once either piece has moved (§8.2.3)", () => {
    const state = buildState({
      pieces: [
        { at: "32D", kind: "K", seat: 1 },
        { at: "1D", kind: "Q", seat: 1, hasMoved: true },
      ],
      activeSeat: 1,
    });
    expect(castlesFrom(state, "32D")).toHaveLength(0);
  });
});

describe("kingside castling (§8.2.1: K D→A, R A→B, radial)", () => {
  /** K and R at home, B and C squares empty AND their pieces moved away. */
  function kingsideReady() {
    return buildState({
      pieces: [
        { at: "32D", kind: "K", seat: 1 },
        { at: "32A", kind: "R", seat: 1 },
      ],
      activeSeat: 1,
      startMoved: ["32B", "32C"], // bishop and knight moved away (R6 satisfied)
    });
  }

  it("slides K to file A and R to file B on the king's back rank", () => {
    const state = kingsideReady();
    const move = mv(state, "32D", "32A");
    expect(move.castle).toBe("kingside");
    const { state: after } = applyOk(state, [move]);
    expect(at(after, "32A")?.kind).toBe("K");
    expect(at(after, "32B")?.kind).toBe("R");
    expect(at(after, "32D")).toBeNull();
  });

  it("R6: empty squares are NOT enough — captured-in-place pieces don't count as moved away", () => {
    const state = buildState({
      pieces: [
        { at: "32D", kind: "K", seat: 1 },
        { at: "32A", kind: "R", seat: 1 },
      ],
      activeSeat: 1,
      // 32B and 32C are empty but startPieceMoved stays false: the knight
      // and bishop were captured at home, they never moved.
      startMoved: [],
    });
    expect(castlesFrom(state, "32D")).toHaveLength(0);
  });

  it("illegal if files B or C are occupied (§8.2.3)", () => {
    const state = buildState({
      pieces: [
        { at: "32D", kind: "K", seat: 1 },
        { at: "32A", kind: "R", seat: 1 },
        { at: "32C", kind: "N", seat: 1 },
      ],
      activeSeat: 1,
      startMoved: ["32B"],
    });
    expect(castlesFrom(state, "32D")).toHaveLength(0);
  });

  it("illegal if the king passes through an attacked square", () => {
    const state = buildState({
      pieces: [
        { at: "32D", kind: "K", seat: 1 },
        { at: "32A", kind: "R", seat: 1 },
        { at: "30B", kind: "R", seat: 2 }, // attacks 32B along file B
      ],
      activeSeat: 1,
      startMoved: ["32B", "32C"],
    });
    expect(castlesFrom(state, "32D")).toHaveLength(0);
  });

  it("legal for every seat on its own kingBack rank", () => {
    for (const [seat, kHome, rHome, bC] of [
      [2, "9D", "9A", ["9B", "9C"]],
      [3, "16D", "16A", ["16B", "16C"]],
      [4, "25D", "25A", ["25B", "25C"]],
    ] as const) {
      const state = buildState({
        pieces: [
          { at: kHome, kind: "K", seat },
          { at: rHome, kind: "R", seat },
        ],
        activeSeat: seat,
        startMoved: [...bC],
      });
      expect(castlesFrom(state, kHome), `seat ${seat}`).toHaveLength(1);
    }
  });
});
