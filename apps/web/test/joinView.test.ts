import { describe, expect, it } from "vitest";
import { joinView } from "../src/lib/game/joinView";

describe("joinView", () => {
  it("lobby: open seats are claimable and spectating is offered", () => {
    expect(joinView("lobby", [1, 3])).toEqual({
      openSeats: [2, 4],
      canSpectate: true,
      stale: false,
    });
  });

  it("active: no seats, but the game is watchable", () => {
    expect(joinView("active", [1, 2, 3, 4])).toEqual({
      openSeats: [],
      canSpectate: true,
      stale: false,
    });
  });

  it("complete/abandoned/unknown: stale", () => {
    for (const status of ["complete", "abandoned", "dormant", null]) {
      expect(joinView(status, [])).toEqual({
        openSeats: [],
        canSpectate: false,
        stale: true,
      });
    }
  });
});
