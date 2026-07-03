/**
 * M7 — the social state machine, scripted end-to-end at the pure layer:
 * team resignation, four-way draw with void-on-move semantics, engine-
 * verified claims, the abandonment ladder's three outcomes, nudge cooldown.
 */
import { describe, expect, it } from "vitest";
import {
  initialState,
  serializeState,
} from "@rotochess/engine";
import {
  ABANDON_CLOSEABLE_DAYS,
  nudgeAllowed,
  resolveAbandonment,
  resolveDrawAgreement,
  resolveDrawClaim,
  resolveResignation,
  type ActionRow,
  type SeatMap,
} from "../src/lib/game/resolve-actions";

const seats: SeatMap = { uN: 1, uE: 2, uS: 3, uW: 4 };
const at = (user: string, kind: string, ply = 5, created = "2026-07-01T00:00:00Z"): ActionRow => ({
  user_id: user,
  kind,
  ply_at: ply,
  created_at: created,
});

describe("team resignation (P2)", () => {
  it("propose alone does nothing; partner confirm ends the game against the team", () => {
    const rows = [at("uN", "resign_propose")];
    expect(resolveResignation(rows, 5, seats)).toEqual({ kind: "none" });
    // North (team 1) proposes; SOUTH is the partner. East confirming ≠ valid.
    rows.push(at("uE", "resign_confirm"));
    expect(resolveResignation(rows, 5, seats)).toEqual({ kind: "none" });
    rows.push(at("uS", "resign_confirm"));
    expect(resolveResignation(rows, 5, seats)).toEqual({
      kind: "complete",
      result: "team_24",
      reason: "resignation",
    });
  });

  it("P2 window: the proposal survives intervening turns within one round…", () => {
    // North proposes at ply 5; South confirms three turns later (ply 8) —
    // still inside the proposer's round.
    const rows = [at("uN", "resign_propose", 5), at("uS", "resign_confirm", 8)];
    expect(resolveResignation(rows, 8, seats)).toEqual({
      kind: "complete",
      result: "team_24",
      reason: "resignation",
    });
  });

  it("…and expires when the proposer's next turn arrives (a full round on)", () => {
    const rows = [at("uN", "resign_propose", 5), at("uS", "resign_confirm", 9)];
    expect(resolveResignation(rows, 9, seats)).toEqual({ kind: "none" });
  });

  it("partner decline kills the proposal", () => {
    const rows = [
      at("uN", "resign_propose"),
      at("uS", "resign_decline"),
      at("uS", "resign_confirm"),
    ];
    expect(resolveResignation(rows, 5, seats)).toEqual({ kind: "none" });
  });
});

describe("draw by agreement (§8.7)", () => {
  it("needs all four; any decline voids", () => {
    const rows = [at("uN", "draw_propose"), at("uE", "draw_accept"), at("uS", "draw_accept")];
    expect(resolveDrawAgreement(rows, 5, seats)).toEqual({ kind: "none" });
    rows.push(at("uW", "draw_accept"));
    expect(resolveDrawAgreement(rows, 5, seats)).toEqual({
      kind: "complete",
      result: "draw",
      reason: "agreement",
    });
    const declined = [...rows, at("uW", "draw_decline")];
    expect(resolveDrawAgreement(declined, 5, seats)).toEqual({ kind: "none" });
  });
});

describe("rule claims (§8.5/§8.6)", () => {
  it("rejects claims the engine does not verify", () => {
    expect(resolveDrawClaim(serializeState(initialState()))).toEqual({
      kind: "none",
    });
  });

  it("accepts a verified fifty-move claim", () => {
    const state = { ...initialState(), halfmoveClock: 50 };
    expect(resolveDrawClaim(serializeState(state))).toEqual({
      kind: "complete",
      result: "draw",
      reason: "fifty_move",
    });
  });
});

describe("abandonment ladder (P1)", () => {
  const now = new Date("2026-07-20T00:00:00Z");
  const staleEnough = new Date(
    now.getTime() - (ABANDON_CLOSEABLE_DAYS + 1) * 86_400_000,
  );

  it("not closeable before day 14", () => {
    const rows = [at("uN", "abandon_claim")];
    expect(
      resolveAbandonment(rows, 5, seats, 2, new Date(now.getTime() - 86_400_000), now),
    ).toEqual({ kind: "none" });
  });

  it("all three others + partner among them → team resignation", () => {
    // East (seat 2, team 2) is absent; partner is West.
    const rows = [
      at("uN", "abandon_claim"),
      at("uS", "abandon_agree"),
      at("uW", "abandon_agree"), // partner concedes
    ];
    expect(resolveAbandonment(rows, 5, seats, 2, staleEnough, now)).toEqual({
      kind: "complete",
      result: "team_13",
      reason: "abandonment",
    });
  });

  it("partner objecting against a real closure attempt → dormant, never a result", () => {
    // East absent; opponents (N, S) both agree to close; partner West objects.
    const rows = [
      at("uN", "abandon_claim"),
      at("uS", "abandon_agree"),
      at("uW", "abandon_object"),
    ];
    expect(resolveAbandonment(rows, 5, seats, 2, staleEnough, now)).toEqual({
      kind: "dormant",
    });
  });

  it("nobody can unilaterally force dormancy (H2 regression)", () => {
    // A single opponent claims then objects to their own claim: no effect.
    const rows = [at("uN", "abandon_claim"), at("uN", "abandon_object")];
    expect(resolveAbandonment(rows, 5, seats, 2, staleEnough, now)).toEqual({
      kind: "none",
    });
    // Partner objecting BEFORE the opponents agree: stays active too.
    const early = [at("uN", "abandon_claim"), at("uW", "abandon_object")];
    expect(resolveAbandonment(early, 5, seats, 2, staleEnough, now)).toEqual({
      kind: "none",
    });
  });

  it("without the partner's voice the door stays shut", () => {
    const rows = [at("uN", "abandon_claim"), at("uS", "abandon_agree")];
    expect(resolveAbandonment(rows, 5, seats, 2, staleEnough, now)).toEqual({
      kind: "none",
    });
  });
});

describe("nudges", () => {
  it("one per user per 24h", () => {
    const now = new Date("2026-07-02T12:00:00Z");
    const rows = [at("uN", "nudge", 5, "2026-07-02T00:00:00Z")];
    expect(nudgeAllowed(rows, "uN", now)).toBe(false);
    expect(nudgeAllowed(rows, "uS", now)).toBe(true);
    expect(
      nudgeAllowed(rows, "uN", new Date("2026-07-03T00:00:01Z")),
    ).toBe(true);
  });
});
