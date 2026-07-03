/**
 * M2 review-loop fixtures — every gap the lead-dev and game-fidelity review
 * lenses named, pinned as permanent regressions.
 */
import { describe, expect, it } from "vitest";
import { parseSquare, positionKey } from "../src/index.js";
import {
  applyTurn,
  legalMoves,
  legalMovesFrom,
  legalSecondSubmoves,
} from "../src/legal.js";
import { evaluateStatus, claimableDraws } from "../src/status.js";
import type { Move } from "../src/moves.js";
import { buildState, mv, applyOk, at } from "./helpers.js";

describe("R12 — kings are never capturable", () => {
  it("a king en prise on a third player's turn cannot be captured; the engine survives", () => {
    // Seat 1's king is in check from seat 2's rook (28D line). It is seat 4's
    // turn (seat 2's PARTNER) with a rook radially "attacking" 32D.
    const state = buildState({
      pieces: [
        { at: "32D", kind: "K", seat: 1 },
        { at: "28D", kind: "R", seat: 2, hasMoved: true, origin: "9A" },
        { at: "32A", kind: "R", seat: 4, hasMoved: true, origin: "25A" },
      ],
      activeSeat: 4,
    });
    const rookMoves = legalMovesFrom(state, parseSquare("32A"));
    // The king's square is never a destination…
    expect(rookMoves.every((m) => m.to !== parseSquare("32D"))).toBe(true);
    // …but the king still blocks the ray (32B, 32C reachable).
    expect(rookMoves.some((m) => m.to === parseSquare("32C"))).toBe(true);
    // And status evaluation over the whole position never throws.
    expect(() => evaluateStatus(state)).not.toThrow();
  });

  it("check detection still sees through to the king (attack ≠ capture)", () => {
    // A bishop "attack" on a king square must register even though the
    // capture itself is not generatable.
    const state = buildState({
      pieces: [
        { at: "32D", kind: "K", seat: 1 },
        { at: "30B", kind: "B", seat: 2, hasMoved: true, origin: "8B" },
      ],
      activeSeat: 1,
    });
    // 30B → 31C → 32D is a diagonal: seat 1 is in check.
    const status = evaluateStatus(state);
    expect(status.kind === "active" && status.inCheck.includes(1)).toBe(true);
  });
});

describe("R11 — the same piece may make both opening submoves", () => {
  it("a queen crossing sides with submove 1 may move again as submove 2", () => {
    const state = buildState({
      pieces: [{ at: "2B", kind: "Q", seat: 1 }],
      activeSeat: 1,
      ply: 8,
    });
    const first = mv(state, "2B", "32B", { rotDir: -1 }); // cw side → ccw side
    const seconds = legalSecondSubmoves(state, first);
    const again = seconds.filter((m) => m.from === parseSquare("32B"));
    expect(again.length).toBeGreaterThan(0); // R11 default: allowed
  });
});

