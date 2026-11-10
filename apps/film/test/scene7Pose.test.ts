import { describe, expect, it } from "vitest";
import { scene7Pose } from "../src/scenes/scene7Pose";

describe("scene 7 camera", () => {
  it("tilts and scales with eased blends under a per-frame ceiling", () => {
    let maxDky = 0;
    let maxDs = 0;
    let maxDcx = 0;
    let prev = scene7Pose(0);
    for (let f = 1; f < 210; f++) {
      const cur = scene7Pose(f);
      maxDky = Math.max(maxDky, Math.abs(cur.ky - prev.ky));
      maxDs = Math.max(maxDs, Math.abs(cur.s - prev.s));
      maxDcx = Math.max(maxDcx, Math.abs(cur.cx - prev.cx));
      prev = cur;
    }
    // Ceilings tuned to v4's calm feel: tilt ≤ 0.04/frame, scale ≤ 0.04/frame, pan ≤ 8 px/frame.
    expect(maxDky).toBeLessThanOrEqual(0.04);
    expect(maxDs).toBeLessThanOrEqual(0.04);
    expect(maxDcx).toBeLessThanOrEqual(8);
  });

  it("starts flat and ends tilted and centered", () => {
    expect(scene7Pose(0).ky).toBe(1);
    expect(scene7Pose(209).ky).toBeCloseTo(0.46, 2);
    expect(scene7Pose(209).cx).toBe(0);
    expect(scene7Pose(0).leap).toBe(0);
    expect(scene7Pose(120).leap).toBe(1);
  });
});
