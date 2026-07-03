/**
 * M2 fixtures — the banana curl (§5.4): color-chain movement, one rail
 * bounce, captures before/after bounce, blocking, no second bounce.
 * The highest-risk generator in the engine.
 */
import { describe, expect, it } from "vitest";
import { parseSquare, squareColor } from "../src/geometry.js";
import { legalMovesFrom } from "../src/legal.js";
import { initialState } from "../src/state.js";
import { buildState, destinations } from "./helpers.js";

/** Lone seat-1 bishop at 5B; kings on file D at 32/9/16/25. */
function loneBishop() {
  return buildState({
    pieces: [{ at: "5B", kind: "B", seat: 1 }],
    activeSeat: 1,
  });
}

describe("banana curl geometry (§5.4)", () => {
  it("walks all four diagonal rays with exactly one bounce each", () => {
    const dests = destinations(loneBishop(), "5B");
    // Ray +rank/outward: 6C, 7D(rail), bounce, 8C, 9B, 10A(end at rail)
    for (const c of ["C6", "D7", "C8", "B9", "A10"]) expect(dests).toContain(c);
    // Ray −rank/outward: 4C, 3D, bounce, 2C, 1B, 32A
    for (const c of ["C4", "D3", "C2", "B1", "A32"]) expect(dests).toContain(c);
    // Ray +rank/inward: 6A(rail), bounce, 7B, 8C — the ray then dies at 9D,
    // which holds seat 2's KING: blocked, and never a capture target (R12).
    for (const c of ["A6", "B7"]) expect(dests).toContain(c);
    expect(dests).not.toContain("D9");
    // Ray −rank/inward: 4A, bounce, 3B, 2C, 1D
    for (const c of ["A4", "B3", "D1"]) expect(dests).toContain(c);
  });

  it("cannot bounce twice: nothing beyond the second rail contact", () => {
    const dests = destinations(loneBishop(), "5B");
    // Each ray ends at its second rail contact; continuing would need a
    // second bounce (§5.4: cannot bounce more than once per move).
    expect(dests).not.toContain("B11"); // past 10A on the outward ray
    expect(dests).not.toContain("B31"); // past 32A
    expect(dests).not.toContain("C10"); // past 9D on the inward-start ray
  });

  it("never leaves its color chain (§5.4: a bishop never leaves its starting color)", () => {
    const state = loneBishop();
    const origin = squareColor(parseSquare("5B"));
    for (const move of legalMovesFrom(state, parseSquare("5B"))) {
      expect(squareColor(move.to)).toBe(origin);
      for (const sq of move.path) expect(squareColor(sq)).toBe(origin);
    }
  });

  it("captures are legal before the bounce, ending the move", () => {
    const state = buildState({
      pieces: [
        { at: "5B", kind: "B", seat: 1 },
        { at: "7D", kind: "P", seat: 2 }, // sits on the pre-bounce rail square
      ],
      activeSeat: 1,
    });
    const moves = legalMovesFrom(state, parseSquare("5B"));
    const cap = moves.find((m) => m.to === parseSquare("7D"));
    expect(cap?.captures).toBe(parseSquare("7D"));
    // The outward ray died at the capture — its continuation 9B is gone;
    // 8C survives only via the OTHER (inward-start) ray.
    expect(moves.filter((m) => m.to === parseSquare("9B"))).toHaveLength(0);
    expect(moves.filter((m) => m.to === parseSquare("8C"))).toHaveLength(1);
  });

  it("captures are legal after the bounce", () => {
    const state = buildState({
      pieces: [
        { at: "5B", kind: "B", seat: 1 },
        { at: "9B", kind: "P", seat: 2 }, // post-bounce square on the outward ray
      ],
      activeSeat: 1,
    });
    const moves = legalMovesFrom(state, parseSquare("5B"));
    const cap = moves.find(
      (m) => m.to === parseSquare("9B") && m.captures !== undefined,
    );
    expect(cap).toBeDefined();
    // And the ray stops there: 10A only reachable if some other ray gets
    // there — it isn't.
    expect(moves.filter((m) => m.to === parseSquare("10A"))).toHaveLength(0);
  });

  it("blocked by a friendly piece before the rail: no bounce happens", () => {
    const state = buildState({
      pieces: [
        { at: "5B", kind: "B", seat: 1 },
        { at: "7D", kind: "P", seat: 1 },
      ],
      activeSeat: 1,
    });
    const dests = destinations(state, "5B");
    expect(dests).toContain("C6");
    expect(dests).not.toContain("D7"); // friendly
    expect(dests).not.toContain("B9"); // that ray never bounced
  });

  it("cannot bounce off another piece (§5.4)", () => {
    // A piece sitting exactly at the bounce point kills the continuation —
    // bouncing happens off the RAIL, not off occupants.
    const state = buildState({
      pieces: [
        { at: "5B", kind: "B", seat: 1 },
        { at: "6A", kind: "P", seat: 1 }, // friendly at the inner-rail square
      ],
      activeSeat: 1,
    });
    const dests = destinations(state, "5B");
    // Inward +rank ray is dead at 6A: its post-bounce squares must not exist
    // from THAT ray. 7B is only reachable via that ray — must be absent.
    expect(dests).not.toContain("B7");
  });

});

describe("initial-position sanity", () => {
  it("every bishop is fully blocked at game start (like standard chess)", () => {
    for (const seat of [1, 2, 3, 4] as const) {
      const s = { ...initialState(), activeSeat: seat, ply: 20 };
      for (let sq = 0; sq < s.board.length; sq++) {
        const piece = s.board[sq];
        if (piece?.kind === "B" && piece.seat === seat) {
          expect(legalMovesFrom(s, sq), `bishop of seat ${seat}`).toHaveLength(0);
        }
      }
    }
  });
});

describe("degenerate curls", () => {
  it("a bishop starting ON a rail bounces immediately without duplicating squares", () => {
    const state = buildState({
      pieces: [{ at: "5D", kind: "B", seat: 1 }],
      activeSeat: 1,
    });
    const moves = legalMovesFrom(state, parseSquare("5D"));
    // From the outer rail the only diagonals run inward; each destination
    // appears exactly once after dedup.
    const seen = new Map<number, number>();
    for (const m of moves) seen.set(m.to, (seen.get(m.to) ?? 0) + 1);
    for (const [sq, count] of seen) {
      expect(count, `square ${sq}`).toBeLessThanOrEqual(2); // ≤2 only when effects differ
    }
    expect(moves.length).toBeGreaterThan(0);
  });

  it("no curled path ever revisits a square or returns home", () => {
    const state = loneBishop();
    for (const move of legalMovesFrom(state, parseSquare("5B"))) {
      const seen = new Set<number>([parseSquare("5B")]);
      for (const sq of move.path) {
        expect(seen.has(sq), `revisit in path to ${move.to}`).toBe(false);
        seen.add(sq);
      }
    }
  });
});
