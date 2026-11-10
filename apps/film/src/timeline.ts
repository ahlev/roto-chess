/**
 * The film's clock. Beats are authored in seconds (the approved beat sheet)
 * and converted to frames in exactly one place.
 */
export const FPS = 30;

export type BeatId =
  | "hook"
  | "today"
  | "ground"
  | "pocket"
  | "feel"
  | "alone"
  | "depth"
  | "everywhere";

export interface Beat {
  id: BeatId;
  name: string;
  /** Seconds from the start of the film. */
  start: number;
  end: number;
}

export const BEATS: readonly Beat[] = [
  { id: "hook", name: "Hook: the ring", start: 0, end: 7 },
  { id: "today", name: "The platform today", start: 7, end: 14 },
  { id: "ground", name: "Layer 1: solid ground", start: 14, end: 22 },
  { id: "pocket", name: "Layer 2: in your pocket", start: 22, end: 30 },
  { id: "feel", name: "Layer 3: feel", start: 30, end: 38 },
  { id: "alone", name: "Layer 4: never alone", start: 38, end: 46 },
  { id: "depth", name: "Layer 5: depth", start: 46, end: 53 },
  { id: "everywhere", name: "Payoff: everywhere", start: 53, end: 60 },
];

export const TOTAL_FRAMES = 60 * FPS;

export function toFrames(seconds: number): number {
  return Math.round(seconds * FPS);
}

export function beatRange(id: BeatId): { from: number; durationInFrames: number } {
  const beat = BEATS.find((b) => b.id === id);
  if (!beat) throw new Error(`Unknown beat ${id}`);
  return { from: toFrames(beat.start), durationInFrames: toFrames(beat.end - beat.start) };
}
