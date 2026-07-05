import { describe, expect, it } from "vitest";
import { clampVolume, resolveEnabled } from "@/lib/audio/engine";

describe("sound enabled policy", () => {
  it("honors an explicit stored choice on any device", () => {
    expect(resolveEnabled("off", false)).toBe(false);
    expect(resolveEnabled("off", true)).toBe(false);
    expect(resolveEnabled("on", true)).toBe(true); // explicit beats mobile default
    expect(resolveEnabled("on", false)).toBe(true);
  });

  it("defaults desktop ON and mobile OFF when no choice is stored", () => {
    expect(resolveEnabled(null, false)).toBe(true); // desktop: audible
    expect(resolveEnabled(null, true)).toBe(false); // mobile: quiet
  });
});

describe("clampVolume", () => {
  it("keeps levels within 0..1", () => {
    expect(clampVolume(0.5)).toBe(0.5);
    expect(clampVolume(-1)).toBe(0);
    expect(clampVolume(9)).toBe(1);
  });
});
