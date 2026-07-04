/**
 * victory.ts — pure derivation of the "clever context" behind a finished game.
 *
 * The engine's §7.3 timing rule (status.ts) says checkmate is evaluated for
 * the player TO MOVE: it lands the instant the mated seat is on the clock with
 * no legal turn. So the MATED seat is simply the folded final position's active
 * seat (this also repairs the online case, where the completed row nulls
 * `active_seat`). Naming the mating PIECE is subtler — a §7.3 mate can be
 * sealed turns before the mated player's turn arrives (a smother, an unresolved
 * check). We therefore name a specific piece only when the last move
 * VERIFIABLY checks the mated king; otherwise the copy degrades to a
 * team-level line that is always accurate.
 *
 * This module is presentation-agnostic: it returns a VictoryContext of plain
 * strings. VictoryOverlay renders it; the pages own their action buttons.
 */
import {
  applyTurn,
  formatSquare,
  initialState,
  isSquareAttacked,
  kingSquare,
  teamOf,
  type BoardState,
  type PieceKind,
  type Seat,
  type Team,
  type Turn,
} from "@rotochess/engine";

export type VictoryReason =
  | "checkmate"
  | "stalemate"
  | "draw"
  | "resignation"
  | "abandoned";

export interface VictoryContext {
  reason: VictoryReason;
  /** null = draw / no winner. */
  winningTeam: Team | null;
  winnerLabel: string | null; // "Red & Blue" | "Black & Gold"
  matedSeat: Seat | null;
  matedName: string | null; // "West"
  /** The seat that landed the decisive check, when it can be named. */
  matingSeat: Seat | null;
  matingName: string | null; // "North"
  matingPieceName: string | null; // "rook" (null when the mate can't be pinned to one move)
  matingSquare: string | null; // display square, e.g. "B7"
  turns: number; // player-turns played (state.ply)
  headline: string;
  winnerLine: string | null;
  detail: string;
}

const SEAT_NAME: Record<Seat, string> = {
  1: "North",
  2: "East",
  3: "South",
  4: "West",
};

const KIND_NAME: Record<PieceKind, string> = {
  K: "king",
  Q: "queen",
  R: "rook",
  B: "bishop",
  N: "knight",
  P: "pawn",
};

const TEAM_LABEL: Record<Team, string> = {
  1: "Red & Blue",
  2: "Black & Gold",
};

/**
 * Does the piece that just moved to `to` actually deliver the check that mates
 * `matedSeat`? Test it in isolation: keep the mated team's pieces as real
 * blockers, strip every enemy piece except the mover, and ask whether the king
 * is still attacked. True → a clean, nameable mating stroke; false → a delayed
 * or discovered mate we won't misattribute (the copy falls back to the team).
 */
function decisiveMatingMove(
  finalState: BoardState,
  matedSeat: Seat,
  moverTo: number,
): { pieceName: string; square: string } | null {
  const mover = finalState.board[moverTo];
  if (!mover) return null; // captured off / evaporated — nothing to name
  const matedTeam = teamOf(matedSeat);
  const board = finalState.board.map((p) =>
    p && teamOf(p.seat) === matedTeam ? p : null,
  );
  board[moverTo] = mover; // reinstate only the mover as the lone attacker
  const isolated: BoardState = { ...finalState, board };
  const kSq = kingSquare(isolated, matedSeat);
  if (!isSquareAttacked(isolated, kSq, teamOf(mover.seat))) return null;
  return { pieceName: KIND_NAME[mover.kind], square: formatSquare(moverTo) };
}

/**
 * Fold the canonical turn list to the terminal state and pull out who mated,
 * with what, and how long the game ran. Everything comes from data already
 * persisted — no new DB columns.
 */
function reconstruct(
  turns: readonly Turn[],
  initial: BoardState,
): {
  matedSeat: Seat | null;
  matingSeat: Seat | null;
  matingPieceName: string | null;
  matingSquare: string | null;
  finalPly: number;
} {
  let state = initial;
  let lastMover: Seat | null = null;

  for (let i = 0; i < turns.length; i++) {
    if (i === turns.length - 1) lastMover = state.activeSeat;
    const result = applyTurn(state, turns[i] as Turn);
    // Canonical turns always apply; a corrupt record just stops the fold and
    // we report what we have rather than throwing inside the overlay.
    if (!result.ok) break;
    state = result.state;
  }

  // The mated seat is whoever is on the clock at the end (§7.3) — the true
  // source, even online where the row's active_seat is nulled on completion.
  const matedSeat: Seat | null = turns.length > 0 ? state.activeSeat : null;

  let matingSeat: Seat | null = null;
  let matingPieceName: string | null = null;
  let matingSquare: string | null = null;
  const lastTurn = turns[turns.length - 1];
  const move = lastTurn?.submoves[lastTurn.submoves.length - 1];
  if (move && matedSeat !== null) {
    const decisive = decisiveMatingMove(state, matedSeat, move.to);
    if (decisive) {
      matingSeat = lastMover;
      matingPieceName = decisive.pieceName;
      matingSquare = decisive.square;
    }
  }

  return {
    matedSeat,
    matingSeat,
    matingPieceName,
    matingSquare,
    finalPly: state.ply,
  };
}

export function victoryContext(args: {
  reason: VictoryReason;
  winningTeam: Team | null;
  turns: readonly Turn[];
  initial?: BoardState;
}): VictoryContext {
  const { reason, winningTeam } = args;
  const turns = args.turns;
  const initial = args.initial ?? initialState();
  const winnerLabel = winningTeam ? TEAM_LABEL[winningTeam] : null;

  const { matedSeat, matingSeat, matingPieceName, matingSquare, finalPly } =
    reconstruct(turns, initial);
  const matingName = matingSeat ? SEAT_NAME[matingSeat] : null;
  const matedName = matedSeat ? SEAT_NAME[matedSeat] : null;

  const base: Omit<VictoryContext, "headline" | "winnerLine" | "detail"> = {
    reason,
    winningTeam,
    winnerLabel,
    matedSeat,
    matedName,
    matingSeat,
    matingName,
    matingPieceName,
    matingSquare,
    turns: finalPly,
  };

  switch (reason) {
    case "checkmate": {
      // Named stroke:  "North's rook closed the ring on West's king…"
      // Team fallback: "Red & Blue closed the ring on West's king…"
      const subject =
        matingName && matingPieceName
          ? `${matingName}'s ${matingPieceName}`
          : (winnerLabel ?? "The winning team");
      const mated = matedName ? `${matedName}'s king` : "the enemy king";
      const onTurn = finalPly > 0 ? ` on turn ${finalPly}` : "";
      return {
        ...base,
        headline: "The crown is taken.",
        winnerLine: winnerLabel ? `${winnerLabel} reign.` : null,
        detail: `${subject} closed the ring on ${mated} — checkmate${onTurn}.`,
      };
    }
    case "resignation":
      return {
        ...base,
        headline: winnerLabel
          ? `${winnerLabel} take it.`
          : "The game is conceded.",
        winnerLine: winnerLabel ? `${winnerLabel} reign.` : null,
        detail: matedName ? `${matedName}'s king tips.` : "A king tips.",
      };
    case "abandoned":
      return {
        ...base,
        headline: "Closed as abandoned.",
        winnerLine: null,
        detail: "The table emptied before the crown was decided.",
      };
    case "stalemate":
    case "draw":
    default:
      return {
        ...base,
        winningTeam: null,
        winnerLabel: null,
        headline: "The crown stays on the table.",
        winnerLine: null,
        detail: "A draw — all four hands empty.",
      };
  }
}
