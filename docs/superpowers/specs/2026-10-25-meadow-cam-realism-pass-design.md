# Meadow Cam — realism pass

Approved by the founder 2026-10-25 after the first Meadow Cam publish
(artifact https://claude.ai/artifact/Vx8aVarNcpBjbnzwnHKfv2). Prototype only.
Builds on `2026-10-25-meadow-cam-medieval-variant-design.md`; everything not
mentioned here stays as that spec says. Republish to the same URL.

## Founder feedback

- The meridians are too prominent: the rising red glow between each side's
  starting board reads as a wall.
- Overall too simplistic. Wants richer, deeper textures, more dynamic
  lighting, much more realistic foliage, grass and meadow surfaces, and depth
  of surface on the setting, the board and the pieces.

## Decisions

| Question | Ruling |
|---|---|
| Texture source | Generated seamless photo-textures (Higgsfield `gpt_image_2_5`, 2k, downscaled to 1024) embedded as JPEG data URIs; alpha foliage cards as PNG with transparent background. Pieces' shapes stay procedural; only their surfaces use textures. |
| Derived maps | Normal, roughness and ambient maps are derived from each albedo in code at load (Sobel on luminance, blurred-luminance roughness); only albedos ship. |
| Meridians | Banners kept at one quarter of the current alpha; jasper strip no longer emissive; flare and Avenger tear unchanged. |
| Budget | Page ≤ 8 MB. Desktop first; a lighter tier (one third of the blades, no SSAO) on narrow screens or pixel ratio < 1.5. |

## Texture set

Albedos (seamless, 1:1): meadow turf, trampled turf, wildflower turf, oak
bark, granite rock face, cream marble, grey slate, weathered granite block,
wrought iron, hammered steel, cloth weave, aged bronze.
Alpha cards: grass tuft, oak leaf cluster, wildflower heads, meadow shrub sprig.

## Scene changes

**Meadow.** Ground uses turf albedo + derived normal + displacement; a
trampled-turf ring under and just around the slab; wildflower-turf patches
blended by noise. Grass: 60,000 instanced blades near the ring (r 3.2–10),
4 segments each, random bend and lean, root-to-tip colour via vertex colour,
wind field with rolling gusts (two octaves of moving noise in the vertex
shader). A sparse outer ring of 20,000 blades to r 25. Grass-tuft cards
(cross-planes, alpha-cut) 3,000; wildflower cards 1,500; shrub cards along
the tree line.

**Trees.** Trunk + 3 branches with bark albedo/normal; canopy from 80–120
leaf-cluster cards per tree (instanced planes, double-sided, alphaTest 0.5,
cast shadows) so sunlight dapples through.

**Dynamic lighting.** A cloud layer (large plane at y 9 with a soft cloud
alphaMap, alphaTest, `castShadow`, drifting with the preset's wind) throws
moving shadows on field and board. Per-preset sky environment: PMREM from a
scene containing only the sky dome, rebuilt when a preset finishes its tween,
so reflections match the sky. SSAOPass (three 0.160) between render and bloom
at the desktop tier. Shadow map stays 4096.

**Board.** Marble/slate/granite albedos with derived normals and roughness;
grout as a dark recessed normal line plus moss colour; iron rails and bronze
studs textured; sundial dial in marble with engraved ticks.

**Pieces.** Lathe segments 28 → 48. Livery: cloth-weave normal map
(repeat 6), clearcoat kept. Steel: hammered normal. Stone (keeps): granite
albedo + normal. Trim: aged bronze/gold albedo tint. Felt base dark.

**Mountains.** Rock albedo + normal with planar UVs, vertex colour kept for
snow.

## Verification

- `window.orreryTraceAll()`: camera peak °/s per turn unchanged from v4
  (71 / 106 / 214 / 112 / 96).
- Frames for each event in each preset; cloud shadows visibly move between
  two frames 3 s apart; dapple under trees visible on the board in Golden hour.
- Built page ≤ 8 MB; loads with no console errors; phone tier renders.
