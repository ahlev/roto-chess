import { describe, expect, it } from "vitest";
import type { Move, Square, Turn } from "@rotochess/engine";
import { recentMovesBySeat } from "@/lib/game/recentMoves";

/** Minimal legal-move shape — only from/to/path matter here. */
function mv(from: Square, to: Square): Move {
  return { from, to, path: [to] };
}
const turn = (...moves: Move[]): Turn =>
  ({ submoves: moves as unknown as Turn["submoves"] });

describe("recentMovesBySeat", () => {
  it("returns nothing before any move", () => {
    expect(recentMovesBySeat([])).toEqual([]);
  });

  it("maps each seat to its most recent move (seats rotate 1→2→3→4)", () => {
    // 5 turns: seat 1 has moved twice (turn 0 and turn 4); the newer wins.
    const turns: Turn[] = [
      turn(mv(0, 1)), // seat 1 (old)
      turn(mv(10, 11)), // seat 2
      turn(mv(20, 21)), // seat 3
      turn(mv(30, 31)), // seat 4
      turn(mv(2, 3)), // seat 1 (new)
    ];
    const got = recentMovesBySeat(turns);
    const bySeat = new Map(got.map((m) => [m.seat, m]));
    expect(bySeat.get(1)).toEqual({ seat: 1, from: 2, to: 3 });
    expect(bySeat.get(2)).toEqual({ seat: 2, from: 10, to: 11 });
    expect(bySeat.get(3)).toEqual({ seat: 3, from: 20, to: 21 });
    expect(bySeat.get(4)).toEqual({ seat: 4, from: 30, to: 31 });
    expect(got).toHaveLength(4);
  });

  it("uses the FINAL submove of an opening (two-move) turn", () => {
    const turns: Turn[] = [turn(mv(0, 5), mv(5, 9))]; // seat 1 opening
    expect(recentMovesBySeat(turns)).toEqual([{ seat: 1, from: 5, to: 9 }]);
  });

  it("covers only the seats that have moved so far", () => {
    const turns: Turn[] = [turn(mv(0, 1)), turn(mv(10, 11))]; // seats 1, 2
    const seats = recentMovesBySeat(turns).map((m) => m.seat).sort();
    expect(seats).toEqual([1, 2]);
  });
});
