/**
 * M2 fixtures — §7.3, the rule that bites builders trained on standard
 * chess: it is NOT checkmate until the threatened player is to move and has
 * no legal turn. Intervening players may resolve the check first.
 */
import { describe, expect, it } from "vitest";

import { evaluateStatus, claimableDraws } from "../src/status.js";
import { isInCheck } from "../src/legal.js";
import { buildState, mv, applyOk, type StateSpec } from "./helpers.js";

/**
 * The smother: seat 1's king at 32D boxed in by its own pawns, every pawn
 * pointed INTO the blockade (origins chosen so no pawn can move or capture
 * the checker), plus one free pawn far away at 12B so seat 1 always has a
 * move when NOT in check (distinguishing checkmate from stalemate).
 * Seat 2's knight at 4B will deliver check by jumping to 2C.
 */
function smotherSpec(extra: StateSpec["pieces"] = []): StateSpec {
  return {
    pieces: [
      { at: "32D", kind: "K", seat: 1 },
      { at: "31D", kind: "P", seat: 1, origin: "2D", hasMoved: true },
      { at: "31C", kind: "P", seat: 1, origin: "2C", hasMoved: true },
      { at: "32C", kind: "P", seat: 1, origin: "1C", hasMoved: true },
      { at: "1C", kind: "P", seat: 1, origin: "2C", hasMoved: true },
      { at: "1D", kind: "P", seat: 1, origin: "31D", hasMoved: true },
      { at: "12B", kind: "P", seat: 1, origin: "2B", hasMoved: true },
      { at: "4B", kind: "N", seat: 2, hasMoved: true, origin: "1C" },
      ...extra,
    ],
    activeSeat: 2,
    ply: 30,
  };
}

describe("§7.3 — checkmate timing", () => {
  it("a delivered 'mate' is NOT checkmate while other players still move first", () => {
    const state = buildState(smotherSpec());
    const { state: afterCheck } = applyOk(state, [mv(state, "4B", "2C")]);

    // Seat 1 is in what standard chess would call mate...
    expect(isInCheck(afterCheck, 1)).toBe(true);
    // ...but it's seat 3's turn: the game is ACTIVE.
    expect(afterCheck.activeSeat).toBe(3);
    const status = evaluateStatus(afterCheck);
    expect(status.kind).toBe("active");
    if (status.kind === "active") {
      expect(status.inCheck).toContain(1);
    }
  });

  it("becomes checkmate only when the threatened player's turn arrives unresolved", () => {
    const state = buildState(smotherSpec());
    let s = applyOk(state, [mv(state, "4B", "2C")]).state;
    // Seats 3 and 4 shuffle their kings without interfering.
    s = applyOk(s, [mv(s, "16D", "15D")]).state;
    expect(evaluateStatus(s).kind).toBe("active"); // still seat 4 to move
    s = applyOk(s, [mv(s, "25D", "24D")]).state;

    // NOW it is seat 1's turn, still in check, no legal turn:
    expect(s.activeSeat).toBe(1);
    const status = evaluateStatus(s);
    expect(status).toEqual({
      kind: "checkmate",
      matedSeat: 1,
      winningTeam: 2,
    });
  });

  it("an intervening player (the partner, §7.2 — voluntarily) can capture the checker", () => {
    // Same smother, but seat 3 has a rook at 2A that can take the knight.
    const state = buildState(
      smotherSpec([{ at: "2A", kind: "R", seat: 3, hasMoved: true, origin: "17A" }]),
    );
    let s = applyOk(state, [mv(state, "4B", "2C")]).state;
    expect(isInCheck(s, 1)).toBe(true);

    // Seat 3 rescues its partner:
    s = applyOk(s, [mv(s, "2A", "2C")]).state;
    expect(isInCheck(s, 1)).toBe(false);
    s = applyOk(s, [mv(s, "25D", "24D")]).state; // seat 4 shuffles

    // Seat 1's turn arrives with no check — game continues (the free pawn moves).
    expect(s.activeSeat).toBe(1);
    expect(evaluateStatus(s).kind).toBe("active");
    const pawnMove = mv(s, "12B", "13B");
    expect(pawnMove).toBeDefined();
  });

  it("§7.1: while in check, unrelated moves are illegal (check must be addressed)", () => {
    const state = buildState(smotherSpec());
    let s = applyOk(state, [mv(state, "4B", "2C")]).state;
    s = applyOk(s, [mv(s, "16D", "15D")]).state;
    s = applyOk(s, [mv(s, "25D", "24D")]).state;
    // Seat 1 in check: the faraway free pawn cannot move (leaves king in check).
    expect(() => mv(s, "12B", "13B")).toThrow(/No legal move/);
  });

  it("§7.2: a player is never constrained by their PARTNER's check", () => {
    const state = buildState(smotherSpec());
    const s = applyOk(state, [mv(state, "4B", "2C")]).state;
    // Seat 3 (partner of the checked seat 1) may play anything — including
    // moves that ignore the check entirely.
    expect(evaluateStatus(s).kind).toBe("active");
    expect(mv(s, "16D", "15D")).toBeDefined(); // legal despite partner's plight
  });
});

describe("stalemate (§8.4)", () => {
  it("no legal turn while NOT in check is a draw for all four", () => {
    // Remove the free pawn and the checker; block the 1C pawn's advance
    // with a harmless enemy pawn at 2C (it attacks only 1B/1D diagonals,
    // never the king — no check anywhere).
    const spec = smotherSpec([
      { at: "2C", kind: "P", seat: 2, origin: "7C", hasMoved: true },
    ]);
    spec.pieces = spec.pieces.filter((p) => !(p.at === "12B" || p.at === "4B"));
    spec.activeSeat = 1;
    const state = buildState(spec);
    const status = evaluateStatus(state);
    expect(status).toEqual({ kind: "stalemate", stalematedSeat: 1 });
  });
});

describe("draw claims (§8.5, §8.6)", () => {
  it("fifty-move claimability tracks player-turns without pawn moves or captures", () => {
    const state = buildState({
      pieces: [{ at: "5B", kind: "R", seat: 1, halo: true }],
      activeSeat: 1,
      halfmoveClock: 49,
    });
    expect(claimableDraws(state).fiftyMove).toBe(false);
    const { state: after } = applyOk(state, [mv(state, "5B", "6B", { rotDir: 1 })]);
    expect(after.halfmoveClock).toBe(50);
    expect(claimableDraws(after).fiftyMove).toBe(true);
  });

  it("a pawn move resets the fifty-move clock", () => {
    const state = buildState({
      pieces: [{ at: "2B", kind: "P", seat: 1 }],
      activeSeat: 1,
      halfmoveClock: 49,
    });
    const { state: after } = applyOk(state, [mv(state, "2B", "3B")]);
    expect(after.halfmoveClock).toBe(0);
  });
});
