/**
 * Layer 4 — Game: initialState + an ordered list of turns IS the game.
 * Every derived view (current position, scrubbing, catch-up replay, export)
 * is the same fold. Replay is cheap: a long Roto game is a few hundred
 * turns and applyTurn is pure.
 */

import { type Team, teamOf } from "./geometry.js";
import { initialState, type BoardState } from "./state.js";
import type { Turn } from "./moves.js";
import { applyTurn, type TurnEvents } from "./legal.js";
import { evaluateStatus, type GameStatus } from "./status.js";
import {
  parseGame,
  serializeGame,
  type GameHeaders,
  type ParsedGame,
} from "./pgn.js";

export interface FoldStep {
  turn: Turn;
  state: BoardState;
  events: TurnEvents;
  status: GameStatus;
}

export interface FoldResult {
  steps: FoldStep[];
  finalState: BoardState;
  finalStatus: GameStatus;
}

/**
 * Fold a turn list over the initial position. Throws on any illegal turn —
 * a stored game that fails to replay is corrupt and must be surfaced loudly.
 */
export function playGame(turns: readonly Turn[]): FoldResult {
  let state = initialState();
  const steps: FoldStep[] = [];
  for (const turn of turns) {
    const result = applyTurn(state, turn);
    if (!result.ok) {
      throw new Error(
        `playGame: illegal turn at ply ${state.ply}: ${result.error}`,
      );
    }
    state = result.state;
    const status = evaluateStatus(state);
    steps.push({ turn, state, events: result.events, status });
    if (status.kind !== "active") break;
  }
  if (steps.length < turns.length) {
    // Turns recorded after a terminal position can only mean corruption —
    // the server authority never accepts them. Fail loudly, never truncate.
    throw new Error(
      `playGame: ${turns.length - steps.length} turn(s) recorded after the game ended`,
    );
  }
  return {
    steps,
    finalState: state,
    finalStatus: steps.length
      ? (steps[steps.length - 1] as FoldStep).status
      : evaluateStatus(state),
  };
}

/**
 * The position after `plyCount` turns — a ONE-OFF convenience. UI scrubbers
 * must not call this per slider tick (O(n²) replay): call playGame once per
 * loaded game and index `steps[i].state`, which also carries the events and
 * status each ply needs for animation cues.
 */
export function stateAtPly(turns: readonly Turn[], plyCount: number): BoardState {
  return playGame(turns.slice(0, plyCount)).finalState;
}

export type GameResult =
  | { winner: Team; reason: "checkmate"; matedSeat: number }
  | { winner: null; reason: "stalemate" }
  | null;

/** Rules-derived result (resignation/agreement/abandonment live at the app layer). */
export function resultOf(status: GameStatus): GameResult {
  if (status.kind === "checkmate") {
    return {
      winner: status.winningTeam,
      reason: "checkmate",
      matedSeat: status.matedSeat,
    };
  }
  if (status.kind === "stalemate") return { winner: null, reason: "stalemate" };
  return null;
}

/** Result header token per TDD §3.8: 13 = seats 1&3 win, 24 = seats 2&4. */
export function resultHeaderOf(status: GameStatus): "13" | "24" | "Draw" | "*" {
  if (status.kind === "checkmate") {
    return teamOf(status.matedSeat) === 1 ? "24" : "13";
  }
  if (status.kind === "stalemate") return "Draw";
  return "*";
}

/** Serialize a played game to .rpgn, deriving result headers from the fold. */
export function gameToRotoPgn(
  turns: readonly Turn[],
  headers?: GameHeaders,
): string {
  const fold = playGame(turns);
  const derived: GameHeaders = {
    ...headers,
    result: headers?.result ?? resultHeaderOf(fold.finalStatus),
  };
  const round =
    headers?.resultRound ??
    (fold.finalStatus.kind !== "active"
      ? Math.ceil(fold.finalState.ply / 4)
      : undefined);
  if (round !== undefined) derived.resultRound = round;
  if (fold.finalStatus.kind === "checkmate" && !derived.termination) {
    derived.termination = "Checkmate";
  }
  if (fold.finalStatus.kind === "stalemate" && !derived.termination) {
    derived.termination = "Stalemate";
  }
  return serializeGame({ headers: derived, turns });
}

/** Parse + fully validate a .rpgn document (replay happens inside parseGame). */
export function gameFromRotoPgn(text: string): ParsedGame {
  return parseGame(text);
}
