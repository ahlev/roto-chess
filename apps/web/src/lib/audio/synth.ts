/**
 * Procedural SFX synthesis — the SAME DSP that rendered the approved WAVs,
 * ported to run in the browser. Each cue is built from raw math (oscillators,
 * filtered noise, modal "wood" synthesis, inharmonic bell partials, envelopes)
 * into a Float32Array of mono PCM; the audio engine wraps each in an
 * AudioBuffer once at startup. No binary assets, no external service — the
 * sounds ARE code, so every timbre is a tunable number, not an opaque file.
 */

export type CueName =
  | "set-down"
  | "capture"
  | "check-pulse"
  | "halo"
  | "avenger"
  | "victory"
  | "draw"
  | "your-turn"
  | "evaporation"
  | "zoom-detent"
  | "chat-tick";

// Sample rate is set per-render from the live AudioContext (44.1k or 48k).
let SR = 44100;

// ---- primitives --------------------------------------------------------
const buf = (dur: number) => new Float32Array(Math.ceil(dur * SR));
const t = (i: number) => i / SR;

// Deterministic noise so every render of a cue is identical.
let seed = 12345;
function resetSeed() {
  seed = 12345;
}
function rnd(): number {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return (seed / 0xffffffff) * 2 - 1;
}

/** Exponentially-decaying sine — one "mode" of a struck body. */
function mode(
  out: Float32Array,
  freq: number,
  amp: number,
  tau: number,
  start = 0,
  atk = 0.003,
): void {
  const s0 = Math.floor(start * SR);
  for (let i = s0; i < out.length; i++) {
    const lt = t(i - s0);
    const a = lt < atk ? lt / atk : 1; // soft attack, no click
    out[i] =
      (out[i] ?? 0) +
      amp * a * Math.exp(-lt / tau) * Math.sin(2 * Math.PI * freq * lt);
  }
}

/** One-pole low-pass; cutoff may be a constant or a function of sample index. */
function lowpass(out: Float32Array, cutoff: number | ((i: number) => number)): void {
  let y = 0;
  for (let i = 0; i < out.length; i++) {
    const fc = typeof cutoff === "function" ? cutoff(i) : cutoff;
    const rc = 1 / (2 * Math.PI * fc);
    const a = 1 / SR / (rc + 1 / SR);
    y += a * ((out[i] ?? 0) - y);
    out[i] = y;
  }
}

function highpass(out: Float32Array, fc: number): void {
  let y = 0;
  let prev = 0;
  const rc = 1 / (2 * Math.PI * fc);
  const a = rc / (rc + 1 / SR);
  for (let i = 0; i < out.length; i++) {
    const x = out[i] ?? 0;
    y = a * (y + x - prev);
    prev = x;
    out[i] = y;
  }
}

/** Filtered-noise transient/texture with its own exponential envelope. */
function noiseBurst(
  out: Float32Array,
  amp: number,
  tau: number,
  start = 0,
  atk = 0.001,
): void {
  const s0 = Math.floor(start * SR);
  for (let i = s0; i < out.length; i++) {
    const lt = t(i - s0);
    const a = lt < atk ? lt / atk : 1;
    out[i] = (out[i] ?? 0) + amp * a * Math.exp(-lt / tau) * rnd();
  }
}

/** Normalize to peak, apply master gain, de-click with short fades. */
function finish(out: Float32Array, master = 1, peak = 0.95): Float32Array {
  let m = 0;
  for (const v of out) m = Math.max(m, Math.abs(v));
  const g = (m > 0 ? peak / m : 1) * master;
  for (let i = 0; i < out.length; i++) out[i] = (out[i] ?? 0) * g;
  const fi = 64;
  const fo = 300;
  for (let i = 0; i < fi; i++) out[i] = (out[i] ?? 0) * (i / fi);
  for (let i = 0; i < fo && i < out.length; i++) {
    const j = out.length - 1 - i;
    out[j] = (out[j] ?? 0) * (i / fo);
  }
  return out;
}

/** A struck bowl/bell — inharmonic partials, warm decay. */
function bell(out: Float32Array, base: number, gain: number, tauScale = 1, start = 0): void {
  const ratios = [1, 2.76, 5.4, 8.93];
  const amps = [1, 0.55, 0.33, 0.18];
  const taus = [0.7, 0.42, 0.26, 0.16];
  ratios.forEach((r, k) =>
    mode(out, base * r, (amps[k] ?? 0) * gain, (taus[k] ?? 0.2) * tauScale, start, 0.004),
  );
}

