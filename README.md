# Roto Chess

A four-player team chess variant played on a circular board — invented and
refined over a decade and ~250 games by its original design group, now given
a real client.

## Structure

- `packages/engine` — `@rotochess/engine`: the pure, zero-dependency rules
  engine implementing Rulebook v3.1. The single authority on legality; runs
  on both client (UX) and server (truth). Exports raw TypeScript source —
  `apps/web` consumes it via `transpilePackages` (no build step until the
  future open-source release).
- `apps/web` — the Next.js web app (board, tables, async multiplayer). *(lands at milestone M4+)*
- `docs/` — rulings, going-live runbook, asset manifest, build recap. *(lands with deliverables)*

## Commands

```bash
pnpm install     # once
pnpm test        # full test suite (unit, property, perft, golden games)
pnpm typecheck   # strict TS across the workspace
pnpm lint
pnpm --filter web dev   # run the app at localhost:3000 (once apps/web exists)
```

Without Supabase env vars the app runs in local/demo mode (hotseat play);
see `docs/GOING-LIVE.md` (deliverable) to wire the real backend.
