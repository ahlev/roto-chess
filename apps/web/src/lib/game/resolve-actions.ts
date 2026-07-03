/**
 * Game-end machinery — the pure rules of the SOCIAL layer, mirroring
 * docs/RULINGS.md P1/P2 and the board-game consultation §3:
 *
 *  - resignation is a TEAM act: propose → partner confirms (or declines);
 *    proposals void when the proposer's next turn arrives (ply moves on)
 *  - draw by agreement needs all four; any decline voids; any completed
 *    turn voids (submit_turn deletes stale proposals)
 *  - threefold/fifty are CLAIMS verified against the engine
 *  - abandonment: day-7 reminder, day-14 closeable by the other three;
 *    counted as team resignation ONLY if the absent player's partner is
 *    among the agreers; otherwise the game goes dormant. The system never
 *    awards a result on its own.
 */
import {
  claimableDraws,
  deserializeState,
  partnerOf,
  teamOf,
  type Seat,
} from "@rotochess/engine";

export const ABANDON_REMINDER_DAYS = 7;
export const ABANDON_CLOSEABLE_DAYS = 14;
export const NUDGE_COOLDOWN_HOURS = 24;

/**
 * P2: a proposal lives until the PROPOSER'S next turn arrives — one full
 * round, four plies — so partners and opponents can answer on their own
 * async schedule. (The consultation's draw-expiry "after one full round"
 * shares the same window.) submit_turn's voiding delete uses the same
 * constant via the migration.
 */
export const PROPOSAL_WINDOW_PLIES = 4;

export interface ActionRow {
  user_id: string;
  kind: string;
  ply_at: number;
  created_at: string;
}

export interface SeatMap {
  [userId: string]: Seat;
}

export type Resolution =
  | { kind: "none" }
  | {
      kind: "complete";
      result: "team_13" | "team_24" | "draw";
      reason: "resignation" | "agreement" | "threefold" | "fifty_move" | "abandonment";
    }
  | { kind: "dormant" };

/** Live rows = within the one-round proposal window (P2). */
export function liveRows(rows: ActionRow[], currentPly: number): ActionRow[] {
  return rows.filter(
    (r) => currentPly - r.ply_at < PROPOSAL_WINDOW_PLIES && r.ply_at <= currentPly,
  );
}

export function resolveResignation(
  rows: ActionRow[],
  currentPly: number,
  seats: SeatMap,
): Resolution {
  const live = liveRows(rows, currentPly);
  const proposal = live.find((r) => r.kind === "resign_propose");
  if (!proposal) return { kind: "none" };
  const proposerSeat = seats[proposal.user_id];
  if (!proposerSeat) return { kind: "none" };
  const partnerId = Object.entries(seats).find(
    ([, seat]) => seat === partnerOf(proposerSeat),
  )?.[0];
  const declined = live.some(
    (r) => r.kind === "resign_decline" && r.user_id === partnerId,
  );
  if (declined) return { kind: "none" };
  const confirmed = live.some(
    (r) => r.kind === "resign_confirm" && r.user_id === partnerId,
  );
  if (!confirmed) return { kind: "none" };
  const losingTeam = teamOf(proposerSeat);
  return {
    kind: "complete",
    result: losingTeam === 1 ? "team_24" : "team_13",
    reason: "resignation",
  };
}

export function resolveDrawAgreement(
  rows: ActionRow[],
  currentPly: number,
  seats: SeatMap,
): Resolution {
  const live = liveRows(rows, currentPly);
  const proposal = live.find((r) => r.kind === "draw_propose");
  if (!proposal) return { kind: "none" };
  if (live.some((r) => r.kind === "draw_decline")) return { kind: "none" };
  const accepters = new Set(
    live.filter((r) => r.kind === "draw_accept").map((r) => r.user_id),
  );
  accepters.add(proposal.user_id);
  const everyone = Object.keys(seats);
  const unanimous =
    everyone.length === 4 && everyone.every((u) => accepters.has(u));
  return unanimous
    ? { kind: "complete", result: "draw", reason: "agreement" }
    : { kind: "none" };
}

export function resolveDrawClaim(stateJson: string): Resolution {
  const state = deserializeState(stateJson);
  const claims = claimableDraws(state);
  if (claims.threefold) {
    return { kind: "complete", result: "draw", reason: "threefold" };
  }
  if (claims.fiftyMove) {
    return { kind: "complete", result: "draw", reason: "fifty_move" };
  }
  return { kind: "none" };
}

/**
 * Abandonment (P1): claimable once the ABSENT player (the seat to move) has
 * been silent past the closeable window. Agreement of the other three ends
 * it; partner's presence among agreers decides resignation vs dormant.
 */
export function resolveAbandonment(
  rows: ActionRow[],
  currentPly: number,
  seats: SeatMap,
  activeSeat: Seat,
  lastMoveAt: Date,
  now: Date,
): Resolution {
  const live = liveRows(rows, currentPly);
  const claim = live.find((r) => r.kind === "abandon_claim");
  if (!claim) return { kind: "none" };
  const idleDays = (now.getTime() - lastMoveAt.getTime()) / 86_400_000;
  if (idleDays < ABANDON_CLOSEABLE_DAYS) return { kind: "none" };

  const absentUserId = Object.entries(seats).find(
    ([, seat]) => seat === activeSeat,
  )?.[0];
  const partnerId = Object.entries(seats).find(
    ([, seat]) => seat === partnerOf(activeSeat),
  )?.[0];

  const agreers = new Set(
    live
      .filter((r) => r.kind === "abandon_agree" || r.kind === "abandon_claim")
      .map((r) => r.user_id),
  );
  const others = Object.keys(seats).filter((u) => u !== absentUserId);
  const opponents = others.filter((u) => u !== partnerId);
  // ONLY the absent player's partner may steer the outcome to dormant (P1)
  // — and only against an actual closure attempt (both opponents agreed).
  // An opponent's objection simply leaves the game active; nobody can
  // unilaterally force dormancy.
  const partnerObjects =
    partnerId !== undefined &&
    live.some((r) => r.kind === "abandon_object" && r.user_id === partnerId);
  const opponentsAgree = opponents.every((u) => agreers.has(u));

  if (partnerObjects && opponentsAgree) return { kind: "dormant" };
  if (partnerObjects) return { kind: "none" };

  const allThree = others.every((u) => agreers.has(u));
  if (!allThree) return { kind: "none" };

  // All three agreed — the partner among them concedes for the team (§7.4).
  const losingTeam = teamOf(activeSeat);
  return {
    kind: "complete",
    result: losingTeam === 1 ? "team_24" : "team_13",
    reason: "abandonment",
  };
}

/** Nudge rate limit: one per user per game per 24h. */
export function nudgeAllowed(rows: ActionRow[], userId: string, now: Date): boolean {
  const last = rows
    .filter((r) => r.kind === "nudge" && r.user_id === userId)
    .map((r) => new Date(r.created_at).getTime())
    .sort((a, b) => b - a)[0];
  if (last === undefined) return true;
  return now.getTime() - last >= NUDGE_COOLDOWN_HOURS * 3_600_000;
}
