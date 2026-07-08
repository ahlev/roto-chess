import { describe, expect, it } from "vitest";
import { bucketGames } from "../src/lib/game/dashboardBuckets";

const g = (
  over: Partial<{
    status: string;
    active_seat: number | null;
    mySeat: number | null;
    role: "player" | "observer";
    last_move_at: string | null;
  }>,
) => ({
  status: "active",
  active_seat: 1,
  mySeat: 1,
  role: "player" as const,
  last_move_at: null,
  ...over,
});

describe("bucketGames", () => {
  it("player games bucket exactly as before", () => {
    const rows = [
      g({ status: "lobby" }),
      g({ status: "active", active_seat: 1, mySeat: 1 }),
      g({ status: "active", active_seat: 2, mySeat: 1 }),
      g({ status: "complete" }),
    ];
    const b = bucketGames(rows);
    expect(b.settingUp).toHaveLength(1);
    expect(b.yourTurn).toHaveLength(1);
    expect(b.waiting).toHaveLength(1);
    expect(b.finished).toHaveLength(1);
    expect(b.observing).toHaveLength(0);
    expect(b.observedFinished).toHaveLength(0);
  });

  it("observed games land in their own buckets and NEVER in yourTurn", () => {
    const rows = [
      g({ role: "observer", mySeat: null, status: "active", active_seat: 1 }),
      g({ role: "observer", mySeat: null, status: "lobby" }),
      g({ role: "observer", mySeat: null, status: "complete" }),
    ];
    const b = bucketGames(rows);
    expect(b.observing).toHaveLength(2); // lobby + active both "observing"
    expect(b.observedFinished).toHaveLength(1);
    expect(b.yourTurn).toHaveLength(0);
    expect(b.waiting).toHaveLength(0);
    expect(b.settingUp).toHaveLength(0);
    expect(b.finished).toHaveLength(0);
  });

  it("yourTurn sorts oldest wait first; waiting most recent first", () => {
    const b = bucketGames([
      g({ active_seat: 1, mySeat: 1, last_move_at: "2026-07-02" }),
      g({ active_seat: 1, mySeat: 1, last_move_at: "2026-07-01" }),
      g({ active_seat: 2, mySeat: 1, last_move_at: "2026-07-01" }),
      g({ active_seat: 2, mySeat: 1, last_move_at: "2026-07-02" }),
    ]);
    expect(b.yourTurn.map((r) => r.last_move_at)).toEqual([
      "2026-07-01",
      "2026-07-02",
    ]);
    expect(b.waiting.map((r) => r.last_move_at)).toEqual([
      "2026-07-02",
      "2026-07-01",
    ]);
  });
});
