# Orrery Cam v5 — true 3D Staunton pieces

Approved by the founder 2026-10-24. Prototype only (standalone artifact
https://claude.ai/artifact/8QKtXjMT6fM4zsQqQiyPg4); nothing in the app changes.

**LOCKED 2026-10-24.** The founder reviewed the built v5 ("looks right"). This
is the piece look for the in-app Orrery Cam. Port the geometry from artifact
version 5 (version id `1792898211-2ade`): `foot`/`bead`/`bez`/`arc` profile
helpers, the `PIECE_GEO` profiles, `carveSlit`, `merlons`, `knightHead`/`knightMane`
with `headTaper`, the knight eyes, `turnKnight`, and the seat lacquer `PAL`. Port
them as-is, without restyling.

## Goal

v4 is liked as-is. Its pieces are the app's 2D cburnett sprites extruded into
thick slabs that billboard toward the camera. Replace them with truly 3D,
clearly recognizable Classic Staunton pieces. Change nothing else.

## Decisions

| Question | Ruling |
|---|---|
| Style | Classic Staunton (tournament silhouette) |
| Build | Procedural in code: `LatheGeometry` for P/R/B/Q/K; sculpted knight from a beveled horse-head profile. Blender-modelled knight only if the code knight reads as chunky. |
| Knight facing | Toward the board center. On its own move it eases toward the leap during the approach (≤ 60°/s, eased both ends) and eases back to center after landing. |
| Colour | v4 seat lacquer unchanged (red / charcoal / blue / gold, clearcoat, env reflections). One lacquer material per piece plus a dark felt underside. |

## Pieces

- **Pawn** — base, collar, ball head. ~0.21 tall.
- **Rook** — base, tapering tower, turret with 5 cut crenels. ~0.26.
- **Knight** — turned base + horse head: muzzle narrower than neck, ears, mane ridge, eye hollows. ~0.29.
- **Bishop** — base, collar, mitre with slanted slit, ball finial. ~0.32.
- **Queen** — base, collar, coronet of 9 balls around a domed top. ~0.38.
- **King** — base, collar, crown, squared cross. ~0.42.

Base diameter ≤ 0.22 so pieces fit the inner ring (square chord ≈ 0.27).

## Behaviour

- Round pieces never rotate: v4's billboard yaw (`facing()`, 90°/s cap) is removed.
- Halo sits just above each piece's own top (per-kind height) instead of a fixed `HALO_Y`.
- Unchanged: occluder fade, evaporation (rise/shrink/ash), capture shards, graves, curtains, camera rig, timings, captions, controls.

## Verification

- Re-run the motion trace (`window.orreryTraceAll()`): camera peak °/s per turn ≈ v4 (71/106/214/112/96); piece yaw 0 except knights ≤ 60°/s.
- Close-up frames of every piece type from the shoulder cam: each identifiable at a glance.
- No console errors; WebGL fallback still shown when WebGL is off.
