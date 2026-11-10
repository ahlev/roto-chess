/**
 * Scene 7's camera as a pure function of the local frame, so its motion is
 * testable as motion. Phases: tilt 0–66 and zoom 0–72, pieces rise 36–57,
 * shoulder pan toward the mover 60–141, the leap 80–110, settle back to the
 * centered overview 125–206. The tilt, zoom and pan durations are set by the
 * per-frame ceiling in test/scene7Pose.test.ts (the settle curve peaks at
 * about 4.4x its average slope). All blends are settle-eased; nothing
 * follows exponentially.
 */
import { tween } from "../motion";

export type Scene7Pose = {
  ky: number;
  s: number;
  /** Pan offset from the layout center, in px. */
  cx: number;
  cy: number;
  /** 0..1 piece-rise progress. */
  rise: number;
  /** 0..1 knight leap progress. */
  leap: number;
};

export function scene7Pose(frame: number): Scene7Pose {
  const ky = tween(frame, 0, 2200, 1, 0.46);
  const s = tween(frame, 0, 2400, 1.6, 2.2);
  const rise = tween(frame, 36, 700, 0, 1);
  const panOut = tween(frame, 60, 2700, 0, 1);
  const panBack = tween(frame, 125, 2700, 0, 1);
  const pan = panOut * (1 - panBack);
  const leap = tween(frame, 80, 1000, 0, 1);
  // `0 - x` rather than `-x`: at pan = 0 this is +0, not -0 (the test pins cx with toBe(0)).
  return { ky, s, cx: 0 - 140 * pan, cy: 40 * pan, rise, leap };
}
