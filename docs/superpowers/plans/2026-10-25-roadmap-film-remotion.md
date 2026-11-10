# Roadmap Film (Remotion) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the 60-second Roto Chess roadmap film as a Remotion project in the monorepo, rendering the eight approved storyboard beats as one continuous, deterministic shot with the app's own board, pieces, palette and synthesized sound.

**Architecture:** A new `apps/film` workspace. Scenes are SVG compositions driven only by `useCurrentFrame()`; the board is drawn from a synced copy of the web app's board geometry, pieces come from the same sprite files loaded once as data URLs, and every move shown is a legal engine move produced by a deterministic scripted opening. Audio is the app's synthesized cue set rendered to WAV once by script. Layout numbers live in one table per format so the portrait cut reuses the scenes.

**Tech Stack:** Remotion 4.0.537 (`remotion`, `@remotion/cli`, `@remotion/google-fonts`), React 19, TypeScript 5.8, `@rotochess/engine` (workspace), vitest, Node 22+ (scripts use Node's native TypeScript import), pnpm 11.

Spec: `docs/superpowers/specs/2026-10-25-roadmap-film-remotion-design.md`.

## Global Constraints

- Every Remotion package is pinned to the exact version `4.0.537` (no caret).
- Composition `RoadmapFilm`: 1920×1080, 30 fps, 1800 frames. Beat frame ranges: 0–210, 210–420, 420–660, 660–900, 900–1140, 1140–1380, 1380–1590, 1590–1800.
- Nothing reads `Date.now()`, `Math.random()` or CSS animation. All motion comes from `useCurrentFrame()`.
- Palette tokens verbatim from `apps/web/src/app/globals.css`; fonts Instrument Serif, Instrument Sans, IBM Plex Mono; motion durations 150/250/400/700 ms; settle easing `cubic-bezier(0.22, 1, 0.36, 1)`.
- The eight on-screen lines, unchanged: "Four players. One ring. Rules chess never had." / "It works. It does not yet feel alive." / "First, make it unbreakable." / "Then, make it yours." / "Every move should land." / "Play when no one is waiting. Share when it ends." / "See the move the way it felt." / "One game. Every table."
- Names on screen are placeholders: Alex, Sam, Jordan, Casey, "the Nerds' table". Product name "Roto Chess".
- `apps/web` is not modified. The film never imports from `apps/web` at build time; it uses synced copies.
- Sprites are drawn with SVG `<image>` elements from data URLs; no sprite markup is ever injected as raw HTML.
- Do not commit or push without the founder's word (project rule). Each task ends with a local verification, not a commit.
- Monorepo root for all commands: `C:\Users\ahlev\OneDrive\Desktop\CLAUDE\Roto Chess\app`.

---

## File structure

```
apps/film/
  package.json                 workspace "film": scripts, pinned Remotion deps
  tsconfig.json                extends ../../tsconfig.base.json, DOM lib, react-jsx
  remotion.config.ts           image format, overwrite
  vitest.config.ts             pure tests under test/
  public/pieces/*.svg          synced from apps/web (24 files)
  public/audio/*.wav           rendered by scripts/render-audio.mjs
  scripts/sync-assets.mjs      copies pieces + board geometry from apps/web
  scripts/render-audio.mjs     cues + motif → WAV
  scripts/stills.mjs           one PNG per beat midpoint
  src/index.ts                 registerRoot
  src/Root.tsx                 Composition registrations
  src/RoadmapFilm.tsx          the Sequence timeline + audio
  src/timeline.ts              FPS, beats, toFrames, beatRange
  src/motion.ts                ms→frames, settle easing, tween, fade
  src/theme.ts                 palette tokens
  src/fonts.ts                 google-fonts loading
  src/layout.ts                per-format layout numbers
  src/board/geometry.ts        GENERATED copy of web board-geometry.ts
  src/board/sprites.ts         sprite fetch → data URLs
  src/board/Board.tsx          Squares, Rails, Meridians, Numerals, Pieces, paths
  src/board/script.ts          deterministic engine-played opening
  src/ui/LowerThird.tsx        on-screen line with scrim
  src/ui/Chip.tsx              pill chip
  src/ui/Rose.tsx              Meridian Rose monogram
  src/ui/Staunton.tsx          2.5D piece silhouettes
  src/ui/Devices.tsx           phone, tablet, laptop frames
  src/scenes/Scene1Hook.tsx … Scene8Everywhere.tsx
  src/scenes/scene7Pose.ts     pure pose function for the motion test
  src/audio/cueSheet.ts        absolute cue frames
  src/audio/Cues.tsx           <Audio> sequences
  test/timeline.test.ts, motion.test.ts, script.test.ts, scene7Pose.test.ts
```

---

### Task 1: Scaffold the `film` workspace with the timeline

**Files:**
- Create: `apps/film/package.json`
- Create: `apps/film/tsconfig.json`
- Create: `apps/film/remotion.config.ts`
- Create: `apps/film/vitest.config.ts`
- Create: `apps/film/src/timeline.ts`
- Create: `apps/film/src/index.ts`
- Create: `apps/film/src/Root.tsx`
- Create: `apps/film/src/RoadmapFilm.tsx` (placeholder, replaced in Task 9)
- Create: `apps/film/.gitignore`
- Test: `apps/film/test/timeline.test.ts`

**Interfaces:**
- Produces: `FPS = 30`, `BEATS: readonly Beat[]` (`{ id: BeatId; name: string; start: number; end: number }` in seconds), `BeatId` union `"hook" | "today" | "ground" | "pocket" | "feel" | "alone" | "depth" | "everywhere"`, `toFrames(seconds: number): number`, `beatRange(id: BeatId): { from: number; durationInFrames: number }`, `TOTAL_FRAMES = 1800`.

- [ ] **Step 1: Create the package manifest**

`apps/film/package.json`:

```json
{
  "name": "film",
  "version": "0.1.0",
  "private": true,
  "description": "Roto Chess roadmap film — Remotion composition rendering the eight approved beats.",
  "scripts": {
    "studio": "remotion studio src/index.ts",
    "render": "remotion render src/index.ts RoadmapFilm out/roadmap-1080p.mp4 --codec h264",
    "render:portrait": "remotion render src/index.ts RoadmapFilmPortrait out/roadmap-portrait.mp4 --codec h264",
    "stills": "node scripts/stills.mjs",
    "sync-assets": "node scripts/sync-assets.mjs",
    "render-audio": "node scripts/render-audio.mjs",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@remotion/cli": "4.0.537",
    "@remotion/google-fonts": "4.0.537",
    "@rotochess/engine": "workspace:*",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "remotion": "4.0.537"
  },
  "devDependencies": {
    "@types/react": "^19.1.8",
    "@types/react-dom": "^19.1.6",
    "typescript": "^5.8.3",
    "vitest": "^3.2.4"
  }
}
```

- [ ] **Step 2: Create tsconfig, Remotion config, vitest config, gitignore**

`apps/film/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "noEmit": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true
  },
  "include": ["src", "test", "remotion.config.ts", "vitest.config.ts"]
}
```

`apps/film/remotion.config.ts`:

```ts
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
```

`apps/film/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
  },
});
```

`apps/film/.gitignore`:

```
out/
```

- [ ] **Step 3: Write the failing timeline test**

`apps/film/test/timeline.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { BEATS, FPS, TOTAL_FRAMES, beatRange, toFrames } from "../src/timeline";

describe("timeline", () => {
  it("runs 60 seconds at 30 fps", () => {
    expect(FPS).toBe(30);
    expect(TOTAL_FRAMES).toBe(1800);
    expect(toFrames(60)).toBe(1800);
  });

  it("has eight contiguous beats covering 0 to 60 s", () => {
    expect(BEATS).toHaveLength(8);
    expect(BEATS[0]?.start).toBe(0);
    expect(BEATS[7]?.end).toBe(60);
    for (let i = 1; i < BEATS.length; i++) {
      expect(BEATS[i]?.start).toBe(BEATS[i - 1]?.end);
    }
  });

  it("maps beat ids to frame ranges", () => {
    expect(beatRange("hook")).toEqual({ from: 0, durationInFrames: 210 });
    expect(beatRange("ground")).toEqual({ from: 420, durationInFrames: 240 });
    expect(beatRange("everywhere")).toEqual({ from: 1590, durationInFrames: 210 });
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run from the monorepo root:

```bash
pnpm install && pnpm --filter film test
```

Expected: FAIL with "Cannot find module '../src/timeline'" (after `pnpm install` has linked the new workspace; a lockfile change is expected for a new workspace).

- [ ] **Step 5: Write the timeline module**

`apps/film/src/timeline.ts`:

```ts
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
```

- [ ] **Step 6: Create the root, a placeholder film, and the entry**

`apps/film/src/RoadmapFilm.tsx` (placeholder; Task 9 replaces it):

```tsx
import { AbsoluteFill, useCurrentFrame } from "remotion";

export interface FilmProps {
  format: "landscape" | "portrait";
}

export const RoadmapFilm = ({ format }: FilmProps) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: "#17130e", color: "#efe6d6", fontSize: 48, justifyContent: "center", alignItems: "center" }}>
      Roto Chess film · {format} · frame {frame}
    </AbsoluteFill>
  );
};
```

`apps/film/src/Root.tsx`:

```tsx
import { Composition } from "remotion";
import { RoadmapFilm } from "./RoadmapFilm";
import { FPS, TOTAL_FRAMES } from "./timeline";

export const Root = () => (
  <>
    <Composition
      id="RoadmapFilm"
      component={RoadmapFilm}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={1920}
      height={1080}
      defaultProps={{ format: "landscape" as const }}
    />
  </>
);
```

`apps/film/src/index.ts`:

```ts
import { registerRoot } from "remotion";
import { Root } from "./Root";

registerRoot(Root);
```

- [ ] **Step 7: Run tests, typecheck, and a smoke still**

```bash
pnpm --filter film test && pnpm --filter film typecheck && pnpm --filter film exec remotion still src/index.ts RoadmapFilm out/smoke.png --frame=30
```

Expected: 3 tests pass; typecheck clean; `apps/film/out/smoke.png` exists and shows "frame 30" on an espresso background (Remotion downloads its headless browser on first run; allow a minute).

- [ ] **Step 8: Confirm the monorepo still passes**

```bash
pnpm typecheck && pnpm lint && pnpm test
```

Expected: all green (the film's tests join the run).

---

### Task 2: Synced board geometry, sprites, and the Board components

**Files:**
- Create: `apps/film/scripts/sync-assets.mjs`
- Create (generated): `apps/film/src/board/geometry.ts`, `apps/film/public/pieces/*.svg`
- Create: `apps/film/src/board/sprites.ts`
- Create: `apps/film/src/theme.ts`
- Create: `apps/film/src/board/Board.tsx`
- Create: `apps/film/src/board/script.ts` (minimal; Task 4 completes it)
- Create: `apps/film/src/BoardCheck.tsx` (review composition)
- Modify: `apps/film/src/Root.tsx`

**Interfaces:**
- Consumes: `@rotochess/engine` (`squareOf`, `rankOf`, `fileOf`, `Seat`, `PieceKind`, `BoardState`), geometry copy (`SQUARES`, `CENTER`, `INNER_R`, `OUTER_R`, `SECTOR_DEG`, `polarPoint`).
- Produces: `BoardTransform { cx; cy; s; ky? }`, `FilmPiece { rank; file; seat; kind; halo? }`, `mapPoint(T, p)`, `groupTransform(T)`, components `Squares`, `Rails`, `Meridians`, `Numerals`, `Pieces`, `Sprite`, `BoardSvg`, helpers `cellCentroid(rank, file)`, `movePathD(T, cells)`, `pointAlongCells(T, cells, t)`, `useSprites(): SpriteMap | null`, `SpriteMap = Record<string, string>` (key `${seat}${kind}` → data URL), `piecesOf(state)`.

- [ ] **Step 1: Write the sync script**

`apps/film/scripts/sync-assets.mjs`:

```js
/**
 * Copy the web app's piece sprites and board geometry into the film.
 * The web app stays the single source of truth; outputs are committed and
 * never hand-edited. Run: pnpm --filter film sync-assets
 */
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const web = join(here, "../../web");
const piecesIn = join(web, "public/pieces");
const piecesOut = join(here, "../public/pieces");
mkdirSync(piecesOut, { recursive: true });
let n = 0;
for (const f of readdirSync(piecesIn)) {
  if (!f.endsWith(".svg")) continue;
  copyFileSync(join(piecesIn, f), join(piecesOut, f));
  n++;
}

const geomIn = join(web, "src/components/board/board-geometry.ts");
const geomOut = join(here, "../src/board/geometry.ts");
const banner = `// GENERATED by scripts/sync-assets.mjs from apps/web/src/components/board/board-geometry.ts — do not edit.\n`;
writeFileSync(geomOut, banner + readFileSync(geomIn, "utf8"));
console.log(`synced ${n} sprites and board geometry`);
```

- [ ] **Step 2: Run it and typecheck the generated file**

```bash
pnpm --filter film sync-assets && pnpm --filter film typecheck
```

Expected: "synced 24 sprites and board geometry"; typecheck clean (the copy imports only `@rotochess/engine`).

- [ ] **Step 3: Write the sprite loader**

Each sprite is fetched once from the film's `public/pieces/` and turned into a `data:image/svg+xml` URL. An SVG `<image href>` then draws it with no network access at render time, and `delayRender` holds the frame until every sprite is in memory.

`apps/film/src/board/sprites.ts`:

```ts
import { useEffect, useState } from "react";
import { cancelRender, continueRender, delayRender, staticFile } from "remotion";

/** Key = `${seat}${kind}`, value = a data URL for the sprite SVG. */
export type SpriteMap = Record<string, string>;

const SEATS = [1, 2, 3, 4] as const;
const KINDS = ["K", "Q", "R", "B", "N", "P"] as const;
export const SPRITE_KEYS: readonly string[] = SEATS.flatMap((s) => KINDS.map((k) => `${s}${k}`));

const cache: { promise: Promise<SpriteMap> | null; value: SpriteMap | null } = { promise: null, value: null };

export function loadSprites(): Promise<SpriteMap> {
  if (!cache.promise) {
    cache.promise = Promise.all(
      SPRITE_KEYS.map(async (key) => {
        const res = await fetch(staticFile(`pieces/${key}.svg`));
        if (!res.ok) throw new Error(`sprite ${key}: HTTP ${res.status}`);
        const svg = await res.text();
        return [key, `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`] as const;
      }),
    ).then((entries) => {
      cache.value = Object.fromEntries(entries);
      return cache.value;
    });
  }
  return cache.promise;
}

/** Blocks the render until all 24 sprites are in memory; returns null meanwhile. */
export function useSprites(): SpriteMap | null {
  const [sprites, setSprites] = useState<SpriteMap | null>(cache.value);
  const [handle] = useState<number | null>(() => (cache.value ? null : delayRender("Loading piece sprites")));
  useEffect(() => {
    if (cache.value) return;
    loadSprites()
      .then((v) => {
        setSprites(v);
        if (handle !== null) continueRender(handle);
      })
      .catch((err: unknown) => cancelRender(err));
  }, [handle]);
  return sprites;
}
```

- [ ] **Step 4: Add the theme tokens**

`apps/film/src/theme.ts`:

```ts
/** Midnight Orrery tokens, verbatim from apps/web/src/app/globals.css. */
export const PALETTE = {
  bg: "#17130e",
  surface: "#211b14",
  surfaceRaised: "#2b241b",
  line: "#3c3327",
  text: "#efe6d6",
  textDim: "#b0a490",
  ruleRed: "#a8352a",
  boardCream: "#f0e6d2",
  boardUmber: "#b09a78",
  boardMeridian: "#a8352a",
  check: "#ff5a45",
  halo: "#f2d27c",
  evaporate: "#8fa6a0",
  success: "#8faf7e",
  lastMove: "#cbbfa4",
  pieceRed: "#b5342a",
  pieceBlue: "#2f62a8",
  pieceGold: "#c9962e",
  pieceBlack: "#26201a",
} as const;

