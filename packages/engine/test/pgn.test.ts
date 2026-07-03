/**
 * M3 — Roto-PGN round-trip and Game-layer fold. All sample tokens here are
 * ENGINE-GENERATED (Andrew's rule: never hand-write spec examples).
 */
import { describe, expect, it } from "vitest";
import { initialState } from "../src/state.js";
import {
  applyTurn,
  legalMoves,
  legalSecondSubmoves,
} from "../src/legal.js";
import type { BoardState } from "../src/state.js";
import type { Move, Turn } from "../src/moves.js";
import {
  moveToToken,
  parseGame,
  serializeGame,
  turnToToken,
} from "../src/pgn.js";
import {
  gameFromRotoPgn,
  gameToRotoPgn,
  playGame,
  resultHeaderOf,
  stateAtPly,
} from "../src/game.js";
import { buildState, mv } from "./helpers.js";

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

function randomTurns(seed: number, maxTurns: number): Turn[] {
  const rand = rng(seed);
  const turns: Turn[] = [];
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
        submoves: [first, seconds[Math.floor(rand() * seconds.length)] as Move] as const,
      };
    } else {
      turn = { submoves: [first] as const };
    }
    const r = applyTurn(state, turn);
    if (!r.ok) throw new Error(r.error);
    turns.push(turn);
    state = r.state;
  }
  return turns;
}

describe("token shape", () => {
  it("canonical tokens are rank-first with P required (R10)", () => {
    const state = buildState({
      pieces: [{ at: "2B", kind: "P", seat: 1 }],
      activeSeat: 1,
    });
    expect(moveToToken(state, mv(state, "2B", "3B"))).toBe("P2B-3B");
  });

  it("captures use x; halo/evaporation/avenger suffix correctly", () => {
    const state = buildState({
      pieces: [
        { at: "5B", kind: "R", seat: 1 },
        { at: "5C", kind: "P", seat: 2 },
      ],
      activeSeat: 1,
    });
    expect(moveToToken(state, mv(state, "5B", "5C"))).toBe("R5Bx5C*");
  });

  it("evaporating capture carries BOTH marks: halo earned (*), then evaporated (†)", () => {
    const state = buildState({
      pieces: [
        { at: "2B", kind: "N", seat: 1 },
        { at: "32C", kind: "P", seat: 2, hasMoved: true, origin: "10C" },
      ],
      activeSeat: 1,
    });
    expect(moveToToken(state, mv(state, "2B", "32C"))).toBe("N2Bx32C*†");
  });

  it("castles are O-O and O-O-O", () => {
    const q = buildState({
      pieces: [
        { at: "32D", kind: "K", seat: 1 },
        { at: "1D", kind: "Q", seat: 1 },
      ],
      activeSeat: 1,
    });
    expect(moveToToken(q, mv(q, "32D", "1D"))).toBe("O-O-O");
    const k = buildState({
      pieces: [
        { at: "32D", kind: "K", seat: 1 },
        { at: "32A", kind: "R", seat: 1 },
      ],
      activeSeat: 1,
      startMoved: ["32B", "32C"],
    });
    expect(moveToToken(k, mv(k, "32D", "32A"))).toBe("O-O");
  });

  it("opening turns join with & and en passant marks e.p.", () => {
    const state = initialState();
    const firsts = legalMoves(state);
    const first = firsts[0] as Move;
    const second = legalSecondSubmoves(state, first)[0] as Move;
    const { token } = turnToToken(state, { submoves: [first, second] as const });
    expect(token).toContain("&");
  });
});

describe("round-trip property", () => {
  it(
    "serialize → parse reproduces the exact turn list and final state, across seeds",
    { timeout: 240_000 },
    () => {
      for (const seed of [11, 222, 3333, 44444]) {
        const turns = randomTurns(seed, 32);
        expect(turns.length).toBeGreaterThan(5);
        const text = serializeGame({
          headers: { event: `Seed ${seed}`, north: "N", east: "E", south: "S", west: "W" },
          turns,
        });
        const parsed = parseGame(text);
        expect(parsed.turns.length, `seed ${seed}`).toBe(turns.length);
        const original = playGame(turns).finalState;
        expect(parsed.finalState, `seed ${seed}`).toEqual(original);
        // And the reserialization is byte-identical (canonical form):
        const text2 = serializeGame({
          headers: { event: `Seed ${seed}`, north: "N", east: "E", south: "S", west: "W" },
          turns: parsed.turns,
        });
        expect(text2).toBe(text);
      }
    },
  );

  it("headers survive the trip", () => {
    const turns = randomTurns(7, 8);
    const text = serializeGame({
      headers: {
        event: "The Thursday Board",
        site: "rotochess.app",
        date: "2026.07.03",
        north: "Cashin", east: "GK", south: "Danny", west: "Andrew",
      },
      turns,
    });
    const parsed = parseGame(text);
    expect(parsed.headers.event).toBe("The Thursday Board");
    expect(parsed.headers.west).toBe("Andrew");
    expect(parsed.headers.result).toBe("*");
  });
});

describe("game layer", () => {
  it("playGame folds deterministically and stateAtPly scrubs", () => {
    const turns = randomTurns(99, 24);
    const fold = playGame(turns);
    expect(fold.steps).toHaveLength(turns.length);
    const mid = stateAtPly(turns, 10);
    expect(mid.ply).toBe(10);
    expect(fold.steps[9]?.state).toEqual(mid);
  });

  it("gameToRotoPgn derives result headers from the fold", () => {
    const turns = randomTurns(5, 12);
    const text = gameToRotoPgn(turns, { event: "Header derivation" });
    expect(text).toContain('[Result "*"]'); // random short game: ongoing
    const parsed = gameFromRotoPgn(text);
    expect(parsed.turns.length).toBe(turns.length);
  });

  it("resultHeaderOf maps teams to compass pairs", () => {
    expect(
      resultHeaderOf({ kind: "checkmate", matedSeat: 1, winningTeam: 2 }),
    ).toBe("EW");
    expect(
      resultHeaderOf({ kind: "checkmate", matedSeat: 2, winningTeam: 1 }),
    ).toBe("NS");
    expect(resultHeaderOf({ kind: "stalemate", stalematedSeat: 3 })).toBe(
      "draw",
    );
  });

  it("a corrupt record fails loudly, not silently", () => {
    const turns = randomTurns(13, 6);
    const text = serializeGame({ turns });
    const corrupted = text.replace(/P(\d+)B-/u, "P$1C-");
    expect(() => parseGame(corrupted)).toThrow();
  });
});

describe("engine-generated spec examples (for the docs)", () => {
  it("prints a legal opening round for documentation use", () => {
    let state: BoardState = initialState();
    const tokens: string[] = [];
    for (let i = 0; i < 4; i++) {
      const first = legalMoves(state)[0] as Move;
      const second = legalSecondSubmoves(state, first)[0] as Move;
      const { token, after } = turnToToken(state, {
        submoves: [first, second] as const,
      });
      tokens.push(token);
      state = after;
    }
    // Every token: two &-joined canonical moves.
    for (const token of tokens) {
      expect(token).toMatch(/^[KQRBNP]\d+[A-D][-x]\d+[A-D].*&[KQRBNP]\d+[A-D][-x]\d+[A-D]/u);
    }
  });
});
