# Meadow Cam realism pass — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace Meadow Cam's flat procedural surfaces with photo-textured PBR materials, dense realistic grass and foliage, and dynamic lighting, while keeping the v4 camera rig and timings untouched.

**Architecture:** Same parts/build layout as the first plan (`2026-10-25-meadow-cam-medieval-variant.md`). A new part `05-textures.js` holds the embedded data-URI albedos and the derived-map helpers; `30-world.js`, `40-board.js`, `60-pieces.js`, `10-renderer.js`, `20-light.js` and `50-banners.js` are revised in place. `build.py` gains a texture-embedding step that reads `textures/*.jpg|png` and writes `parts/05-textures.js`.

**Tech Stack:** three.js 0.160 (SSAOPass, PMREMGenerator), canvas 2D for derived maps, Python + Pillow for downscaling, Higgsfield gpt_image_2_5 for the source images.

## Global Constraints

- Spec: `app/docs/superpowers/specs/2026-10-25-meadow-cam-realism-pass-design.md`.
- Camera rig (`80-rig.js` camera code, `90-hud-player.js` timings) is not edited.
- Republish to `https://claude.ai/artifact/Vx8aVarNcpBjbnzwnHKfv2` by the same `file_path` as before.
- Page ≤ 8 MB. Trace must still read 71 / 106 / 214 / 112 / 96.
- Paths as in the first plan (`$W`, dev server `meadow-cam` on 8792).

---

### Task 1: Texture set on disk
- [ ] Poll the 16 generation jobs with `jobs_wait`; download each result into `$W/textures-raw/` (untrusted downloads: own directory, read with `-I` Python only).
- [ ] `downscale.py`: Pillow resize to 1024², JPEG q82 for albedos, PNG (palette-reduced) for alpha cards → `$W/textures/<name>.(jpg|png)`. Print sizes; total ≤ 5 MB.
- [ ] Inspect each in the browser or via Read; regenerate any that is not seamless or has baked shadows.

### Task 2: Texture pipeline
- [ ] `build.py`: emit `parts/05-textures.js` with `const TEX_SRC = { turf: "data:image/jpeg;base64,…", … }`.
- [ ] `05-textures.js` tail (static, appended by build from `parts-src/05-textures.tail.js`): `loadTex(name, repeat)` → THREE.Texture from an Image (sRGB, repeat, anisotropy 8); `deriveNormal(img, strength)` (Sobel on luminance → RGB normal canvas); `deriveRoughness(img, lo, hi)` (blurred luminance inverted); `TEX = await loadAll()` — the module awaits all images before the scene is built (top-level await inside the module script; show "Loading textures…" in the caption until done).

### Task 3: Meadow
- [ ] Ground: turf albedo/normal/roughness, displacement via vertex y (existing `groundY` plus noise from a 256² height sample of the turf luminance); trampled ring r 2.9–4 blended by vertex colour mask; wildflower patches by noise.
- [ ] Blades: `InstancedMesh` of a 4-segment tapered plane (6 tris), 60k/20k, per-instance colour, `onBeforeCompile` wind: `sway = n(iw*0.15 + t*0.35)*0.5 + n(iw*0.6 + t*1.1)*0.3`, bend ∝ height², gust band travelling along +x.
- [ ] Tuft cards (3,000), flower cards (1,500), shrub cards (300): cross-plane `InstancedMesh` with alphaMap/alphaTest 0.5, double side, `customDepthMaterial` for cut-out shadows.

### Task 4: Trees
- [ ] Trunk (bark albedo/normal), 3 branch cylinders, canopy of 80–120 leaf cards per tree on a sphere shell, instanced per tree, castShadow with alpha cut-out depth material.

### Task 5: Dynamic lighting
- [ ] Cloud shadow plane: 60×60 at y 9, cloud alphaMap (procedural soft noise canvas), `castShadow`, `visible` only for shadows (`material.colorWrite=false`, depthWrite false) drifting with preset wind; density per preset (noon 0.35, golden 0.5, storm 0.9).
- [ ] Sky env: `skyScene` holding a clone of the dome; `scene.environment = pmrem.fromScene(skyScene)` rebuilt when `light.t` reaches 1 and on start.
- [ ] `SSAOPass(scene, camera, w, h)` kernelRadius 0.12, minDistance 0.001, maxDistance 0.08, output Default; only at desktop tier. Quality tier: `TIER = (innerWidth < 760 || devicePixelRatio < 1.5) ? "lite" : "full"`.

### Task 6: Board
- [ ] Materials from TEX with derived maps; grout: a second `LineSegments` replaced by thin dark recessed strips (planes with normal map) + moss albedo tint; rails `ironMat` with iron albedo/normal; studs bronze albedo.

### Task 7: Pieces
- [ ] Lathe segments 48; `newArmyMats`: livery `normalMap: TEX.cloth.normal` (repeat 6, scale 0.35); steel `normalMap: TEX.steel.normal`; stone `map: TEX.granite`; trim `map: TEX.bronze` tinted by `PAL[seat].trim`.

### Task 8: Meridians
- [ ] `50-banners.js`: alpha factor 0.25×; `40-board.js`: `jasperMat.emissiveIntensity = 0`.

### Task 9: Verify and republish
- [ ] Trace, event frames per preset, cloud-shadow motion check (two frames 3 s apart), size, phone tier, console clean. Republish by file path; update todo review + memory.