export const SEAT_COLOR = { 1: "#e5705f", 2: "#c7bcac", 3: "#7fa9dc", 4: "#d9ae4e" } as const;
export const LACQUER = { 1: PALETTE.pieceRed, 2: PALETTE.pieceBlack, 3: PALETTE.pieceBlue, 4: PALETTE.pieceGold } as const;
```

- [ ] **Step 5: Write the Board components**

`apps/film/src/board/Board.tsx`:

```tsx
/**
 * Board layers for film scenes. Every layer takes a BoardTransform that maps
 * the 576-unit board space to frame space (cx, cy = where the board center
 * lands; s = scale; ky = vertical squash for tilted views). Squares, rails
 * and meridians use an SVG group transform; pieces and numerals are placed
 * at mapped centroids and drawn upright, as the app does.
 */
import type { PieceKind, Seat } from "@rotochess/engine";
import { squareOf } from "@rotochess/engine";
import type { ReactNode } from "react";
import { CENTER, INNER_R, OUTER_R, SECTOR_DEG, SQUARES, polarPoint } from "./geometry";
import type { SpriteMap } from "./sprites";
import { PALETTE } from "../theme";

export interface BoardTransform {
  cx: number;
  cy: number;
  s: number;
  ky?: number;
}

export interface FilmPiece {
  rank: number;
  file: number;
  seat: Seat;
  kind: PieceKind;
  halo?: boolean;
}

const f2 = (n: number) => n.toFixed(2);

export function mapPoint(T: BoardTransform, p: { x: number; y: number }): { x: number; y: number } {
  return { x: T.cx + (p.x - CENTER) * T.s, y: T.cy + (p.y - CENTER) * T.s * (T.ky ?? 1) };
}

export function groupTransform(T: BoardTransform): string {
  return `translate(${T.cx} ${T.cy}) scale(${T.s} ${T.s * (T.ky ?? 1)}) translate(${-CENTER} ${-CENTER})`;
}

export function cellCentroid(rank: number, file: number): { x: number; y: number; deg: number; r: number } {
  const g = SQUARES[squareOf(rank, file)];
  if (!g) throw new Error(`no square ${rank}/${file}`);
  return { x: g.cx, y: g.cy, deg: g.midDeg, r: g.midR };
}

export type SquareStyle = (rank: number, file: number, color: string) => { fill: string; stroke?: string; strokeWidth?: number; opacity?: number } | null;

export const Squares = ({ T, style, opacity = 1 }: { T: BoardTransform; style?: SquareStyle; opacity?: number }) => (
  <g transform={groupTransform(T)} opacity={opacity}>
    {SQUARES.map((g) => {
      // Rank and file recovered from the centroid (both are exact multiples of the sector and ring widths).
      const rank = Math.floor(g.midDeg / SECTOR_DEG);
      const file = Math.round((g.midR - INNER_R - 20) / 40);
      const base = g.color === 1 ? PALETTE.boardCream : PALETTE.boardUmber;
      const st = style ? style(rank, file, base) : { fill: base };
      if (!st) return null;
      return <path key={g.square} d={g.path} fill={st.fill} stroke={st.stroke} strokeWidth={st.strokeWidth} opacity={st.opacity} />;
    })}
  </g>
);

export const Rails = ({ T, color = "#5a4d3b" }: { T: BoardTransform; color?: string }) => (
  <g transform={groupTransform(T)}>
    <circle cx={CENTER} cy={CENTER} r={INNER_R} fill="none" stroke={color} strokeWidth={1.2 / T.s} />
    <circle cx={CENTER} cy={CENTER} r={OUTER_R} fill="none" stroke={color} strokeWidth={1.2 / T.s} />
  </g>
);

export const Meridians = ({ T, width = 3, opacity = 1, only }: { T: BoardTransform; width?: number; opacity?: number; only?: Seat }) => (
  <g transform={groupTransform(T)} opacity={opacity}>
    {([1, 2, 3, 4] as const).map((seat) => {
      if (only !== undefined && seat !== only) return null;
      const deg = (seat - 1) * 90;
      const a = polarPoint(deg, INNER_R - 2);
      const b = polarPoint(deg, OUTER_R + 2);
      return <line key={seat} x1={f2(a.x)} y1={f2(a.y)} x2={f2(b.x)} y2={f2(b.y)} stroke={PALETTE.boardMeridian} strokeWidth={width / T.s} strokeLinecap="round" />;
    })}
  </g>
);

export const Numerals = ({ T }: { T: BoardTransform }) => (
  <g>
    {Array.from({ length: 32 }, (_, rank) => {
      const q = mapPoint(T, polarPoint(rank * SECTOR_DEG + SECTOR_DEG / 2, INNER_R - 14));
      return (
        <text key={rank} x={f2(q.x)} y={f2(q.y)} fontSize={f2(7.5 * T.s)} fill={PALETTE.textDim} textAnchor="middle" dominantBaseline="middle" fontFamily="IBM Plex Mono, monospace">
          {rank + 1}
        </text>
      );
    })}
  </g>
);

export const Sprite = ({ sprites, piece, at, size, opacity = 1, scale = 1 }: { sprites: SpriteMap; piece: FilmPiece; at: { x: number; y: number }; size: number; opacity?: number; scale?: number }) => {
  const href = sprites[`${piece.seat}${piece.kind}`];
  if (!href) return null;
  const sz = size * scale;
  return (
    <g opacity={opacity}>
      {piece.halo ? <circle cx={f2(at.x)} cy={f2(at.y)} r={f2(sz / 2 - 1)} fill="none" stroke={PALETTE.halo} strokeWidth={f2(Math.max(2, sz * 0.07))} /> : null}
      <image href={href} x={f2(at.x - sz / 2)} y={f2(at.y - sz / 2)} width={f2(sz)} height={f2(sz)} preserveAspectRatio="xMidYMid meet" />
    </g>
  );
};

export const Pieces = ({ T, pieces, sprites, size, filter, opacity = 1 }: { T: BoardTransform; pieces: readonly FilmPiece[]; sprites: SpriteMap; size?: number; filter?: (p: FilmPiece) => boolean; opacity?: number }) => (
  <g opacity={opacity}>
    {pieces.filter((p) => !filter || filter(p)).map((p) => (
      <Sprite key={`${p.rank}-${p.file}`} sprites={sprites} piece={p} at={mapPoint(T, cellCentroid(p.rank, p.file))} size={size ?? 34 * T.s} />
    ))}
  </g>
);

/** Smooth path through cell centroids (port of the app's movePathD) in frame space. */
export function movePathD(T: BoardTransform, cells: readonly [number, number][]): string {
  const pts = cells.map(([rank, file]) => {
    const c = cellCentroid(rank, file);
    return { ...mapPoint(T, c), deg: c.deg, r: c.r };
  });
  const first = pts[0];
  if (!first) return "";
  let d = `M ${f2(first.x)} ${f2(first.y)}`;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    let delta = b.deg - a.deg;
    while (delta > 180) delta -= 360;
    while (delta < -180) delta += 360;
    const c = mapPoint(T, polarPoint(a.deg + delta / 2, (a.r + b.r) / 2));
    d += ` Q ${f2(c.x)} ${f2(c.y)} ${f2(b.x)} ${f2(b.y)}`;
  }
  return d;
}

/** Point at fraction t (0..1) along the cells, interpolated in polar space so arcs stay arcs. */
export function pointAlongCells(T: BoardTransform, cells: readonly [number, number][], t: number): { x: number; y: number } {
  const polar = cells.map(([rank, file]) => cellCentroid(rank, file));
  const legs = polar.length - 1;
  if (legs <= 0) return mapPoint(T, polar[0] ?? { x: CENTER, y: CENTER });
  const clamped = Math.min(1, Math.max(0, t));
  const pos = clamped * legs;
  const i = Math.min(legs - 1, Math.floor(pos));
  const u = pos - i;
  const a = polar[i]!;
  const b = polar[i + 1]!;
  let delta = b.deg - a.deg;
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  return mapPoint(T, polarPoint(a.deg + delta * u, a.r + (b.r - a.r) * u));
}

export const BoardSvg = ({ width, height, children }: { width: number; height: number; children: ReactNode }) => (
  <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} style={{ display: "block" }}>
    {children}
  </svg>
);
```

- [ ] **Step 6: A minimal script module and the review composition**

`apps/film/src/board/script.ts` (Task 4 replaces this file in full):

```ts
import type { BoardState } from "@rotochess/engine";
import { fileOf, rankOf } from "@rotochess/engine";
import type { FilmPiece } from "./Board";

/** Board state → film pieces (rank/file/seat/kind/halo). */
export function piecesOf(state: BoardState): FilmPiece[] {
  const out: FilmPiece[] = [];
  state.board.forEach((p, sq) => {
    if (!p) return;
    out.push({ rank: rankOf(sq), file: fileOf(sq), seat: p.seat, kind: p.kind, halo: p.halo });
  });
  return out;
}
```

`apps/film/src/BoardCheck.tsx`:

```tsx
import { AbsoluteFill } from "remotion";
import { initialState } from "@rotochess/engine";
import { BoardSvg, Meridians, Numerals, Pieces, Rails, Squares } from "./board/Board";
import { useSprites } from "./board/sprites";
import { piecesOf } from "./board/script";
import { PALETTE } from "./theme";

export const BoardCheck = () => {
  const sprites = useSprites();
  const T = { cx: 960, cy: 540, s: 1.6 };
  return (
    <AbsoluteFill style={{ backgroundColor: PALETTE.bg }}>
      <BoardSvg width={1920} height={1080}>
        <Squares T={T} />
        <Rails T={T} />
        <Meridians T={T} />
        <Numerals T={T} />
        {sprites ? <Pieces T={T} pieces={piecesOf(initialState())} sprites={sprites} /> : null}
      </BoardSvg>
    </AbsoluteFill>
  );
};
```

Register it in `apps/film/src/Root.tsx` by adding `import { BoardCheck } from "./BoardCheck";` and, inside the fragment after the `RoadmapFilm` composition:

```tsx
    <Composition id="BoardCheck" component={BoardCheck} durationInFrames={1} fps={FPS} width={1920} height={1080} />
```

- [ ] **Step 7: Render the check still and look at it**

```bash
pnpm --filter film typecheck && pnpm --filter film exec remotion still src/index.ts BoardCheck out/board-check.png
```

Expected: `out/board-check.png` shows the cream-and-umber annulus, four red meridians, numerals 1–32 inside the hole, and all 64 pieces at their start squares with North (red) at the top. Open the PNG and confirm pieces are upright and centered in their cells. If the render stalls on "Loading piece sprites", a sprite fetch failed: check that `public/pieces/` has 24 files.

---

### Task 3: Motion vocabulary, fonts, layout table, lower third, and small UI parts

**Files:**
- Create: `apps/film/src/motion.ts`
- Create: `apps/film/src/fonts.ts`
- Create: `apps/film/src/layout.ts`
- Create: `apps/film/src/ui/LowerThird.tsx`
- Create: `apps/film/src/ui/Chip.tsx`
- Create: `apps/film/src/ui/Rose.tsx`
- Test: `apps/film/test/motion.test.ts`

**Interfaces:**
- Produces: `ms(milliseconds): number` (frames, rounded), `DUR = { fast: 150, base: 250, slow: 400, ceremony: 700 }` (ms), `settle: (t: number) => number`, `tween(frame, startFrame, durationMs, from, to, easing?)`, `fade(frame, startFrame, durationMs)` (0..1), `enter(frame, startFrame, durationMs?, rise?)` → `{ opacity, dy }`; `Layout` type and `LAYOUTS.landscape` / `LAYOUTS.portrait`; `LowerThird { text; enterAt; layout; id }`; `Chip { x; y; w; h; label; color; fill?; textColor?; size?; opacity? }`; `Rose { x; y; size; color?; opacity? }`; `FONTS = { display, displayItalic, sans, mono }` font-family strings.

- [ ] **Step 1: Write the failing motion test**

`apps/film/test/motion.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DUR, fade, ms, settle, tween } from "../src/motion";

