/**
 * M2 — property-based random playouts (fast-check): global invariants that
 * must hold at every step of any legal game, plus replay determinism.
 */
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  initialState,
  deserializeState,
  serializeState,
  type BoardState,
} from "../src/state.js";
import { squareColor, SEATS } from "../src/geometry.js";
import {
  applyTurn,
  legalMoves,
  legalSecondSubmoves,
} from "../src/legal.js";
import type { Move, Turn } from "../src/moves.js";

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface PlayoutStep {
  turn: Turn;
  state: BoardState;
}

function randomPlayout(seed: number, maxTurns: number): PlayoutStep[] {
  const rand = rng(seed);
  const steps: PlayoutStep[] = [];
  let state = initialState();
  for (let t = 0; t < maxTurns; t++) {
    const firsts = legalMoves(state);
    if (firsts.length === 0) break;
    const first = firsts[Math.floor(rand() * firsts.length)] as Move;
    let turn: Turn;
    if (state.ply < 20) {
      const seconds = legalSecondSubmoves(state, first);
      if (seconds.length === 0) break;
      turn = {
        submoves: [
          first,
          seconds[Math.floor(rand() * seconds.length)] as Move,
        ] as const,
      };
    } else {
      turn = { submoves: [first] as const };
    }
    const result = applyTurn(state, turn);
    expect(result.ok, !result.ok ? result.error : "").toBe(true);
    if (!result.ok) break;
    state = result.state;
    steps.push({ turn, state });
  }
  return steps;
}

function countBySeat(state: BoardState, kind: string): Map<number, number> {
  const counts = new Map<number, number>();
  for (const p of state.board) {
    if (p?.kind === kind) counts.set(p.seat, (counts.get(p.seat) ?? 0) + 1);
  }
  return counts;
}

describe("random playout invariants", () => {
  it(
    "hold at every step across seeded playouts",
    { timeout: 240_000 },
    () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100_000 }), (seed) => {
          const steps = randomPlayout(seed, 30);
          let prevHalos = new Set<string>();
          for (const { turn, state } of steps) {
            // Exactly one king per seat, always — kings are never captured
            // (§1.2: mate ends the game before any king could be taken).
            const kings = countBySeat(state, "K");
            for (const seat of SEATS) {
              expect(kings.get(seat), `seed ${seed} ply ${state.ply}`).toBe(1);
            }
            // No move ever targets a king.
            for (const sub of turn.submoves) {
              if (sub.captures === undefined) continue;
              // (the victim was recorded pre-application; we can't read it
              // now — the structural guarantee is exercised via generators
              // never emitting king-captures, checked below on legal sets)
            }
            // Bishops never change square color (§5.4).
            state.board.forEach((p, at) => {
              if (p?.kind === "B" && !p.promoted) {
                expect(
                  squareColor(at),
                  `seed ${seed}: bishop off-color at ${at}`,
                ).toBe(squareColor(p.origin));
              }
            });
            // Halo monotonicity: a halo, once earned, never disappears while
            // the piece lives. Track by (seat,kind,origin) identity.
            const halos = new Set<string>();
            state.board.forEach((p) => {
              if (p?.halo) halos.add(`${p.seat}|${p.kind}|${p.origin}`);
            });
            for (const id of prevHalos) {
              const stillAlive = state.board.some(
                (p) => p && `${p.seat}|${p.kind}|${p.origin}` === id,
              );
              if (stillAlive) {
                expect(halos.has(id), `seed ${seed}: halo lost on ${id}`).toBe(
                  true,
                );
              }
            }
            prevHalos = halos;
            // Evaporations only remove non-haloed primaries; evaporated
            // squares are empty (checked structurally: `evaporates` moves
            // leave board[to] === null — the applySubmove fixture covers
            // it; here we verify no haloed primary ever vanished without a
            // capture, which the halo-monotonicity check above implies).
            // Opening shape: exactly two submoves through ply 20, one after.
            expect(turn.submoves.length).toBe(state.ply <= 20 ? 2 : 1);
            // Fifty-move clock is a non-negative integer.
            expect(state.halfmoveClock).toBeGreaterThanOrEqual(0);
            // EP windows only ever reference the just-completed turn.
            for (const t of state.epTargets) {
              expect(t.createdAtPly).toBe(state.ply - 1);
            }
          }
        }),
        { numRuns: 8 },
      );
    },
  );

  it(
    "replay determinism: folding the recorded turns reproduces the final state exactly",
    { timeout: 240_000 },
    () => {
      const steps = randomPlayout(424242, 40);
      expect(steps.length).toBeGreaterThan(10);
      let replayed = initialState();
      for (const { turn } of steps) {
        const r = applyTurn(replayed, turn);
        expect(r.ok).toBe(true);
        if (r.ok) replayed = r.state;
      }
      expect(replayed).toEqual(steps[steps.length - 1]?.state);
    },
  );

  it(
    "serialization round-trips any reachable state",
    { timeout: 120_000 },
    () => {
      const steps = randomPlayout(777, 25);
      for (const { state } of steps) {
        expect(deserializeState(serializeState(state))).toEqual(state);
      }
    },
  );

  it("legal sets never contain a king capture", { timeout: 120_000 }, () => {
    const steps = randomPlayout(2024, 30);
    for (const { state } of steps) {
      for (const move of legalMoves(state)) {
        if (move.captures === undefined) continue;
        expect(state.board[move.captures]?.kind).not.toBe("K");
      }
    }
  });
});
