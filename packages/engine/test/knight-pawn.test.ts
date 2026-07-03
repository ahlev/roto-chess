/**
 * M2 fixtures — knights (§5.5: L-shape with rank wrap, radial clipping) and
 * pawns (§5.7: origin-anchored direction, double first move, diagonal
 * captures, mandatory promotion; §8.3 promoted piece always haloed).
 */
import { describe, expect, it } from "vitest";
import { parseSquare } from "../src/geometry.js";
import { legalMovesFrom } from "../src/legal.js";
import { buildState, destinations, mv, applyOk, at } from "./helpers.js";

describe("knight (§5.5)", () => {
  it("wraps rank offsets through the 32↔1 junction", () => {
    const state = buildState({
      pieces: [{ at: "1B", kind: "N", seat: 1 }],
      activeSeat: 1,
    });
    const dests = destinations(state, "1B");
    // From 1B (rank 1): ±1/±2 and ±2/±1 with wrap; 32D holds seat 1's own
    // king (auto-placed), so that square is excluded.
    expect(dests).toEqual(["2D", "31A", "31C", "3A", "3C"].sort());
  });

  it("clips at the rails: never jumps into or across the center or outside D", () => {
    const state = buildState({
      pieces: [{ at: "2D", kind: "N", seat: 1 }],
      activeSeat: 1,
    });
    // From file D, +2/-2 file offsets are gone; only inward jumps survive.
    expect(destinations(state, "2D")).toEqual(["1B", "32C", "3B", "4C"].sort());
  });

  it("a non-haloed knight jumping across its own meridian evaporates (§6.3)", () => {
    const state = buildState({
      pieces: [{ at: "2B", kind: "N", seat: 1 }],
      activeSeat: 1,
    });
    const crossing = mv(state, "2B", "32C");
    expect(crossing.evaporates).toBe(true);
    const staying = mv(state, "2B", "4C");
    expect(staying.evaporates).toBeUndefined();
  });
});

describe("pawn direction and advance (§2.8, §5.7)", () => {
  it("clockwise-side pawns advance clockwise, with a double first step", () => {
    const state = buildState({
      pieces: [{ at: "2B", kind: "P", seat: 1 }],
      activeSeat: 1,
    });
    expect(destinations(state, "2B")).toEqual(["3B", "4B"].sort());
  });

  it("counterclockwise-side pawns advance the other way", () => {
    const state = buildState({
      pieces: [{ at: "31B", kind: "P", seat: 1 }],
      activeSeat: 1,
    });
    expect(destinations(state, "31B")).toEqual(["30B", "29B"].sort());
  });

  it("direction is anchored to the pawn's ORIGIN, not its current square", () => {
    // A seat-1 pawn that started on 2B and has advanced deep into P2's
    // quadrant keeps advancing clockwise.
    const state = buildState({
      pieces: [{ at: "6B", kind: "P", seat: 1, origin: "2B" }],
      activeSeat: 1,
    });
    expect(destinations(state, "6B")).toEqual(["7B"]); // moved: no double
  });

  it("no double step once moved; forward blocked by any piece", () => {
    const state = buildState({
      pieces: [
        { at: "2B", kind: "P", seat: 1 },
        { at: "3B", kind: "P", seat: 2 },
      ],
      activeSeat: 1,
    });
    // Forward blocked; no diagonal enemies → no moves at all.
    expect(destinations(state, "2B")).toEqual([]);
  });

  it("captures diagonally forward, one file inward or outward", () => {
    const state = buildState({
      pieces: [
        { at: "2B", kind: "P", seat: 1 },
        { at: "3A", kind: "P", seat: 2 },
        { at: "3C", kind: "P", seat: 2 },
        { at: "3B", kind: "P", seat: 2 }, // blocks forward
      ],
      activeSeat: 1,
    });
    expect(destinations(state, "2B")).toEqual(["3A", "3C"].sort());
    expect(mv(state, "2B", "3A").captures).toBe(parseSquare("3A"));
  });

  it("cannot capture partner pieces (they are friendly, R9)", () => {
    const state = buildState({
      pieces: [
        { at: "2B", kind: "P", seat: 1 },
        { at: "3A", kind: "P", seat: 3 }, // partner
      ],
      activeSeat: 1,
    });
    expect(destinations(state, "2B")).toEqual(["3B", "4B"].sort());
  });
});

describe("promotion (§5.7, §8.3)", () => {
  it("promotes on the opposing back rank with a free choice of Q/R/B/N", () => {
    const state = buildState({
      pieces: [{ at: "7B", kind: "P", seat: 1, origin: "2B" }],
      activeSeat: 1,
    });
    const moves = legalMovesFrom(state, parseSquare("7B")).filter(
      (m) => m.to === parseSquare("8B"),
    );
    expect(moves.map((m) => m.promotion).sort()).toEqual(["B", "N", "Q", "R"]);
  });

  it("the promoted piece ALWAYS carries a halo (§8.3)", () => {
    const state = buildState({
      pieces: [{ at: "7B", kind: "P", seat: 1, origin: "2B" }],
      activeSeat: 1,
    });
    const { state: after } = applyOk(state, [
      mv(state, "7B", "8B", { promotion: "R" }),
    ]);
    const piece = at(after, "8B");
    expect(piece?.kind).toBe("R");
    expect(piece?.halo).toBe(true);
    expect(piece?.promoted).toBe(true);
    // GUARD from state.ts: the promoted piece's origin (8B, an enemy
    // back-rank square) must NOT be marked in startPieceMoved.
    expect(after.startPieceMoved[parseSquare("8B")]).toBe(false);
  });

  it("promotion by diagonal capture works too", () => {
    const state = buildState({
      pieces: [
        { at: "7B", kind: "P", seat: 1, origin: "2B" },
        { at: "8C", kind: "N", seat: 2 },
        { at: "8B", kind: "P", seat: 2 }, // blocks straight promotion
      ],
      activeSeat: 1,
    });
    const move = mv(state, "7B", "8C", { promotion: "Q" });
    expect(move.captures).toBe(parseSquare("8C"));
    const { state: after } = applyOk(state, [move]);
    expect(at(after, "8C")?.kind).toBe("Q");
    expect(at(after, "8C")?.halo).toBe(true);
  });

  it("counterclockwise pawns promote at their §5.7 rank (seat 4, rank 23 → 17)", () => {
    const state = buildState({
      pieces: [{ at: "18B", kind: "P", seat: 4, origin: "23B" }],
      activeSeat: 4,
    });
    const moves = legalMovesFrom(state, parseSquare("18B")).filter(
      (m) => m.to === parseSquare("17B"),
    );
    expect(moves).toHaveLength(4); // four promotion choices
    expect(moves.every((m) => m.promotion !== undefined)).toBe(true);
  });
});
