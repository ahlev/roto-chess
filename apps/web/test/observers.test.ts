import { describe, expect, it } from "vitest";
import { resolveViewerRole } from "../src/lib/game/observers";

const obs = [{ userId: "u-watch", displayName: "Ava" }];

describe("resolveViewerRole", () => {
  it("a seat always wins — even if a stale observer row lingers", () => {
    expect(resolveViewerRole(2, "u-watch", obs)).toBe("player");
  });
  it("no seat + membership row → observer", () => {
    expect(resolveViewerRole(null, "u-watch", obs)).toBe("observer");
  });
  it("no seat + no membership → none (loading, or not yet admitted)", () => {
    expect(resolveViewerRole(null, "u-else", obs)).toBe("none");
    expect(resolveViewerRole(null, null, obs)).toBe("none");
  });
});
