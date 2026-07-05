/**
 * The audio engine — one lazily-created AudioContext, one master gain kept at
 * a MODERATE ceiling (present but subtle, never loud), and a bank of
 * pre-rendered cue buffers. Everything is gated behind a user gesture (browser
 * autoplay policy): the context is created on the first real interaction, and
 * `playCue` is a safe no-op until then.
 *
 * Design notes:
 *  - Master ceiling is deliberately low; per-cue trims balance perceived
 *    loudness so a ringing bell never dominates a dry click.
 *  - A tiny debounce prevents the same cue double-firing on rapid events.
 *  - Mute state persists to localStorage and honors prefers-reduced-motion
 *    (the OS "calmer" signal) by starting muted.
 */
import { renderAll, type CueName } from "./synth";

/** The top of the range — moderate on purpose. */
const MASTER_CEILING = 0.5;

/** Per-cue perceived-loudness balance (a sustained bell needs less than a click). */
const CUE_TRIM: Record<CueName, number> = {
  "set-down": 1.0,
  capture: 1.0,
  "check-pulse": 1.0,
  halo: 0.85,
  victory: 0.9,
  draw: 0.85,
  "your-turn": 0.95,
  evaporation: 0.9,
  "zoom-detent": 0.9,
  "chat-tick": 0.9,
};

const STORAGE_KEY = "rc-sound-enabled";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let buffers: Record<CueName, AudioBuffer> | null = null;
let enabled = true;
const lastPlayed = new Map<CueName, number>();
const listeners = new Set<(on: boolean) => void>();

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

function loadPreference(): boolean {
  if (typeof window === "undefined") return true;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "off") return false;
  if (stored === "on") return true;
  // No explicit choice yet: default ON, unless the OS asks for calm.
  return !prefersReducedMotion();
}

/** Create the context + render buffers. Safe to call repeatedly. */
function ensure(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    enabled = loadPreference();
    master = ctx.createGain();
    master.gain.value = enabled ? MASTER_CEILING : 0;
    master.connect(ctx.destination);
    const pcm = renderAll(ctx.sampleRate);
    buffers = {} as Record<CueName, AudioBuffer>;
    for (const name of Object.keys(pcm) as CueName[]) {
      const data = pcm[name];
      const b = ctx.createBuffer(1, data.length, ctx.sampleRate);
      b.getChannelData(0).set(data);
      buffers[name] = b;
    }
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Warm the engine from within a user gesture (called by SoundController). */
export function unlockAudio(): void {
  ensure();
}

/** Play a cue. No-op before unlock, when muted, or on the server. */
export function playCue(cue: CueName, gain = 1): void {
  if (!enabled) return;
  const c = ensure();
  if (!c || !master || !buffers) return;
  const now = c.currentTime;
  const prev = lastPlayed.get(cue) ?? -1;
  if (now - prev < 0.045) return; // debounce identical rapid fires
  lastPlayed.set(cue, now);
  const src = c.createBufferSource();
  src.buffer = buffers[cue];
  const g = c.createGain();
  g.gain.value = gain * CUE_TRIM[cue];
  src.connect(g).connect(master);
  src.start();
}

export function isSoundEnabled(): boolean {
  return typeof window === "undefined" ? true : loadPreference();
}

/** Toggle/persist sound. Ramps the master rather than cutting hard. */
export function setSoundEnabled(on: boolean): void {
  enabled = on;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  }
  if (on) ensure(); // may create the context if toggled on pre-gesture
  if (ctx && master) {
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.linearRampToValueAtTime(
      on ? MASTER_CEILING : 0,
      ctx.currentTime + 0.08,
    );
  }
  for (const l of listeners) l(on);
}

/** Subscribe to enabled changes (for the toggle UI). Returns unsubscribe. */
export function onSoundChange(l: (on: boolean) => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
