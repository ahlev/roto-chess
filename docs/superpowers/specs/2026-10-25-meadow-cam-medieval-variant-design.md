# Meadow Cam — medieval / fantasy art-direction variant of the 3D move camera

Approved by the founder 2026-10-25. Prototype only; nothing in the app changes.
Alternative to Orrery Cam v5 (spec `2026-10-24-orrery-cam-v5-staunton-pieces-design.md`),
built in parallel by another session. Both share the v4 functional base.

## Goal

Same replay, different world. Keep every functional part of Orrery Cam v4
(camera rig, phase timings, scripted round, player loop, HUD controls, review
hooks) and re-dress the scene as a sunny hilltop meadow battlefield under
mountains, with filtered sunlight that singles out the mover, heraldic
medieval pieces, and a stone-and-marble board.

## Decisions

| Question | Ruling |
|---|---|
| Base | Orrery Cam v4 source (published artifact, 2026-10-09). Camera rig, timings, player, HUD, scripted round, `orreryReview` / `orreryTraceAll` hooks copied unchanged. |
| Deliverable | A new standalone HTML page published as its own private artifact, "Meadow Cam". The Orrery Cam artifact is not touched. Source kept in this session's scratchpad and republished by path. |
| Sunlight | Automatic sun shaft tracks the mover every turn, plus a HUD "Light" control with three presets: Noon, Golden hour (default), Storm-break. |
| Pieces | Procedural three.js geometry (lathe, extrude, box). Stylized toy-soldier look. Never AI-generated. |
| Seat colours | Heraldic livery in the v4 seat colours: red / charcoal / blue / gold. |
| Piece facing | No billboard yaw. Knights face board centre and ease toward their leap during the approach (≤ 60°/s), easing back after landing (as v5). |

## Scene

**Sky.** Dome shader: blue zenith, warm pale horizon, a sun disc with soft
glow placed at the active preset's sun direction. Light blue haze fog.
Stars, planets and orbit rings from v4 are removed.

**Horizon.** A ring of low-poly mountains (noise-displaced ring of cones)
with snow above a height threshold, beyond a far treeline band.

**Meadow.** A large grass-green disc under the board, slightly domed. Instanced
grass blades (several thousand thin tapered planes) sway in a vertex shader;
flower sprites in three colours scattered among them. A clump of cone-and-sphere
trees on the up-sun side casts dappled shadow across part of the board.

**Clouds.** A handful of soft billboard sprites drifting slowly; density and
brightness follow the Light preset.

## Board

Same annulus radii, square geometry and placement as v4.

- Squares: cream marble and grey slate `MeshStandardMaterial`s with a
  procedural canvas texture (veins and grain), low roughness on the marble.
- Slab: weathered granite with moss-green joint lines on the grid instead of
  v4's thin brown lines.
- Rails: dark wrought-iron tori with bronze studs instead of brass.
- Centre: a stone sundial — stepped plinth, dial face, iron gnomon. Its
  shadow comes from the real key light, so it reads differently per preset.
  Seat turn-order dots become four small bronze bosses on the plinth.
- Meridian strips stay red, as inlaid jasper (slightly emissive).

## Sunlight

- Key light is the sun: a shadow-casting `DirectionalLight` whose position,
  colour and intensity come from the preset.
- **Sun shaft.** A soft volumetric cone (open cylinder, additive beam shader
  from v4's grave beam, widened) stands over the mover. It fades in during
  the approach, follows the mover during travel, pools on the landing square
  through the event, and fades during the settle. Its colour follows the preset.
  Brightness is low enough that bloom does not blow out the piece.
- **Presets** (HUD control, three pills, `aria-pressed`):
  - *Noon* — high white-gold sun, short shadows, bright sky, few clouds.
  - *Golden hour* (default) — low amber sun from the West-South-West, long
    shadows, warm horizon, more clouds, slightly stronger shaft.
  - *Storm-break* — dark slate overcast, dim cool ambient, single bright shaft
    on the mover, sky nearly grey, fog denser.
  Switching tweens every preset value (sun direction and colour, hemisphere
  light, sky dome uniforms, fog colour and density, exposure, cloud opacity)
  over 2 s with smootherstep so the change is calm.

## Pieces

Base diameter ≤ 0.22 (inner-ring square chord ≈ 0.27). Heights near the v5
set: P 0.22, R 0.27, N 0.30, B 0.32, Q 0.38, K 0.42. Materials per army:
painted livery (seat colour, clearcoat), steel armour (grey, metalness 0.9),
gold trim (royalty and clerics), dark felt base. Charcoal army gets cream trim
for contrast as in the 2D set.

- **Pawn (footman)** — turned base, tunic body in livery, round helm, kite
  shield in livery on the front.
- **Rook (keep)** — square-ish tower from a lathe with 8 sides, four crenels,
  arrow-slit grooves, livery band near the top.
- **Knight (destrier)** — turned base, armoured horse head (beveled extruded
  profile), chamfron plate, plume in livery, faces board centre.
- **Bishop (cleric)** — base, robe, mitre with slanted slit, small cross
  finial, crozier on one side.
- **Queen (lady)** — base, gown, veil cone, crown of 8 points, gold trim.
- **King (lord)** — base, robe with cape, taller crown of 5 points, sceptre.

Halo sits above each kind's own top height.

## Rule events

All hooks, timings and uniforms from v4 are kept; only the look changes.

- **Meridian curtain → banner.** Same shader plane, drawn as a hanging banner
  with a forked bottom edge (alpha cut in the fragment shader) under an iron
  crossbar on a standard at the outer rail. Still red light, still flares on a
  crossing, still tears for an Avenger.
- **Halo** — golden circlet of light, same ignite animation.
- **Evaporation** — same rise, shrink and fade; motes become warm pollen
  specks lit by the sun.
- **Grave** — ember cairn ring (small stones) with a candle-flame shaft.
- **Avenger** — banner tears, shards are red cloth, shockwaves unchanged.
- **Capture** — shards in the victim's livery colour, as v4.

## HUD

Same panel and controls as v4 plus the Light control. Eyebrow and title read
"Roto Chess · Meadow Cam prototype — Round 12, on the hill". Legend swatches
recoloured to the new palette. CSS tokens: warm daylight panel (parchment on
dark walnut) instead of midnight.

## Verification

- `window.orreryTraceAll()`: peak camera °/s per turn within ±15 % of v4
  (71 / 106 / 214 / 112 / 96); piece yaw 0 except knights ≤ 60°/s.
- Frame-check each event with `window.orreryReview(turn, seconds)` in the
  built-in browser: move, evaporation, halo, grave, avenger.
- All three Light presets switch cleanly; default is Golden hour.
- No console errors; WebGL-off fallback text still shows.
- Phone-width layout still usable (legend hidden, controls wrap).
