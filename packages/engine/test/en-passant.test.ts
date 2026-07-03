/**
 * M2 fixtures — en passant (§8.1) and its four-player wrinkles (ruling R5):
 * window scope, expiry, and behavior inside the double-move opening.
 */
import { describe, expect, it } from "vitest";
import { parseSquare } from "../src/geometry.js";
import { legalMovesFrom } from "../src/legal.js";
import { buildState, mv, applyOk, at } from "./helpers.js";

describe("standard en passant (§8.1)", () => {
  /**
   * Seat 2's pawn at 10B (unmoved) double-steps to 12B, passing 11B.
   * Seat 3's pawn at 12C (advancing counterclockwise toward the East
   * meridian) could have captured at 11B had it advanced one square.
   */
  function afterDoubleStep() {
    const state = buildState({
      pieces: [
        { at: "10B", kind: "P", seat: 2 },
        { at: "12C", kind: "P", seat: 3, origin: "15C", hasMoved: true },
      ],
      activeSeat: 2,
      ply: 21,
    });
    return applyOk(state, [mv(state, "10B", "12B")]).state;
  }

  it("a double step opens an EP window on the passed-over square", () => {
    const after = afterDoubleStep();
    expect(after.epTargets).toHaveLength(1);
    expect(after.epTargets[0]?.square).toBe(parseSquare("11B"));
    expect(after.epTargets[0]?.pawnSquare).toBe(parseSquare("12B"));
  });

  it("the immediately-following player may capture as if the pawn advanced one", () => {
    const after = afterDoubleStep(); // seat 3 to move
    const ep = mv(after, "12C", "11B");
    expect(ep.enPassant).toBe(true);
    expect(ep.captures).toBe(parseSquare("12B")); // victim ≠ destination
    const { state: done } = applyOk(after, [ep]);
    expect(at(done, "11B")?.kind).toBe("P");
    expect(at(done, "11B")?.seat).toBe(3);
    expect(at(done, "12B")).toBeNull();
  });

  it("R5: the window closes when the following player's turn completes", () => {
    const after = afterDoubleStep();
    // Seat 3 plays something else (king move) instead of capturing.
    const { state: next } = applyOk(after, [mv(after, "16D", "15D")]);
    expect(next.epTargets).toHaveLength(0);
    // Turn cycles back around to seat 3 eventually; the capture is gone now —
    // verify directly that no EP move exists for the 12C pawn anymore.
    const later = { ...next, activeSeat: 3 as const };
    const moves = legalMovesFrom(later, parseSquare("12C"));
    expect(moves.every((m) => m.enPassant !== true)).toBe(true);
  });
});

describe("en passant × the double-move opening (R5 wrinkles)", () => {
  it("a double-step as submove 1 still presents its target after submove 2", () => {
    // Seat 1's opening turn: 2B double-steps (clockwise side), then a
    // counterclockwise-side pawn advances. The EP window from submove 1
    // must survive the whole turn.
    const state = buildState({
      pieces: [
        { at: "2B", kind: "P", seat: 1 },
        { at: "31B", kind: "P", seat: 1 },
      ],
      activeSeat: 1,
      ply: 4, // round 2 of the opening
    });
    const first = mv(state, "2B", "4B");
    const result = applyOk(state, [first, {
      ...mv(state, "31B", "30B"),
      // legalSecondSubmoves recomputes; passing the pre-turn move object is
      // fine because 31B's options don't depend on 2B's move.
    }]);
    expect(result.state.epTargets).toHaveLength(1);
    expect(result.state.epTargets[0]?.square).toBe(parseSquare("3B"));
  });

  it("one opening turn can open TWO windows (a double-step on each side)", () => {
    const state = buildState({
      pieces: [
        { at: "2B", kind: "P", seat: 1 },
        { at: "31B", kind: "P", seat: 1 },
      ],
      activeSeat: 1,
      ply: 4,
    });
    const result = applyOk(state, [
      mv(state, "2B", "4B"),
      mv(state, "31B", "29B"),
    ]);
    expect(result.state.epTargets).toHaveLength(2);
  });

  it("during the opening, EP capture is available to either submove of the following turn", () => {
    // Seat 1 double-stepped 2B→4B (target 3B). Seat 2's opening turn: its
    // counterclockwise-side pawn at 4C can EP-capture at 3B as submove 1 or 2.
    const base = buildState({
      pieces: [
        { at: "2B", kind: "P", seat: 1 },
        { at: "31B", kind: "P", seat: 1 },
        { at: "4C", kind: "P", seat: 2, origin: "7C", hasMoved: true },
        { at: "10B", kind: "P", seat: 2 },
      ],
      activeSeat: 1,
      ply: 4,
    });
    const seat2turn = applyOk(base, [
      mv(base, "2B", "4B"),
      mv(base, "31B", "30B"),
    ]).state;

    // As submove 1:
    const epFirst = mv(seat2turn, "4C", "3B");
    expect(epFirst.enPassant).toBe(true);
    // Complete the turn with a clockwise-side move:
    const done1 = applyOk(seat2turn, [
      epFirst,
      // recompute second submoves against the intermediate state is done
      // internally by applyTurn's legalSecondSubmoves matching
      { ...mv(seat2turn, "10B", "11B") },
    ]);
    expect(at(done1.state, "3B")?.seat).toBe(2);
    expect(at(done1.state, "4B")).toBeNull(); // victim removed

    // As submove 2 (other order):
    const first = mv(seat2turn, "10B", "11B");
    const done2 = applyOk(seat2turn, [first, epFirst]);
    expect(at(done2.state, "3B")?.seat).toBe(2);
    expect(at(done2.state, "4B")).toBeNull();
  });
});