/** A weighted wooden piece knock (felt-cushioned). */
function woodKnock(out: Float32Array, base: number, gain: number, start = 0): void {
  mode(out, base, 1.0 * gain, 0.1, start, 0.002);
  mode(out, base * 2.3, 0.5 * gain, 0.06, start, 0.002);
  mode(out, base * 4.6, 0.22 * gain, 0.035, start, 0.002);
  noiseBurst(out, 0.5 * gain, 0.004, start); // contact transient
}

// ---- cues --------------------------------------------------------------
const CUES: Record<CueName, () => Float32Array> = {
  "set-down": () => {
    const o = buf(0.19);
    woodKnock(o, 190, 1);
    lowpass(o, 2600); // felt warmth
    return finish(o, 0.8);
  },
  capture: () => {
    const o = buf(0.28);
    woodKnock(o, 190, 1); // the moving piece lands
    woodKnock(o, 250, 0.55, 0.045); // captured piece displaced
    noiseBurst(o, 0.18, 0.05, 0.05, 0.01); // faint felt sweep
    highpass(o, 120);
    lowpass(o, 2800);
    return finish(o, 0.82);
  },
  "check-pulse": () => {
    const o = buf(0.42);
    mode(o, 92, 1.0, 0.28, 0, 0.008);
    mode(o, 138, 0.3, 0.18, 0, 0.008);
    mode(o, 46, 0.45, 0.3, 0, 0.01); // sub — gravity
    noiseBurst(o, 0.12, 0.01, 0);
    lowpass(o, 420);
    return finish(o, 0.85);
  },
  halo: () => {
    const o = buf(0.85);
    bell(o, 587.33, 1); // D5, warm
    lowpass(o, 8000);
    return finish(o, 0.72);
  },
  avenger: () => {
    // Revenge struck in meridian red: a firm low knock (the capture lands),
    // then a dark-to-bright open fifth — D4 rising to A4 — tense, not sweet.
    const o = buf(1.0);
    woodKnock(o, 150, 0.9);
    bell(o, 293.66, 0.85, 0.9, 0.05); // D4
    bell(o, 440.0, 0.7, 0.9, 0.2); // A4
    lowpass(o, 6500);
    return finish(o, 0.78);
  },
  victory: () => {
    const o = buf(1.7);
    // A-major bloom: A4 – D5 – F#5, gently staggered, ringing together
    bell(o, 440.0, 0.9, 1.3, 0.0);
    bell(o, 587.33, 0.9, 1.3, 0.12);
    bell(o, 740.0, 0.8, 1.3, 0.24);
    woodKnock(o, 73, 0.5, 0.95); // a soft wooden "close", like a box lid
    lowpass(o, 8500);
    return finish(o, 0.72);
  },
  draw: () => {
    const o = buf(1.1);
    // deliberately unresolved: D5 + G5 (a suspended, open pair)
    bell(o, 587.33, 0.85, 1.0, 0.0);
    bell(o, 784.0, 0.7, 1.0, 0.13);
    lowpass(o, 7500);
    return finish(o, 0.62);
  },
  "your-turn": () => {
    const o = buf(0.34);
    const tap = (f: number, s: number) => {
      mode(o, f, 1.0, 0.12, s, 0.003);
      mode(o, f * 2, 0.28, 0.06, s, 0.003);
    };
    tap(523.25, 0.0); // C5
    tap(659.25, 0.12); // E5
    lowpass(o, 6000);
    return finish(o, 0.6);
  },
  evaporation: () => {
    const o = buf(0.72);
    noiseBurst(o, 1.0, 0.35, 0, 0.02); // breathy body
    const N = o.length;
    lowpass(o, (i) => 2500 * Math.pow(300 / 2500, i / N)); // sweep down
    highpass(o, 200);
    return finish(o, 0.55);
  },
  "zoom-detent": () => {
    const o = buf(0.06);
    noiseBurst(o, 1.0, 0.006, 0);
    mode(o, 2000, 0.3, 0.008, 0, 0.0005); // tiny mechanical tick
    highpass(o, 800);
    lowpass(o, 3000);
    return finish(o, 0.7);
  },
  "chat-tick": () => {
    const o = buf(0.13);
    noiseBurst(o, 1.0, 0.03, 0, 0.001); // paper/card
    highpass(o, 1200);
    lowpass(o, 5500);
    return finish(o, 0.5);
  },
};

/** Render every cue's PCM at the given sample rate. Called once at startup. */
export function renderAll(sampleRate: number): Record<CueName, Float32Array> {
  SR = sampleRate;
  const out = {} as Record<CueName, Float32Array>;
  for (const name of Object.keys(CUES) as CueName[]) {
    resetSeed();
    out[name] = CUES[name]();
  }
  return out;
}
