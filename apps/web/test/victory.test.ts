/**
 * victoryContext turns a finished game into the "clever context" the victory
 * screen speaks. These fixtures play REAL mates through the engine (asserted
 * with evaluateStatus, so a fixture that isn't actually mate fails loudly),
 * then check the derived narration.
 *
 * Two shapes matter:
 *  - a DIRECT mate (the last move lands the check) → the piece is named;
 *  - a DELAYED §7.3 mate (the check was sealed earlier; intervening players
 *    shuffle) → we must NOT misattribute it to the last shuffler, and the
 *    mated seat still resolves from the final position, not the last mover.
 */
import { describe, it, expect } from "vitest";
import {
  applyTurn,
  evaluateStatus,
  legalMovesFrom,
  parseSquare,
  type BoardState,
  type Turn,
} from "@rotochess/engine";
import { demoState } from "../src/lib/game/demo-positions";
import { victoryContext } from "../src/lib/game/victory";

/** Build the single-submove turn `from→to` legal in `state` (post-opening). */
function turnFor(state: BoardState, from: string, to: string): Turn {
  const move = legalMovesFrom(state, parseSquare(from)).find(
    (m) => m.to === parseSquare(to),
  );
  if (!move) throw new Error(`no legal move ${from} → ${to}`);
  return { submoves: [move] };
}

/** Play a sequence, returning the collected turns and the terminal state. */
function play(
  initial: BoardState,
  steps: [string, string][],
): { turns: Turn[]; final: BoardState } {
  let s = initial;
  const turns: Turn[] = [];
  for (const [from, to] of steps) {
    const t = turnFor(s, from, to);
    const r = applyTurn(s, t);
    if (!r.ok) throw new Error(`illegal ${from} → ${to}: ${r.error}`);
    turns.push(t);
    s = r.state;
  }
  return { turns, final: s };
}

// The §7.3 smother: seat 1's king boxed by its own pawns, one free pawn far
// away so it has a move only when NOT in check (distinguishing mate from
// stalemate). Seats 2/3/4 kings are auto-seated at home by demoState.
const smother = [
  { at: "32D", kind: "K" as const, seat: 1 as const },
  { at: "31D", kind: "P" as const, seat: 1 as const, origin: "2D", hasMoved: true },
  { at: "31C", kind: "P" as const, seat: 1 as const, origin: "2C", hasMoved: true },
  { at: "32C", kind: "P" as const, seat: 1 as const, origin: "1C", hasMoved: true },
  { at: "1C", kind: "P" as const, seat: 1 as const, origin: "2C", hasMoved: true },
  { at: "1D", kind: "P" as const, seat: 1 as const, origin: "31D", hasMoved: true },
  { at: "12B", kind: "P" as const, seat: 1 as const, origin: "2B", hasMoved: true },
];

describe("victoryContext — checkmate", () => {
  it("names the piece on a DIRECT mate (last move lands the check)", () => {
    // West (seat 4) to move; its knight at 1A jumps to 2C — the proven smother
    // square (§7.3 fixture) that attacks the North king at 32D inescapably.
    // North is then to move, mated, on the very move that landed the check.
    const initial = demoState(
      [...smother, { at: "1A", kind: "N", seat: 4 }],
      4,
      { ply: 30 },
    );
    const { turns, final } = play(initial, [["1A", "2C"]]);
    expect(evaluateStatus(final)).toEqual({
      kind: "checkmate",
      matedSeat: 1,
      winningTeam: 2,
    });

    const ctx = victoryContext({ reason: "checkmate", winningTeam: 2, turns, initial });
    expect(ctx.matedSeat).toBe(1);
    expect(ctx.matedName).toBe("North");
    expect(ctx.matingSeat).toBe(4);
    expect(ctx.matingName).toBe("West");
    expect(ctx.matingPieceName).toBe("knight");
    expect(ctx.matingSquare).toBe("C2");
    expect(ctx.turns).toBe(31);
    expect(ctx.headline).toBe("The crown is taken.");
    expect(ctx.winnerLine).toBe("Black & Gold reign.");
    expect(ctx.detail).toBe(
      "West's knight closed the ring on North's king — checkmate on turn 31.",
    );
  });

  it("does NOT misattribute a DELAYED §7.3 mate, but still names the mated seat", () => {
    // East (seat 2) knight jumps to 2C, sealing the smother — but it isn't
    // mate until North is to move. Seats 3 and 4 shuffle their kings first;
    // the LAST mover is West's king, which did not deliver the check.
    const initial = demoState(
      [...smother, { at: "4B", kind: "N", seat: 2, origin: "1C", hasMoved: true }],
      2,
      { ply: 30 },
    );
    const { turns, final } = play(initial, [
      ["4B", "2C"],
      ["16D", "15D"],
      ["25D", "24D"],
    ]);
    expect(evaluateStatus(final)).toEqual({
      kind: "checkmate",
      matedSeat: 1,
      winningTeam: 2,
    });

    const ctx = victoryContext({ reason: "checkmate", winningTeam: 2, turns, initial });
    expect(ctx.matedSeat).toBe(1); // from the final position, not the last mover
    expect(ctx.matedName).toBe("North");
    expect(ctx.matingPieceName).toBeNull(); // last move didn't check → no piece named
    expect(ctx.matingSeat).toBeNull();
    expect(ctx.turns).toBe(33);
    expect(ctx.detail).toBe(
      "Black & Gold closed the ring on North's king — checkmate on turn 33.",
    );
  });
});

describe("victoryContext — non-checkmate reasons", () => {
  it("reads a draw with no winner", () => {
    const ctx = victoryContext({ reason: "stalemate", winningTeam: null, turns: [] });
    expect(ctx.winningTeam).toBeNull();
    expect(ctx.headline).toBe("The crown stays on the table.");
    expect(ctx.detail).toBe("A draw — all four hands empty.");
  });

  it("reads a resignation as a win for the standing team", () => {
    const initial = demoState([...smother, { at: "1A", kind: "N", seat: 4 }], 4, {
      ply: 30,
    });
    const { turns } = play(initial, [["1A", "2C"]]);
    const ctx = victoryContext({ reason: "resignation", winningTeam: 2, turns, initial });
    expect(ctx.headline).toBe("Black & Gold take it.");
    expect(ctx.winnerLine).toBe("Black & Gold reign.");
    expect(ctx.detail).toBe("North's king tips.");
  });
});
