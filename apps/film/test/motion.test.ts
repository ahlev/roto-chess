import { describe, expect, it } from "vitest";
import { DUR, fade, ms, settle, tween } from "../src/motion";

describe("motion vocabulary", () => {
  it("converts the app's durations to frames at 30 fps", () => {
    expect(ms(DUR.fast)).toBe(5);
    expect(ms(DUR.base)).toBe(8);
    expect(ms(DUR.slow)).toBe(12);
    expect(ms(DUR.ceremony)).toBe(21);
  });

  it("settle easing is monotonic and never overshoots", () => {
    let prev = -1;
    for (let i = 0; i <= 60; i++) {
      const v = settle(i / 60);
      expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1 + 1e-9);
      prev = v;
    }
    expect(settle(0)).toBeCloseTo(0, 6);
    expect(settle(1)).toBeCloseTo(1, 6);
  });

  it("tween clamps outside its window and fade is 0..1", () => {
    expect(tween(0, 10, 400, 100, 200)).toBe(100);
    expect(tween(10, 10, 400, 100, 200)).toBe(100);
    expect(tween(22, 10, 400, 100, 200)).toBe(200);
    expect(tween(100, 10, 400, 100, 200)).toBe(200);
    const mid = tween(16, 10, 400, 100, 200);
    expect(mid).toBeGreaterThan(100);
    expect(mid).toBeLessThan(200);
    expect(fade(5, 10, 250)).toBe(0);
    expect(fade(18, 10, 250)).toBe(1);
  });
});
