/**
 * M2 — differential testing: the optimized generator (src/legal.ts) vs the
 * deliberately naive one (test/naive.ts) across a corpus of randomly
 * played-out positions. Disagreement = a bug in one of them.
 */
import { describe, expect, it } from "vitest";
import { initialState } from "../src/state.js";
import type { BoardState } from "../src/state.js";
import type { Move } from "../src/moves.js";
import {
  applyTurn,
  legalMoves,
  legalSecondSubmoves,
} from "../src/legal.js";
import {
  naiveLegalOpeningFirsts,
  naiveLegalSubmoves,
  naiveSignatureSet,
} from "./naive.js";

/** Deterministic PRNG (mulberry32) so corpus failures reproduce exactly. */
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

function engineSig(m: Move): string {
  return [
    m.from, m.to, m.captures ?? "-", m.enPassant ? "e" : "-",
    m.promotion ?? "-", m.castle ?? "-",
    m.earnsHalo ? "H" : "-", m.evaporates ? "X" : "-", m.avenger ? "A" : "-",
  ].join("|");
}

function engineSignatureSet(moves: Move[]): Set<string> {
  return new Set(moves.map(engineSig));
}

function diffSets(a: Set<string>, b: Set<string>): string {
  const onlyA = [...a].filter((x) => !b.has(x));
  const onlyB = [...b].filter((x) => !a.has(x));
  return `engine-only: [${onlyA.join(" ; ")}]\nnaive-only: [${onlyB.join(" ; ")}]`;
}

/** Play a random legal game via the engine, collecting states along the way. */
function playout(
  seed: number,
  maxTurns: number,
): BoardState[] {
  const rand = rng(seed);
  const states: BoardState[] = [];
  let state = initialState();
  for (let t = 0; t < maxTurns; t++) {
    states.push(state);
    const firsts = legalMoves(state);
    if (firsts.length === 0) break;
    const first = firsts[Math.floor(rand() * firsts.length)] as Move;
    let turn;
    if (state.ply < 20) {
      const seconds = legalSecondSubmoves(state, first);
      if (seconds.length === 0) break;
      const second = seconds[Math.floor(rand() * seconds.length)] as Move;
      turn = { submoves: [first, second] as const };
    } else {
      turn = { submoves: [first] as const };
    }
    const result = applyTurn(state, turn);
    if (!result.ok) throw new Error(`playout ${seed}: ${result.error}`);
    state = result.state;
  }
  states.push(state);
  return states;
}

describe("differential: optimized vs naive generator", () => {
  it("agree on the initial position (opening first-submoves)", () => {
    const state = initialState();
    const engine = engineSignatureSet(legalMoves(state));
    const naive = naiveSignatureSet(naiveLegalOpeningFirsts(state));
    expect(engine, diffSets(engine, naive)).toEqual(naive);
  });

  it(
    "agree across a corpus of random positions (post-opening single moves)",
    { timeout: 240_000 },
    () => {
      let compared = 0;
      for (let seed = 1; seed <= 12; seed++) {
        const states = playout(seed * 7919, 45);
        for (const state of states) {
          if (state.ply < 20) continue; // opening handled separately
          const engine = engineSignatureSet(legalMoves(state));
          const naive = naiveSignatureSet(naiveLegalSubmoves(state));
          expect(
            engine,
            `seed ${seed} ply ${state.ply}\n${diffSets(engine, naive)}`,
          ).toEqual(naive);
          compared++;
        }
      }
      expect(compared).toBeGreaterThanOrEqual(150);
    },
  );

  it(
    "agree across opening positions (first-submove sets with pair completion)",
    { timeout: 240_000 },
    () => {
      let compared = 0;
      for (let seed = 100; seed <= 106; seed++) {
        const states = playout(seed * 104729, 19);
        for (const state of states) {
          if (state.ply >= 20) break;
          const engine = engineSignatureSet(legalMoves(state));
          const naive = naiveSignatureSet(naiveLegalOpeningFirsts(state));
          expect(
            engine,
            `seed ${seed} ply ${state.ply}\n${diffSets(engine, naive)}`,
          ).toEqual(naive);
          compared++;
        }
      }
      expect(compared).toBeGreaterThanOrEqual(30);
    },
  );
});

describe("perft — self-manufactured goldens", () => {
  /** Count legal turns to depth d (a depth-1 node in the opening = a full two-submove turn). */
  function perft(state: BoardState, depth: number): number {
    if (depth === 0) return 1;
    let nodes = 0;
    const firsts = legalMoves(state);
    for (const first of firsts) {
      if (state.ply < 20) {
        for (const second of legalSecondSubmoves(state, first)) {
          const r = applyTurn(state, { submoves: [first, second] as const });
          if (!r.ok) throw new Error(r.error);
          nodes += perft(r.state, depth - 1);
        }
      } else {
        const r = applyTurn(state, { submoves: [first] as const });
        if (!r.ok) throw new Error(r.error);
        nodes += perft(r.state, depth - 1);
      }
    }
    return nodes;
  }

  it("perft(1) from the start equals the differential-agreed turn count", () => {
    const state = initialState();
    const count = perft(state, 1);
    // Cross-check the same number by direct pair enumeration:
    let pairs = 0;
    for (const first of legalMoves(state)) {
      pairs += legalSecondSubmoves(state, first).length;
    }
    expect(count).toBe(pairs);
    // GOLDEN — recorded from the first agreed run; a change means the
    // opening move generator changed behavior. Investigate before updating.
    expect(count).toMatchInlineSnapshot(`236`);
  });

  // ~80s of CPU: runs when PERFT_DEEP=1 (CI nightly / pre-release), not on
  // every regression pass. GOLDEN recorded 2026-07-03: 55,696.
  it.runIf(process.env.PERFT_DEEP)(
    "perft(2) from the start — golden",
    { timeout: 600_000 },
    () => {
      const value = perft(initialState(), 2);
      expect(value).toMatchInlineSnapshot(`55696`);
    },
  );

  it("perft(1..2) at a fixed post-opening position — golden", () => {
    // Deterministic mid-game position: seeded playout to ply 24.
    const states = playout(31337, 24);
    const state = states[states.length - 1] as BoardState;
    expect(state.ply).toBeGreaterThanOrEqual(20);
    expect([perft(state, 1), perft(state, 2)]).toMatchInlineSnapshot(`
      [
        23,
        558,
      ]
    `);
  });
});
