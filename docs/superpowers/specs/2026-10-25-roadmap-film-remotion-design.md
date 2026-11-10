# Roadmap film, motion pass — design

Approved inputs: the Film narrative tab of the roadmap doc
(https://claude.ai/artifact/FBafVF48DM41zLJC9Sv5Lb) and the eight approved
storyboard frames (https://claude.ai/artifact/SGsSL4wrkiDgvTXNRP21y1).
Founder choices, 2026-10-25: on-screen type only, the name "Roto Chess",
placeholder names, synthesized music.

## Goal

A 60-second, 1920×1080, 30 fps MP4 that plays the eight storyboard beats as
one continuous shot of the same circular board, rendered deterministically
from code. A 1080×1920 cut comes from the same scenes with a different layout
table, not from cropping.

## Where it lives

A new workspace `apps/film` (package name `film`) in the pnpm monorepo.

- It depends on `@rotochess/engine` (workspace) so every move shown is a
  legal engine move with an engine-authored path.
- It gets its own copies of two web assets through a sync script, so the web
  app stays the single source of truth and the film never imports across
  apps at build time: `apps/web/public/pieces/*.svg` →
  `apps/film/public/pieces/`, and
  `apps/web/src/components/board/board-geometry.ts` →
  `apps/film/src/board/geometry.ts` (generated, committed, never hand-edited).
- Vercel is unaffected (its root is `apps/web`). CI's `pnpm -r typecheck`
  and `pnpm -r test` pick the package up automatically; its tests are pure
  (no rendering in CI).
- Remotion packages are pinned to one exact version (`4.0.537`) because
  mixed Remotion versions fail at startup. Remotion's license is free for
  individuals and teams of up to three people; the founder confirms this
  applies before any wider use.

## Composition

`RoadmapFilm`: 1920×1080, fps 30, 1800 frames. One `<Sequence>` per beat at
the frame ranges below. Each scene component reads its own local frame from
`useCurrentFrame()` and never reads wall-clock time, randomness, or CSS
animation, so every frame renders identically.

| Beat | Seconds | Frames |
| --- | --- | --- |
| 1 Hook | 0 to 7 | 0 to 210 |
| 2 Today | 7 to 14 | 210 to 420 |
| 3 Solid ground | 14 to 22 | 420 to 660 |
| 4 In your pocket | 22 to 30 | 660 to 900 |
| 5 Feel | 30 to 38 | 900 to 1140 |
| 6 Never alone | 38 to 46 | 1140 to 1380 |
| 7 Depth | 46 to 53 | 1380 to 1590 |
| 8 Everywhere | 53 to 60 | 1590 to 1800 |

Scenes compose inside one `<svg viewBox="0 0 W H">` per scene (W and H from
the layout table), so the storyboard's SVG compositions carry over directly.

## Modules

| Module | Responsibility |
| --- | --- |
| `src/timeline.ts` | FPS, beat table in seconds, `toFrames`, `beatRange`. |
| `src/motion.ts` | The app's motion vocabulary as frame math: durations 150/250/400/700 ms, the settle easing `cubic-bezier(0.22, 1, 0.36, 1)`, `tween`, `fade`. |
| `src/theme.ts` | Midnight Orrery tokens verbatim from `globals.css`; seat and lacquer colors. |
| `src/fonts.ts` | Loads Instrument Serif, Instrument Sans, IBM Plex Mono through `@remotion/google-fonts` with explicit weights and the latin subset. |
| `src/layout.ts` | Per-format numbers (board centers, scales, lower-third position) for `landscape` and `portrait`. |
| `src/board/geometry.ts` | Generated copy of the web board geometry (annulus paths, centroids, `movePathD`). |
| `src/board/sprites.ts` | Fetches the 24 piece SVGs once from `staticFile`, inlines them as nested `<svg>`; blocks the render with `delayRender` until loaded. |
| `src/board/Board.tsx` | `Squares`, `Rails`, `Meridians`, `Numerals`, `Pieces`, `mapPoint`, all driven by a `BoardTransform {cx, cy, s, ky}`. |
| `src/board/script.ts` | Plays a deterministic 16-ply opening through the engine with a fixed move preference; exports the per-ply states, the hero bishop curl (West, ply 11) and a South knight leap. |
| `src/ui/*` | `LowerThird`, `Chip`, `Rose`, `DeviceFrames`, `Staunton` silhouettes. |
| `src/scenes/Scene1Hook.tsx` … `Scene8Everywhere.tsx` | One file per beat; each exports the component and, where motion needs checking, a pure `pose(frame)` function. |
| `src/audio/cueSheet.ts`, `src/audio/Cues.tsx` | Absolute cue frames and the `<Audio>` sequences; the clockwork motif under everything. |
| `scripts/sync-assets.mjs` | Copies pieces and board geometry from the web app. |
| `scripts/render-audio.mjs` | Renders the app's synthesized cues and a new clockwork motif to WAV in `public/audio/`, using the web app's `synth.ts` directly (pure math, no Web Audio). |
| `scripts/stills.mjs` | Renders one PNG at the midpoint of each beat for review. |

## Motion rules (binding)

- Pose changes use eased blends from a captured pose; nothing uses
  exponential follow. The settle easing from the app is the default.
- Scene 7's tilt and camera are a pure function `scene7Pose(frame)` and a
  test asserts the per-frame change of tilt and scale stays under a ceiling,
  so motion is verified as motion, not as stills (lesson of 2026-10-09).
- Two cuts only: into the share card at 42 s and into the devices at 53 s.
  Everything else is the board moving under the camera.
- Type enters with the same settle blend as pieces: 24 px rise plus fade
  over 400 ms. On-screen lines are the eight approved lines, unchanged.

## Audio

- Cues are the app's own synthesized set, rendered to WAV once by script:
  set-down, capture, halo, evaporation, your-turn, avenger, check-pulse,
  zoom-detent, chat-tick. Placed on the cue sheet at absolute frames.
- The motif is new, synthesized in the same script: a clockwork tick every
  600 ms (filtered noise burst plus a low sine), a soft inharmonic bell
  partial every fourth tick, 60 s, mixed at 0.25 and faded over the last two
  seconds. No licensed or stock audio.

## Beat 7 in this pass

Beat 7 renders as the storyboard shows it: a 2.5D SVG tilt with Staunton
silhouettes and meridian curtains, because the true 3D pieces wait on the
Orrery Cam v5 sign-off and because a WebGL render adds risk to the first
cut. The port to `@remotion/three` using the v5 prototype scene is a
separate follow-on plan once v5 is approved; the scene's `pose(frame)`
interface stays the same so the swap does not touch the timeline.

## Verification and gates

1. `pnpm --filter film test`: timeline, motion helpers, script legality,
   scene 7 motion ceiling. Pure, runs in CI.
2. `pnpm --filter film stills`: eight PNGs at beat midpoints. Founder
   compares them with the approved storyboard. Gate before the full render.
3. `pnpm --filter film render`: `out/roadmap-1080p.mp4`. Founder reviews the
   motion. Gate before the portrait cut.
4. `pnpm --filter film render:portrait`: `out/roadmap-portrait.mp4`.

## Out of scope

Voiceover, a licensed track, real player names, the Four Crowns name, the
`@remotion/three` port, and any change to `apps/web`.
