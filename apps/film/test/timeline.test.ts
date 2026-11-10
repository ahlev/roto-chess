import { describe, expect, it } from "vitest";
import { BEATS, FPS, TOTAL_FRAMES, beatRange, toFrames } from "../src/timeline";

describe("timeline", () => {
  it("runs 60 seconds at 30 fps", () => {
    expect(FPS).toBe(30);
    expect(TOTAL_FRAMES).toBe(1800);
    expect(toFrames(60)).toBe(1800);
  });

  it("has eight contiguous beats covering 0 to 60 s", () => {
    expect(BEATS).toHaveLength(8);
    expect(BEATS[0]?.start).toBe(0);
    expect(BEATS[7]?.end).toBe(60);
    for (let i = 1; i < BEATS.length; i++) {
      expect(BEATS[i]?.start).toBe(BEATS[i - 1]?.end);
    }
  });

  it("maps beat ids to frame ranges", () => {
    expect(beatRange("hook")).toEqual({ from: 0, durationInFrames: 210 });
    expect(beatRange("ground")).toEqual({ from: 420, durationInFrames: 240 });
    expect(beatRange("everywhere")).toEqual({ from: 1590, durationInFrames: 210 });
  });
});
