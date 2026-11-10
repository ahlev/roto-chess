/**
 * One PNG per beat at its representative frame (the storyboard moment:
 * the beat midpoint, except beats 1, 2, 4, 6 and 8 whose captions or key moments come late), for
 * the founder's storyboard comparison. Run: pnpm --filter film stills
 */
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const FPS = 30;
const BEATS = [[0, 7], [7, 14], [14, 22], [22, 30], [30, 38], [38, 46], [46, 53], [53, 60]];
/** Beat-local frame overrides where the midpoint precedes the caption. */
const LOCAL_FRAME = { 1: 200, 2: 180, 4: 200, 6: 170, 8: 160 };
mkdirSync("out/stills", { recursive: true });
BEATS.forEach(([start, end], i) => {
  const local = LOCAL_FRAME[i + 1];
  const frame = local !== undefined ? start * FPS + local : Math.round(((start + end) / 2) * FPS);
  const r = spawnSync("pnpm", ["exec", "remotion", "still", "src/index.ts", "RoadmapFilm", `out/stills/beat-${i + 1}.png`, `--frame=${frame}`], { stdio: "inherit", shell: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
});
console.log("stills in out/stills");
