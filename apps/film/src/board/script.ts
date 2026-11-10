/**
 * A deterministic opening played through the engine, so every move the
 * film shows is legal and every path is engine-authored. The preference
 * below opens the B/C files early so bishops curl by ply 8–11 (verified
 * 2026-10-25 in an engine probe: West's bishop B25→D27 via C26 at ply 11).
 */
import type { BoardState, Move, Turn } from "@rotochess/engine";
import { applyTurn, fileOf, initialState, legalMoves, legalSecondSubmoves, rankOf } from "@rotochess/engine";
import type { FilmPiece } from "./Board";

export function piecesOf(state: BoardState): FilmPiece[] {
  const out: FilmPiece[] = [];
  state.board.forEach((p, sq) => {
    if (!p) return;
    out.push({ rank: rankOf(sq), file: fileOf(sq), seat: p.seat, kind: p.kind, halo: p.halo });
  });
  return out;
}

export function cellsOf(move: Move): [number, number][] {
  return [move.from, ...move.path].map((sq) => [rankOf(sq), fileOf(sq)]);
}

function preference(state: BoardState, m: Move): number {
  const p = state.board[m.from];
  if (!p) return 9;
  if (p.kind === "B" && m.path.length >= 2) return 0;
  if (p.kind === "P" && (fileOf(m.from) === 1 || fileOf(m.from) === 2)) return 1;
  if (p.kind === "N") return 2;
  if (p.kind === "P") return 3;
  return 4;
}

function pick(state: BoardState, moves: Move[]): Move {
  const sorted = [...moves].sort((a, b) => preference(state, a) - preference(state, b) || a.from - b.from || a.to - b.to);
  const first = sorted[0];
  if (!first) throw new Error("no legal move");
  return first;
}

/** Plays `plies` plies from the initial position. Exported so tests can compare independent runs. */
export function buildScript(plies: number): { states: BoardState[]; turns: Turn[] } {
  const states: BoardState[] = [initialState()];
  const turns: Turn[] = [];
  for (let i = 0; i < plies; i++) {
    const s = states[i]!;
    const first = pick(s, legalMoves(s));
    const turn: Turn = s.ply < 20 ? { submoves: [first, pick(s, legalSecondSubmoves(s, first))] } : { submoves: [first] };
    const r = applyTurn(s, turn);
    if (!r.ok) throw new Error(`script ply ${i}: ${r.error}`);
    turns.push(turn);
    states.push(r.state);
  }
  return { states, turns };
}

export const SCRIPT: { states: readonly BoardState[]; turns: readonly Turn[] } = buildScript(16);

/** West's bishop curl at ply 11 (states[11] → states[12]). */
export function heroBishop(): { move: Move; before: BoardState; after: BoardState } {
  const before = SCRIPT.states[11]!;
  const move = SCRIPT.turns[11]!.submoves[0];
  const mover = before.board[move.from];
  if (mover?.seat !== 4 || mover.kind !== "B") throw new Error("ply 11 is not a West bishop move");
  return { move, before, after: SCRIPT.states[12]! };
}

/** The first legal South knight move at ply 14 (South to move), for the leap. */
export function heroKnight(): { move: Move; state: BoardState } {
  const state = SCRIPT.states[14]!;
  const move = legalMoves(state).find((m) => state.board[m.from]?.kind === "N");
  if (!move) throw new Error("no South knight move at ply 14");
  return { move, state };
}
