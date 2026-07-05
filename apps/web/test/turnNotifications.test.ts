import { describe, expect, it } from "vitest";
import {
  countUnseen,
  pruneSeen,
  turnSignature,
  type TurnNotification,
} from "@/lib/notifications/useTurnNotifications";

const n = (gameId: string, lastMoveAt: string | null): TurnNotification => ({
  gameId,
  tableName: "T",
  lastMoveAt,
});

describe("turn-notification bookkeeping", () => {
  it("signature folds gameId + last move, so a new move re-raises it", () => {
    expect(turnSignature(n("g1", "2026-07-05T10:00:00Z"))).toBe(
      "g1:2026-07-05T10:00:00Z",
    );
    // Same game, later move → different signature (badge re-raises).
    expect(turnSignature(n("g1", "t1"))).not.toBe(turnSignature(n("g1", "t2")));
    // Missing timestamp is stable, not a crash.
    expect(turnSignature(n("g1", null))).toBe("g1:0");
  });

  it("counts only turns whose signature isn't acknowledged", () => {
    const items = [n("g1", "t1"), n("g2", "t1"), n("g3", "t1")];
    expect(countUnseen(items, new Set())).toBe(3);
    const seen = new Set([turnSignature(items[0]!), turnSignature(items[1]!)]);
    expect(countUnseen(items, seen)).toBe(1);
    // Acknowledge everything → nothing new.
    expect(countUnseen(items, new Set(items.map(turnSignature)))).toBe(0);
  });

  it("a new move in an acknowledged game becomes unseen again", () => {
    const seen = new Set([turnSignature(n("g1", "t1"))]);
    // The same game moved again (t2) — no longer acknowledged.
    expect(countUnseen([n("g1", "t2")], seen)).toBe(1);
  });

  it("prunes seen signatures no longer present", () => {
    const seen = new Set(["g1:t1", "g2:t1", "gone:t9"]);
    const live = [n("g1", "t1"), n("g2", "t1")];
    const pruned = pruneSeen(seen, live);
    expect([...pruned].sort()).toEqual(["g1:t1", "g2:t1"]);
  });
});