describe("threefold repetition (§8.5) — previously untested", () => {
  it("counts recurring positions and exposes the claim at three", () => {
    // All four kings pre-moved (stable startPieceMoved), shuffling D→C→D…
    // Every 8 turns the full position (placement + activeSeat) recurs.
    let state = buildState({
      pieces: [
        { at: "32D", kind: "K", seat: 1, hasMoved: true },
        { at: "9D", kind: "K", seat: 2, hasMoved: true },
        { at: "16D", kind: "K", seat: 3, hasMoved: true },
        { at: "25D", kind: "K", seat: 4, hasMoved: true },
      ],
      noAutoKings: true,
      activeSeat: 1,
      ply: 40,
    });
    const shuffle: Array<[string, string]> = [
      ["32D", "32C"], ["9D", "9C"], ["16D", "16C"], ["25D", "25C"],
      ["32C", "32D"], ["9C", "9D"], ["16C", "16D"], ["25C", "25D"],
    ];
    let claimable = false;
    for (let cycle = 0; cycle < 3 && !claimable; cycle++) {
      for (const [from, to] of shuffle) {
        state = applyOk(state, [mv(state, from, to)]).state;
        if (claimableDraws(state).threefold) {
          claimable = true;
          break;
        }
      }
    }
    expect(claimable).toBe(true);
  });

  it("positions differing ONLY in a halo flag are different positions", () => {
    const base = buildState({
      pieces: [{ at: "5B", kind: "R", seat: 1 }],
      activeSeat: 1,
    });
    const haloed = buildState({
      pieces: [{ at: "5B", kind: "R", seat: 1, halo: true }],
      activeSeat: 1,
    });
    expect(positionKey(base)).not.toBe(positionKey(haloed));
  });

  it("positions differing only in startPieceMoved (R6 rights) are different", () => {
    const a = buildState({
      pieces: [{ at: "32D", kind: "K", seat: 1 }],
      activeSeat: 1,
    });
    const b = buildState({
      pieces: [{ at: "32D", kind: "K", seat: 1 }],
      activeSeat: 1,
      startMoved: ["32B"],
    });
    expect(positionKey(a)).not.toBe(positionKey(b));
  });
});

describe("R2 — legal singles but no legal pair in the opening", () => {
  /** Seat 1: one free mover on the cw side only; everything ccw immobile. */
  function onlyOneSide() {
    return buildState({
      pieces: [
        { at: "32D", kind: "K", seat: 1 },
        { at: "31D", kind: "P", seat: 1, origin: "2D", hasMoved: true },
        { at: "31C", kind: "P", seat: 1, origin: "2C", hasMoved: true },
        { at: "32C", kind: "P", seat: 1, origin: "1C", hasMoved: true },
        { at: "1C", kind: "P", seat: 1, origin: "2C", hasMoved: true },
        { at: "1D", kind: "P", seat: 1, origin: "31D", hasMoved: true },
        { at: "2C", kind: "P", seat: 2, origin: "7C", hasMoved: true },
        { at: "12B", kind: "P", seat: 1, origin: "2B", hasMoved: true },
      ],
      activeSeat: 1,
      ply: 8, // mid-opening
    });
  }

  it("the single moves exist (post-opening the position is playable)…", () => {
    const post = { ...onlyOneSide(), ply: 20 };
    expect(legalMoves(post).length).toBeGreaterThan(0);
  });

  it("…but with no pair available the opening evaluation is stalemate", () => {
    const state = onlyOneSide();
    expect(legalMoves(state)).toHaveLength(0); // no completable first submove
    expect(evaluateStatus(state)).toEqual({
      kind: "stalemate",
      stalematedSeat: 1,
    });
  });
});

describe("castling rights — moved-and-returned pieces (§8.2.3)", () => {
  it("a king that has moved (even back home) can never castle", () => {
    const state = buildState({
      pieces: [
        { at: "32D", kind: "K", seat: 1, hasMoved: true },
        { at: "1D", kind: "Q", seat: 1 },
        { at: "32A", kind: "R", seat: 1 },
      ],
      activeSeat: 1,
      startMoved: ["32B", "32C"],
    });
    const castles = legalMovesFrom(state, parseSquare("32D")).filter(
      (m) => m.castle,
    );
    expect(castles).toHaveLength(0);
  });

  it("a rook that has moved kills kingside", () => {
    const state = buildState({
      pieces: [
        { at: "32D", kind: "K", seat: 1 },
        { at: "32A", kind: "R", seat: 1, hasMoved: true },
      ],
      activeSeat: 1,
      startMoved: ["32B", "32C"],
    });
    const castles = legalMovesFrom(state, parseSquare("32D")).filter(
      (m) => m.castle === "kingside",
    );
    expect(castles).toHaveLength(0);
  });
});

