import { describe, expect, it } from "vitest";
import { applyTurn, legalMoves } from "@rotochess/engine";
import { SCRIPT, buildScript, cellsOf, heroBishop, heroKnight, piecesOf } from "../src/board/script";

describe("scripted opening", () => {
  it("plays 16 legal plies from the initial position", () => {
    expect(SCRIPT.turns).toHaveLength(16);
    expect(SCRIPT.states).toHaveLength(17);
    SCRIPT.turns.forEach((turn, i) => {
      const r = applyTurn(SCRIPT.states[i]!, turn);
      expect(r.ok).toBe(true);
    });
    expect(piecesOf(SCRIPT.states[0]!)).toHaveLength(64);
  });

  it("is deterministic across independent runs", () => {
    const sig = (turns: readonly { submoves: readonly { from: number; to: number }[] }[]) =>
      turns.map((t) => t.submoves.map((m) => `${m.from}-${m.to}`).join("&"));
    expect(sig(buildScript(16).turns)).toEqual(sig(SCRIPT.turns));
    expect(sig(buildScript(16).turns)).toEqual(sig(buildScript(16).turns));
  });

  it("has a West bishop curl at ply 11 as the hero move", () => {
    const { move, before, after } = heroBishop();
    const mover = before.board[move.from];
    expect(before.ply).toBe(11);
    expect(before.activeSeat).toBe(4);
    expect(mover?.seat).toBe(4);
    expect(after.board[move.to]?.kind).toBe("B");
    expect(mover?.kind).toBe("B");
    expect(move.path.length).toBeGreaterThanOrEqual(2);
    expect(cellsOf(move)).toHaveLength(move.path.length + 1);
  });

  it("has a legal South knight leap at ply 14", () => {
    const { move, state } = heroKnight();
    expect(state.activeSeat).toBe(3);
    expect(state.board[move.from]?.kind).toBe("N");
    expect(legalMoves(state).some((m) => m.from === move.from && m.to === move.to)).toBe(true);
    expect(cellsOf(move)).toHaveLength(2);
  });
});
