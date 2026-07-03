/**
 * Bake the four seat-tinted piece sets from the raw cburnett SVGs.
 * Run once (pnpm --filter web generate:pieces); outputs are committed.
 *
 * Per-seat fill STYLES (never color alone — accessibility spec):
 *   N red   — solid seat fill, umber outline
 *   E black — solid dark fill, CREAM outline & detailing (inverted)
 *   S blue  — solid seat fill, umber outline (+ base notch drawn at render)
 *   W gold  — HOLLOW: dark fill, gold outline & detailing
 * Stroke width bumped ~20% (1.5 → 1.8) to survive small annular cells.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const rawDir = join(here, "../src/components/board/pieces-raw");
const outDir = join(here, "../public/pieces");

const KINDS = ["K", "Q", "R", "B", "N", "P"];

/** seat → { body: main fill, line: stroke + detail fill } */
const STYLES = {
  1: { body: "#b5342a", line: "#26201a" }, // North red
  2: { body: "#26201a", line: "#f3ebdd" }, // East black, cream detailing
  3: { body: "#2f62a8", line: "#26201a" }, // South blue
  // West gold: hollow-outlined per spec, but with a warm dark-gold body and
  // the bright outline so pawns/knights read GOLD (not black) at phone size
  // — the fidelity review's smallest-glyph finding.
  4: { body: "#4a3a12", line: "#d9ae4e" },
};

function tint(svg, style) {
  return svg
    // Body fills
    .replaceAll('fill="#fff"', `fill="${style.body}"`)
    .replaceAll("fill:#fff", `fill:${style.body}`)
    .replaceAll('fill="#ffffff"', `fill="${style.body}"`)
    // Line work: strokes and black detail fills
    .replaceAll('stroke="#000"', `stroke="${style.line}"`)
    .replaceAll("stroke:#000", `stroke:${style.line}`)
    .replaceAll('fill="#000"', `fill="${style.line}"`)
    .replaceAll("fill:#000", `fill:${style.line}`)
    // +20% stroke weight
    .replaceAll('stroke-width="1.5"', 'stroke-width="1.8"')
    .replaceAll("stroke-width:1.5", "stroke-width:1.8");
}

mkdirSync(outDir, { recursive: true });
let count = 0;
for (const kind of KINDS) {
  const raw = readFileSync(join(rawDir, `w${kind}.svg`), "utf8");
  for (const seat of [1, 2, 3, 4]) {
    const tinted = tint(raw, STYLES[seat]);
    // Fail loudly if the source set ever changes shape and a fill/stroke
    // slips through untinted.
    if (/#fff\b|#ffffff\b|"#000"|:#000\b/u.test(tinted)) {
      throw new Error(`untinted color survived in ${seat}${kind}`);
    }
    writeFileSync(join(outDir, `${seat}${kind}.svg`), tinted);
    count++;
  }
}
console.log(`wrote ${count} static sprites → public/pieces/`);