describe("halo condition 2 for knights and bishops (§6.2)", () => {
  it("a knight LANDING on an enemy back rank earns the halo", () => {
    const state = buildState({
      pieces: [{ at: "7C", kind: "N", seat: 1, hasMoved: true, origin: "1C" }],
      activeSeat: 1,
    });
    expect(mv(state, "7C", "9B").earnsHalo).toBe(true); // display 9 = P2 back rank
    expect(mv(state, "7C", "5B").earnsHalo).toBeUndefined();
  });

  it("a bishop passing THROUGH enemy back ranks mid-curl earns it", () => {
    const state = buildState({
      pieces: [{ at: "6B", kind: "B", seat: 1, hasMoved: true, origin: "1B" }],
      activeSeat: 1,
    });
    // 6B → 7C → 8D → (bounce) → 9C → 10B → 11A: passes ranks 8 and 9.
    const move = mv(state, "6B", "11A");
    expect(move.path).toHaveLength(5);
    expect(move.earnsHalo).toBe(true);
  });
});

describe("fifty-move clock details (§8.6, R15)", () => {
  it("a capture resets the clock", () => {
    const state = buildState({
      pieces: [
        { at: "5B", kind: "R", seat: 1, halo: true },
        { at: "5C", kind: "P", seat: 2 },
      ],
      activeSeat: 1,
      halfmoveClock: 30,
    });
    const { state: after } = applyOk(state, [mv(state, "5B", "5C")]);
    expect(after.halfmoveClock).toBe(0);
  });

  it("an evaporation does NOT reset the clock (R15 — §8.6 read literally)", () => {
    const state = buildState({
      pieces: [{ at: "2B", kind: "N", seat: 1 }],
      activeSeat: 1,
      halfmoveClock: 30,
    });
    const { state: after } = applyOk(state, [mv(state, "2B", "32C")]);
    expect(after.halfmoveClock).toBe(31);
  });
});

describe("pawn details", () => {
  it("a double step is blocked by a piece on the INTERMEDIATE square", () => {
    const state = buildState({
      pieces: [
        { at: "2B", kind: "P", seat: 1 },
        { at: "3B", kind: "N", seat: 2 }, // sits on the passed-over square
      ],
      activeSeat: 1,
    });
    const dests = legalMovesFrom(state, parseSquare("2B")).map((m) => m.to);
    expect(dests).not.toContain(parseSquare("4B"));
    expect(dests).not.toContain(parseSquare("3B")); // forward can't capture
  });
});

describe("avenger × opening (§6.4 × §4.2)", () => {
  it("an avenger crossing works as an opening submove", () => {
    const state = buildState({
      pieces: [
        { at: "1C", kind: "N", seat: 1 }, // unmoved on origin, cw side
        { at: "31A", kind: "P", seat: 1 }, // ccw-side pairing material
      ],
      activeSeat: 1,
      ply: 8,
      avengeableLoss: [true, false],
    });
    const first = mv(state, "1C", "31B"); // crosses the meridian
    expect(first.avenger).toBe(true);
    const result = applyTurn(state, {
      submoves: [
        first,
        legalSecondSubmoves(state, first).find(
          (m) => m.from === parseSquare("31A"),
        ) as Move,
      ] as const,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(at(result.state, "31B")?.kind).toBe("N"); // survived, unhaloed
      expect(at(result.state, "31B")?.halo).toBe(false);
    }
  });
});

describe("malformed input never throws (server authority totality)", () => {
  it("applyTurn rejects garbage shapes gracefully", () => {
    const state = buildState({
      pieces: [{ at: "5B", kind: "R", seat: 1 }],
      activeSeat: 1,
    });
    for (const bad of [
      { submoves: null },
      { submoves: [null] },
      { submoves: [42] },
      {},
      { submoves: [{ from: 9999, to: -1, path: [] }] },
    ]) {
      const result = applyTurn(state, bad as never);
      expect(result.ok).toBe(false);
    }
  });
});
