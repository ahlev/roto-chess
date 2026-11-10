/**
 * The app's motion vocabulary as frame math. Durations and the settle curve
 * are the ones in globals.css; every scene animates through these helpers so
 * the film moves like the product.
 */
import { Easing, interpolate } from "remotion";
import { FPS } from "./timeline";

export const DUR = { fast: 150, base: 250, slow: 400, ceremony: 700 } as const;

export function ms(milliseconds: number): number {
  return Math.round((milliseconds / 1000) * FPS);
}

/** cubic-bezier(0.22, 1, 0.36, 1): fast out, long gentle settle, no overshoot. */
export const settle: (t: number) => number = Easing.bezier(0.22, 1, 0.36, 1);

export function tween(frame: number, startFrame: number, durationMs: number, from: number, to: number, easing: (t: number) => number = settle): number {
  const frames = Math.max(1, ms(durationMs));
  return interpolate(frame, [startFrame, startFrame + frames], [from, to], {
    easing,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

export function fade(frame: number, startFrame: number, durationMs: number): number {
  return tween(frame, startFrame, durationMs, 0, 1);
}

/** Rise-and-fade entrance used by type and chips: returns {opacity, dy}. */
export function enter(frame: number, startFrame: number, durationMs = DUR.slow, rise = 24): { opacity: number; dy: number } {
  return { opacity: fade(frame, startFrame, durationMs), dy: tween(frame, startFrame, durationMs, rise, 0) };
}
