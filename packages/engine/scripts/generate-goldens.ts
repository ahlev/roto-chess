/**
 * Golden-game generator: play seeded feature-seeking games until we find
 * (1) a checkmate game containing at least one halo, evaporation, castling,
 * en passant, AND promotion — the DONE-WHEN showcase game — and (2) a second
 * independent checkmate game. Output: test/goldens/*.rpgn, replayed by
 * test/goldens.test.ts on every run and by the M4 Playwright UI test.
 *
 * Usage: npx tsx scripts/generate-goldens.ts
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
const outDir = join(here, "../test/goldens");

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

interface Features {
  halo: boolean;
  evaporation: boolean;
  castle: boolean;
  ep: boolean;
  promotion: boolean;
}

/** Move preference: mate-seeking, then feature-seeking, then captures. */
function scoreMove(m: Move, f: Features, rand: () => number): number {
  let s = rand(); // jitter for variety
  if (m.castle && !f.castle) s += 60;
  if (m.enPassant && !f.ep) s += 60;
  if (m.promotion === "Q" && !f.promotion) s += 55;
  if (m.earnsHalo && !f.halo) s += 30;
  if (m.evaporates && !f.evaporation && rand() < 0.25) s += 25;
  if (m.evaporates && f.evaporation) s -= 40; // stop throwing pieces away
  if (m.captures !== undefined) s += 12;
  if (m.promotion && m.promotion !== "Q") s -= 20; // prefer queening once
  return s;
}

function updateFeatures(f: Features, turn: Turn): void {
  for (const m of turn.submoves) {
    if (m.castle) f.castle = true;
    if (m.enPassant) f.ep = true;
    if (m.promotion) f.promotion = true;
    if (m.earnsHalo && !m.evaporates) f.halo = true;
    if (m.evaporates) f.evaporation = true;
  }
}

function playSeed(seed: number, maxTurns: number) {
  const rand = rng(seed);
  let state: BoardState = initialState();
  const turns: Turn[] = [];
  const features: Features = {
    halo: false, evaporation: false, castle: false, ep: false, promotion: false,
  };
  for (let t = 0; t < maxTurns; t++) {
    const firsts = legalMoves(state);
    if (firsts.length === 0) break;
    let turn: Turn | null = null;
    // Mate-in-one scan (bounded): try the most promising few turns and take
    // an immediate checkmate if found.
    const pickBest = (moves: Move[]): Move =>
      moves.reduce((best, m) =>
        scoreMove(m, features, rand) > scoreMove(best, features, rand) ? m : best,
      );
    if (state.ply >= 20) {
      for (const m of firsts) {
        const r = applyTurn(state, { submoves: [m] as const });
        if (r.ok && evaluateStatus(r.state).kind === "checkmate") {
          turn = { submoves: [m] as const };
          break;
        }
      }
      if (!turn) turn = { submoves: [pickBest(firsts)] as const };
    } else {
      const first = pickBest(firsts);
      const seconds = legalSecondSubmoves(state, first);
      if (seconds.length === 0) break;
      turn = { submoves: [first, pickBest(seconds)] as const };
    }
    const result = applyTurn(state, turn);
    if (!result.ok) throw new Error(result.error);
    turns.push(turn);
    updateFeatures(features, turn);
    state = result.state;
    if (evaluateStatus(state).kind !== "active") break;
  }
  const status = evaluateStatus(state);
  return { turns, state, status, features };
}

mkdirSync(outDir, { recursive: true });

let showcase: number | null = null;
let second: number | null = null;
for (let seed = 1; seed <= 4000 && (showcase === null || second === null); seed++) {
  const g = playSeed(seed, 260);
  if (g.status.kind !== "checkmate") continue;
  const f = g.features;
  const all = f.halo && f.evaporation && f.castle && f.ep && f.promotion;
  if (all && showcase === null) {
    showcase = seed;
    writeFileSync(
      join(outDir, "golden-showcase.rpgn"),
      gameToRotoPgn(g.turns, {
        event: `Golden showcase (seed ${seed})`,
        site: "engine-generated",
      }),
    );
    console.log(
      `showcase: seed ${seed}, ${g.turns.length} turns, mated seat ${g.status.matedSeat}`,
    );
  } else if (seed !== showcase && second === null) {
    second = seed;
    writeFileSync(
      join(outDir, "golden-2.rpgn"),
      gameToRotoPgn(g.turns, {
        event: `Golden game 2 (seed ${seed})`,
        site: "engine-generated",
      }),
    );
    console.log(
      `second: seed ${seed}, ${g.turns.length} turns, mated seat ${g.status.matedSeat}`,
    );
  }
}

if (showcase === null) {
  console.error("No showcase game found in seed range — widen the search.");
  process.exitCode = 1;
}
