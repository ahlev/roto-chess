/**
 * Render the app's synthesized cues and the film's clockwork motif to WAV.
 * Uses the web app's synth.ts directly through Node's native TypeScript
 * import (Node 22.18+ / 24): the module is pure math with no imports.
 * Run: pnpm --filter film render-audio
 */
import { Buffer } from "node:buffer";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "../public/audio");
mkdirSync(outDir, { recursive: true });
const SR = 44100;

const synthPath = pathToFileURL(join(here, "../../web/src/lib/audio/synth.ts")).href;
const { renderAll } = await import(synthPath);

function wav(samples) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  return buf;
}

const cues = renderAll(SR);
for (const [name, pcm] of Object.entries(cues)) {
  writeFileSync(join(outDir, `${name}.wav`), wav(pcm));
}

// Clockwork motif: a tick every 600 ms (filtered noise burst + low sine),
// a soft inharmonic bell partial every fourth tick, 60 s, quiet.
const seconds = 60;
const motif = new Float32Array(SR * seconds);
let seed = 7;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return (seed / 0xffffffff) * 2 - 1; };
const tickEvery = 0.6;
for (let k = 0; k * tickEvery < seconds; k++) {
  const start = Math.floor(k * tickEvery * SR);
  let lp = 0;
  for (let i = 0; i < SR * 0.05; i++) {
    const t = i / SR;
    const env = Math.exp(-t * 90);
    lp = lp * 0.86 + rnd() * 0.14;
    const s = lp * 0.5 * env + Math.sin(2 * Math.PI * 110 * t) * 0.35 * Math.exp(-t * 40);
    if (start + i < motif.length) motif[start + i] += s * 0.4;
  }
  if (k % 4 === 0) {
    for (let i = 0; i < SR * 1.4; i++) {
      const t = i / SR;
      const s = Math.sin(2 * Math.PI * 523.25 * t) * Math.exp(-t * 3) * 0.12 + Math.sin(2 * Math.PI * 1397 * t) * Math.exp(-t * 6) * 0.05;
      if (start + i < motif.length) motif[start + i] += s;
    }
  }
}
writeFileSync(join(outDir, "motif.wav"), wav(motif));
console.log(`wrote ${Object.keys(cues).length} cues + motif to public/audio`);