describe("motion vocabulary", () => {
  it("converts the app's durations to frames at 30 fps", () => {
    expect(ms(DUR.fast)).toBe(5);
    expect(ms(DUR.base)).toBe(8);
    expect(ms(DUR.slow)).toBe(12);
    expect(ms(DUR.ceremony)).toBe(21);
  });

  it("settle easing is monotonic and never overshoots", () => {
    let prev = -1;
    for (let i = 0; i <= 60; i++) {
      const v = settle(i / 60);
      expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1 + 1e-9);
      prev = v;
    }
    expect(settle(0)).toBeCloseTo(0, 6);
    expect(settle(1)).toBeCloseTo(1, 6);
  });

  it("tween clamps outside its window and fade is 0..1", () => {
    expect(tween(0, 10, 400, 100, 200)).toBe(100);
    expect(tween(10, 10, 400, 100, 200)).toBe(100);
    expect(tween(22, 10, 400, 100, 200)).toBe(200);
    expect(tween(100, 10, 400, 100, 200)).toBe(200);
    const mid = tween(16, 10, 400, 100, 200);
    expect(mid).toBeGreaterThan(100);
    expect(mid).toBeLessThan(200);
    expect(fade(5, 10, 250)).toBe(0);
    expect(fade(18, 10, 250)).toBe(1);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
pnpm --filter film test
```

Expected: FAIL, "Cannot find module '../src/motion'".

- [ ] **Step 3: Write the motion module**

`apps/film/src/motion.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm --filter film test
```

Expected: PASS (timeline 3, motion 3).

- [ ] **Step 5: Fonts, layout, and the UI parts**

`apps/film/src/fonts.ts`:

```ts
import { loadFont as loadSerif } from "@remotion/google-fonts/InstrumentSerif";
import { loadFont as loadSans } from "@remotion/google-fonts/InstrumentSans";
import { loadFont as loadMono } from "@remotion/google-fonts/IBMPlexMono";

const serif = loadSerif("normal", { weights: ["400"], subsets: ["latin"] });
const serifItalic = loadSerif("italic", { weights: ["400"], subsets: ["latin"] });
const sans = loadSans("normal", { weights: ["400", "500", "600"], subsets: ["latin"] });
const mono = loadMono("normal", { weights: ["400", "500"], subsets: ["latin"] });

export const FONTS = {
  display: `${serif.fontFamily}, Georgia, serif`,
  displayItalic: `${serifItalic.fontFamily}, Georgia, serif`,
  sans: `${sans.fontFamily}, system-ui, sans-serif`,
  mono: `${mono.fontFamily}, ui-monospace, monospace`,
} as const;

export const fontsReady = Promise.all([serif.waitUntilDone(), serifItalic.waitUntilDone(), sans.waitUntilDone(), mono.waitUntilDone()]);
```

`apps/film/src/layout.ts`:

```ts
/** Per-format numbers. Scenes read only from here, so the portrait cut is a table, not a rewrite. */
export interface Layout {
  format: "landscape" | "portrait";
  width: number;
  height: number;
  /** Lower-third baseline and left edge. */
  lowerX: number;
  lowerY: number;
  lowerSize: number;
  /** Beat 1: hero board. */
  hero: { cx: number; cy: number; s: number };
  /** Beat 2: board inside the browser window, and the window box. */
  today: { cx: number; cy: number; s: number; win: { x: number; y: number; w: number; h: number } };
  /** Beat 3: exploded planes. */
  ground: { cx: number; s: number; ky: number; planeY: [number, number, number, number]; labelX: number };
  /** Beat 4: phone box and the flight start. */
  pocket: { phone: { x: number; y: number; w: number; h: number }; miniStart: { cx: number; cy: number; s: number } };
  /** Beat 5: close crop and lens. */
  feel: { cx: number; cy: number; s: number; lens: { x: number; y: number; r: number } };
  /** Beat 6: board and share card. */
  alone: { cx: number; cy: number; s: number; card: { x: number; y: number; w: number; h: number } };
  /** Beat 7: tilted board. */
  depth: { cx: number; cy: number };
  /** Beat 8: device boxes and the brand lockup. */
  everywhere: { phone: { x: number; y: number; w: number; h: number }; tablet: { x: number; y: number; w: number; h: number }; laptop: { x: number; y: number; w: number; h: number }; brandX: number; brandY: number };
}

export const LAYOUTS: Record<Layout["format"], Layout> = {
  landscape: {
    format: "landscape",
    width: 1920,
    height: 1080,
    lowerX: 96,
    lowerY: 984,
    lowerSize: 78,
    hero: { cx: 960, cy: 470, s: 1.4 },
    today: { cx: 630, cy: 590, s: 1.1, win: { x: 210, y: 90, w: 1500, h: 860 } },
    ground: { cx: 1120, s: 1.2, ky: 0.4, planeY: [230, 400, 570, 740], labelX: 300 },
    pocket: { phone: { x: 1160, y: 70, w: 460, h: 940 }, miniStart: { cx: 870, cy: 520, s: 0.52 } },
    feel: { cx: 1180, cy: 1120, s: 3.4, lens: { x: 430, y: 470, r: 220 } },
    alone: { cx: 640, cy: 520, s: 1.36, card: { x: 1280, y: 110, w: 540, h: 700 } },
    depth: { cx: 960, cy: 600 },
    everywhere: { phone: { x: 150, y: 330, w: 300, h: 600 }, tablet: { x: 560, y: 390, w: 700, h: 500 }, laptop: { x: 1370, y: 360, w: 460, h: 300 }, brandX: 760, brandY: 42 },
  },
  portrait: {
    format: "portrait",
    width: 1080,
    height: 1920,
    lowerX: 72,
    lowerY: 1760,
    lowerSize: 64,
    hero: { cx: 540, cy: 820, s: 1.6 },
    today: { cx: 540, cy: 760, s: 1.15, win: { x: 60, y: 200, w: 960, h: 1180 } },
    ground: { cx: 540, s: 1.1, ky: 0.4, planeY: [520, 720, 920, 1120], labelX: 72 },
    pocket: { phone: { x: 310, y: 240, w: 460, h: 940 }, miniStart: { cx: 540, cy: 1400, s: 0.52 } },
    feel: { cx: 760, cy: 1500, s: 3.2, lens: { x: 300, y: 560, r: 200 } },
    alone: { cx: 540, cy: 560, s: 1.2, card: { x: 150, y: 1000, w: 780, h: 640 } },
    depth: { cx: 540, cy: 900 },
    everywhere: { phone: { x: 110, y: 760, w: 260, h: 520 }, tablet: { x: 420, y: 820, w: 560, h: 400 }, laptop: { x: 300, y: 1300, w: 480, h: 310 }, brandX: 380, brandY: 160 },
  },
};
```

`apps/film/src/ui/LowerThird.tsx`:

```tsx
import { useCurrentFrame } from "remotion";
import { FONTS } from "../fonts";
import type { Layout } from "../layout";
import { enter } from "../motion";
import { PALETTE } from "../theme";

/**
 * The on-screen line: a bottom scrim so type reads over any board, a red
 * meridian tick, and the line rising 24 px as it fades in (400 ms settle).
 * `enterAt` is the scene-local frame the line starts entering.
 */
export const LowerThird = ({ text, enterAt, layout, id }: { text: string; enterAt: number; layout: Layout; id: string }) => {
  const frame = useCurrentFrame();
  const { opacity, dy } = enter(frame, enterAt);
  const scrimTop = layout.height - 260;
  return (
    <g>
      <defs>
        <linearGradient id={`scrim-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={PALETTE.bg} stopOpacity="0" />
          <stop offset="0.45" stopColor={PALETTE.bg} stopOpacity="0.7" />
          <stop offset="1" stopColor={PALETTE.bg} stopOpacity="0.94" />
        </linearGradient>
      </defs>
      <rect x="0" y={scrimTop} width={layout.width} height="260" fill={`url(#scrim-${id})`} opacity={opacity} />
      <g transform={`translate(${layout.lowerX} ${layout.lowerY + dy})`} opacity={opacity}>
        <line x1="0" y1={-layout.lowerSize * 0.4} x2="0" y2="2" stroke={PALETTE.boardMeridian} strokeWidth="5" strokeLinecap="round" />
        <text x="34" y="0" fontFamily={FONTS.display} fontSize={layout.lowerSize} fill={PALETTE.text} letterSpacing="-1">
          {text}
        </text>
      </g>
    </g>
  );
};
```

`apps/film/src/ui/Chip.tsx`:

```tsx
import { FONTS } from "../fonts";
import { PALETTE } from "../theme";

export const Chip = ({ x, y, w, h, label, color, fill = PALETTE.surfaceRaised, textColor, size = 24, opacity = 1 }: { x: number; y: number; w: number; h: number; label: string; color: string; fill?: string; textColor?: string; size?: number; opacity?: number }) => (
  <g transform={`translate(${x} ${y})`} opacity={opacity}>
    <rect width={w} height={h} rx={h / 2} fill={fill} stroke={color} strokeWidth="2" />
    <text x={w / 2} y={h / 2 + 1} textAnchor="middle" dominantBaseline="middle" fontFamily={FONTS.sans} fontSize={size} fontWeight="500" fill={textColor ?? color}>
      {label}
    </text>
  </g>
);
```

`apps/film/src/ui/Rose.tsx` (the Meridian Rose, drawn as in `apps/web/src/components/brand/MeridianRose.tsx`):

```tsx
import { PALETTE } from "../theme";

export const Rose = ({ x, y, size, color = PALETTE.text, opacity = 1 }: { x: number; y: number; size: number; color?: string; opacity?: number }) => (
  <g transform={`translate(${x} ${y}) scale(${size / 48})`} opacity={opacity}>
    <path d="M 29.47 8.96 A 16 16 0 1 1 18.53 8.96" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    <g stroke={PALETTE.ruleRed} strokeWidth="2.5" strokeLinecap="round">
      <line x1="24" y1="2" x2="24" y2="9" />
      <line x1="24" y1="39" x2="24" y2="46" />
      <line x1="2" y1="24" x2="9" y2="24" />
      <line x1="39" y1="24" x2="46" y2="24" />
    </g>
    <path d="M 18.53 8.96 L 21.2 13.2 L 24 9.4 L 26.8 13.2 L 29.47 8.96" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </g>
);
```

- [ ] **Step 6: Typecheck and the test suite**

```bash
pnpm --filter film typecheck && pnpm --filter film test
```

Expected: clean; 6 tests pass. (If `@remotion/google-fonts/InstrumentSerif` is reported missing, list the package's exports with `ls node_modules/@remotion/google-fonts` from `apps/film` and use the exact module names printed there for the three faces.)

---

### Task 4: The scripted opening (engine-legal moves)

**Files:**
- Modify: `apps/film/src/board/script.ts` (replace in full)
- Test: `apps/film/test/script.test.ts`

**Interfaces:**
- Consumes: `initialState`, `legalMoves`, `legalSecondSubmoves`, `applyTurn`, `fileOf`, `rankOf` from `@rotochess/engine`; `FilmPiece`.
- Produces: `SCRIPT: { states: readonly BoardState[]; turns: readonly Turn[] }` (states[0] = initial, states[i] = after i plies, 16 plies), `piecesOf(state)`, `cellsOf(move: Move): [number, number][]` (origin then path, as rank/file pairs), `heroBishop(): { move: Move; before: BoardState; after: BoardState }` (West's ply-11 bishop curl), `heroKnight(): { move: Move; state: BoardState }` (a South knight move legal at ply 14).

- [ ] **Step 1: Write the failing test**

`apps/film/test/script.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { applyTurn } from "@rotochess/engine";
import { SCRIPT, cellsOf, heroBishop, heroKnight, piecesOf } from "../src/board/script";

describe("scripted opening", () => {
  it("plays 16 legal plies from the initial position", () => {
    expect(SCRIPT.turns).toHaveLength(16);
    expect(SCRIPT.states).toHaveLength(17);
    SCRIPT.turns.forEach((turn, i) => {
      const r = applyTurn(SCRIPT.states[i]!, turn);
      expect(r.ok).toBe(true);
    });
    expect(piecesOf(SCRIPT.states[0]!)).toHaveLength(64);
  });

  it("is deterministic", () => {
    const sig = () => SCRIPT.turns.map((t) => t.submoves.map((m) => `${m.from}-${m.to}`).join("&"));
    expect(sig()).toEqual(sig());
  });

  it("has a West bishop curl at ply 11 as the hero move", () => {
    const { move, before } = heroBishop();
    const mover = before.board[move.from];
    expect(mover?.seat).toBe(4);
    expect(mover?.kind).toBe("B");
    expect(move.path.length).toBeGreaterThanOrEqual(2);
    expect(cellsOf(move)).toHaveLength(move.path.length + 1);
  });

  it("has a legal South knight leap at ply 14", () => {
    const { move, state } = heroKnight();
    expect(state.activeSeat).toBe(3);
    expect(state.board[move.from]?.kind).toBe("N");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
pnpm --filter film test
```

Expected: FAIL, `SCRIPT` / `heroBishop` not exported.

- [ ] **Step 3: Write the script**

Replace `apps/film/src/board/script.ts` with:

```ts
/**
 * A deterministic opening played through the engine, so every move the
 * film shows is legal and every path is engine-authored. The preference
 * below opens the B/C files early so bishops curl by ply 8–11 (verified
 * 2026-10-25 in an engine probe: West's bishop B25→D27 via C26 at ply 11).
 */
import type { BoardState, Move, Turn } from "@rotochess/engine";
import { applyTurn, fileOf, initialState, legalMoves, legalSecondSubmoves, rankOf } from "@rotochess/engine";
import type { FilmPiece } from "./Board";

export function piecesOf(state: BoardState): FilmPiece[] {
  const out: FilmPiece[] = [];
  state.board.forEach((p, sq) => {
    if (!p) return;
    out.push({ rank: rankOf(sq), file: fileOf(sq), seat: p.seat, kind: p.kind, halo: p.halo });
  });
  return out;
}

export function cellsOf(move: Move): [number, number][] {
  return [move.from, ...move.path].map((sq) => [rankOf(sq), fileOf(sq)]);
}

function preference(state: BoardState, m: Move): number {
  const p = state.board[m.from];
  if (!p) return 9;
  if (p.kind === "B" && m.path.length >= 2) return 0;
  if (p.kind === "P" && (fileOf(m.from) === 1 || fileOf(m.from) === 2)) return 1;
  if (p.kind === "N") return 2;
  if (p.kind === "P") return 3;
  return 4;
}

function pick(state: BoardState, moves: Move[]): Move {
  const sorted = [...moves].sort((a, b) => preference(state, a) - preference(state, b) || a.from - b.from || a.to - b.to);
  const first = sorted[0];
  if (!first) throw new Error("no legal move");
  return first;
}

function play(plies: number): { states: BoardState[]; turns: Turn[] } {
  const states: BoardState[] = [initialState()];
  const turns: Turn[] = [];
  for (let i = 0; i < plies; i++) {
    const s = states[i]!;
    const first = pick(s, legalMoves(s));
    const turn: Turn = s.ply < 20 ? { submoves: [first, pick(s, legalSecondSubmoves(s, first))] } : { submoves: [first] };
    const r = applyTurn(s, turn);
    if (!r.ok) throw new Error(`script ply ${i}: ${r.error}`);
    turns.push(turn);
    states.push(r.state);
  }
  return { states, turns };
}

export const SCRIPT: { states: readonly BoardState[]; turns: readonly Turn[] } = play(16);

/** West's bishop curl at ply 11 (states[11] → states[12]). */
export function heroBishop(): { move: Move; before: BoardState; after: BoardState } {
  const before = SCRIPT.states[11]!;
  const move = SCRIPT.turns[11]!.submoves[0];
  return { move, before, after: SCRIPT.states[12]! };
}

/** The first legal South knight move at ply 14 (South to move), for the leap. */
export function heroKnight(): { move: Move; state: BoardState } {
  const state = SCRIPT.states[14]!;
  const move = legalMoves(state).find((m) => state.board[m.from]?.kind === "N");
  if (!move) throw new Error("no South knight move at ply 14");
  return { move, state };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
pnpm --filter film test
```

Expected: PASS, 10 tests. If the hero-bishop test fails because the engine's move ordering changed since the probe, print the script with this one-off in the test and move the hero index in `heroBishop()` to the first ply whose first submove is a West bishop with a 2-square path:

```ts
SCRIPT.turns.forEach((t, i) => console.log(i, t.submoves.map((m) => `${SCRIPT.states[i]!.board[m.from]?.kind}${SCRIPT.states[i]!.board[m.from]?.seat} ${m.from}->${m.to} path ${m.path.length}`).join(" & ")));
```

---

### Task 5: Scenes 1 and 2 (Hook, Today)

**Files:**
- Create: `apps/film/src/scenes/SceneFrame.tsx`
- Create: `apps/film/src/scenes/Scene1Hook.tsx`
- Create: `apps/film/src/scenes/Scene2Today.tsx`
- Modify: `apps/film/src/Root.tsx` (register `Scene1`, `Scene2` review compositions)

**Interfaces:**
- Consumes: Board layers, `useSprites`, `SCRIPT`, `piecesOf`, `tween/fade/DUR`, `LowerThird`, `LAYOUTS`.
- Produces: `SceneFrame({ layout, id, children })` (the `<AbsoluteFill>` + `<BoardSvg>` wrapper with vignette and glow gradients `vig-${id}` / `glow-${id}`), `Scene1Hook({ layout })`, `Scene2Today({ layout })`; each scene reads `useCurrentFrame()` as its local frame.

- [ ] **Step 1: The scene wrapper**

`apps/film/src/scenes/SceneFrame.tsx`:

```tsx
import type { ReactNode } from "react";
import { AbsoluteFill } from "remotion";
import { BoardSvg } from "../board/Board";
import type { Layout } from "../layout";
import { PALETTE } from "../theme";

export const SceneFrame = ({ layout, id, children }: { layout: Layout; id: string; children: ReactNode }) => (
  <AbsoluteFill style={{ backgroundColor: PALETTE.bg }}>
    <BoardSvg width={layout.width} height={layout.height}>
      <defs>
        <radialGradient id={`vig-${id}`} cx="50%" cy="48%" r="70%">
          <stop offset="60%" stopColor={PALETTE.bg} stopOpacity="0" />
          <stop offset="100%" stopColor="#0b0906" stopOpacity="0.75" />
        </radialGradient>
        <radialGradient id={`glow-${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={PALETTE.halo} stopOpacity="0.55" />
          <stop offset="100%" stopColor={PALETTE.halo} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={layout.width} height={layout.height} fill={PALETTE.bg} />
      {children}
      <rect width={layout.width} height={layout.height} fill={`url(#vig-${id})`} />
    </BoardSvg>
  </AbsoluteFill>
);
```

- [ ] **Step 2: Scene 1, the hook**

`apps/film/src/scenes/Scene1Hook.tsx`:

```tsx
/**
 * Beat 1 (0–210): the North meridian draws (0–21), the annulus resolves
 * clockwise from pencil outline to solid (21–93), a North pawn glides to the
 * far side of the meridian (100–112) and evaporates (112–133) with motes
 * rising (133–170). Type enters at 156 (5.2 s). The pawn's crossing is an
 * illustrative staging of §6.3; the resolve and board are engine geometry.
 */
import { useCurrentFrame } from "remotion";
import { Meridians, Pieces, Rails, Sprite, Squares, cellCentroid, mapPoint, pointAlongCells } from "../board/Board";
import type { SquareStyle } from "../board/Board";
import { useSprites } from "../board/sprites";
import { SCRIPT, piecesOf } from "../board/script";
import { INNER_R, OUTER_R, SECTOR_DEG, polarPoint } from "../board/geometry";
import { FONTS } from "../fonts";
import type { Layout } from "../layout";
import { DUR, fade, tween } from "../motion";
import { PALETTE, SEAT_COLOR } from "../theme";
import { LowerThird } from "../ui/LowerThird";
import { SceneFrame } from "./SceneFrame";

const PAWN_CELLS: [number, number][] = [[30, 1], [31, 1], [0, 1], [1, 1]];
const MOTES: [number, number, number][] = [[-6, -26, 3.2], [10, -40, 2.4], [-18, -48, 2], [16, -60, 1.6], [2, -74, 1.4], [-10, -86, 1.1]];

export const Scene1Hook = ({ layout }: { layout: Layout }) => {
  const frame = useCurrentFrame();
  const sprites = useSprites();
  const T = layout.hero;
  const meridianDraw = tween(frame, 0, DUR.ceremony, 0, 1);
  const sweepDeg = tween(frame, 21, 2400, 0, 360);
  const style: SquareStyle = (rank, _file, col) => {
    const deg = rank * SECTOR_DEG + SECTOR_DEG / 2;
    if (deg < sweepDeg) return { fill: col };
    const ahead = Math.min(1, (deg - sweepDeg) / 140);
    return { fill: "none", stroke: PALETTE.boardCream, strokeWidth: 0.9 - 0.5 * ahead, opacity: 0.55 - 0.35 * ahead };
  };
  const a = mapPoint(T, polarPoint(0, INNER_R - 2));
  const b = mapPoint(T, polarPoint(0, OUTER_R + 2));
  const pawnT = tween(frame, 100, DUR.slow, 0, 1);
  const pawnAt = frame < 100 ? mapPoint(T, cellCentroid(30, 1)) : pointAlongCells(T, PAWN_CELLS, pawnT);
  const evap = tween(frame, 112, DUR.ceremony, 1, 0);
  const pawnScale = 0.6 + 0.4 * evap;
  const pawnOpacity = frame < 112 ? 1 : evap;
  const moteRise = tween(frame, 133, 1200, 0, 1);
  const moteOpacity = frame < 133 ? 0 : 1 - moteRise;
  const pieces = piecesOf(SCRIPT.states[0]!).filter((p) => !(p.rank === 30 && p.file === 1));
  const visible = (p: { rank: number }) => p.rank * SECTOR_DEG + SECTOR_DEG / 2 < sweepDeg - 10;
  const end = mapPoint(T, cellCentroid(1, 1));
  return (
    <SceneFrame layout={layout} id="s1">
      <circle cx={T.cx} cy={T.cy} r={OUTER_R * T.s + 40} fill="url(#glow-s1)" opacity={0.18 * fade(frame, 21, 1000)} />
      <Squares T={T} style={style} />
      <Rails T={T} />
      <Meridians T={T} width={3.5} opacity={0.35 * fade(frame, 40, 1000)} />
      <line x1={a.x} y1={a.y} x2={a.x + (b.x - a.x) * meridianDraw} y2={a.y + (b.y - a.y) * meridianDraw} stroke={SEAT_COLOR[1]} strokeWidth="5" strokeLinecap="round" />
      {sprites ? <Pieces T={T} pieces={pieces} sprites={sprites} filter={visible} /> : null}
      {sprites && frame >= 60 ? <Sprite sprites={sprites} piece={{ rank: 30, file: 1, seat: 1, kind: "P" }} at={pawnAt} size={34 * T.s} opacity={pawnOpacity} scale={pawnScale} /> : null}
      {MOTES.map(([dx, dy, r], i) => (
        <circle key={i} cx={end.x + dx} cy={end.y + dy * moteRise} r={r} fill={PALETTE.evaporate} opacity={moteOpacity * (0.9 - r * 0.15)} />
      ))}
      <text x={T.cx} y={T.cy + 10} fontFamily={FONTS.mono} fontSize="34" fill={PALETTE.textDim} textAnchor="middle" letterSpacing="10" opacity={fade(frame, 90, 1000)}>ROTO</text>
      <LowerThird text="Four players. One ring. Rules chess never had." enterAt={156} layout={layout} id="s1" />
    </SceneFrame>
  );
};
```

- [ ] **Step 3: Scene 2, the platform today**

`apps/film/src/scenes/Scene2Today.tsx`:

```tsx
/**
 * Beat 2 (210–420, local 0–210): the camera pulls back (0–48) from the hero
 * board to the board-in-a-browser; chrome fades in (24–36); sidebar panels
 * fade (36–48); the mail badge pings at 120 (11 s); a veil dims the window
 * with the type at 150.
 */
import { useCurrentFrame } from "remotion";
import { Meridians, Numerals, Pieces, Rails, Squares } from "../board/Board";
import { useSprites } from "../board/sprites";
import { SCRIPT, piecesOf } from "../board/script";
import { OUTER_R } from "../board/geometry";
import { FONTS } from "../fonts";
import type { Layout } from "../layout";
import { DUR, fade, tween } from "../motion";
import { PALETTE, SEAT_COLOR } from "../theme";
import { LowerThird } from "../ui/LowerThird";
import { SceneFrame } from "./SceneFrame";

const HISTORY = ["1. P B2→B3 · P B31→B29", "2. P B7→B5 · P B10→B11", "3. P B15→B13 · P B18→B19", "4. P B23→B21 · P B26→B27", "5. P C2→C3 · P B29→B28", "6. P B5→B4 · P C10→C11", "7. P B13→B12 · P C18→C19", "8. P B21→B20 · P C26→C27"];
const CHAT = ["North: nice curl", "East: that pawn is doomed", "South: back tomorrow", "West: (observing) hi all"];

export const Scene2Today = ({ layout }: { layout: Layout }) => {
  const frame = useCurrentFrame();
  const sprites = useSprites();
  const from = layout.hero;
  const to = layout.today;
  const k = tween(frame, 0, 1600, 0, 1);
  const T = { cx: from.cx + (to.cx - from.cx) * k, cy: from.cy + (to.cy - from.cy) * k, s: from.s + (to.s - from.s) * k };
  const win = layout.today.win;
  const chrome = fade(frame, 24, DUR.slow);
  const panels = fade(frame, 36, DUR.slow);
  const ping = frame >= 120 && frame < 132 ? 1 + 0.25 * Math.sin(((frame - 120) / 12) * Math.PI) : 1;
  const veil = 0.18 * fade(frame, 150, DUR.slow);
  const pieces = piecesOf(SCRIPT.states[8]!);
  const grey = { frame: "#1d1d1f", bar: "#2a2a2d", field: "#333337", text: "#c8c8cc", dim: "#9a9aa0" };
  const sx = win.x + win.w - 600;
  const sy = win.y + 150;
  const plaques: [number, number, string, string, "start" | "middle" | "end"][] = [
    [T.cx, T.cy - OUTER_R * T.s - 34, "North · Alex", SEAT_COLOR[1], "middle"],
    [T.cx + OUTER_R * T.s + 24, T.cy, "East · Sam", SEAT_COLOR[2], "start"],
    [T.cx, T.cy + OUTER_R * T.s + 50, "South · Jordan", SEAT_COLOR[3], "middle"],
    [T.cx - OUTER_R * T.s - 24, T.cy, "West · Casey", SEAT_COLOR[4], "end"],
  ];
  return (
    <SceneFrame layout={layout} id="s2">
      <g opacity={chrome}>
        <rect x={win.x} y={win.y} width={win.w} height={win.h} rx="14" fill={grey.frame} stroke="#3a3a3c" strokeWidth="2" />
        <rect x={win.x} y={win.y} width={win.w} height="52" rx="14" fill={grey.bar} />
        <rect x={win.x} y={win.y + 30} width={win.w} height="22" fill={grey.bar} />
        {[30, 54, 78].map((dx) => <circle key={dx} cx={win.x + dx} cy={win.y + 26} r="7" fill="#5c5c60" />)}
        <rect x={win.x + 120} y={win.y + 8} width="260" height="38" rx="8" fill="#3a3a3e" />
        <text x={win.x + 140} y={win.y + 33} fontFamily={FONTS.sans} fontSize="19" fill={grey.text}>Roto Chess · Game</text>
        <rect x={win.x} y={win.y + 52} width={win.w} height="54" fill="#232326" />
        <rect x={win.x + 120} y={win.y + 62} width={win.w - 240} height="34" rx="17" fill={grey.field} />
        <text x={win.x + 148} y={win.y + 85} fontFamily={FONTS.mono} fontSize="19" fill={grey.dim}>roto-chess.vercel.app/app/game/2HPMK</text>
        <rect x={win.x + 2} y={win.y + 106} width={win.w - 4} height={win.h - 108} fill={PALETTE.bg} />
      </g>
      <Squares T={T} />
      <Rails T={T} />
      <Meridians T={T} />
      {sprites ? <Pieces T={T} pieces={pieces} sprites={sprites} /> : null}
      <g opacity={chrome}><Numerals T={T} /></g>
      <g opacity={panels}>
        {plaques.map(([x, y, label, color, anchor]) => (
          <text key={label} x={x} y={y} fontFamily={FONTS.sans} fontSize="19" fill={color} textAnchor={anchor}>{label}</text>
        ))}
        <rect x={sx} y={sy} width="560" height="300" rx="8" fill={PALETTE.surface} stroke={PALETTE.line} />
        <text x={sx + 20} y={sy + 36} fontFamily={FONTS.mono} fontSize="15" fill={PALETTE.textDim} letterSpacing="2">HISTORY</text>
        {HISTORY.map((row, i) => (
          <text key={row} x={sx + 20} y={sy + 72 + i * 30} fontFamily={FONTS.mono} fontSize="18" fill={i === HISTORY.length - 1 ? PALETTE.text : PALETTE.textDim}>{row}</text>
        ))}
        <rect x={sx} y={sy + 330} width="560" height="300" rx="8" fill={PALETTE.surface} stroke={PALETTE.line} />
        <text x={sx + 20} y={sy + 366} fontFamily={FONTS.mono} fontSize="15" fill={PALETTE.textDim} letterSpacing="2">TABLE CHAT</text>
        {CHAT.map((row, i) => (
          <text key={row} x={sx + 20} y={sy + 402 + i * 32} fontFamily={FONTS.sans} fontSize="19" fill={PALETTE.textDim}>{row}</text>
        ))}
        <rect x={sx + 16} y={sy + 570} width="528" height="40" rx="20" fill={PALETTE.surfaceRaised} stroke={PALETTE.line} />
        <text x={sx + 36} y={sy + 596} fontFamily={FONTS.sans} fontSize="18" fill="#6f6555">Say something…</text>
        <g transform={`translate(${win.x + win.w - 145} ${win.y + 20}) scale(${ping})`} opacity="0.7">
          <rect width="110" height="26" rx="13" fill={PALETTE.surfaceRaised} stroke={PALETTE.line} />
          <text x="55" y="18" fontFamily={FONTS.mono} fontSize="14" fill={PALETTE.textDim} textAnchor="middle" letterSpacing="1">MAIL · 1</text>
        </g>
      </g>
      <rect x={win.x} y={win.y} width={win.w} height={win.h} rx="14" fill={PALETTE.bg} opacity={veil} />
      <LowerThird text="It works. It does not yet feel alive." enterAt={150} layout={layout} id="s2" />
    </SceneFrame>
  );
};
```

- [ ] **Step 4: Register review compositions and render stills**

Add to `apps/film/src/Root.tsx` (imports at top; compositions inside the fragment):

```tsx
import { LAYOUTS } from "./layout";
import { Scene1Hook } from "./scenes/Scene1Hook";
import { Scene2Today } from "./scenes/Scene2Today";
// …
    <Composition id="Scene1" component={Scene1Hook} durationInFrames={210} fps={FPS} width={1920} height={1080} defaultProps={{ layout: LAYOUTS.landscape }} />
    <Composition id="Scene2" component={Scene2Today} durationInFrames={210} fps={FPS} width={1920} height={1080} defaultProps={{ layout: LAYOUTS.landscape }} />
```

```bash
pnpm --filter film typecheck && pnpm --filter film exec remotion still src/index.ts Scene1 out/scene1-f105.png --frame=105 && pnpm --filter film exec remotion still src/index.ts Scene1 out/scene1-f200.png --frame=200 && pnpm --filter film exec remotion still src/index.ts Scene2 out/scene2-f180.png --frame=180
```

Expected: `scene1-f105.png` shows the board fully resolved with the pawn across the meridian mid-fade; `scene1-f200.png` shows the type line fully in; `scene2-f180.png` matches storyboard frame 2 (board inside the grey browser, panels, veil). Compare against the storyboard at https://claude.ai/artifact/SGsSL4wrkiDgvTXNRP21y1.

---

### Task 6: Scenes 3 and 4 (Solid ground, In your pocket)

**Files:**
- Create: `apps/film/src/scenes/Scene3Ground.tsx`
- Create: `apps/film/src/scenes/Scene4Pocket.tsx`
- Modify: `apps/film/src/Root.tsx` (register `Scene3`, `Scene4`, 240 frames each)

**Interfaces:**
- Consumes: as Task 5, plus `Chip`, `Rose`, `movePathD`.
- Produces: `Scene3Ground({ layout })`, `Scene4Pocket({ layout })`.

- [ ] **Step 1: Scene 3**

`apps/film/src/scenes/Scene3Ground.tsx`:

```tsx
/**
 * Beat 3 (local 0–240): the board tilts (0–24), four planes lift apart
 * (24–60, staggered 120 ms), labels fade in with each plane, the heartbeat
 * draws (60–200), the chip turns green at 200, planes re-stack (180–210).
 * Type enters at 60.
 */
import { useCurrentFrame } from "remotion";
import { Meridians, Pieces, Rails, Squares, cellCentroid, mapPoint, movePathD } from "../board/Board";
import { useSprites } from "../board/sprites";
import { SCRIPT, piecesOf } from "../board/script";
import { OUTER_R } from "../board/geometry";
import { FONTS } from "../fonts";
import type { Layout } from "../layout";
import { DUR, fade, tween } from "../motion";
import { PALETTE, SEAT_COLOR } from "../theme";
import { Chip } from "../ui/Chip";
import { LowerThird } from "../ui/LowerThird";
import { SceneFrame } from "./SceneFrame";

const PLANES = [
  { name: "Input", sub: "tap · path · confirm" },
  { name: "Events", sub: "halo · evaporation · Avenger" },
  { name: "Pieces", sub: "upright, counter-rotated" },
  { name: "Geometry", sub: "128 sectors, four meridians" },
] as const;

export const Scene3Ground = ({ layout }: { layout: Layout }) => {
  const frame = useCurrentFrame();
  const sprites = useSprites();
  const L = layout.ground;
  const ky = tween(frame, 0, 800, 1, L.ky);
  const base = L.planeY[3];
  // Each plane rises from the geometry plane's y to its own y; all re-stack from 180.
  const lift = (i: number) => {
    const up = tween(frame, 24 + i * 4, 900, 0, 1);
    const down = tween(frame, 180, 1000, 0, 1);
    return base + (L.planeY[i]! - base) * up * (1 - down);
  };
  const Tn = (i: number) => ({ cx: L.cx, cy: lift(i), s: L.s, ky });
  const T4 = Tn(3), T3 = Tn(2), T2 = Tn(1), T1 = Tn(0);
  const sep = tween(frame, 24, 900, 0, 1) * (1 - tween(frame, 180, 1000, 0, 1));
  const pieces = piecesOf(SCRIPT.states[0]!);
  const haloAt = mapPoint(T2, cellCentroid(12, 2));
  const evapAt = mapPoint(T2, cellCentroid(23, 1));
  const aveAt = mapPoint(T2, cellCentroid(1, 0));
  const sel = mapPoint(T1, cellCentroid(18, 2));
  const dest = mapPoint(T1, cellCentroid(22, 2));
  const hbLen = 1140;
  const hb = tween(frame, 60, 4600, hbLen, 0);
  const green = frame >= 200;
  return (
    <SceneFrame layout={layout} id="s3">
      <Squares T={T4} />
      <Rails T={T4} />
      <Meridians T={T4} />
      <g opacity={sep}>
        <Rails T={T3} color="#4a3f31" />
        <Meridians T={T3} width={2} opacity={0.25} />
      </g>
      {sprites ? <Pieces T={T3} pieces={pieces} sprites={sprites} size={30} /> : null}
      <g opacity={sep}>
        <Rails T={T2} color="#4a3f31" />
        <Meridians T={T2} width={2} opacity={0.25} />
        <ellipse cx={haloAt.x} cy={haloAt.y} rx="26" ry="11" fill="none" stroke={PALETTE.halo} strokeWidth="4" />
        <ellipse cx={haloAt.x} cy={haloAt.y} rx="44" ry="19" fill="none" stroke={PALETTE.halo} strokeWidth="2" opacity="0.4" />
        {[[0, -4, 3], [8, -16, 2.4], [-7, -26, 2], [5, -38, 1.6]].map(([dx, dy, r], i) => <circle key={i} cx={evapAt.x + dx!} cy={evapAt.y + dy!} r={r} fill={PALETTE.evaporate} />)}
        <ellipse cx={aveAt.x} cy={aveAt.y} rx="30" ry="13" fill="none" stroke={PALETTE.boardMeridian} strokeWidth="3" />
        <ellipse cx={aveAt.x} cy={aveAt.y} rx="54" ry="23" fill="none" stroke={PALETTE.boardMeridian} strokeWidth="2" opacity="0.45" />
        <Rails T={T1} color="#4a3f31" />
        <Meridians T={T1} width={2} opacity={0.25} />
        <ellipse cx={sel.x} cy={sel.y} rx="28" ry="12" fill={SEAT_COLOR[3]} fillOpacity="0.25" stroke={SEAT_COLOR[3]} strokeWidth="2.5" />
        <path d={movePathD(T1, [[18, 2], [19, 1], [20, 0], [21, 1], [22, 2]])} fill="none" stroke={SEAT_COLOR[3]} strokeWidth="4" strokeLinecap="round" strokeDasharray="10 12" />
        <ellipse cx={dest.x} cy={dest.y} rx="9" ry="4" fill={SEAT_COLOR[3]} />
        <Chip x={L.cx + 250} y={L.planeY[0] - 60} w={250} h={46} label="B C19 → C23   Confirm" color={SEAT_COLOR[3]} size={21} />
        {PLANES.map((p, i) => (
          <g key={p.name} opacity={fade(frame, 30 + i * 4, DUR.slow)}>
            <text x={L.labelX} y={lift(i) - 6} fontFamily={FONTS.sans} fontSize="34" fontWeight="500" fill={PALETTE.text}>{p.name}</text>
            <text x={L.labelX} y={lift(i) + 26} fontFamily={FONTS.sans} fontSize="19" fill={PALETTE.textDim}>{p.sub}</text>
            <line x1={L.labelX + 300} y1={lift(i)} x2={L.cx - OUTER_R * L.s - 20} y2={lift(i)} stroke={PALETTE.line} strokeWidth="1.5" strokeDasharray="4 8" />
          </g>
        ))}
      </g>
      <g transform={`translate(${L.labelX} 912)`}>
        <path d="M0 0 H200 l14 -34 l18 60 l16 -42 l10 16 H520 l14 -34 l18 60 l16 -42 l10 16 H900 l14 -34 l18 60 l16 -42 l10 16 H1140" fill="none" stroke={PALETTE.success} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" strokeDasharray={hbLen} strokeDashoffset={hb} />
      </g>
      <Chip x={1480} y={886} w={300} h={48} label={green ? "engine 0.3.0 · live · 0 errors" : "engine 0.3.0 · deploying…"} color={green ? PALETTE.success : PALETTE.textDim} size={20} opacity={fade(frame, 60, DUR.slow)} />
      <LowerThird text="First, make it unbreakable." enterAt={60} layout={layout} id="s3" />
    </SceneFrame>
  );
};
```

- [ ] **Step 2: Scene 4**

`apps/film/src/scenes/Scene4Pocket.tsx`:

```tsx
/**
 * Beat 4 (local 0–240): the browser ghost fades (0–18); the board shrinks
 * and flies along a gold path into the home-screen icon (18–51), which
 * lands with a 150 ms settle; the banner slides down at 135 (26.5 s); the
 * tap ring pulses at 165–180. Type enters at 60.
 */
import { useCurrentFrame } from "remotion";
import { Meridians, Squares } from "../board/Board";
import { FONTS } from "../fonts";
import type { Layout } from "../layout";
import { DUR, fade, tween } from "../motion";
import { PALETTE, SEAT_COLOR } from "../theme";
import { Chip } from "../ui/Chip";
import { Rose } from "../ui/Rose";
import { LowerThird } from "../ui/LowerThird";
import { SceneFrame } from "./SceneFrame";

const TONES = ["#2e2a24", "#33302b", "#3a3327", "#2b2f2a", "#332a2a", "#2a2e33"];

export const Scene4Pocket = ({ layout }: { layout: Layout }) => {
  const frame = useCurrentFrame();
  const ph = layout.pocket.phone;
  const screen = { x: ph.x + 16, y: ph.y + 16, w: ph.w - 32, h: ph.h - 32 };
  const ix = screen.x + 34, iy = screen.y + 200, cell = 100;
  const hero = { x: ix + cell, y: iy + cell };
  const ghost = 0.35 * (1 - fade(frame, 0, 600));
  const flight = tween(frame, 18, 1100, 0, 1);
  const start = layout.pocket.miniStart;
  // Quadratic flight: start → control → icon center.
  const c = { x: (start.cx + hero.x + 36) / 2 + 60, y: Math.min(start.cy, hero.y) - 120 };
  const u = flight;
  const fx = (1 - u) * (1 - u) * start.cx + 2 * (1 - u) * u * c.x + u * u * (hero.x + 36);
  const fy = (1 - u) * (1 - u) * start.cy + 2 * (1 - u) * u * c.y + u * u * (hero.y + 36);
  const fs = start.s + (0.11 - start.s) * u;
  const landed = frame >= 51;
  const iconScale = landed ? tween(frame, 51, DUR.fast, 1.12, 1) : 0;
  const banner = tween(frame, 135, DUR.base, -140, 0);
  const bannerOpacity = fade(frame, 135, DUR.base);
  const tap = frame >= 165 && frame < 180 ? Math.sin(((frame - 165) / 15) * Math.PI) : 0;
  const nb = { x: screen.x + 18, y: screen.y + 74 + banner, w: screen.w - 36, h: 112 };
  const win = layout.today.win;
  return (
    <SceneFrame layout={layout} id="s4">
      <g opacity={ghost}>
        <rect x={win.x + 120} y={win.y + 20} width={win.w - 320} height={win.h - 60} rx="14" fill="none" stroke="#5a5a60" strokeWidth="2" strokeDasharray="6 10" />
        <text x={win.x + 260} y={win.y + 55} fontFamily={FONTS.mono} fontSize="19" fill="#8a8a90">roto-chess.vercel.app</text>
      </g>
      <rect x={ph.x} y={ph.y} width={ph.w} height={ph.h} rx="64" fill="#0b0907" stroke={PALETTE.line} strokeWidth="3" />
      <rect x={screen.x} y={screen.y} width={screen.w} height={screen.h} rx="50" fill={PALETTE.surface} />
      <rect x={ph.x + ph.w / 2 - 60} y={screen.y + 14} width="120" height="28" rx="14" fill="#0b0907" />
      <text x={screen.x + 36} y={screen.y + 50} fontFamily={FONTS.sans} fontSize="22" fontWeight="600" fill={PALETTE.text}>9:41</text>
      {Array.from({ length: 20 }, (_, n) => {
        const r = Math.floor(n / 4), col = n % 4;
        const x = ix + col * cell, y = iy + r * cell;
        if (r === 1 && col === 1) {
          return (
            <g key={n} transform={`translate(${x + 36} ${y + 36}) scale(${iconScale}) translate(${-x - 36} ${-y - 36})`}>
              <rect x={x} y={y} width="72" height="72" rx="18" fill={PALETTE.bg} stroke={SEAT_COLOR[4]} strokeWidth="3" />
              <Rose x={x + 12} y={y + 12} size={48} />
              <text x={x + 36} y={y + 94} fontFamily={FONTS.sans} fontSize="15" fontWeight="500" fill={PALETTE.text} textAnchor="middle">Roto Chess</text>
            </g>
          );
        }
        return (
          <g key={n}>
            <rect x={x} y={y} width="72" height="72" rx="18" fill={TONES[n % TONES.length]} />
            <rect x={x + 22} y={y + 84} width="28" height="6" rx="3" fill={PALETTE.line} />
          </g>
        );
      })}
      <rect x={screen.x + 24} y={screen.y + screen.h - 120} width={screen.w - 48} height="96" rx="28" fill={PALETTE.surfaceRaised} opacity="0.8" />
      {[0, 1, 2, 3].map((col) => <rect key={col} x={screen.x + 48 + col * 96} y={screen.y + screen.h - 108} width="72" height="72" rx="18" fill={TONES[(col + 2) % TONES.length]} />)}
      {!landed ? (
        <g>
          <path d={`M ${start.cx} ${start.cy} Q ${c.x} ${c.y} ${hero.x + 36} ${hero.y + 36}`} fill="none" stroke={SEAT_COLOR[4]} strokeWidth="2.5" strokeDasharray="3 12" strokeLinecap="round" opacity={0.8 * fade(frame, 10, DUR.base)} />
          <g opacity="0.9">
            <Squares T={{ cx: fx, cy: fy, s: fs }} />
            <Meridians T={{ cx: fx, cy: fy, s: fs }} width={2.5} />
          </g>
        </g>
      ) : null}
      <g opacity={bannerOpacity}>
        <rect x={nb.x} y={nb.y} width={nb.w} height={nb.h} rx="26" fill={PALETTE.surfaceRaised} stroke={PALETTE.line} strokeWidth="1.5" />
        <rect x={nb.x + 16} y={nb.y + 18} width="56" height="56" rx="14" fill={PALETTE.bg} stroke={SEAT_COLOR[4]} strokeWidth="2" />
        <Rose x={nb.x + 20} y={nb.y + 22} size={48} />
        <text x={nb.x + 88} y={nb.y + 36} fontFamily={FONTS.mono} fontSize="15" fill={PALETTE.textDim} letterSpacing="1">ROTO CHESS · now</text>
        <text x={nb.x + 88} y={nb.y + 64} fontFamily={FONTS.sans} fontSize="21" fontWeight="600" fill={PALETTE.text}>Your move at the Nerds’ table</text>
        <text x={nb.x + 88} y={nb.y + 92} fontFamily={FONTS.sans} fontSize="18" fill={PALETTE.textDim}>Jordan’s knight gave check on D13.</text>
        <circle cx={nb.x + nb.w - 60} cy={nb.y + nb.h / 2} r={26 + 10 * tap} fill="none" stroke={SEAT_COLOR[4]} strokeWidth="2" opacity={0.7 * (1 - tap * 0.6)} />
        <circle cx={nb.x + nb.w - 60} cy={nb.y + nb.h / 2} r="10" fill={SEAT_COLOR[4]} opacity="0.8" />
      </g>
      <g opacity={fade(frame, 40, DUR.slow)}>
        <Chip x={96} y={300} w={360} h={50} label="Add to Home Screen" color={SEAT_COLOR[4]} size={22} />
        <text x={96} y={390} fontFamily={FONTS.sans} fontSize="22" fill={PALETTE.textDim}>Manifest · icon set · offline shell</text>
        <text x={96} y={426} fontFamily={FONTS.sans} fontSize="22" fill={PALETTE.textDim}>Web Push on Android and iPhone</text>
      </g>
      <LowerThird text="Then, make it yours." enterAt={60} layout={layout} id="s4" />
    </SceneFrame>
  );
};
```

- [ ] **Step 3: Register and render review stills**

Add `Scene3` / `Scene4` compositions in `Root.tsx` exactly as Task 5 Step 4 did for Scene1/Scene2 (durations 240).

```bash
pnpm --filter film typecheck && pnpm --filter film exec remotion still src/index.ts Scene3 out/scene3-f120.png --frame=120 && pnpm --filter film exec remotion still src/index.ts Scene4 out/scene4-f40.png --frame=40 && pnpm --filter film exec remotion still src/index.ts Scene4 out/scene4-f200.png --frame=200
```

Expected: scene 3 at 120 shows four separated planes with labels and the heartbeat half drawn; scene 4 at 40 shows the mini board mid-flight on the gold path; at 200 the icon has landed and the banner is in with its tap ring.

---

### Task 7: Scenes 5 and 6 (Feel, Never alone)

**Files:**
- Create: `apps/film/src/scenes/Scene5Feel.tsx`
- Create: `apps/film/src/scenes/Scene6Alone.tsx`
- Modify: `apps/film/src/Root.tsx` (register `Scene5`, `Scene6`, 240 frames each)

**Interfaces:**
- Consumes: `heroBishop`, `cellsOf`, `pointAlongCells`, `movePathD`, `SCRIPT`, `piecesOf`, `Sprite`.
- Produces: `Scene5Feel({ layout })`, `Scene6Alone({ layout })`.

- [ ] **Step 1: Scene 5**

`apps/film/src/scenes/Scene5Feel.tsx`:

```tsx
/**
 * Beat 5 (local 0–240): close on West's quadrant. The hero bishop travels
 * its engine path (20–32, 400 ms), sets down (32–37), the halo inscribes
 * (37–58) then bloom rings expand and fade (58–100); chime arcs appear at
 * 40/52/64; the lens grows at 90–98; the caption slides in at 100. Type
 * enters at 70. The halo is a staged visual on a legal move.
 */
import { useCurrentFrame } from "remotion";
import { Meridians, Numerals, Pieces, Rails, Sprite, Squares, cellCentroid, mapPoint, movePathD, pointAlongCells } from "../board/Board";
import type { BoardTransform, SquareStyle } from "../board/Board";
import { useSprites } from "../board/sprites";
import { cellsOf, heroBishop, piecesOf } from "../board/script";
import { CENTER } from "../board/geometry";
import { FONTS } from "../fonts";
import type { Layout } from "../layout";
import { DUR, fade, tween } from "../motion";
import { PALETTE, SEAT_COLOR } from "../theme";
import { Chip } from "../ui/Chip";
import { LowerThird } from "../ui/LowerThird";
import { SceneFrame } from "./SceneFrame";

export const Scene5Feel = ({ layout }: { layout: Layout }) => {
  const frame = useCurrentFrame();
  const sprites = useSprites();
  const { move, before } = heroBishop();
  const cells = cellsOf(move);
  const from = cells[0]!;
  const to = cells[cells.length - 1]!;
  // Center the crop on the hero move's midpoint so the composition follows the engine's path.
  const midCell = cells[Math.floor(cells.length / 2)]!;
  const mid = cellCentroid(midCell[0], midCell[1]);
  const L = layout.feel;
  const T: BoardTransform = { cx: layout.width / 2 - (mid.x - CENTER) * L.s, cy: layout.height * 0.55 - (mid.y - CENTER) * L.s, s: L.s };
  const travel = tween(frame, 20, DUR.slow, 0, 1);
  const setDown = tween(frame, 32, DUR.fast, 1.1, 1);
  const bishopAt = pointAlongCells(T, cells, travel);
  const landed = frame >= 32;
  const inscribe = tween(frame, 37, DUR.ceremony, 0, 1);
  const bloom = tween(frame, 58, 1400, 0, 1);
  const land = mapPoint(T, cellCentroid(to[0], to[1]));
  const pieces = piecesOf(before).filter((p) => !(p.rank === from[0] && p.file === from[1]));
  const style: SquareStyle = (rank, file, col) => ({ fill: col, stroke: (rank === to[0] && file === to[1]) || (rank === from[0] && file === from[1]) ? PALETTE.lastMove : undefined, strokeWidth: 1.6 });
  const lensR = L.lens.r * tween(frame, 90, DUR.base, 0, 1);
  const zs = T.s * 1.9;
  const bp = { x: CENTER + (L.lens.x - T.cx) / T.s, y: CENTER + (L.lens.y - T.cy) / T.s };
  const Tl: BoardTransform = { cx: L.lens.x - (bp.x - CENTER) * zs, cy: L.lens.y - (bp.y - CENTER) * zs, s: zs };
  const haloR = (34 * T.s) / 2 - 1;
  const circ = 2 * Math.PI * haloR;
  const caption = tween(frame, 100, DUR.base, -40, 0);
  const heroPiece = { rank: to[0], file: to[1], seat: 4 as const, kind: "B" as const };
  return (
    <SceneFrame layout={layout} id="s5">
      <Squares T={T} style={style} />
      <Rails T={T} />
      <Meridians T={T} width={4} />
      <Numerals T={T} />
      <path d={movePathD(T, cells)} fill="none" stroke={SEAT_COLOR[4]} strokeWidth="9" strokeLinecap="round" opacity={0.9 * fade(frame, 14, DUR.base)} />
      {sprites ? <Pieces T={T} pieces={pieces} sprites={sprites} /> : null}
      {sprites ? <Sprite sprites={sprites} piece={heroPiece} at={bishopAt} size={34 * T.s} scale={landed ? setDown : 1.08} /> : null}
      {landed ? (
        <g>
          <circle cx={land.x} cy={land.y} r={haloR} fill="none" stroke={PALETTE.halo} strokeWidth={Math.max(2, 34 * T.s * 0.07)} strokeDasharray={circ} strokeDashoffset={circ * (1 - inscribe)} transform={`rotate(-90 ${land.x} ${land.y})`} />
          <circle cx={land.x} cy={land.y} r={haloR + 110 * bloom} fill="none" stroke={PALETTE.halo} strokeWidth="3" opacity={0.5 * (1 - bloom)} />
          <circle cx={land.x} cy={land.y} r={haloR + 160 * bloom} fill="none" stroke={PALETTE.halo} strokeWidth="1.5" opacity={0.25 * (1 - bloom)} />
          <circle cx={land.x} cy={land.y} r={150} fill="url(#glow-s5)" opacity={0.5 * (1 - bloom)} />
          <g transform={`translate(${land.x + 110} ${land.y - 110})`} fill="none" stroke={PALETTE.halo} strokeWidth="3" strokeLinecap="round">
            <path d="M0 0 a24 24 0 0 1 0 -34" opacity={0.9 * fade(frame, 40, DUR.base) * (1 - bloom)} />
            <path d="M14 10 a44 44 0 0 1 0 -54" opacity={0.6 * fade(frame, 52, DUR.base) * (1 - bloom)} />
            <path d="M28 20 a64 64 0 0 1 0 -74" opacity={0.3 * fade(frame, 64, DUR.base) * (1 - bloom)} />
          </g>
        </g>
      ) : null}
      {lensR > 1 ? (
        <g>
          <clipPath id="lens-s5"><circle cx={L.lens.x} cy={L.lens.y} r={lensR} /></clipPath>
          <g clipPath="url(#lens-s5)">
            <rect width={layout.width} height={layout.height} fill={PALETTE.bg} />
            <Squares T={Tl} />
            <Rails T={Tl} />
            <Meridians T={Tl} width={4} />
            <Numerals T={Tl} />
            {sprites ? <Pieces T={Tl} pieces={pieces.concat([heroPiece])} sprites={sprites} /> : null}
          </g>
          <circle cx={L.lens.x} cy={L.lens.y} r={lensR} fill="none" stroke={PALETTE.text} strokeWidth="5" />
          <circle cx={L.lens.x} cy={L.lens.y} r={lensR + 10} fill="none" stroke={SEAT_COLOR[4]} strokeWidth="2" opacity="0.6" />
          <text x={L.lens.x} y={L.lens.y - lensR - 28} fontFamily={FONTS.sans} fontSize="22" fill={PALETTE.textDim} textAnchor="middle" opacity={fade(frame, 98, DUR.base)}>long-press lens · inner ring at 1.9×</text>
        </g>
      ) : null}
      <g transform={`translate(0 ${caption})`} opacity={fade(frame, 100, DUR.base)}>
        <Chip x={96} y={112} w={520} h={56} label="Halo earned · West bishop curl" color={SEAT_COLOR[4]} size={24} />
        <text x={96} y={206} fontFamily={FONTS.mono} fontSize="22" fill={PALETTE.textDim}>set-down · chime · 400 ms settle</text>
      </g>
      <LowerThird text="Every move should land." enterAt={70} layout={layout} id="s5" />
    </SceneFrame>
  );
};
```

- [ ] **Step 2: Scene 6**

`apps/film/src/scenes/Scene6Alone.tsx`:

```tsx
/**
 * Beat 6 (local 0–240): plaques fill at 0/8/16/24; two bot moves play
 * (East's ply-13 move at 40–52, South's ply-14 move at 70–82) from the
 * scripted opening; the cut at 120 (42 s) folds the share card open
 * (120–132); reactions land at 140/145/150; the chat bubble rises at 160.
 * Type enters at 30 and holds through the cut.
 */
import type { PieceKind, Seat } from "@rotochess/engine";
import { useCurrentFrame } from "remotion";
import { Meridians, Pieces, Rails, Sprite, Squares, pointAlongCells } from "../board/Board";
import { useSprites } from "../board/sprites";
import { SCRIPT, cellsOf, piecesOf } from "../board/script";
import { OUTER_R } from "../board/geometry";
import { FONTS } from "../fonts";
import type { Layout } from "../layout";
import { DUR, fade, tween } from "../motion";
import { PALETTE, SEAT_COLOR } from "../theme";
import { Chip } from "../ui/Chip";
import { LowerThird } from "../ui/LowerThird";
import { SceneFrame } from "./SceneFrame";

const BOT_MOVES = [
  { ply: 13, at: 40 },
  { ply: 14, at: 70 },
] as const;

export const Scene6Alone = ({ layout }: { layout: Layout }) => {
  const frame = useCurrentFrame();
  const sprites = useSprites();
  const L = layout.alone;
  const T = { cx: L.cx, cy: L.cy, s: L.s };
  // Position: ply 13 before any bot move; each bot move's first submove animates, then the state advances.
  const done = BOT_MOVES.filter((m) => frame >= m.at + 12).length;
  const state = SCRIPT.states[13 + done]!;
  const active = BOT_MOVES.find((m) => frame >= m.at && frame < m.at + 12);
  let pieces = piecesOf(state);
  let mover: { at: { x: number; y: number }; seat: Seat; kind: PieceKind } | null = null;
  if (active) {
    const mv = SCRIPT.turns[active.ply]!.submoves[0];
    const cells = cellsOf(mv);
    const fromCell = cells[0]!;
    const p = state.board[mv.from]!;
    pieces = pieces.filter((q) => !(q.rank === fromCell[0] && q.file === fromCell[1]));
    mover = { at: pointAlongCells(T, cells, tween(frame, active.at, DUR.slow, 0, 1)), seat: p.seat, kind: p.kind };
  }
  const plaque = (x: number, y: number, name: string, sub: string, color: string, bot: boolean, anchor: "start" | "middle" | "end", enterAt: number) => {
    const w = 290, h = 76;
    const px = anchor === "end" ? x - w : anchor === "middle" ? x - w / 2 : x;
    return (
      <g key={name + sub} opacity={fade(frame, enterAt, DUR.base)}>
        <rect x={px} y={y} width={w} height={h} rx="16" fill={PALETTE.surface} stroke={color} strokeWidth="2" />
        {bot ? (
          <g>
            <circle cx={px + 38} cy={y + 38} r="22" fill={PALETTE.bg} stroke={color} strokeWidth="2" />
            <circle cx={px + 38} cy={y + 38} r="12" fill="none" stroke={color} strokeWidth="2" />
            <circle cx={px + 38} cy={y + 38} r="3" fill={color} />
          </g>
        ) : (
          <g>
            <circle cx={px + 38} cy={y + 38} r="22" fill={color} />
            <text x={px + 38} y={y + 46} fontFamily={FONTS.sans} fontSize="22" fontWeight="600" fill={PALETTE.bg} textAnchor="middle">A</text>
          </g>
        )}
        <text x={px + 76} y={y + 33} fontFamily={FONTS.sans} fontSize="22" fontWeight="600" fill={PALETTE.text}>{name}</text>
        <text x={px + 76} y={y + 58} fontFamily={FONTS.sans} fontSize="17" fill={color}>{sub}</text>
      </g>
    );
  };
  const cut = frame >= 120;
  const c = L.card;
  const fold = tween(frame, 120, DUR.slow, 0, 1);
  const Tc = { cx: c.x + c.w / 2, cy: c.y + 350, s: 0.62 };
  const finalPieces = piecesOf(SCRIPT.states[16]!).filter((_, i) => i % 3 !== 0);
  return (
    <SceneFrame layout={layout} id="s6">
      <Squares T={T} />
      <Rails T={T} />
      <Meridians T={T} />
      {sprites ? <Pieces T={T} pieces={pieces} sprites={sprites} /> : null}
      {sprites && mover ? <Sprite sprites={sprites} piece={{ rank: 0, file: 0, seat: mover.seat, kind: mover.kind }} at={mover.at} size={34 * T.s} scale={1.08} /> : null}
      {plaque(T.cx, T.cy - OUTER_R * T.s - 100, "Alex (you)", "North · to move", SEAT_COLOR[1], false, "middle", 0)}
      {plaque(T.cx + OUTER_R * T.s + 40, T.cy - 38, "Practice bot", "East · calm, legal, fast", SEAT_COLOR[2], true, "start", 8)}
      {plaque(T.cx, T.cy + OUTER_R * T.s + 28, "Practice bot", "South · your partner", SEAT_COLOR[3], true, "middle", 16)}
      {plaque(T.cx - OUTER_R * T.s - 40, T.cy - 38, "Practice bot", "West", SEAT_COLOR[4], true, "end", 24)}
      {cut ? (
        <g transform={`translate(${c.x + c.w / 2} ${c.y + c.h / 2}) scale(1 ${fold}) translate(${-c.x - c.w / 2} ${-c.y - c.h / 2})`}>
          <rect x={c.x} y={c.y} width={c.w} height={c.h} rx="22" fill={PALETTE.surface} stroke={PALETTE.line} strokeWidth="2" />
          <text x={c.x + 32} y={c.y + 50} fontFamily={FONTS.mono} fontSize="15" fill={PALETTE.textDim} letterSpacing="2">NERDS’ TABLE · GAME 14</text>
          <text x={c.x + 32} y={c.y + 92} fontFamily={FONTS.sans} fontSize="34" fontWeight="600" fill={PALETTE.text}>North &amp; South win</text>
          <text x={c.x + 32} y={c.y + 124} fontFamily={FONTS.sans} fontSize="19" fill={PALETTE.textDim}>checkmate on move 61 · 9 days</text>
          <Squares T={Tc} />
          <Rails T={Tc} />
          <Meridians T={Tc} width={2.5} />
          {sprites ? <Pieces T={Tc} pieces={finalPieces} sprites={sprites} /> : null}
          <rect x={c.x + 32} y={c.y + 560} width={c.w - 64} height="44" rx="22" fill={PALETTE.surfaceRaised} stroke={PALETTE.line} />
          <text x={c.x + c.w / 2} y={c.y + 588} fontFamily={FONTS.mono} fontSize="18" fill={PALETTE.text} textAnchor="middle">roto-chess.vercel.app/replay/2HPMK</text>
          <Chip x={c.x + 32} y={c.y + 626} w={150} h={44} label="Well played · 3" color={SEAT_COLOR[4]} size={18} opacity={fade(frame, 140, DUR.fast)} />
          <Chip x={c.x + 198} y={c.y + 626} w={130} h={44} label="Rematch?" color={SEAT_COLOR[3]} size={18} opacity={fade(frame, 145, DUR.fast)} />
          <Chip x={c.x + 344} y={c.y + 626} w={164} h={44} label="Watch replay" color={PALETTE.text} size={18} opacity={fade(frame, 150, DUR.fast)} />
        </g>
      ) : null}
      {cut ? (
        <g transform={`translate(0 ${tween(frame, 160, DUR.base, 30, 0)})`} opacity={fade(frame, 160, DUR.base)}>
          <rect x={c.x - 40} y={c.y + c.h + 30} width="300" height="48" rx="24" fill={PALETTE.surfaceRaised} />
          <text x={c.x - 20} y={c.y + c.h + 61} fontFamily={FONTS.sans} fontSize="18" fill={PALETTE.textDim}>Sam: that bishop at move 40…</text>
        </g>
      ) : null}
      <LowerThird text="Play when no one is waiting. Share when it ends." enterAt={30} layout={layout} id="s6" />
    </SceneFrame>
  );
};
```

- [ ] **Step 3: Register and render review stills**

Register `Scene5` and `Scene6` (240 frames each) in `Root.tsx` as before.

```bash
pnpm --filter film typecheck && pnpm --filter film exec remotion still src/index.ts Scene5 out/scene5-f26.png --frame=26 && pnpm --filter film exec remotion still src/index.ts Scene5 out/scene5-f110.png --frame=110 && pnpm --filter film exec remotion still src/index.ts Scene6 out/scene6-f46.png --frame=46 && pnpm --filter film exec remotion still src/index.ts Scene6 out/scene6-f170.png --frame=170
```

Expected: scene 5 at 26 shows the bishop mid-curl on the gold path; at 110 the halo is inscribed, bloom fading, lens open, caption in. Scene 6 at 46 shows East's piece mid-move with all four plaques; at 170 the share card is open with three chips and the chat bubble.

---

### Task 8: Scenes 7 and 8 (Depth, Everywhere) with the motion ceiling test

**Files:**
- Create: `apps/film/src/scenes/scene7Pose.ts`
- Create: `apps/film/src/ui/Staunton.tsx`
- Create: `apps/film/src/ui/Devices.tsx`
- Create: `apps/film/src/scenes/Scene7Depth.tsx`
- Create: `apps/film/src/scenes/Scene8Everywhere.tsx`
- Modify: `apps/film/src/Root.tsx` (register `Scene7`, `Scene8`, 210 frames each)
- Test: `apps/film/test/scene7Pose.test.ts`

**Interfaces:**
- Produces: `scene7Pose(frame): { ky: number; s: number; cx: number; cy: number; rise: number; leap: number }` (pure, frame-local), `Staunton({ x, y, seat, kind, h?, opacity? })`, `PhoneFrame/TabletFrame/LaptopFrame({ box, opacity? })`, `Box { x; y; w; h }`, `Scene7Depth({ layout })`, `Scene8Everywhere({ layout })`.

- [ ] **Step 1: Write the failing motion-ceiling test**

`apps/film/test/scene7Pose.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { scene7Pose } from "../src/scenes/scene7Pose";

describe("scene 7 camera", () => {
  it("tilts and scales with eased blends under a per-frame ceiling", () => {
    let maxDky = 0;
    let maxDs = 0;
    let maxDcx = 0;
    let prev = scene7Pose(0);
    for (let f = 1; f < 210; f++) {
      const cur = scene7Pose(f);
      maxDky = Math.max(maxDky, Math.abs(cur.ky - prev.ky));
      maxDs = Math.max(maxDs, Math.abs(cur.s - prev.s));
      maxDcx = Math.max(maxDcx, Math.abs(cur.cx - prev.cx));
      prev = cur;
    }
    // Ceilings tuned to v4's calm feel: tilt ≤ 0.04/frame, scale ≤ 0.04/frame, pan ≤ 8 px/frame.
    expect(maxDky).toBeLessThanOrEqual(0.04);
    expect(maxDs).toBeLessThanOrEqual(0.04);
    expect(maxDcx).toBeLessThanOrEqual(8);
  });

  it("starts flat and ends tilted and centered", () => {
    expect(scene7Pose(0).ky).toBe(1);
    expect(scene7Pose(209).ky).toBeCloseTo(0.46, 2);
    expect(scene7Pose(209).cx).toBe(0);
    expect(scene7Pose(0).leap).toBe(0);
    expect(scene7Pose(120).leap).toBe(1);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
pnpm --filter film test
```

Expected: FAIL, "Cannot find module '../src/scenes/scene7Pose'".

- [ ] **Step 3: Write the pose function**

`apps/film/src/scenes/scene7Pose.ts`:

```ts
/**
 * Scene 7's camera as a pure function of the local frame, so its motion is
 * testable as motion. Phases: tilt + zoom 0–36 (1.2 s), pieces rise 36–57,
 * shoulder pan toward the mover 60–90, the leap 80–110, settle back to the
 * centered overview 110–180. All blends are settle-eased from a captured
 * pose; nothing follows exponentially.
 */
import { tween } from "../motion";

export interface Scene7Pose {
  ky: number;
  s: number;
  /** Pan offset from the layout center, in px. */
  cx: number;
  cy: number;
  /** 0..1 piece-rise progress. */
  rise: number;
  /** 0..1 knight leap progress. */
  leap: number;
}

export function scene7Pose(frame: number): Scene7Pose {
  const ky = tween(frame, 0, 1200, 1, 0.46);
  const s = tween(frame, 0, 1200, 1.6, 2.2);
  const rise = tween(frame, 36, 700, 0, 1);
  const panOut = tween(frame, 60, 1000, 0, 1);
  const panBack = tween(frame, 110, 2300, 0, 1);
  const pan = panOut * (1 - panBack);
  const leap = tween(frame, 80, 1000, 0, 1);
  return { ky, s, cx: -140 * pan, cy: 40 * pan, rise, leap };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm --filter film test
```

Expected: PASS (12 tests). If a ceiling fails, lengthen that phase's duration in `scene7Pose.ts`; never raise the ceiling.

- [ ] **Step 5: Staunton silhouettes and device frames**

`apps/film/src/ui/Staunton.tsx`:

```tsx
import type { PieceKind, Seat } from "@rotochess/engine";
import { LACQUER, PALETTE } from "../theme";

/** Provisional 2.5D silhouettes (base at y=0). Replaced by the v5 3D pieces in the follow-on plan. */
const SHAPES: Record<PieceKind, string> = {
  P: "M-13 0 L13 0 L11 -6 L5 -10 L5 -22 Q10 -26 10 -32 Q10 -41 0 -41 Q-10 -41 -10 -32 Q-10 -26 -5 -22 L-5 -10 L-11 -6 Z",
  R: "M-14 0 L14 0 L12 -7 L8 -11 L8 -40 L13 -40 L13 -52 L7 -52 L7 -46 L3 -46 L3 -52 L-3 -52 L-3 -46 L-7 -46 L-7 -52 L-13 -52 L-13 -40 L-8 -40 L-8 -11 L-12 -7 Z",
  N: "M-14 0 L14 0 L12 -7 L7 -11 L7 -24 L15 -34 L20 -42 L18 -48 L8 -54 L4 -64 L-2 -56 L-10 -54 L-17 -44 L-15 -36 L-5 -32 L-7 -24 L-7 -11 L-12 -7 Z",
  B: "M-14 0 L14 0 L12 -7 L6 -11 L6 -22 Q12 -28 12 -40 Q12 -54 0 -60 Q-12 -54 -12 -40 Q-12 -28 -6 -22 L-6 -11 L-12 -7 Z M0 -60 L0 -66",
  Q: "M-15 0 L15 0 L13 -7 L7 -12 L7 -30 Q14 -38 14 -52 L10 -66 L5 -58 L0 -68 L-5 -58 L-10 -66 L-14 -52 Q-14 -38 -7 -30 L-7 -12 L-13 -7 Z",
  K: "M-15 0 L15 0 L13 -7 L7 -12 L7 -32 Q14 -40 14 -54 L0 -64 L-14 -54 Q-14 -40 -7 -32 L-7 -12 L-13 -7 Z M0 -64 L0 -80 M-6 -73 L6 -73",
};

export const Staunton = ({ x, y, seat, kind, h = 1, opacity = 1 }: { x: number; y: number; seat: Seat; kind: PieceKind; h?: number; opacity?: number }) => (
  <g transform={`translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${h.toFixed(3)})`} opacity={opacity}>
    <ellipse cx="0" cy="2" rx="16" ry="5" fill="#000" opacity="0.35" />
    <path d={SHAPES[kind]} fill={LACQUER[seat]} stroke={PALETTE.pieceBlack} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
  </g>
);
```

`apps/film/src/ui/Devices.tsx`:

```tsx
import { PALETTE } from "../theme";

export interface Box { x: number; y: number; w: number; h: number }

export const PhoneFrame = ({ box, opacity = 1 }: { box: Box; opacity?: number }) => (
  <g opacity={opacity}>
    <rect x={box.x} y={box.y} width={box.w} height={box.h} rx="44" fill="#0b0907" stroke={PALETTE.line} strokeWidth="3" />
    <rect x={box.x + 12} y={box.y + 12} width={box.w - 24} height={box.h - 24} rx="34" fill={PALETTE.surface} />
  </g>
);

export const TabletFrame = ({ box, opacity = 1 }: { box: Box; opacity?: number }) => (
  <g opacity={opacity}>
    <rect x={box.x} y={box.y} width={box.w} height={box.h} rx="30" fill="#0b0907" stroke={PALETTE.line} strokeWidth="3" />
    <rect x={box.x + 14} y={box.y + 14} width={box.w - 28} height={box.h - 28} rx="20" fill={PALETTE.surface} />
  </g>
);

export const LaptopFrame = ({ box, opacity = 1 }: { box: Box; opacity?: number }) => (
  <g opacity={opacity}>
    <rect x={box.x} y={box.y} width={box.w} height={box.h} rx="16" fill="#0b0907" stroke={PALETTE.line} strokeWidth="3" />
    <rect x={box.x + 10} y={box.y + 10} width={box.w - 20} height={box.h - 20} rx="10" fill={PALETTE.surface} />
    <path d={`M${box.x - 50} ${box.y + box.h + 2} h${box.w + 100} l-14 22 h-${box.w + 72} z`} fill="#141009" stroke={PALETTE.line} strokeWidth="2" />
  </g>
);
```

- [ ] **Step 6: Scene 7**

`apps/film/src/scenes/Scene7Depth.tsx`:

```tsx
/**
 * Beat 7 (local 0–210): the flat board tilts into perspective, Staunton
 * silhouettes rise from the sprites, red meridian curtains stand up, the
 * camera pans over South's shoulder for the knight's engine-legal leap, then
 * settles to the centered overview. Pose from scene7Pose (tested).
 */
import { useCurrentFrame } from "remotion";
import { Meridians, Pieces, Rails, Squares, cellCentroid, mapPoint } from "../board/Board";
import type { BoardTransform } from "../board/Board";
import { useSprites } from "../board/sprites";
import { cellsOf, heroKnight, piecesOf } from "../board/script";
import { INNER_R, OUTER_R, polarPoint } from "../board/geometry";
import { FONTS } from "../fonts";
import type { Layout } from "../layout";
import { DUR, fade } from "../motion";
import { PALETTE, SEAT_COLOR } from "../theme";
import { LowerThird } from "../ui/LowerThird";
import { Staunton } from "../ui/Staunton";
import { SceneFrame } from "./SceneFrame";
import { scene7Pose } from "./scene7Pose";

export const Scene7Depth = ({ layout }: { layout: Layout }) => {
  const frame = useCurrentFrame();
  const sprites = useSprites();
  const pose = scene7Pose(frame);
  const T: BoardTransform = { cx: layout.depth.cx + pose.cx, cy: layout.depth.cy + pose.cy, s: pose.s, ky: pose.ky };
  const { move, state } = heroKnight();
  const cells = cellsOf(move);
  const from = cells[0]!;
  const to = cells[cells.length - 1]!;
  const pieces = piecesOf(state);
  const placed = pieces.map((p) => ({ ...p, ...mapPoint(T, cellCentroid(p.rank, p.file)) })).sort((a, b) => a.y - b.y);
  const kFrom = mapPoint(T, cellCentroid(from[0], from[1]));
  const kTo = mapPoint(T, cellCentroid(to[0], to[1]));
  const u = pose.leap;
  const apex = Math.min(kFrom.y, kTo.y) - 190;
  const kx = (1 - u) * (1 - u) * kFrom.x + 2 * (1 - u) * u * ((kFrom.x + kTo.x) / 2) + u * u * kTo.x;
  const ky = (1 - u) * (1 - u) * kFrom.y + 2 * (1 - u) * u * apex + u * u * kTo.y;
  const curtain = fade(frame, 20, 1000);
  const yMin = layout.depth.cy - OUTER_R * pose.s * pose.ky;
  const yMax = layout.depth.cy + OUTER_R * pose.s * pose.ky;
  return (
    <SceneFrame layout={layout} id="s7">
      <Squares T={T} />
      <Rails T={T} />
      <Meridians T={T} width={4} />
      {([1, 2, 3, 4] as const).map((seat) => {
        const deg = (seat - 1) * 90;
        const a = mapPoint(T, polarPoint(deg, INNER_R));
        const b = mapPoint(T, polarPoint(deg, OUTER_R));
        const hgt = 120 * curtain;
        return <polygon key={seat} points={`${a.x},${a.y} ${b.x},${b.y} ${b.x},${b.y - hgt} ${a.x},${a.y - hgt}`} fill={PALETTE.boardMeridian} opacity={(seat === 1 ? 0.22 : 0.14) * curtain} />;
      })}
      {sprites && pose.rise < 1 ? <Pieces T={T} pieces={pieces} sprites={sprites} size={34 * pose.s * (1 - pose.rise)} opacity={1 - pose.rise} /> : null}
      {pose.rise > 0
        ? placed.map((p) => {
            if (p.rank === from[0] && p.file === from[1]) return null;
            const depth = (p.y - yMin) / Math.max(1, yMax - yMin);
            const h = (0.75 + depth * 0.7) * pose.rise;
            const op = depth > 0.86 ? 0.35 : 1;
            return <Staunton key={`${p.rank}-${p.file}`} x={p.x} y={p.y} seat={p.seat} kind={p.kind} h={h} opacity={op} />;
          })
        : null}
      {pose.rise > 0 ? (
        <g>
          <path d={`M ${kFrom.x} ${kFrom.y} Q ${(kFrom.x + kTo.x) / 2} ${apex} ${kTo.x} ${kTo.y}`} fill="none" stroke={SEAT_COLOR[3]} strokeWidth="5" strokeDasharray="6 14" strokeLinecap="round" opacity={fade(frame, 70, DUR.base)} />
          <ellipse cx={kTo.x} cy={kTo.y} rx="22" ry="9" fill="none" stroke={SEAT_COLOR[3]} strokeWidth="3" opacity={fade(frame, 70, DUR.base)} />
          <Staunton x={kx} y={ky} seat={3} kind="N" h={(1.25 + 0.35 * Math.sin(u * Math.PI)) * pose.rise} />
          <text x={(kFrom.x + kTo.x) / 2 + 70} y={apex - 10} fontFamily={FONTS.mono} fontSize="20" fill={SEAT_COLOR[3]} opacity={fade(frame, 80, DUR.base)}>South knight · leap</text>
        </g>
      ) : null}
      <g stroke={PALETTE.textDim} strokeWidth="2" fill="none" opacity={0.5 * fade(frame, 36, DUR.slow)}>
        <path d="M120 120 v-40 h40" />
        <path d={`M${layout.width - 120} 120 v-40 h-40`} />
        <path d={`M120 ${layout.height - 120} v40 h40`} />
        <path d={`M${layout.width - 120} ${layout.height - 120} v40 h-40`} />
      </g>
      <text x={layout.width / 2} y="110" fontFamily={FONTS.mono} fontSize="20" fill={PALETTE.textDim} textAnchor="middle" letterSpacing="2" opacity={fade(frame, 36, DUR.slow)}>ORRERY CAM · over the shoulder · settles to the centered overview</text>
      <LowerThird text="See the move the way it felt." enterAt={60} layout={layout} id="s7" />
    </SceneFrame>
  );
};
```

- [ ] **Step 7: Scene 8**

`apps/film/src/scenes/Scene8Everywhere.tsx`:

```tsx
/**
 * Beat 8 (local 0–210): devices fade up (0–12); the account chip travels
 * the dotted path (20–62, 1.4 s); store pills at 120 (57 s); the rose and
 * name resolve at 150 (58 s); hold; fade to black 195–210. Type at 60.
 */
import { useCurrentFrame } from "remotion";
import { Meridians, Pieces, Squares } from "../board/Board";
import { useSprites } from "../board/sprites";
import { SCRIPT, piecesOf } from "../board/script";
import { FONTS } from "../fonts";
import type { Layout } from "../layout";
import { DUR, fade, tween } from "../motion";
import { PALETTE, SEAT_COLOR } from "../theme";
import { Chip } from "../ui/Chip";
import { LaptopFrame, PhoneFrame, TabletFrame } from "../ui/Devices";
import { LowerThird } from "../ui/LowerThird";
import { Rose } from "../ui/Rose";
import { SceneFrame } from "./SceneFrame";

export const Scene8Everywhere = ({ layout }: { layout: Layout }) => {
  const frame = useCurrentFrame();
  const sprites = useSprites();
  const E = layout.everywhere;
  const pos = piecesOf(SCRIPT.states[16]!);
  const up = fade(frame, 0, DUR.slow);
  const Tp = { cx: E.phone.x + E.phone.w / 2, cy: E.phone.y + E.phone.h / 2, s: 0.46 };
  const Tt = { cx: E.tablet.x + E.tablet.w * 0.36, cy: E.tablet.y + E.tablet.h / 2, s: 0.72 };
  const Tl = { cx: E.laptop.x + E.laptop.w * 0.33, cy: E.laptop.y + E.laptop.h / 2, s: 0.42 };
  const anchors = [
    { x: E.phone.x + E.phone.w / 2, y: E.phone.y - 40 },
    { x: E.tablet.x + E.tablet.w / 2, y: E.tablet.y - 40 },
    { x: E.laptop.x + E.laptop.w / 2, y: E.laptop.y - 40 },
  ];
  const t = tween(frame, 20, 1400, 0, 2);
  const seg = Math.min(1, Math.floor(t));
  const u = t - seg;
  const a = anchors[seg]!;
  const b = anchors[Math.min(2, seg + 1)]!;
  const cx = a.x + (b.x - a.x) * u;
  const cy = a.y + (b.y - a.y) * u - 90 * Math.sin(u * Math.PI);
  const black = fade(frame, 195, 500);
  return (
    <SceneFrame layout={layout} id="s8">
      <PhoneFrame box={E.phone} opacity={up} />
      <g opacity={up}>
        <Squares T={Tp} />
        <Meridians T={Tp} width={2} />
        {sprites ? <Pieces T={Tp} pieces={pos} sprites={sprites} size={15} /> : null}
        <text x={E.phone.x + E.phone.w / 2} y={E.phone.y + 70} fontFamily={FONTS.sans} fontSize="20" fontWeight="600" fill={PALETTE.text} textAnchor="middle">Your move</text>
      </g>
      <TabletFrame box={E.tablet} opacity={up} />
      <g opacity={up}>
        <Squares T={Tt} />
        <Meridians T={Tt} width={2.5} />
        {sprites ? <Pieces T={Tt} pieces={pos} sprites={sprites} size={24} /> : null}
        <text x={E.tablet.x + E.tablet.w - 220} y={E.tablet.y + 90} fontFamily={FONTS.mono} fontSize="14" fill={PALETTE.textDim} letterSpacing="2">HISTORY</text>
        {["12. N C9→D11", "13. B B1→C3", "14. P A2→A4", "15. Q D1→C2"].map((row, i) => (
          <text key={row} x={E.tablet.x + E.tablet.w - 220} y={E.tablet.y + 126 + i * 30} fontFamily={FONTS.mono} fontSize="17" fill={i === 3 ? PALETTE.text : PALETTE.textDim}>{row}</text>
        ))}
      </g>
      <LaptopFrame box={E.laptop} opacity={up} />
      <g opacity={up}>
        <Squares T={Tl} />
        <Meridians T={Tl} width={2} />
        {sprites ? <Pieces T={Tl} pieces={pos} sprites={sprites} size={14} /> : null}
        <text x={E.laptop.x + E.laptop.w - 160} y={E.laptop.y + 90} fontFamily={FONTS.mono} fontSize="15" fill={PALETTE.textDim} letterSpacing="2">Observing</text>
        <text x={E.laptop.x + E.laptop.w - 160} y={E.laptop.y + 124} fontFamily={FONTS.sans} fontSize="18" fill={SEAT_COLOR[4]}>West · Casey</text>
      </g>
      <path d={`M ${anchors[0]!.x} ${anchors[0]!.y} Q ${(anchors[0]!.x + anchors[1]!.x) / 2} ${anchors[0]!.y - 90} ${anchors[1]!.x} ${anchors[1]!.y} Q ${(anchors[1]!.x + anchors[2]!.x) / 2} ${anchors[1]!.y - 90} ${anchors[2]!.x} ${anchors[2]!.y}`} fill="none" stroke={SEAT_COLOR[4]} strokeWidth="2.5" strokeDasharray="4 12" strokeLinecap="round" opacity={0.8 * fade(frame, 14, DUR.base)} />
      {anchors.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="7" fill={SEAT_COLOR[4]} opacity={fade(frame, 14 + i * 20, DUR.base)} />)}
      <g opacity={fade(frame, 20, DUR.base)}>
        <Chip x={cx - 150} y={cy - 26} w={300} h={52} label="Alex · one account, every device" color={SEAT_COLOR[4]} size={21} />
      </g>
      <g opacity={fade(frame, 120, DUR.slow)}>
        <Chip x={layout.width - 490} y={740} w={190} h={50} label="App Store" color={PALETTE.textDim} textColor={PALETTE.text} size={20} />
        <Chip x={layout.width - 280} y={740} w={200} h={50} label="Google Play" color={PALETTE.textDim} textColor={PALETTE.text} size={20} />
        <text x={layout.width - 290} y={830} fontFamily={FONTS.sans} fontSize="19" fill={PALETTE.textDim} textAnchor="middle">native shell around the same code</text>
      </g>
      <g opacity={fade(frame, 150, DUR.ceremony)}>
        <Rose x={E.brandX} y={E.brandY} size={96} />
        <text x={E.brandX + 120} y={E.brandY + 70} fontFamily={FONTS.display} fontSize="84" fill={PALETTE.text}>Roto Chess</text>
      </g>
      <LowerThird text="One game. Every table." enterAt={60} layout={layout} id="s8" />
      <rect width={layout.width} height={layout.height} fill="#000" opacity={black} />
    </SceneFrame>
  );
};
```

- [ ] **Step 8: Register and render review stills**

Register `Scene7` (210) and `Scene8` (210) in `Root.tsx`.

```bash
pnpm --filter film typecheck && pnpm --filter film test && pnpm --filter film exec remotion still src/index.ts Scene7 out/scene7-f95.png --frame=95 && pnpm --filter film exec remotion still src/index.ts Scene7 out/scene7-f200.png --frame=200 && pnpm --filter film exec remotion still src/index.ts Scene8 out/scene8-f160.png --frame=160
```

Expected: tests pass (12); scene 7 at 95 shows the tilted board, silhouettes, the knight at its apex with the pan toward South; at 200 the overview is centered; scene 8 at 160 shows three devices, the chip at the laptop, store pills, rose and name.

---

### Task 9: Audio (rendered cues, motif) and the assembled film

**Files:**
- Create: `apps/film/scripts/render-audio.mjs`
- Create (generated): `apps/film/public/audio/*.wav`
- Create: `apps/film/src/audio/cueSheet.ts`
- Create: `apps/film/src/audio/Cues.tsx`
- Modify: `apps/film/src/RoadmapFilm.tsx` (replace the placeholder)

**Interfaces:**
- Consumes: `apps/web/src/lib/audio/synth.ts` `renderAll(sampleRate): Record<CueName, Float32Array>` (imported by the script at run time only; pure math, no imports).
- Produces: `CUE_SHEET: readonly CueEvent[]` with `CueEvent { cue: CueFile; frame: number; gain?: number }`, `CueFile` union, `<Cues />`, final `RoadmapFilm({ format })`.

- [ ] **Step 1: Write the audio render script**

`apps/film/scripts/render-audio.mjs`:

```js
/**
 * Render the app's synthesized cues and the film's clockwork motif to WAV.
 * Uses the web app's synth.ts directly through Node's native TypeScript
 * import (Node 22.18+ / 24): the module is pure math with no imports.
 * Run: pnpm --filter film render-audio
 */
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
```

- [ ] **Step 2: Run it**

```bash
pnpm --filter film render-audio && ls apps/film/public/audio
```

Expected: "wrote 11 cues + motif to public/audio" and twelve `.wav` files (`set-down`, `capture`, `check-pulse`, `halo`, `avenger`, `victory`, `draw`, `your-turn`, `evaporation`, `zoom-detent`, `chat-tick`, `motif`). If Node refuses the `.ts` import, run with `node --experimental-strip-types scripts/render-audio.mjs` (Node 22.6–22.17) and put that flag in the `render-audio` script.

- [ ] **Step 3: The cue sheet and Cues component**

`apps/film/src/audio/cueSheet.ts`:

```ts
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
```

`apps/film/src/audio/Cues.tsx`:

```tsx
import { Audio, Sequence, interpolate, staticFile } from "remotion";
import { TOTAL_FRAMES } from "../timeline";
import { CUE_SHEET } from "./cueSheet";

export const Cues = () => (
  <>
    <Audio
      src={staticFile("audio/motif.wav")}
      volume={(f) => 0.25 * interpolate(f, [TOTAL_FRAMES - 60, TOTAL_FRAMES], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
    />
    {CUE_SHEET.map((c, i) => (
      <Sequence key={`${c.cue}-${i}`} from={c.frame} durationInFrames={90}>
        <Audio src={staticFile(`audio/${c.cue}.wav`)} volume={c.gain ?? 0.8} />
      </Sequence>
    ))}
  </>
);
```

- [ ] **Step 4: Assemble the film**

Replace `apps/film/src/RoadmapFilm.tsx`:

```tsx
import { AbsoluteFill, Sequence } from "remotion";
import { Cues } from "./audio/Cues";
import { LAYOUTS } from "./layout";
import { Scene1Hook } from "./scenes/Scene1Hook";
import { Scene2Today } from "./scenes/Scene2Today";
import { Scene3Ground } from "./scenes/Scene3Ground";
import { Scene4Pocket } from "./scenes/Scene4Pocket";
import { Scene5Feel } from "./scenes/Scene5Feel";
import { Scene6Alone } from "./scenes/Scene6Alone";
import { Scene7Depth } from "./scenes/Scene7Depth";
import { Scene8Everywhere } from "./scenes/Scene8Everywhere";
import { PALETTE } from "./theme";
import { beatRange } from "./timeline";

export interface FilmProps {
  format: "landscape" | "portrait";
}

const SCENES = [
  ["hook", Scene1Hook],
  ["today", Scene2Today],
  ["ground", Scene3Ground],
  ["pocket", Scene4Pocket],
  ["feel", Scene5Feel],
  ["alone", Scene6Alone],
  ["depth", Scene7Depth],
  ["everywhere", Scene8Everywhere],
] as const;

export const RoadmapFilm = ({ format }: FilmProps) => {
  const layout = LAYOUTS[format];
  return (
    <AbsoluteFill style={{ backgroundColor: PALETTE.bg }}>
      {SCENES.map(([id, Scene]) => {
        const { from, durationInFrames } = beatRange(id);
        return (
          <Sequence key={id} from={from} durationInFrames={durationInFrames} name={id}>
            <Scene layout={layout} />
          </Sequence>
        );
      })}
      <Cues />
    </AbsoluteFill>
  );
};
```

- [ ] **Step 5: Typecheck, test, and render one still from the assembled film**

```bash
pnpm --filter film typecheck && pnpm --filter film test && pnpm --filter film exec remotion still src/index.ts RoadmapFilm out/film-f1020.png --frame=1020
```

Expected: clean; `film-f1020.png` is scene 5 at its local frame 120 (halo bloomed, lens open).

---

### Task 10: Stills script, full render, and the review gate

**Files:**
- Create: `apps/film/scripts/stills.mjs`
- Create: `apps/film/README.md`

**Interfaces:**
- Produces: `out/stills/beat-1.png` … `beat-8.png`; `out/roadmap-1080p.mp4`.

- [ ] **Step 1: The stills script**

`apps/film/scripts/stills.mjs`:

```js
/**
 * One PNG at the midpoint of each beat, for the founder's storyboard
 * comparison. Run: pnpm --filter film stills
 */
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const FPS = 30;
const BEATS = [[0, 7], [7, 14], [14, 22], [22, 30], [30, 38], [38, 46], [46, 53], [53, 60]];
mkdirSync("out/stills", { recursive: true });
BEATS.forEach(([start, end], i) => {
  const frame = Math.round(((start + end) / 2) * FPS);
  const r = spawnSync("pnpm", ["exec", "remotion", "still", "src/index.ts", "RoadmapFilm", `out/stills/beat-${i + 1}.png`, `--frame=${frame}`], { stdio: "inherit", shell: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
});
console.log("stills in out/stills");
```

- [ ] **Step 2: Render the stills and compare with the storyboard**

```bash
pnpm --filter film stills
```

Expected: eight PNGs. Open each beside the matching storyboard frame (https://claude.ai/artifact/SGsSL4wrkiDgvTXNRP21y1). Each must show the same composition, palette, and on-screen line; type must never sit on cream squares without the scrim. Fix any scene that differs, then re-run. This is the founder's gate: send the eight stills before the full render.

- [ ] **Step 3: Full render**

```bash
pnpm --filter film render
```

Expected: `apps/film/out/roadmap-1080p.mp4`, 60.0 s, 1920×1080, with audio. A first render takes several minutes. Watch it once end to end and check: no frame flashes to black between beats, the motif is quiet under the cues, type enters at the stated seconds, scene 7 never jerks.

- [ ] **Step 4: README**

`apps/film/README.md`:

```markdown
# film

The 60-second Roto Chess roadmap film, built with Remotion from the approved
storyboard. Spec: `docs/superpowers/specs/2026-10-25-roadmap-film-remotion-design.md`.

- `pnpm --filter film studio` — Remotion Studio to scrub any scene.
- `pnpm --filter film stills` — one PNG per beat into `out/stills/`.
- `pnpm --filter film render` — `out/roadmap-1080p.mp4`.
- `pnpm --filter film render:portrait` — `out/roadmap-portrait.mp4`.
- `pnpm --filter film sync-assets` — re-copy pieces and board geometry from `apps/web` (committed outputs).
- `pnpm --filter film render-audio` — re-render cues and the motif to `public/audio/` (committed outputs).

Rules: every move is an engine-legal move from `src/board/script.ts`; all
motion comes from `useCurrentFrame()`; palette and durations are the app's;
sprites are drawn with SVG `<image>` from data URLs. Remotion is pinned to
one exact version across packages.
```

- [ ] **Step 5: Monorepo check**

```bash
pnpm typecheck && pnpm lint && pnpm test
```

Expected: green. (`out/` is gitignored; `public/pieces`, `public/audio`, and `src/board/geometry.ts` are generated but committed, as the README says.)

---

### Task 11: Portrait composition

**Files:**
- Modify: `apps/film/src/Root.tsx`

**Interfaces:**
- Consumes: `LAYOUTS.portrait` (Task 3), `RoadmapFilm({ format: "portrait" })`.
- Produces: composition `RoadmapFilmPortrait`, `out/roadmap-portrait.mp4`.

- [ ] **Step 1: Register the portrait composition**

In `apps/film/src/Root.tsx`, add after `RoadmapFilm`:

```tsx
    <Composition
      id="RoadmapFilmPortrait"
      component={RoadmapFilm}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={1080}
      height={1920}
      defaultProps={{ format: "portrait" as const }}
    />
```

- [ ] **Step 2: Render portrait stills for the four densest beats and adjust the table**

```bash
pnpm --filter film exec remotion still src/index.ts RoadmapFilmPortrait out/portrait-b2.png --frame=315 && pnpm --filter film exec remotion still src/index.ts RoadmapFilmPortrait out/portrait-b3.png --frame=540 && pnpm --filter film exec remotion still src/index.ts RoadmapFilmPortrait out/portrait-b6.png --frame=1260 && pnpm --filter film exec remotion still src/index.ts RoadmapFilmPortrait out/portrait-b8.png --frame=1695
```

Expected: each still keeps every element inside 1080×1920 with the lower third readable. Where something is clipped, change only the numbers in `LAYOUTS.portrait` in `src/layout.ts` (never scene code), re-render that still, repeat. Fixed-position elements that scenes still place by landscape numbers (scene 3's heartbeat row at y 912 and chip at x 1480, scene 4's left chip column at x 96, scene 5's caption at x 96, scene 8's store pills at `layout.width - 490`) are the known rough edges of the portrait cut; move those four into the `Layout` table if the portrait stills show them clipped.

- [ ] **Step 3: Render the portrait cut**

```bash
pnpm --filter film render:portrait && pnpm --filter film typecheck && pnpm --filter film test
```

Expected: `out/roadmap-portrait.mp4`, 60 s, 1080×1920; tests still pass.

---

## Self-review

**Spec coverage.** Workspace and pinned versions (Task 1); synced geometry and sprites with no cross-app import and no raw markup injection (Task 2); motion vocabulary, fonts, layout table (Task 3); engine-legal scripted moves (Task 4); eight scenes with the approved lines and timings (Tasks 5–8); scene 7 motion verified as motion (Task 8 test); synthesized cues and motif, no stock audio (Task 9); stills gate, full render, README (Task 10); portrait from the layout table (Task 11). Out-of-scope items (voiceover, licensed track, real names, `@remotion/three` port, `apps/web` changes) have no task, as intended.

**Placeholders.** None: every step carries its code or exact command. The "adjust if" branches name the exact change (hero index in Task 4, portrait numbers and the four landscape-placed elements in Task 11, Node flag in Task 9, font module names in Task 3).

**Type consistency.** `BoardTransform { cx, cy, s, ky? }` and `FilmPiece { rank, file, seat, kind, halo? }` are defined in Task 2 and used unchanged in Tasks 5–8. `SpriteMap` values are data URLs, consumed only by `Sprite`'s `<image href>`. `piecesOf`, `cellsOf`, `heroBishop`, `heroKnight`, `SCRIPT` (Task 4) match their uses. `tween(frame, startFrame, durationMs, from, to)` and `fade(frame, startFrame, durationMs)` (Task 3) match every call. `LowerThird { text, enterAt, layout, id }`, `Chip`, `Rose`, `Staunton`, device frames match their uses. `scene7Pose` returns `{ ky, s, cx, cy, rise, leap }` in both the test and the scene. `CueEvent` and `BeatId` match between `cueSheet.ts` and `timeline.ts`.
