/**
 * Synthetic archive-corpus generator: seeded, mate-seeking playouts saved as
 * spec-format .rpgn under archive/corpus/synthetic/. These exist so the
 * archive-validation harness (test/archive.test.ts) demonstrably works end
 * to end before the historical corpus arrives; they are committed artifacts,
 * regenerated only when the emit format changes.
 *
 * Usage: npx tsx scripts/generate-archive-corpus.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyTurn,
  evaluateStatus,
  gameToRotoPgn,
  initialState,
  legalMoves,
  legalSecondSubmoves,
  type BoardState,
  type Move,
  type Turn,
} from "../src/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "../archive/corpus/synthetic");

const SEEDS = [7, 42, 99, 2026];
const MAX_TURNS = 240;

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

function playSeed(seed: number): { turns: Turn[]; status: string } {
  const rand = rng(seed);
  let state: BoardState = initialState();
  const turns: Turn[] = [];
  const pick = (moves: Move[]): Move => {
    // Light capture preference keeps games from wandering forever.
    let best = moves[0] as Move;
    let bestScore = -Infinity;
    for (const m of moves) {
      const s = rand() + (m.captures !== undefined ? 0.6 : 0);
      if (s > bestScore) {
        bestScore = s;
        best = m;
      }
    }
    return best;
  };
  for (let t = 0; t < MAX_TURNS; t++) {
    const firsts = legalMoves(state);
    if (firsts.length === 0) break;
    let turn: Turn | null = null;
    if (state.ply >= 20) {
      // Bounded mate-in-one scan so some synthetic games actually finish.
      for (const m of firsts) {
        const r = applyTurn(state, { submoves: [m] as const });
        if (r.ok && evaluateStatus(r.state).kind === "checkmate") {
          turn = { submoves: [m] as const };
          break;
        }
      }
      if (!turn) turn = { submoves: [pick(firsts)] as const };
    } else {
      const first = pick(firsts);
      const seconds = legalSecondSubmoves(state, first);
      if (seconds.length === 0) break;
      turn = { submoves: [first, pick(seconds)] as const };
    }
    const result = applyTurn(state, turn);
    if (!result.ok) throw new Error(result.error);
    turns.push(turn);
    state = result.state;
    if (evaluateStatus(state).kind !== "active") break;
  }
  return { turns, status: evaluateStatus(state).kind };
}

mkdirSync(outDir, { recursive: true });
for (const seed of SEEDS) {
  const { turns, status } = playSeed(seed);
  const text = gameToRotoPgn(turns, {
    event: `Synthetic archive game (seed ${seed})`,
    site: "engine-generated",
    player1: `Seed-${seed} P1`,
    player2: `Seed-${seed} P2`,
    player3: `Seed-${seed} P3`,
    player4: `Seed-${seed} P4`,
  });
  const file = join(outDir, `seed-${seed}.rpgn`);
  writeFileSync(file, text);
  console.log(`seed ${seed}: ${turns.length} turns, ${status} -> ${file}`);
}
