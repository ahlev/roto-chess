/**
 * M2 fixtures — wraparound sliding (§5.1, §5.3, §5.6): rook/queen file-wise
 * wrap through 32↔1, junction blocking, no null move, direction-dependent
 * effects, and reach-or-pass halo earning (§6.2).
 */
import { describe, expect, it } from "vitest";
import { parseSquare } from "../src/geometry.js";
import { legalMovesFrom } from "../src/legal.js";
import { buildState, destinations, mv, applyOk, at } from "./helpers.js";

describe("rook wraparound sliding (§5.6)", () => {
  it("a lone rook reaches all 31 other squares of its ring, never its own", () => {
    // Kings live on file D; file B is empty all the way around.
    const state = buildState({
      pieces: [{ at: "5B", kind: "R", seat: 1 }],
      activeSeat: 1,
    });
    const dests = destinations(state, "5B");
    const fileB = dests.filter((c) => c.startsWith("B"));
    expect(fileB).toHaveLength(31);
    expect(dests).not.toContain("B5"); // no 32-step null move
    // Radial reach on its rank:
    expect(dests).toContain("A5");
    expect(dests).toContain("C5");
    expect(dests).toContain("D5");
  });

  it("is blocked by a friendly piece at the 32↔1 junction", () => {
    const state = buildState({
      pieces: [
        { at: "5B", kind: "R", seat: 1 },
        { at: "1B", kind: "P", seat: 1 },
      ],
      activeSeat: 1,
    });
    const dests = destinations(state, "5B");
    // Clockwise it runs 6B..32B; counterclockwise 4B..2B; 1B is friendly.
    expect(dests).toContain("B32");
    expect(dests).toContain("B2");
    expect(dests).not.toContain("B1");
  });

  it("captures an enemy at the junction from either side", () => {
    const state = buildState({
      pieces: [
        { at: "5B", kind: "R", seat: 1 },
        { at: "1B", kind: "P", seat: 2 },
      ],
      activeSeat: 1,
    });
    const captures = legalMovesFrom(state, parseSquare("5B")).filter(
      (m) => m.captures !== undefined,
    );
    expect(captures.length).toBeGreaterThanOrEqual(1);
    expect(captures.every((m) => m.to === parseSquare("1B"))).toBe(true);
  });

  it("the same destination via opposite directions differs in effect and both are kept", () => {
    // Unhaloed seat-1 rook: ccw 5B→3B is two quiet steps; cw 5B→3B goes the
    // long way around — crossing P2's and P4's back ranks (halo, §6.2) AND
    // seat 1's own meridian (evaporation, §6.3).
    const state = buildState({
      pieces: [{ at: "5B", kind: "R", seat: 1 }],
      activeSeat: 1,
    });
    const to3B = legalMovesFrom(state, parseSquare("5B")).filter(
      (m) => m.to === parseSquare("3B"),
    );
    expect(to3B).toHaveLength(2);
    const ccw = to3B.find((m) => m.rotDir === -1);
    const cw = to3B.find((m) => m.rotDir === 1);
    expect(ccw).toBeDefined();
    expect(cw).toBeDefined();
    expect(ccw?.evaporates).toBeUndefined();
    expect(ccw?.earnsHalo).toBeUndefined();
    expect(cw?.earnsHalo).toBe(true); // passed enemy back ranks on the way
    expect(cw?.evaporates).toBe(true); // crossed own meridian, unhaloed
  });
});

describe("reach-or-pass halo earning (§6.2, v3.0 clarification)", () => {
  it("a rook sliding THROUGH an opposing back rank earns the halo", () => {
    const state = buildState({
      pieces: [{ at: "7B", kind: "R", seat: 1 }],
      activeSeat: 1,
    });
    // 7B → 12B passes display ranks 8,9 — both P2 back ranks.
    const move = mv(state, "7B", "12B", { rotDir: 1 });
    expect(move.earnsHalo).toBe(true);
    const { state: after } = applyOk(state, [move]);
    expect(at(after, "12B")?.halo).toBe(true);
  });

  it("landing exactly ON the back rank earns it too", () => {
    const state = buildState({
      pieces: [{ at: "7B", kind: "R", seat: 1 }],
      activeSeat: 1,
    });
    expect(mv(state, "7B", "8B", { rotDir: 1 }).earnsHalo).toBe(true);
  });

  it("a PARTNER's back rank does not earn a halo (opposing players only)", () => {
    // Seat 3 is seat 1's partner; ranks 16/17 are seat 3's back ranks.
    const state = buildState({
      pieces: [{ at: "14B", kind: "R", seat: 1 }],
      activeSeat: 1,
    });
    const move = mv(state, "14B", "19B", { rotDir: 1 });
    expect(move.earnsHalo).toBeUndefined();
  });

  it("capturing anywhere earns the halo (§6.2 condition 1)", () => {
    const state = buildState({
      pieces: [
        { at: "5B", kind: "R", seat: 1 },
        { at: "5C", kind: "P", seat: 2 },
      ],
      activeSeat: 1,
    });
    const move = mv(state, "5B", "5C");
    expect(move.captures).toBe(parseSquare("5C"));
    expect(move.earnsHalo).toBe(true);
  });

  it("radial moves never cross a meridian and never evaporate", () => {
    const state = buildState({
      pieces: [{ at: "1B", kind: "R", seat: 1 }],
      activeSeat: 1,
    });
    // 1B is right beside seat 1's own meridian; radial move stays on rank 1.
    const move = mv(state, "1B", "1D");
    expect(move.evaporates).toBeUndefined();
  });
});

describe("queen (§5.3)", () => {
  it("combines file-wise wrap, radial, and diagonal — no bishop bounce", () => {
    const state = buildState({
      pieces: [{ at: "5B", kind: "Q", seat: 1 }],
      activeSeat: 1,
    });
    const dests = destinations(state, "5B");
    expect(dests).toContain("B20"); // wrapped far side of the ring
    expect(dests).toContain("A5");
    expect(dests).toContain("C6"); // diagonal
    expect(dests).toContain("D7"); // diagonal to the outer rail
    // A bounce continuation like 8C (via 6C,7D then reflecting) must NOT
    // exist as a queen diagonal — queens do not banana-curl.
    const diagTo8C = legalMovesFrom(state, parseSquare("5B")).filter(
      (m) => m.to === parseSquare("8C") && m.path.length === 3,
    );
    expect(diagTo8C).toHaveLength(0);
  });

  it("queens never evaporate: exempt from the halo system (§6.2)", () => {
    const state = buildState({
      pieces: [{ at: "2B", kind: "Q", seat: 1 }],
      activeSeat: 1,
    });
    // Crossing seat 1's own meridian ccw: 2B → 32B.
    const move = mv(state, "2B", "32B", { rotDir: -1 });
    expect(move.evaporates).toBeUndefined();
    expect(move.earnsHalo).toBeUndefined(); // queens never carry halos either
  });
});
