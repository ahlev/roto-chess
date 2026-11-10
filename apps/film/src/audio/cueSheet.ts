import type { BeatId } from "../timeline";
import { beatRange } from "../timeline";

export type CueFile = "set-down" | "capture" | "check-pulse" | "halo" | "avenger" | "your-turn" | "evaporation" | "zoom-detent" | "chat-tick";

export interface CueEvent {
  cue: CueFile;
  /** Absolute film frame. */
  frame: number;
  gain?: number;
}

const at = (beat: BeatId, local: number) => beatRange(beat).from + local;

/** Every cue the film plays, matched to the scene timings in each scene's header comment. */
export const CUE_SHEET: readonly CueEvent[] = [
  { cue: "set-down", frame: at("hook", 112), gain: 0.6 },
  { cue: "evaporation", frame: at("hook", 114) },
  { cue: "chat-tick", frame: at("today", 120), gain: 0.5 },
  { cue: "set-down", frame: at("ground", 196), gain: 0.5 },
  { cue: "your-turn", frame: at("pocket", 135) },
  { cue: "set-down", frame: at("feel", 32) },
  { cue: "halo", frame: at("feel", 37) },
  { cue: "zoom-detent", frame: at("feel", 90), gain: 0.6 },
  { cue: "set-down", frame: at("alone", 52), gain: 0.7 },
  { cue: "set-down", frame: at("alone", 82), gain: 0.7 },
  { cue: "chat-tick", frame: at("alone", 160), gain: 0.6 },
  { cue: "set-down", frame: at("depth", 110) },
  { cue: "check-pulse", frame: at("everywhere", 150), gain: 0.5 },
];
