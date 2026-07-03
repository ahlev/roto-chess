/**
 * The authority's pure core: validate a client TurnRef against the stored
 * snapshot and produce everything submit_turn needs. No I/O beyond the
 * CSPRNG — unit-tested directly and driven against the real schema in the
 * PGlite harness. The engine decides legality; Postgres decides ordering.
 */
import { randomInt } from "node:crypto";
import {
  applyTurn,
  deserializeState,
  evaluateStatus,
  matchTurnRef,
  turnToToken,
  type Seat,
  type TurnRef,
} from "@rotochess/engine";

export type PreparedTurn =
  | {
      ok: true;
      newStateJson: string;
      notation: string;
      turnJson: string;
      newActiveSeat: Seat | null;
      newStatus: "active" | "complete";
      result: "team_13" | "team_24" | "draw" | null;
      resultReason: "checkmate" | "stalemate" | null;
    }
  | { ok: false; status: number; error: string };

export function prepareTurn(
  stateJson: string,
  expectedPly: number,
  submitterSeat: Seat,
  ref: TurnRef,
): PreparedTurn {
  let state;
  try {
    state = deserializeState(stateJson);
  } catch (e) {
    return { ok: false, status: 500, error: `Corrupt snapshot: ${String(e)}` };
  }
  if (state.ply !== expectedPly) {
    return { ok: false, status: 409, error: "Stale snapshot" };
  }
  if (state.activeSeat !== submitterSeat) {
    return { ok: false, status: 403, error: "Not your turn" };
  }
  const match = matchTurnRef(state, ref);
  if (!match.ok) {
    return { ok: false, status: 422, error: match.error };
  }
  // Token computed against the pre-turn state (it applies internally too,
  // but we keep the authoritative application explicit below).
  const { token } = turnToToken(state, match.turn);
  const applied = applyTurn(state, match.turn);
  if (!applied.ok) {
    return { ok: false, status: 422, error: applied.error };
  }
  const status = evaluateStatus(applied.state);
  const terminal = status.kind !== "active";
  return {
    ok: true,
    newStateJson: JSON.stringify(applied.state),
    notation: token,
    turnJson: JSON.stringify(match.turn),
    newActiveSeat: terminal ? null : applied.state.activeSeat,
    newStatus: terminal ? "complete" : "active",
    result:
      status.kind === "checkmate"
        ? status.winningTeam === 1
          ? "team_13"
          : "team_24"
        : status.kind === "stalemate"
          ? "draw"
          : null,
    resultReason:
      status.kind === "checkmate"
        ? "checkmate"
        : status.kind === "stalemate"
          ? "stalemate"
          : null,
  };
}

/** Join codes: 5 chars from an unambiguous alphabet (no 0/O/1/I/L). */
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** CSPRNG by default — V8's Math.random is state-recoverable. */
export function generateJoinCode(
  pick: (bound: number) => number = randomInt,
): string {
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += CODE_ALPHABET[pick(CODE_ALPHABET.length)];
  }
  return code;
}
