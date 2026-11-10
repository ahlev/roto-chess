# film

The 60-second Roto Chess roadmap film, built with Remotion from the approved
storyboard. Spec: `docs/superpowers/specs/2026-10-25-roadmap-film-remotion-design.md`.

- `pnpm --filter film studio` — Remotion Studio to scrub any scene.
- `pnpm --filter film test` / `typecheck` — pure tests (timeline, motion, script legality, scene 7 motion ceiling); also run by `pnpm -r test` in CI.
- `pnpm --filter film stills` — one PNG per beat into `out/stills/` (beat midpoints; beats 1, 2, 4, 6 and 8 are taken later, once their captions, notification, share card or lockup have landed).
- `pnpm --filter film render` — `out/roadmap-1080p.mp4`.
- `pnpm --filter film render:portrait` — `out/roadmap-portrait.mp4`.
- `pnpm --filter film sync-assets` — re-copy pieces and board geometry from `apps/web` (committed outputs).
- `pnpm --filter film render-audio` — re-render cues and the motif to `public/audio/` (committed outputs).

Rules: every move is an engine-legal move from `src/board/script.ts`; all
motion comes from `useCurrentFrame()`; palette and durations are the app's;
sprites are drawn with SVG `<image>` from data URLs. Remotion is pinned to
one exact version across packages (`4.0.537`).

Gates: the founder compares the eight stills with the approved storyboard
before the full render, and reviews the 1080p render before the portrait cut.

Licence: Remotion's free licence covers individuals and teams of up to three
people; confirm it still applies before any wider use.
