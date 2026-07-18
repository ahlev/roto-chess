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
 *  - Sound is ON by default; a persisted mute is the only thing that silences
 *    it, so it never feels mysteriously broken.
 */
import { renderAll, type CueName } from "./synth";

/** The top of the range — moderate on purpose (present, never loud). */
const MASTER_CEILING = 0.6;

/** Per-cue perceived-loudness balance (a sustained bell needs less than a click). */
const CUE_TRIM: Record<CueName, number> = {
  "set-down": 1.0,
  capture: 1.0,
  "check-pulse": 1.0,
  halo: 0.85,
  avenger: 0.9,
  victory: 0.9,
  draw: 0.85,
  "your-turn": 0.95,
  evaporation: 0.9,
  "zoom-detent": 0.9,
  "chat-tick": 0.9,
};

const STORAGE_KEY = "rc-sound-enabled";
const STORAGE_KEY_VOL = "rc-sound-volume";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let buffers: Record<CueName, AudioBuffer> | null = null;
let enabled = true;
/** 0..1 user level; scales the master ceiling. */
let volume = 1;
const lastPlayed = new Map<CueName, number>();
const listeners = new Set<(on: boolean) => void>();
const volumeListeners = new Set<(v: number) => void>();

/** Clamp a volume level into 0..1. */
export function clampVolume(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
const clamp01 = clampVolume;

/**
 * Decide the default enabled state from the stored choice and device class.
 * An explicit choice always wins; with none, desktop is audible and mobile is
 * quiet (surprise audio on a phone is jarring, and touch needs a tap anyway).
 * Pure, so the policy can be unit-tested without a DOM.
 */
export function resolveEnabled(
  stored: string | null,
  touchPrimary: boolean,
): boolean {
  if (stored !== null) return stored !== "off";
  return !touchPrimary;
}

/** Touch-primary device (phone/tablet): no hover, coarse pointer. */
function isTouchPrimary(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(hover: none) and (pointer: coarse)").matches;
}

function loadPreference(): boolean {
  if (typeof window === "undefined") return true;
  // (Reduced-motion is deliberately NOT a reason to mute — that once read as
  // "sound is broken"; it should calm ambient layers, not kill every cue.)
  return resolveEnabled(window.localStorage.getItem(STORAGE_KEY), isTouchPrimary());
}

function loadVolume(): number {
  if (typeof window === "undefined") return 1;
  const raw = window.localStorage.getItem(STORAGE_KEY_VOL);
  const n = raw === null ? 1 : Number(raw);
  return Number.isFinite(n) ? clamp01(n) : 1;
}

/** Master gain target: muted → 0, else the ceiling scaled by the user volume. */
function targetGain(): number {
  return enabled ? MASTER_CEILING * volume : 0;
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
    volume = loadVolume();
    master = ctx.createGain();
    master.gain.value = targetGain();
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
    master.gain.linearRampToValueAtTime(targetGain(), ctx.currentTime + 0.08);
  }
  for (const l of listeners) l(on);
}

/** Current volume level (0..1). */
export function getVolume(): number {
  return typeof window === "undefined" ? volume : loadVolume();
}

/** Set/persist the volume level. Nudging up from silence lifts a mute. */
export function setVolume(v: number): void {
  volume = clamp01(v);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY_VOL, String(volume));
  }
  // Dragging the level up is an intent to hear it — get a mute out of the way.
  if (volume > 0 && !enabled) {
    enabled = true;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, "on");
    }
    for (const l of listeners) l(true);
  }
  ensure(); // a slider drag is a gesture; safe to warm the engine
  if (ctx && master) {
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.linearRampToValueAtTime(targetGain(), ctx.currentTime + 0.05);
  }
  for (const l of volumeListeners) l(volume);
}

/** Subscribe to volume changes (for the slider UI). Returns unsubscribe. */
export function onVolumeChange(l: (v: number) => void): () => void {
  volumeListeners.add(l);
  return () => volumeListeners.delete(l);
}

/** Subscribe to enabled changes (for the toggle UI). Returns unsubscribe. */
export function onSoundChange(l: (on: boolean) => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
