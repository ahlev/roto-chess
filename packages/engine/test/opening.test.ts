/**
 * M2 fixtures — the double-move opening (§4.2): two submoves, one per side
 * of the mover's own meridian (R8: side = origin square), atomic turns,
 * R1 (per-submove self-check), R3 (castling's side anchor).
 */
import { describe, expect, it } from "vitest";
import { parseSquare, meridianSide, rankOf } from "../src/geometry.js";
import { initialState, inOpening } from "../src/state.js";
import {
  applyTurn,
  legalMoves,
  legalSecondSubmoves,
  legalTurns,
  submoveSide,
} from "../src/legal.js";
import { buildState, mv, applyOk } from "./helpers.js";

describe("opening turn structure (§4.2)", () => {
  it("the initial position offers legal opening turns, all with two submoves on opposite sides", () => {
    const state = initialState();
    expect(inOpening(state)).toBe(true);
    const turns = legalTurns(state);
    expect(turns.length).toBeGreaterThan(50);
    for (const turn of turns) {
      expect(turn.submoves).toHaveLength(2);
      const [a, b] = turn.submoves;
      expect(submoveSide(1, a)).not.toBe(submoveSide(1, b as never));
    }
  });

  it("rejects a turn with both submoves on the same side", () => {
    const state = initialState();
    const cwMoves = legalMoves(state).filter(
      (m) => meridianSide(1, rankOf(m.from)) === "cw",
    );
    expect(cwMoves.length).toBeGreaterThan(1);
    const [a, b] = [cwMoves[0], cwMoves[1]];
    const result = applyTurn(state, { submoves: [a, b] as never });
    expect(result.ok).toBe(false);
  });

  it("rejects single-submove turns during the opening and double turns after it", () => {
    const opening = initialState();
    const single = legalMoves(opening)[0];
    expect(applyTurn(opening, { submoves: [single] as never }).ok).toBe(false);

    const post = buildState({
      pieces: [{ at: "5B", kind: "R", seat: 1 }],
      activeSeat: 1,
      ply: 20,
    });
    const m = mv(post, "5B", "6B", { rotDir: 1 });
    const double = applyTurn(post, { submoves: [m, m] as never });
    expect(double.ok).toBe(false);
  });

  it("play converts to single-move turns at round 6 (ply 20)", () => {
    const state = { ...initialState(), ply: 20 };
    expect(inOpening(state)).toBe(false);
    const turns = legalTurns(state);
    expect(turns.every((t) => t.submoves.length === 1)).toBe(true);
  });

  it("a full opening round: four players each make a two-move turn", () => {
    let state = initialState();
    for (let i = 0; i < 4; i++) {
      const seatBefore = state.activeSeat;
      const turns = legalTurns(state);
      expect(turns.length).toBeGreaterThan(0);
      const result = applyTurn(state, turns[0] as never);
      expect(result.ok).toBe(true);
      if (result.ok) {
        state = result.state;
        expect(state.activeSeat).toBe((seatBefore % 4) + 1);
      }
    }
    expect(state.ply).toBe(4);
  });
});

describe("R1 — every submove independently avoids self-check", () => {
  it("a first submove that exposes the king is not offered, even if a pair could repair it", () => {
    // Seat 1's knight at 30D shields K@32D from a seat-2 rook at 28D
    // (file-D line: 28D→29D→30D→31D→32D needs 29D,30D,31D clear; the knight
    // at 30D blocks it). Moving the knight exposes the king mid-turn.
    const state = buildState({
      pieces: [
        { at: "32D", kind: "K", seat: 1 },
        { at: "30D", kind: "N", seat: 1, hasMoved: true, origin: "32C" },
        { at: "28D", kind: "R", seat: 2, hasMoved: true, origin: "9A" },
        // Give both sides a mover so pairs exist:
        { at: "2B", kind: "P", seat: 1 },
        { at: "31B", kind: "P", seat: 1 },
      ],
      activeSeat: 1,
      ply: 8,
    });
    const firsts = legalMoves(state);
    expect(firsts.some((m) => m.from === parseSquare("30D"))).toBe(false);
  });
});

describe("R3 — queenside castle as an opening submove", () => {
  it("counts as the King's origin side; the paired submove must be the other side", () => {
    // Seat 1 castles queenside: K origin 32D is the ccw side, so the other
    // submove must come from the cw side (display ranks 1–16).
    const state = buildState({
      pieces: [
        { at: "32D", kind: "K", seat: 1 },
        { at: "1D", kind: "Q", seat: 1 },
        { at: "2B", kind: "P", seat: 1 }, // cw-side pairing material
        { at: "31B", kind: "P", seat: 1 }, // ccw-side (must NOT pair)
      ],
      activeSeat: 1,
      ply: 8,
    });
    const castle = legalMoves(state).find((m) => m.castle === "queenside");
    expect(castle).toBeDefined();
    const seconds = legalSecondSubmoves(state, castle as never);
    expect(seconds.length).toBeGreaterThan(0);
    for (const m of seconds) {
      expect(meridianSide(1, rankOf(m.from))).toBe("cw");
    }
  });
});

describe("turn atomicity", () => {
  it("applyTurn is all-or-nothing: an illegal second submove changes nothing", () => {
    const state = initialState();
    const first = legalMoves(state)[0] as never;
    const bogus = { ...(first as object) } as never; // same-side duplicate
    const result = applyTurn(state, { submoves: [first, bogus] });
    expect(result.ok).toBe(false);
    // state was never mutated (applyTurn is pure — reference inputs intact)
    expect(state.ply).toBe(0);
    expect(state.board.filter(Boolean)).toHaveLength(64);
  });

  it("the ply advances exactly once per turn, opening or not", () => {
    let state = initialState();
    const r1 = applyOk(state, legalTurns(state)[0]?.submoves as never);
    state = r1.state;
    expect(state.ply).toBe(1);
  });
});
