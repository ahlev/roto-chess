# Meadow Cam (medieval / fantasy 3D move camera) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A standalone three.js page that replays the same scripted Roto Chess round as Orrery Cam v4, with identical camera motion, re-dressed as a sunny hilltop meadow under mountains, with sun-shaft lighting that follows the mover, three Light presets, heraldic medieval pieces and a stone-and-marble board.

**Architecture:** The page is built from ordered script "parts" (`parts/NN-name.js`) concatenated by `build.py` into one `<script type="module">` inside `template.html`, producing `meadow-cam.html`. Task 1 splits the v4 source into those parts verbatim and proves the build runs identically; every later task replaces one part (or applies small asserted string edits to a copied part). The camera rig, timings, player loop and review hooks stay byte-for-byte v4 except for the edits this plan lists.

**Tech Stack:** three.js 0.160 via jsdelivr importmap (ES modules, no bundler), plain HTML/CSS, Python 3 for the build and edit scripts, the desktop app's built-in browser for verification, Artifact tool for publishing.

## Global Constraints

- Spec: `app/docs/superpowers/specs/2026-10-25-meadow-cam-medieval-variant-design.md`.
- Nothing in `app/` changes except this plan file. No git commits (user rule; `app/` is the repo, the prototype lives outside it).
- The Orrery Cam artifact (`https://claude.ai/artifact/8QKtXjMT6fM4zsQqQiyPg4`) is never republished. The result is a NEW artifact titled "Meadow Cam".
- Pieces are procedural geometry, never AI-generated.
- Default Light preset is **Golden hour**. Preset names and labels: `noon` "Noon", `golden` "Golden hour", `storm` "Storm-break".
- Piece base diameter ≤ 0.22 world units. No billboard yaw. Any piece yaw ≤ 60°/s.
- Motion acceptance: `window.orreryTraceAll()` camera peak °/s per turn within ±15 % of v4 = 71 / 106 / 214 / 112 / 96.
- Phase durations, `EVENT_DUR`, `TURNS`, `INITIAL` unchanged from v4.
- Paths (Git Bash form; use these exact values in every command):
  - `W=/c/Users/ahlev/AppData/Local/Temp/claude/C--Users-ahlev--claude-spares-spare-QbPeZi/65ffc00d-391d-4fd8-8049-1729cc327f11/scratchpad/meadow-cam`
  - `V4=/c/Users/ahlev/.claude/projects/C--Users-ahlev-OneDrive-Desktop-CLAUDE-Roto-Chess/65ffc00d-391d-4fd8-8049-1729cc327f11/tool-results/artifact-3bf1b7be-1791524234-5ff1.html` (the saved v4 page, 1131 lines)
  - Project launch config: `C:\Users\ahlev\OneDrive\Desktop\CLAUDE\Roto Chess\.claude\launch.json` (already has an `orrery-prototype` entry on port 8791 owned by another session; do not touch it).
- Dev server: launch config `meadow-cam`, port 8792, page `http://127.0.0.1:8792/meadow-cam.html`.
- Checklist to tick as tasks finish: `tasks/todo.md`, section "Meadow Cam".

---

## File structure

All under `$W` (scratchpad, not the project):

| File | Responsibility |
|---|---|
| `template.html` | Markup, CSS, importmap, one module script containing the marker `/*PARTS*/` |
| `build.py` | Concatenates `parts/*.js` (sorted) into the marker → `meadow-cam.html` |
| `rep.py` | `rep(path, old, new)` asserted string replacement used by edit steps |
| `parts/00-core.js` | three imports, board geometry helpers, scripted round (v4 verbatim) |
| `parts/10-renderer.js` | renderer, scene, camera, env, composer, resize, lights (new) |
| `parts/20-light.js` | Light presets + tween, sky dome, sun shaft + spot, HUD Light binding (new) |
| `parts/30-world.js` | canvas-texture helpers, mountains, meadow, grass, flowers, trees, clouds (new) |
| `parts/40-board.js` | annulus slab, marble/slate squares, grid, jasper meridians, iron rails, sundial, seat bosses (new) |
| `parts/50-banners.js` | meridian banner shader + iron standards + `hitUv` (new) |
| `parts/60-pieces.js` | procedural heraldic pieces, `makePiece` and material helpers (new) |
| `parts/70-fx.js` | v4 fx (burst, motes, shockwave, trail) verbatim + new `igniteHalo` and cairn graves |
| `parts/80-rig.js` | board state, camera rig, run builder (v4 verbatim + listed edits) |
| `parts/90-hud-player.js` | HUD, player, frame loop, review hooks (v4 verbatim + listed edits) |

Interfaces shared across parts (all module-scope `const`/`function` in one concatenated script):

- From 00: `THREE`, `mergeGeometries`, `U`, `SECTOR`, `SEAT_NAME`, `SEAT_BRIGHT`, `ASH`, `D2R`, `parse`, `polar(deg, r, y)`, `polarOf`, `sqPos(sq)`, `wrapDeg`, `degOfPoint`, `meridianDeg(seat)`, `hdr(hex, k)`, `easeInOut`, `INITIAL`, `TURNS`, `TONE_LABEL`, `EVENT_DUR`.
- From 10: `stage`, `renderer`, `scene`, `camera`, `composer`, `hemi`, `key`, `fill`, `moverLight`.
- From 20: `PRESETS`, `light` (`{ cur, from, to, t, name }`), `setLight(name)`, `applyLight(state)`, `updateLight(dt)`, `sky`, `updateShaft(dt, focusVec3OrNull, state)`.
- From 30: `canvasTexture(size, paint, repeat)`, `speckle`, `veins`, `groundY(x, z)`, `cloudMat`, `updateWorld(dt, time)`.
- From 40: `graniteMat`, `marbleMat`, `slateMat`, `ironMat`, `bronzeMat`, `seatDots`, `setActiveSeat(seat)`.
- From 50: `curtainVS`, `curtains` (seat → ShaderMaterial with `uTime uFlare uShatter uHit uColor`), `hitUv(point)`.
- From 60: `PAL[seat].cap`, `PIECE_TOP`, `haloY(kind)`, `yawTo(dirVec3)`, `makePiece(kind, seat, sq, halo)` → `{ kind, seat, group, token, haloMesh, fade, body, mats, wantYaw }`, `disposePiece`, `setEmissive`, `applyFade`, `setOpacity`.
- From 70: `fx`, `addFx`, `clearFx`, `after`, `tween`, `burst`, `motes`, `shockwave`, `trail`, `igniteHalo`, `graves`, `graveMark`, `consumeGrave`, `disposeGrave`, `updateGraves`.
- From 80: `pieces`, `removePiece`, `applyInstant`, `resetTo`, `UP`, `cam`, `view`, poses, `blendPose`, `followTo`, `buildCurve`, `capture`, `onCross`, `EVENTS`, `makeRun`.
- From 90: HUD, `player`, `play`, `tick`, `window.orreryReview`, `window.orreryTraceAll`.

---

### Task 1: Scaffold, build script, v4 split into parts, dev server, baseline trace

**Files:**
- Create: `$W/template.html`, `$W/build.py`, `$W/rep.py`, `$W/parts/00-core.js` … `$W/parts/90-hud-player.js` (all copied from `$V4` line ranges)
- Modify: `C:\Users\ahlev\OneDrive\Desktop\CLAUDE\Roto Chess\.claude\launch.json` (add one configuration)

**Interfaces:** Produces the full v4 program split into parts; later tasks replace parts by file name.

- [ ] **Step 1: Create folders and the build/edit helpers**

```bash
W=/c/Users/ahlev/AppData/Local/Temp/claude/C--Users-ahlev--claude-spares-spare-QbPeZi/65ffc00d-391d-4fd8-8049-1729cc327f11/scratchpad/meadow-cam
mkdir -p "$W/parts"
cat > "$W/build.py" <<'EOF'
import pathlib
root = pathlib.Path(__file__).parent
parts = sorted((root / "parts").glob("*.js"))
js = "\n".join(p.read_text(encoding="utf-8") for p in parts)
tpl = (root / "template.html").read_text(encoding="utf-8")
assert tpl.count("/*PARTS*/") == 1, "template needs exactly one /*PARTS*/ marker"
out = tpl.replace("/*PARTS*/", js, 1)
(root / "meadow-cam.html").write_text(out, encoding="utf-8")
print("built", len(out), "bytes from", [p.name for p in parts])
EOF
cat > "$W/rep.py" <<'EOF'
import pathlib
def rep(path, old, new, count=1):
    p = pathlib.Path(path)
    s = p.read_text(encoding="utf-8")
    n = s.count(old)
    assert n == count, f"{p.name}: expected {count} match(es) of {old[:70]!r}, found {n}"
    p.write_text(s.replace(old, new), encoding="utf-8")
    print("ok", p.name, "-", old[:50].replace("\n", " "))
EOF
```

- [ ] **Step 2: Split the v4 script into parts (verbatim line ranges)**

```bash
V4=/c/Users/ahlev/.claude/projects/C--Users-ahlev-OneDrive-Desktop-CLAUDE-Roto-Chess/65ffc00d-391d-4fd8-8049-1729cc327f11/tool-results/artifact-3bf1b7be-1791524234-5ff1.html
sed -n '159,223p'  "$V4" > "$W/parts/00-core.js"
sed -n '225,298p'  "$V4" > "$W/parts/10-renderer.js"
sed -n '299,412p'  "$V4" > "$W/parts/40-board.js"
sed -n '413,452p'  "$V4" > "$W/parts/50-banners.js"
sed -n '453,538p'  "$V4" > "$W/parts/60-pieces.js"
sed -n '539,709p'  "$V4" > "$W/parts/70-fx.js"
sed -n '710,933p'  "$V4" > "$W/parts/80-rig.js"
sed -n '934,1127p' "$V4" > "$W/parts/90-hud-player.js"
head -1 "$W/parts/00-core.js"; tail -2 "$W/parts/90-hud-player.js"
```
Expected: first line is `import * as THREE from "three";`; the last two lines are `  return out;` and `};`.

- [ ] **Step 3: Write the template (v4 markup as a full document, new title, Light control added)**

```bash
cat > "$W/template.html" <<'EOF'
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Meadow Cam</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Instrument+Sans:wght@400;500;600&family=Instrument+Serif&display=swap">
<style>
  /* Layout: full-bleed WebGL stage; title top-left, key top-right, caption + turn strip + controls docked bottom-left. */
  :root {
    color-scheme: dark;
    --bg: #2b2016;
    --surface: rgba(46, 34, 22, 0.78);
    --line: #5a4631;
    --text: #f3e9d2;
    --dim: #c9b899;
    --north: #e5705f;
    --east: #c7bcac;
    --south: #7fa9dc;
    --west: #d9ae4e;
    --halo: #ffd264;
    --evap: #e8d59a;
    --meridian: #d9442f;
    --focus: #f0dcae;
    --f-display: "Instrument Serif", "Iowan Old Style", Georgia, serif;
    --f-sans: "Instrument Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
    --f-mono: "IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace;
  }
  *, *::before, *::after { box-sizing: border-box; }
  html, body { height: 100%; margin: 0; }
  body { background: var(--bg); color: var(--text); font-family: var(--f-sans); font-size: 14px; overflow: hidden; }
  #stage { position: fixed; inset: 0; }
  #stage canvas { display: block; width: 100%; height: 100%; }

  .top {
    position: fixed; top: 0; left: 0; right: 0; pointer-events: none;
    padding: calc(env(safe-area-inset-top, 0px) + 16px) 16px 0;
    display: flex; justify-content: space-between; align-items: flex-start; gap: 24px;
  }
  .eyebrow { font: 500 11px/1.2 var(--f-mono); letter-spacing: 0.14em; text-transform: uppercase; color: var(--dim); margin: 0; text-shadow: 0 1px 2px rgba(0,0,0,0.5); }
  h1 { font: 400 clamp(30px, 4.2vw, 46px)/1 var(--f-display); margin: 8px 0 10px; letter-spacing: -0.01em; text-wrap: balance; text-shadow: 0 1px 3px rgba(0,0,0,0.55); }
  .lede { font-size: 14px; line-height: 1.5; color: var(--text); max-width: 32rem; margin: 0; text-shadow: 0 1px 2px rgba(0,0,0,0.6); }

  .legend {
    pointer-events: auto; margin: 0; padding: 12px 14px; display: grid; gap: 9px;
    font-size: 12px; line-height: 1.35; color: var(--dim);
    background: var(--surface); border: 1px solid var(--line); border-radius: 10px;
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); max-width: 17rem;
  }
  .legend div { display: grid; grid-template-columns: 22px 1fr; gap: 8px; align-items: center; }
  .legend dt { display: grid; place-items: center; }
  .legend dd { margin: 0; }
  .legend b { color: var(--text); font-weight: 600; }
  .sw-curtain { width: 6px; height: 16px; background: linear-gradient(var(--meridian), var(--meridian) 70%, transparent); clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 75%, 0 100%); }
  .sw-halo { width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--halo); }
  .sw-evap { width: 16px; height: 12px; background: radial-gradient(circle at 25% 70%, var(--evap) 1.5px, transparent 2px), radial-gradient(circle at 70% 35%, var(--evap) 1.5px, transparent 2px), radial-gradient(circle at 55% 85%, var(--evap) 1.2px, transparent 1.8px); }
  .sw-grave { width: 12px; height: 12px; border-radius: 50%; border: 2px solid #ff7a2a; box-shadow: 0 0 6px #ff7a2a; }
  .sw-aveng { width: 16px; height: 16px; border-radius: 50%; border: 1.5px solid var(--north); box-shadow: inset 0 0 0 3px var(--bg), inset 0 0 0 4.5px var(--north); }

  .bottom {
    position: fixed; left: 0; right: 0; bottom: 0; pointer-events: none;
    padding: 0 16px calc(env(safe-area-inset-bottom, 0px) + 16px);
  }
  .panel {
    pointer-events: auto; max-width: 720px; display: grid; gap: 12px;
    background: var(--surface); border: 1px solid var(--line); border-radius: 14px;
    padding: 14px 16px; backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
  }
  .cap-head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; font-size: 13px; }
  .seat-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--seat, var(--dim)); }
  .who { font-weight: 600; }
  .tok { font: 500 12.5px/1 var(--f-mono); padding: 4px 7px; border-radius: 5px; border: 1px solid var(--line); background: rgba(243, 233, 210, 0.06); }
  .tone { font: 500 10.5px/1 var(--f-mono); letter-spacing: 0.12em; text-transform: uppercase; padding: 4px 8px; border-radius: 999px; border: 1px solid currentColor; color: var(--dim); }
  .tone[data-tone="halo"] { color: var(--halo); }
  .tone[data-tone="evaporation"] { color: var(--evap); }
  .tone[data-tone="avenger"] { color: var(--north); }
  .tone[data-tone="grave"] { color: #ff9a5a; }
  #capText { font: 400 clamp(19px, 2.3vw, 25px)/1.28 var(--f-display); margin: 0; min-height: 2.56em; text-wrap: pretty; }
  #capText.lead { color: var(--dim); }

  .chips { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; }
  .chip {
    width: 100%; position: relative; overflow: hidden; cursor: pointer; text-align: left;
    display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 4px 6px;
    padding: 7px 8px 9px; border-radius: 8px; border: 1px solid var(--line);
    background: transparent; color: var(--dim); font: 500 11px/1.2 var(--f-sans);
  }
  .chip .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--seat); }
  .chip .ctok { grid-column: 1 / -1; font: 500 11px/1 var(--f-mono); color: inherit; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .chip .bar { position: absolute; left: 0; bottom: 0; height: 2px; width: calc(var(--p, 0) * 100%); background: var(--focus); }
  .chip.past .bar { width: 100%; opacity: 0.3; }
  .chip[aria-current="step"] { border-color: var(--focus); color: var(--text); }
  .chip:hover { border-color: var(--dim); }

  .rows { display: flex; flex-wrap: wrap; gap: 8px 18px; align-items: center; }
  .controls { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .controls .lbl { font: 500 10.5px/1 var(--f-mono); letter-spacing: 0.12em; text-transform: uppercase; color: var(--dim); margin-right: 2px; }
  .controls button {
    min-height: 36px; padding: 9px 14px; border-radius: 999px; cursor: pointer;
    font: 500 13px/1 var(--f-sans); color: var(--text); background: transparent; border: 1px solid var(--line);
  }
  .controls button:hover { border-color: var(--dim); }
  .controls button.primary { background: var(--text); color: var(--bg); border-color: var(--text); min-width: 76px; }
  .controls button[aria-pressed="true"] { border-color: var(--focus); }
  .controls.light button[aria-pressed="true"] { background: var(--focus); color: var(--bg); }
  button:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }

  #nogl[hidden] { display: none; }
  #nogl { position: fixed; inset: 0; display: grid; place-items: center; padding: 16px; text-align: center; color: var(--dim); }

  @media (max-width: 760px) {
    .legend, .lede { display: none; }
    .chip .who { display: none; }
    .panel { padding: 12px; gap: 10px; }
  }
</style>
</head>
<body>
<div id="stage" aria-label="3D replay of one Roto Chess round on a hilltop meadow"></div>
<div id="nogl" hidden>This prototype needs WebGL, which this browser has turned off.</div>

<header class="top">
  <div>
    <p class="eyebrow">Roto Chess · Meadow Cam prototype</p>
    <h1>Round 12, on the hill</h1>
    <p class="lede">The same scripted round, fought on a stone ring in a mountain meadow. Sunlight finds each mover; every rule event is drawn in the scene.</p>
  </div>
  <dl class="legend" aria-label="Key">
    <div><dt><span class="sw-curtain"></span></dt><dd><b>Meridian banner.</b> Cross your own unhaloed and you evaporate.</dd></div>
    <div><dt><span class="sw-halo"></span></dt><dd><b>Halo.</b> Earned by a capture; opens the meridian for good.</dd></div>
    <div><dt><span class="sw-evap"></span></dt><dd><b>Evaporation.</b> The move completes, then the piece is dust on the wind.</dd></div>
    <div><dt><span class="sw-grave"></span></dt><dd><b>Grave.</b> An unmoved piece fell at home. Its owner may avenge on their very next turn.</dd></div>
    <div><dt><span class="sw-aveng"></span></dt><dd><b>Avenger.</b> The banner tears; the crossing is penalty-free.</dd></div>
  </dl>
</header>

<div class="bottom">
  <section class="panel" aria-label="Replay">
    <div aria-live="polite">
      <div class="cap-head">
        <span class="seat-dot" id="capDot"></span>
        <span class="who" id="capWho">North</span>
        <span class="tok" id="capNote">RA32-A28</span>
        <span class="tone" id="capTone">Move</span>
      </div>
      <p id="capText" class="lead">Loading the board…</p>
    </div>
    <ol class="chips" id="chips" aria-label="Turns in this round"></ol>
    <div class="rows">
      <div class="controls" role="group" aria-label="Playback">
        <button id="bRestart" type="button">Restart</button>
        <button id="bPrev" type="button">‹ Prev</button>
        <button id="bPlay" type="button" class="primary">Pause</button>
        <button id="bNext" type="button">Next ›</button>
        <button id="bSlow" type="button" aria-pressed="false">Slow-mo</button>
      </div>
      <div class="controls light" role="group" aria-label="Light">
        <span class="lbl">Light</span>
        <button type="button" data-light="noon" aria-pressed="false">Noon</button>
        <button type="button" data-light="golden" aria-pressed="true">Golden hour</button>
        <button type="button" data-light="storm" aria-pressed="false">Storm-break</button>
      </div>
    </div>
  </section>
</div>

<script type="importmap">
{ "imports": {
  "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
  "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"
} }
</script>
<script type="module">
/*PARTS*/
</script>
</body>
</html>
EOF
python -I "$W/build.py"
```
Expected: `built NNNNN bytes from ['00-core.js', '10-renderer.js', '40-board.js', '50-banners.js', '60-pieces.js', '70-fx.js', '80-rig.js', '90-hud-player.js']`.

- [ ] **Step 4: Add the dev-server launch configuration** (keep the existing `orrery-prototype` entry untouched)

```bash
python -I - <<'EOF'
import json, pathlib
p = pathlib.Path(r"C:\Users\ahlev\OneDrive\Desktop\CLAUDE\Roto Chess\.claude\launch.json")
cfg = json.loads(p.read_text(encoding="utf-8"))
cfg["configurations"] = [c for c in cfg["configurations"] if c["name"] != "meadow-cam"]
cfg["configurations"].append({
  "name": "meadow-cam",
  "runtimeExecutable": "python",
  "runtimeArgs": ["-m", "http.server", "8792", "--bind", "127.0.0.1", "--directory",
    "C:/Users/ahlev/AppData/Local/Temp/claude/C--Users-ahlev--claude-spares-spare-QbPeZi/65ffc00d-391d-4fd8-8049-1729cc327f11/scratchpad/meadow-cam"],
  "port": 8792, "autoPort": False
})
p.write_text(json.dumps(cfg, indent=2), encoding="utf-8")
print([c["name"] for c in cfg["configurations"]])
EOF
```
Expected: `['orrery-prototype', 'meadow-cam']`.

- [ ] **Step 5: Run it and take the baseline trace**

Use `mcp__Claude_Browser__preview_start` with `name: "meadow-cam"`, then `navigate` to `http://127.0.0.1:8792/meadow-cam.html`. Wait 3 s, `read_console_messages` with `onlyErrors: true` → expect no errors. Then `javascript_tool`:

```js
JSON.stringify(window.orreryTraceAll().map(t => t.camDegPerSec))
```
Expected: five numbers each within ±15 % of `[71, 106, 214, 112, 96]` (the numbers may differ slightly from the memory note because the trace is deterministic only up to random shard velocities, which don't affect the camera; treat ≥ 15 % deviation as a split error and re-check Step 2 ranges). Record the actual numbers in `tasks/todo.md` under the Meadow Cam section as `baseline trace: …`.

- [ ] **Step 6: Tick** "Copy v4 source → meadow-cam.html" in `tasks/todo.md`.

---

### Task 2: Renderer, sunlight presets, sky dome, sun shaft, Light control

**Files:**
- Replace: `$W/parts/10-renderer.js`
- Create: `$W/parts/20-light.js`
- Modify: `$W/parts/90-hud-player.js` (frame-loop hooks)

**Interfaces:**
- Consumes from 00: `polar`, `D2R`, `hdr`.
- Produces: `hemi`, `key`, `fill`, `moverLight`, `sky`, `PRESETS`, `light`, `setLight(name)`, `applyLight(s)`, `updateLight(dt)`, `updateShaft(dt, focus, s)`. `cloudMat` (Task 3) is consumed by `applyLight` only when defined, so this task runs first.

- [ ] **Step 1: Write the renderer part**

```bash
cat > "$W/parts/10-renderer.js" <<'EOF'
// ---------------------------------------------------------------------------
// Renderer, camera, post
// ---------------------------------------------------------------------------
const stage = document.getElementById("stage");
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
} catch (err) {
  document.getElementById("nogl").hidden = false;
  throw err;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color("#e9c9a0");
scene.fog = new THREE.FogExp2("#e9c9a0", 0.006);
const camera = new THREE.PerspectiveCamera(42, 1, 0.03, 600);
{ // Soft studio reflections for lacquer, steel and marble.
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
}

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.3, 0.4, 1.25));
composer.addPass(new OutputPass());

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.fov = w < h ? 60 : 42;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);
resize();

// Daylight: sky/ground hemisphere, the sun (shadow caster), a cool sky fill, and the mover's seat-colored glow.
const hemi = new THREE.HemisphereLight("#ffd9a8", "#4e5d2a", 0.5);
scene.add(hemi);
const key = new THREE.DirectionalLight("#ffb15e", 2.2);
key.castShadow = true;
key.shadow.mapSize.set(4096, 4096);
Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 40 });
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.02;
scene.add(key);
scene.add(key.target);
const fill = new THREE.DirectionalLight("#9fc3ff", 0.35);
fill.position.set(-4, 3, -3);
scene.add(fill);
const moverLight = new THREE.PointLight("#ffffff", 0, 2, 2);
scene.add(moverLight);
EOF
```

- [ ] **Step 2: Write the light part (presets, tween, sky dome, sun shaft, HUD binding)**

```bash
cat > "$W/parts/20-light.js" <<'EOF'
// ---------------------------------------------------------------------------
// Sunlight — three presets tweened over 2 s, the sky dome, and a sun shaft that
// stands over whatever the camera is focused on (the mover, then its landing square).
// ---------------------------------------------------------------------------
const sunDir = (az, el) => polar(az, Math.cos(D2R(el)), Math.sin(D2R(el))).normalize();
const PRESETS = {
  noon:   { sun: sunDir(180, 66), sunColor: "#fff3dc", sunInt: 2.4, hemiSky: "#cfe4ff", hemiGround: "#60783a", hemiInt: 0.6,
            zenith: "#2f6fd0", horizon: "#dbe9f5", glow: 0.5, fog: "#d6e4f0", fogDensity: 0.0045, exposure: 1.0,
            cloud: "#ffffff", cloudOpacity: 0.55, shaft: 0.22, shaftColor: "#fff1cc", spot: 0.5 },
  golden: { sun: sunDir(245, 16), sunColor: "#ffb15e", sunInt: 2.2, hemiSky: "#ffd9a8", hemiGround: "#4e5d2a", hemiInt: 0.5,
            zenith: "#2c5cb0", horizon: "#ffc987", glow: 1.0, fog: "#e9c9a0", fogDensity: 0.006, exposure: 1.05,
            cloud: "#ffd9b0", cloudOpacity: 0.75, shaft: 0.4, shaftColor: "#ffd08a", spot: 0.9 },
  storm:  { sun: sunDir(230, 28), sunColor: "#d8e2ee", sunInt: 0.7, hemiSky: "#6e7d8e", hemiGround: "#2a3326", hemiInt: 0.35,
            zenith: "#3a4551", horizon: "#7a8692", glow: 0.15, fog: "#6d7883", fogDensity: 0.012, exposure: 0.9,
            cloud: "#4a5560", cloudOpacity: 1.0, shaft: 1.0, shaftColor: "#fff4d6", spot: 4.0 },
};
const LIGHT_COLORS = ["sunColor", "hemiSky", "hemiGround", "zenith", "horizon", "fog", "cloud", "shaftColor"];
const LIGHT_NUMS = ["sunInt", "hemiInt", "glow", "fogDensity", "exposure", "cloudOpacity", "shaft", "spot"];
function lightState(src) {
  const o = { sun: src.sun.clone() };
  for (const k of LIGHT_COLORS) o[k] = src[k] instanceof THREE.Color ? src[k].clone() : new THREE.Color(src[k]);
  for (const k of LIGHT_NUMS) o[k] = src[k];
  return o;
}
const light = { name: "golden", cur: lightState(PRESETS.golden), from: null, to: null, t: 1 };
function setLight(name) {
  if (!PRESETS[name] || name === light.name) return;
  light.name = name;
  light.from = lightState(light.cur);
  light.to = lightState(PRESETS[name]);
  light.t = 0;
  for (const b of document.querySelectorAll("[data-light]")) b.setAttribute("aria-pressed", String(b.dataset.light === name));
}
function updateLight(dt) {
  if (light.t < 1) {
    light.t = Math.min(1, light.t + dt / 2);
    const e = THREE.MathUtils.smootherstep(light.t, 0, 1), c = light.cur, a = light.from, b = light.to;
    c.sun.lerpVectors(a.sun, b.sun, e).normalize();
    for (const k of LIGHT_COLORS) c[k].lerpColors(a[k], b[k], e);
    for (const k of LIGHT_NUMS) c[k] = a[k] + (b[k] - a[k]) * e;
  }
  applyLight(light.cur);
}
for (const b of document.querySelectorAll("[data-light]")) b.addEventListener("click", () => setLight(b.dataset.light));

// Sky dome with a sun disc and glow at the preset's sun direction.
const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 48, 24), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false,
  uniforms: {
    uZenith: { value: new THREE.Color("#2c5cb0") }, uHorizon: { value: new THREE.Color("#ffc987") },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunColor: { value: new THREE.Color("#ffb15e") }, uGlow: { value: 1 },
  },
  vertexShader: `varying vec3 vP; void main() { vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform vec3 uZenith, uHorizon, uSunDir, uSunColor; uniform float uGlow; varying vec3 vP;
  void main() {
    float h = vP.y;
    vec3 c = h < 0.0 ? mix(uHorizon, uHorizon * 0.55, smoothstep(0.0, -0.4, h)) : mix(uHorizon, uZenith, pow(smoothstep(0.0, 0.6, h), 0.7));
    float cosA = dot(vP, uSunDir);
    float disc = smoothstep(0.9993, 0.9997, cosA);
    float glow = pow(max(cosA, 0.0), 24.0) * uGlow + pow(max(cosA, 0.0), 4.0) * uGlow * 0.25;
    c += uSunColor * (disc * 4.0 + glow);
    gl_FragColor = vec4(c, 1.0);
  }`,
}));
sky.renderOrder = -1;
scene.add(sky);

// Sun shaft: an open cone of light aligned with the sun, a pool on the ground, and a spot that lifts the mover.
const shaftVS = `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main() { vUv = uv; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
const shaftFS = `uniform vec3 uColor; uniform float uK; uniform float uTime; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main() {
  float face = abs(dot(normalize(vN), normalize(vV)));
  float core = pow(face, 1.8);
  float band = 0.85 + 0.15 * sin(vUv.x * 31.0 + uTime * 0.4) * sin(vUv.y * 7.0 - uTime * 0.3);
  float a = uK * core * band * smoothstep(0.0, 0.12, vUv.y) * mix(0.55, 1.0, vUv.y);
  gl_FragColor = vec4(uColor * a, a);
}`;
const poolFS = `uniform vec3 uColor; uniform float uK; varying vec2 vUv;
void main() { float r = length(vUv - 0.5) * 2.0; float a = uK * 0.9 * pow(max(0.0, 1.0 - r), 2.0); gl_FragColor = vec4(uColor * a, a); }`;
const shaftMat = new THREE.ShaderMaterial({ uniforms: { uColor: { value: new THREE.Color("#ffd08a") }, uK: { value: 0 }, uTime: { value: 0 } },
  vertexShader: shaftVS, fragmentShader: shaftFS, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
const poolMat = new THREE.ShaderMaterial({ uniforms: { uColor: shaftMat.uniforms.uColor, uK: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: poolFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
const shaftBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.46, 4.0, 48, 1, true), shaftMat);
const shaftPool = new THREE.Mesh(new THREE.CircleGeometry(0.42, 48).rotateX(-Math.PI / 2), poolMat);
shaftBeam.renderOrder = 3; shaftPool.renderOrder = 3;
shaftBeam.visible = shaftPool.visible = false;
scene.add(shaftBeam, shaftPool);
const shaftSpot = new THREE.SpotLight("#ffffff", 0, 9, 0.28, 0.7, 1);
scene.add(shaftSpot, shaftSpot.target);
const shaft = { k: 0, pos: new THREE.Vector3(), time: 0 };
const UP_Y = new THREE.Vector3(0, 1, 0);
function updateShaft(dt, focus, s) {
  shaft.time += dt;
  const want = focus ? s.shaft : 0;
  shaft.k += (want - shaft.k) * Math.min(1, dt * 2.2);
  if (focus) shaft.pos.lerp(focus, 1 - Math.exp(-6 * dt));
  const gx = shaft.pos.x, gz = shaft.pos.z, d = s.sun;
  shaftBeam.quaternion.setFromUnitVectors(UP_Y, d);
  shaftBeam.position.set(gx, 0, gz).addScaledVector(d, 2.0);
  shaftPool.position.set(gx, 0.012, gz);
  shaftMat.uniforms.uK.value = shaft.k;
  shaftMat.uniforms.uTime.value = shaft.time;
  poolMat.uniforms.uK.value = shaft.k;
  shaftBeam.visible = shaftPool.visible = shaft.k > 0.003;
  shaftSpot.position.set(gx, 0, gz).addScaledVector(d, 4.0);
  shaftSpot.target.position.set(gx, 0, gz);
  shaftSpot.color.copy(s.shaftColor);
  shaftSpot.intensity = s.spot * shaft.k;
}

function applyLight(s) {
  key.position.copy(s.sun).multiplyScalar(12);
  key.color.copy(s.sunColor);
  key.intensity = s.sunInt;
  hemi.color.copy(s.hemiSky);
  hemi.groundColor.copy(s.hemiGround);
  hemi.intensity = s.hemiInt;
  scene.fog.color.copy(s.fog);
  scene.fog.density = s.fogDensity;
  scene.background.copy(s.fog);
  renderer.toneMappingExposure = s.exposure;
  const u = sky.material.uniforms;
  u.uZenith.value.copy(s.zenith); u.uHorizon.value.copy(s.horizon); u.uSunDir.value.copy(s.sun); u.uSunColor.value.copy(s.sunColor); u.uGlow.value = s.glow;
  shaftMat.uniforms.uColor.value.copy(s.shaftColor);
  if (typeof cloudMat !== "undefined") { cloudMat.opacity = s.cloudOpacity; cloudMat.color.copy(s.cloud); }
}
EOF
```

- [ ] **Step 3: Hook the light and shaft into the frame loop and start-up**

```bash
python -I - <<'EOF'
import sys; sys.path.insert(0, "/c/Users/ahlev/AppData/Local/Temp/claude/C--Users-ahlev--claude-spares-spare-QbPeZi/65ffc00d-391d-4fd8-8049-1729cc327f11/scratchpad/meadow-cam")
from rep import rep
P = "/c/Users/ahlev/AppData/Local/Temp/claude/C--Users-ahlev--claude-spares-spare-QbPeZi/65ffc00d-391d-4fd8-8049-1729cc327f11/scratchpad/meadow-cam/parts/90-hud-player.js"
rep(P, "  for (const c of Object.values(curtains)) c.uniforms.uTime.value = time;\n",
       "  for (const c of Object.values(curtains)) c.uniforms.uTime.value = time;\n  updateLight(dt);\n")
rep(P, "  camera.lookAt(cam.look);\n", "  camera.lookAt(cam.look);\n  updateShaft(dt, view.focus, light.cur);\n")
rep(P, "play(0);\nsetPlaying(player.playing);", "applyLight(light.cur);\nplay(0);\nsetPlaying(player.playing);")
EOF
python -I "$W/build.py"
```

- [ ] **Step 4: Verify in the browser**

Reload `http://127.0.0.1:8792/meadow-cam.html`. Expect: blue sky with a low amber sun, the v4 wooden board and sprite pieces lit warm, a soft light cone standing over the mover during its turn and fading on the settle. `read_console_messages onlyErrors:true` → none. Click each Light button: sky, fog and sun change over about two seconds with no pop; Storm-break darkens everything but the mover under its cone. One screenshot per preset.

- [ ] **Step 5: Tick** "Sun shaft … + Light presets" in `tasks/todo.md`.

---

### Task 3: Landscape — mountains, meadow, grass, flowers, trees, clouds

**Files:**
- Create: `$W/parts/30-world.js`
- Modify: `$W/parts/90-hud-player.js` (call `updateWorld`)

**Interfaces:**
- Consumes: `scene`, `polar`, `D2R`, `THREE`.
- Produces: `canvasTexture(size, paint, repeat)`, `speckle(g, size, n, color, rmin, rmax)`, `veins(g, size, n, color, width)`, `rnd(a, b)`, `groundY(x, z)`, `cloudMat`, `updateWorld(dt, time)`.

- [ ] **Step 1: Write the world part**

```bash
cat > "$W/parts/30-world.js" <<'EOF'
// ---------------------------------------------------------------------------
// The hill: painted canvas textures, a ring of mountains, a domed meadow with
// swaying grass and flowers, a stand of trees up-sun, and drifting clouds.
// ---------------------------------------------------------------------------
const rnd = (a, b) => a + Math.random() * (b - a);
function canvasTexture(size, paint, repeat) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  paint(c.getContext("2d"), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function speckle(g, size, n, color, rmin, rmax) {
  g.fillStyle = color;
  for (let i = 0; i < n; i++) { g.beginPath(); g.arc(rnd(0, size), rnd(0, size), rnd(rmin, rmax), 0, Math.PI * 2); g.fill(); }
}
function veins(g, size, n, color, width) {
  g.strokeStyle = color;
  for (let i = 0; i < n; i++) {
    g.lineWidth = rnd(width * 0.4, width);
    g.beginPath();
    let x = rnd(0, size), y = rnd(0, size);
    g.moveTo(x, y);
    for (let k = 0; k < 5; k++) { const cx = x + rnd(-120, 120), cy = y + rnd(-120, 120); x += rnd(-160, 160); y += rnd(-160, 160); g.quadraticCurveTo(cx, cy, x, y); }
    g.stroke();
  }
}
const grassTex = canvasTexture(512, (g, s) => {
  g.fillStyle = "#587f33"; g.fillRect(0, 0, s, s);
  speckle(g, s, 500, "rgba(120,160,60,0.35)", 6, 26);
  speckle(g, s, 500, "rgba(50,80,30,0.35)", 6, 24);
  speckle(g, s, 2000, "rgba(170,190,80,0.25)", 0.5, 2);
}, 40);

// Ground height: flat under the board, then a gentle dome that rolls away.
function groundY(x, z) {
  const r = Math.hypot(x, z);
  const roll = Math.sin(x * 0.35 + 1.3) * Math.sin(z * 0.29 - 0.7) * 0.35 + Math.sin(x * 0.11) * Math.cos(z * 0.13) * 0.6;
  return -0.2 - r * r * 0.00012 + roll * THREE.MathUtils.smoothstep(r, 3.2, 9);
}
{ // Meadow
  const g = new THREE.PlaneGeometry(320, 320, 120, 120);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, groundY(p.getX(i), p.getZ(i)));
  g.computeVertexNormals();
  const meadow = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 }));
  meadow.receiveShadow = true;
  scene.add(meadow);
}

// Mountains: a jagged ring strip with per-vertex rock/snow color, flat shaded.
function mountainRing(radius, baseY, hMin, hMax, seed, rock, snow, snowFrom, segs = 180) {
  const pos = [], col = [];
  const rockC = new THREE.Color(rock), snowC = new THREE.Color(snow), c = new THREE.Color();
  const height = (i) => {
    const a = (i / segs) * Math.PI * 2;
    const n = Math.sin(a * 3 + seed) * 0.5 + Math.sin(a * 7.3 + seed * 1.7) * 0.3 + Math.sin(a * 17.1 + seed * 2.3) * 0.15 + Math.sin(a * 41 + seed) * 0.05;
    return hMin + (hMax - hMin) * (0.5 + 0.5 * n);
  };
  const push = (v, h) => { pos.push(v.x, v.y, v.z); c.copy(rockC).lerp(snowC, THREE.MathUtils.smoothstep(h, snowFrom, snowFrom + 4)); col.push(c.r, c.g, c.b); };
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * 360, a1 = ((i + 1) / segs) * 360, half = 180 / segs;
    const b0 = polar(a0, radius, baseY), b1 = polar(a1, radius, baseY);
    const p0 = polar(a0 + half, radius * 0.97, baseY + height(i)), p1 = polar(a1 + half, radius * 0.97, baseY + height(i + 1));
    push(b0, 0); push(b1, 0); push(p0, height(i));
    push(p0, height(i)); push(b1, 0); push(p1, height(i + 1));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
  scene.add(m);
  return m;
}
mountainRing(170, -6, 14, 46, 1.0, "#5b6878", "#eef2f7", 26);
mountainRing(112, -6, 6, 24, 4.2, "#55684a", "#e6ebe9", 17);
mountainRing(62, -6, 1.5, 4.5, 2.7, "#2d4b2b", "#3b6334", 99, 240); // forest band: never snows

// Grass: instanced tapered blades that sway in the vertex shader.
const GRASS_N = 7000;
const bladeGeo = new THREE.PlaneGeometry(0.035, 0.26, 1, 3);
bladeGeo.translate(0, 0.13, 0);
{ const p = bladeGeo.attributes.position; for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) * (1 - (p.getY(i) / 0.26) * 0.85)); }
const grassTime = { value: 0 };
const grassMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.9, side: THREE.DoubleSide });
grassMat.onBeforeCompile = (sh) => {
  sh.uniforms.uTime = grassTime;
  sh.vertexShader = sh.vertexShader
    .replace("#include <common>", "#include <common>\nuniform float uTime;")
    .replace("#include <begin_vertex>", `#include <begin_vertex>
      vec3 iw = vec3(instanceMatrix[3].x, 0.0, instanceMatrix[3].z);
      float sway = sin(uTime * 1.4 + iw.x * 1.9 + iw.z * 1.3) * 0.5 + sin(uTime * 2.3 + iw.x * 3.1) * 0.25;
      float hgt = clamp(position.y / 0.26, 0.0, 1.0);
      transformed.x += sway * 0.07 * hgt * hgt;`);
};
{
  const grass = new THREE.InstancedMesh(bladeGeo, grassMat, GRASS_N);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), E = new THREE.Euler();
  const lo = new THREE.Color("#4f7a2e"), hi = new THREE.Color("#9ab84a"), c = new THREE.Color();
  for (let i = 0; i < GRASS_N; i++) {
    const r = 3.3 + Math.pow(Math.random(), 0.7) * 12, a = Math.random() * 360;
    P.copy(polar(a, r, 0)); P.y = groundY(P.x, P.z);
    Q.setFromEuler(E.set(0, Math.random() * Math.PI, 0));
    S.setScalar(0.8 + Math.random() * 0.7);
    grass.setMatrixAt(i, M.compose(P, Q, S));
    grass.setColorAt(i, c.copy(lo).lerp(hi, Math.random()));
  }
  grass.receiveShadow = true;
  scene.add(grass);

  const flowers = new THREE.InstancedMesh(new THREE.SphereGeometry(0.022, 6, 5), new THREE.MeshStandardMaterial({ roughness: 0.8 }), 700);
  const petals = ["#f4e04d", "#f7f3e8", "#b388eb", "#f2a0b7"].map((h) => new THREE.Color(h));
  for (let i = 0; i < 700; i++) {
    const r = 3.4 + Math.pow(Math.random(), 0.8) * 10, a = Math.random() * 360;
    P.copy(polar(a, r, 0)); P.y = groundY(P.x, P.z) + 0.14 + Math.random() * 0.06;
    Q.identity(); S.setScalar(0.7 + Math.random() * 0.6);
    flowers.setMatrixAt(i, M.compose(P, Q, S));
    flowers.setColorAt(i, petals[i % 4]);
  }
  scene.add(flowers);
}

// Trees on the up-sun side so the low sun lays their shadows across the board.
{
  const trunkMat = new THREE.MeshStandardMaterial({ color: "#5a4030", roughness: 1 });
  const leafMats = ["#3f7a2d", "#4f8f36", "#6aa042"].map((h) => new THREE.MeshStandardMaterial({ color: h, roughness: 0.95, flatShading: true }));
  const canopyGeo = new THREE.DodecahedronGeometry(1, 1);
  for (let i = 0; i < 11; i++) {
    const az = 215 + Math.random() * 70, r = 4.0 + Math.random() * 2.6, s = 0.8 + Math.random() * 0.6;
    const base = polar(az, r, 0); base.y = groundY(base.x, base.z);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * s, 0.1 * s, 1.1 * s, 8), trunkMat);
    trunk.position.copy(base); trunk.position.y += 0.55 * s; trunk.castShadow = true;
    scene.add(trunk);
    for (let k = 0; k < 3; k++) {
      const m = new THREE.Mesh(canopyGeo, leafMats[(i + k) % 3]);
      m.scale.setScalar((0.55 - k * 0.1) * s);
      m.position.copy(base).add(new THREE.Vector3((Math.random() - 0.5) * 0.4 * s, (1.1 + k * 0.42) * s, (Math.random() - 0.5) * 0.4 * s));
      m.castShadow = true;
      scene.add(m);
    }
  }
}

// Clouds: soft sprites far out, drifting slowly around the hill.
function cloudTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const g = c.getContext("2d");
  for (const [x, y, r] of [[128, 150, 70], [80, 160, 55], [180, 160, 55], [110, 110, 50], [160, 120, 45]]) {
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, "rgba(255,255,255,0.9)"); grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  }
  return new THREE.CanvasTexture(c);
}
const cloudMat = new THREE.SpriteMaterial({ map: cloudTexture(), transparent: true, depthWrite: false, fog: false, opacity: 0.75 });
const clouds = [];
for (let i = 0; i < 14; i++) {
  const s = new THREE.Sprite(cloudMat);
  const az = Math.random() * 360, r = 70 + Math.random() * 90, y = 28 + Math.random() * 22;
  s.position.copy(polar(az, r, y));
  s.scale.set(40 + Math.random() * 30, 16 + Math.random() * 10, 1);
  s.userData = { az, r, y, speed: 0.15 + Math.random() * 0.2 };
  scene.add(s);
  clouds.push(s);
}
function updateWorld(dt, time) {
  grassTime.value = time;
  for (const c of clouds) { c.userData.az += dt * c.userData.speed; c.position.copy(polar(c.userData.az, c.userData.r, c.userData.y)); }
}
EOF
```

- [ ] **Step 2: Call `updateWorld` from the frame loop**

```bash
python -I - <<'EOF'
import sys; sys.path.insert(0, "/c/Users/ahlev/AppData/Local/Temp/claude/C--Users-ahlev--claude-spares-spare-QbPeZi/65ffc00d-391d-4fd8-8049-1729cc327f11/scratchpad/meadow-cam")
from rep import rep
P = "/c/Users/ahlev/AppData/Local/Temp/claude/C--Users-ahlev--claude-spares-spare-QbPeZi/65ffc00d-391d-4fd8-8049-1729cc327f11/scratchpad/meadow-cam/parts/90-hud-player.js"
rep(P, "  updateLight(dt);\n", "  updateLight(dt);\n  updateWorld(dt, time);\n")
EOF
python -I "$W/build.py"
```

- [ ] **Step 3: Verify in the browser**

Reload. Expect: green meadow with swaying grass and specks of flowers around the ring, snow-capped mountains on the horizon, a forest band, a clump of trees to the west-south-west casting long shadows toward the board in Golden hour, slow clouds. No console errors. Frame rate stays smooth (if the page stutters, lower `GRASS_N` to 4000 and note it in the todo). Screenshot from the overview pose (`window.orreryReview(0, 0.1)`).

- [ ] **Step 4: Tick** "Sky dome + sun disc, mountains, meadow grass, trees, clouds" in `tasks/todo.md`.

---

### Task 4: Board — stone slab, marble and slate squares, iron rails, sundial, jasper meridians

**Files:**
- Replace: `$W/parts/40-board.js` (drops v4's stars, planets, armillary)
- Modify: `$W/parts/90-hud-player.js` (remove `armRings` / `planets` updates)

**Interfaces:**
- Consumes: `scene`, `polar`, `D2R`, `U`, `SECTOR`, `meridianDeg`, `SEAT_BRIGHT`, `mergeGeometries`, `canvasTexture`, `speckle`, `veins`.
- Produces: `graniteMat`, `marbleMat`, `slateMat`, `ironMat`, `bronzeMat`, `seatDots`, `setActiveSeat(seat)` (same signature v4's rig calls).

- [ ] **Step 1: Write the board part**

```bash
cat > "$W/parts/40-board.js" <<'EOF'
// ---------------------------------------------------------------------------
// The stone ring — granite slab, marble and slate squares, iron rails with
// bronze studs, inlaid jasper meridians, and a sundial at the centre.
// ---------------------------------------------------------------------------
const marbleTex = canvasTexture(512, (g, s) => {
  g.fillStyle = "#efe7d6"; g.fillRect(0, 0, s, s);
  speckle(g, s, 900, "rgba(190,175,150,0.25)", 0.5, 2);
  veins(g, s, 26, "rgba(120,105,90,0.28)", 2.2);
  veins(g, s, 12, "rgba(255,255,255,0.5)", 1.2);
}, 3);
const slateTex = canvasTexture(512, (g, s) => {
  g.fillStyle = "#646a70"; g.fillRect(0, 0, s, s);
  speckle(g, s, 1400, "rgba(40,44,50,0.35)", 0.5, 2.5);
  speckle(g, s, 600, "rgba(170,178,186,0.25)", 0.5, 1.5);
  veins(g, s, 10, "rgba(30,34,40,0.35)", 1.5);
}, 3);
const graniteTex = canvasTexture(512, (g, s) => {
  g.fillStyle = "#8b8578"; g.fillRect(0, 0, s, s);
  speckle(g, s, 2500, "rgba(50,46,40,0.45)", 0.4, 1.8);
  speckle(g, s, 1200, "rgba(230,225,210,0.4)", 0.4, 1.4);
  speckle(g, s, 300, "rgba(140,120,80,0.35)", 1, 3);
}, 6);
const graniteMat = new THREE.MeshStandardMaterial({ map: graniteTex, roughness: 0.85 });
const marbleMat = new THREE.MeshStandardMaterial({ map: marbleTex, roughness: 0.28, envMapIntensity: 0.6 });
const slateMat = new THREE.MeshStandardMaterial({ map: slateTex, roughness: 0.6, envMapIntensity: 0.3 });
const ironMat = new THREE.MeshStandardMaterial({ color: "#2c2d31", metalness: 0.85, roughness: 0.45, envMapIntensity: 0.6 });
const bronzeMat = new THREE.MeshStandardMaterial({ color: "#8c6a2e", metalness: 1.0, roughness: 0.35, envMapIntensity: 1.0 });
const jasperMat = new THREE.MeshStandardMaterial({ color: "#8e1f17", emissive: "#c0321e", emissiveIntensity: 0.55, roughness: 0.35 });

{ // Slab
  const shape = new THREE.Shape();
  shape.absarc(0, 0, 2.92, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, 1.08, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 3, curveSegments: 128 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, -0.19, 0);
  const slab = new THREE.Mesh(g, graniteMat);
  slab.receiveShadow = true;
  slab.castShadow = true;
  scene.add(slab);

  // Squares: marble on the light checks, slate on the dark.
  const light = [], dark = [];
  for (let rank = 0; rank < 32; rank++) {
    for (let file = 0; file < 4; file++) {
      const r0 = (120 + file * 40) * U;
      const sq = new THREE.RingGeometry(r0, r0 + 0.4, 6, 1, D2R(90 - (rank + 1) * SECTOR), D2R(SECTOR));
      sq.rotateX(-Math.PI / 2);
      ((rank + file) % 2 ? dark : light).push(sq);
    }
  }
  for (const [geos, mat] of [[light, marbleMat], [dark, slateMat]]) {
    const m = new THREE.Mesh(mergeGeometries(geos), mat);
    m.receiveShadow = true;
    scene.add(m);
  }

  // Mossy joints between the stones.
  const pts = [];
  for (const r of [1.2, 1.6, 2.0, 2.4, 2.8]) {
    for (let i = 0; i < 128; i++) pts.push(polar((i / 128) * 360, r, 0.002), polar(((i + 1) / 128) * 360, r, 0.002));
  }
  for (let k = 0; k < 32; k++) pts.push(polar(k * SECTOR, 1.2, 0.002), polar(k * SECTOR, 2.8, 0.002));
  scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color: "#4f6b3a", transparent: true, opacity: 0.6 })));

  // Meridians: inlaid red jasper.
  for (const seat of [1, 2, 3, 4]) {
    const d = meridianDeg(seat);
    const strip = new THREE.PlaneGeometry(1.66, 0.034);
    strip.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(strip, jasperMat);
    m.position.copy(polar(d, 2.0, 0.004));
    m.rotation.y = D2R(90 - d);
    scene.add(m);
  }
}
// Iron rails with bronze studs.
for (const r of [1.2, 2.8]) {
  const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.016, 12, 200), ironMat);
  t.rotation.x = Math.PI / 2;
  t.position.y = 0.006;
  t.castShadow = true;
  scene.add(t);
  const studs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.02, 10, 8), bronzeMat, 48);
  const M = new THREE.Matrix4();
  for (let i = 0; i < 48; i++) studs.setMatrixAt(i, M.makeTranslation(...polar((i / 48) * 360, r, 0.014).toArray()));
  scene.add(studs);
}

// Sundial at the centre: stepped granite plinth, marble dial, iron gnomon whose shadow is the real sun's.
const seatDots = {};
{
  const add = (geo, mat, y) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; m.castShadow = m.receiveShadow = true; scene.add(m); return m; };
  add(new THREE.CylinderGeometry(0.56, 0.62, 0.08, 40), graniteMat, 0.04);
  add(new THREE.CylinderGeometry(0.42, 0.46, 0.06, 40), graniteMat, 0.11);
  add(new THREE.CylinderGeometry(0.36, 0.37, 0.03, 48), marbleMat, 0.155);
  for (let i = 0; i < 12; i++) {
    const tick = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.004, 0.05), ironMat);
    tick.position.copy(polar(i * 30, 0.3, 0.172));
    tick.rotation.y = D2R(-i * 30);
    scene.add(tick);
  }
  const tri = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0.28, 0), new THREE.Vector2(0, 0.2)]);
  const gn = new THREE.ExtrudeGeometry(tri, { depth: 0.012, bevelEnabled: false });
  gn.translate(0, 0.17, -0.006);
  gn.rotateY(Math.PI / 2); // base points North
  const gnomon = new THREE.Mesh(gn, ironMat);
  gnomon.castShadow = true;
  scene.add(gnomon);
  // Turn-order bosses: bronze, lit in the seat colour when it is that seat's move.
  for (const seat of [1, 2, 3, 4]) {
    const mat = new THREE.MeshStandardMaterial({ color: "#8c6a2e", metalness: 1.0, roughness: 0.35, emissive: SEAT_BRIGHT[seat], emissiveIntensity: 0.15 });
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 10), mat);
    s.position.copy(polar(meridianDeg(seat), 0.5, 0.14));
    scene.add(s);
    seatDots[seat] = mat;
  }
}
function setActiveSeat(seat) {
  for (const s of [1, 2, 3, 4]) seatDots[s].emissiveIntensity = s === seat ? 2.4 : 0.15;
}
EOF
```

- [ ] **Step 2: Remove the orrery updates from the frame loop**

```bash
python -I - <<'EOF'
import sys; sys.path.insert(0, "/c/Users/ahlev/AppData/Local/Temp/claude/C--Users-ahlev--claude-spares-spare-QbPeZi/65ffc00d-391d-4fd8-8049-1729cc327f11/scratchpad/meadow-cam")
from rep import rep
P = "/c/Users/ahlev/AppData/Local/Temp/claude/C--Users-ahlev--claude-spares-spare-QbPeZi/65ffc00d-391d-4fd8-8049-1729cc327f11/scratchpad/meadow-cam/parts/90-hud-player.js"
rep(P, "  armRings[0].rotation.z += dt * 0.4;\n  armRings[1].rotation.y += dt * 0.25;\n  for (const pl of planets) pl.planet.position.copy(polar(pl.phase + time * pl.speed, pl.r, 0));\n", "")
EOF
python -I "$W/build.py"
```

- [ ] **Step 3: Verify in the browser**

Reload. Expect: veined cream marble and grey slate checks on a granite ring, dark iron rails with bronze studs, moss-green joints, red jasper meridians, a sundial in the centre whose gnomon shadow points away from the sun and swings when the Light preset changes, and the bronze boss of the mover's seat glowing. No console errors. Screenshot at `window.orreryReview(0, 2.5)` (shoulder view) and `window.orreryReview(0, 0.1)` (overview).

- [ ] **Step 4: Tick** "Stone/marble board materials, iron rails, sundial centre, jasper meridians" in `tasks/todo.md`.

---

### Task 5: Meridian banners and iron standards

**Files:**
- Replace: `$W/parts/50-banners.js`

**Interfaces:**
- Consumes: `scene`, `polar`, `D2R`, `meridianDeg`, `ironMat`, `bronzeMat`.
- Produces: `curtainVS` (used by the grave beam in Task 7), `curtains[seat]` ShaderMaterial with uniforms `uTime uFlare uShatter uHit uColor` (used by `onCross` and `resetTo` in the rig unchanged), `hitUv(point)`.

- [ ] **Step 1: Write the banners part**

```bash
cat > "$W/parts/50-banners.js" <<'EOF'
// ---------------------------------------------------------------------------
// Meridian banners — a red veil of light hanging from an iron crossbar on each
// meridian. Same uniforms and hooks as v4's curtains: flare on a crossing, tear for an Avenger.
// ---------------------------------------------------------------------------
const curtainVS = `varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const curtainFS = `uniform float uTime; uniform float uFlare; uniform float uShatter; uniform vec2 uHit; uniform vec3 uColor;
varying vec2 vUv;
void main() {
  // Hanging cloth: full at the crossbar (top), four forked tails at the hem (bottom), gently flapping.
  float hem = 0.16 * abs(sin(vUv.x * 12.566)) + 0.04;
  float cloth = smoothstep(hem - 0.03, hem + 0.03, vUv.y + 0.03 * sin(vUv.x * 21.0 + uTime * 1.6));
  float edge = smoothstep(0.0, 0.03, vUv.x) * smoothstep(1.0, 0.97, vUv.x);
  float body = mix(0.55, 1.0, vUv.y);
  float ripple = 0.75 + 0.25 * sin(vUv.x * 30.0 - uTime * 1.9 + sin(vUv.y * 6.0 + uTime) * 1.2);
  float a = cloth * edge * body * (0.26 + 0.14 * ripple);
  vec2 dd = (vUv - uHit) * vec2(1.7, 0.95);
  float r = length(dd);
  float flare = uFlare * (exp(-r * r * 70.0) * 1.1 + exp(-r * r * 9.0) * 0.12);
  float tear = uShatter * smoothstep(0.6, 0.0, r);
  a = a * (1.0 - tear) * (1.0 - 0.5 * uShatter) + flare;
  gl_FragColor = vec4(uColor * (1.0 + flare * 1.2) * a, a);
}`;
const curtains = {};
const standardGeo = new THREE.CylinderGeometry(0.011, 0.015, 1.0, 10);
const barGeo = new THREE.CylinderGeometry(0.007, 0.007, 1.82, 8).rotateZ(Math.PI / 2);
const finialGeo = new THREE.SphereGeometry(0.022, 12, 8);
for (const seat of [1, 2, 3, 4]) {
  const d = meridianDeg(seat);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uFlare: { value: 0 }, uShatter: { value: 0 }, uHit: { value: new THREE.Vector2(0.5, 0.3) }, uColor: { value: new THREE.Color(2.2, 0.35, 0.15) } },
    vertexShader: curtainVS, fragmentShader: curtainFS,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  });
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.95), mat);
  banner.position.copy(polar(d, 2.0, 0.475));
  banner.rotation.y = D2R(90 - d);
  banner.renderOrder = 2;
  scene.add(banner);
  curtains[seat] = mat;

  for (const r of [1.1, 2.9]) {
    const pole = new THREE.Mesh(standardGeo, ironMat);
    pole.position.copy(polar(d, r, 0.5));
    pole.castShadow = true;
    scene.add(pole);
    const finial = new THREE.Mesh(finialGeo, bronzeMat);
    finial.position.copy(polar(d, r, 1.02));
    scene.add(finial);
  }
  const bar = new THREE.Mesh(barGeo, ironMat);
  bar.position.copy(polar(d, 2.0, 0.985));
  bar.rotation.y = D2R(90 - d);
  bar.castShadow = true;
  scene.add(bar);
}
const hitUv = (p) => new THREE.Vector2(
  THREE.MathUtils.clamp((Math.hypot(p.x, p.z) - 1.15) / 1.7, 0, 1),
  THREE.MathUtils.clamp(p.y / 0.95, 0, 1),
);
EOF
python -I "$W/build.py"
```

- [ ] **Step 2: Verify in the browser**

Reload. Expect four red light banners hanging from iron crossbars between two poles on each meridian, with forked hems that flap. `window.orreryReview(1, 3.0)`: East's knight crossing its own meridian flares the banner at the crossing point. `window.orreryReview(4, 3.4)`: the Avenger tears the North banner, red shards fly, and it mends over the next seconds. In Noon the banners should still read; if they look washed out, raise `uColor` to `(2.8, 0.4, 0.18)` and note it in the todo. No console errors.

- [ ] **Step 3: Tick** the banner portion of "Re-skin rule events" in `tasks/todo.md` (edit the line to `… (banner curtains ✓, …)`).

---

### Task 6: Heraldic pieces (procedural), facing, per-kind halo height

**Files:**
- Replace: `$W/parts/60-pieces.js`
- Modify: `$W/parts/70-fx.js` (`igniteHalo` uses `haloY`), `$W/parts/80-rig.js` (`applyInstant`, `facing`, `makeRun`), `$W/parts/90-hud-player.js` (`play`, billboard loop)

**Interfaces:**
- Consumes: `scene`, `sqPos`, `hdr`, `mergeGeometries`, `wrapRad` (rig), `D2R`.
- Produces: `PAL[seat].cap` (used by `capture()` for shard colour), `PIECE_TOP`, `haloY(kind)`, `yawTo(dir)`, `makePiece(kind, seat, sq, halo)` → `{ kind, seat, group, token, haloMesh, fade, body, mats, wantYaw }`, `disposePiece(p)`, `setEmissive(p, color, k)`, `applyFade(p)`, `setOpacity(p, a)`. The rig keeps using `p.group`, `p.token`, `p.haloMesh`, `p.fade`, `p.seat`, `p.kind` exactly as v4 did.

- [ ] **Step 1: Write the pieces part**

```bash
cat > "$W/parts/60-pieces.js" <<'EOF'
// ---------------------------------------------------------------------------
// Pieces — four heraldic armies built from turned and extruded solids.
// Piece-local space: y up, +z is the piece's front, which faces the board centre.
// ---------------------------------------------------------------------------
const PAL = {
  1: { cap: "#c8261a", trim: "#d4a63a" },
  2: { cap: "#2f2822", trim: "#efe3cc" },
  3: { cap: "#2361cf", trim: "#d4a63a" },
  4: { cap: "#e8a41c", trim: "#efe3cc" },
};
const PIECE_TOP = { P: 0.22, R: 0.27, N: 0.31, B: 0.36, Q: 0.39, K: 0.44 };
const haloY = (kind) => PIECE_TOP[kind] + 0.035;
const haloGeo = new THREE.TorusGeometry(0.1, 0.01, 10, 64);
const yawTo = (dir) => Math.atan2(dir.x, dir.z); // rotation.y that points local +z along dir (xz plane)

// Geometry helpers. Each builder returns [{ geo, role }]; roles pick the army material.
const lathe = (pts, segs = 28) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), segs);
const at = (geo, x, y, z) => { geo.translate(x, y, z); return geo; };
const cyl = (rt, rb, h, y, segs = 20) => at(new THREE.CylinderGeometry(rt, rb, h, segs), 0, y, 0);
const ball = (r, y, x = 0, z = 0) => at(new THREE.SphereGeometry(r, 18, 12), x, y, z);
const box = (w, h, d, x, y, z) => at(new THREE.BoxGeometry(w, h, d), x, y, z);
const ringOf = (n, r, y, make, off = 0) => Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2 + off; return make(Math.sin(a) * r, y, Math.cos(a) * r, a); });
const extrude = (pts, depth, bevel = 0.006) => {
  const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 8 });
  g.translate(0, 0, -depth / 2);
  return g;
};
const BASE = () => lathe([[0, 0], [0.105, 0], [0.11, 0.014], [0.1, 0.03], [0.082, 0.05]]);
const KITE = [[0, 0.05], [0.032, 0.025], [0.026, -0.03], [0, -0.052], [-0.026, -0.03], [-0.032, 0.025]];

const BUILD = {
  P: () => [ // footman
    { geo: BASE(), role: "dark" },
    { geo: lathe([[0.06, 0.05], [0.064, 0.09], [0.052, 0.14], [0.044, 0.155]]), role: "livery" },
    { geo: ball(0.036, 0.185), role: "steel" },
    { geo: at(new THREE.TorusGeometry(0.036, 0.005, 8, 24).rotateX(Math.PI / 2), 0, 0.168, 0), role: "dark" },
    { geo: at(extrude(KITE, 0.008), 0, 0.11, 0.058), role: "livery" },
    { geo: at(extrude(KITE, 0.004, 0.003).scale(0.72, 0.72, 1), 0, 0.11, 0.0645), role: "trim" },
  ],
  R: () => [ // keep
    { geo: BASE(), role: "dark" },
    { geo: cyl(0.078, 0.092, 0.17, 0.135, 8), role: "stone" },
    { geo: cyl(0.084, 0.078, 0.022, 0.206, 8), role: "livery" },
    { geo: cyl(0.086, 0.086, 0.012, 0.223, 8), role: "stone" },
    ...ringOf(4, 0.07, 0.247, (x, y, z, a) => ({ geo: at(new THREE.BoxGeometry(0.036, 0.036, 0.03).rotateY(a), x, y, z), role: "stone" })),
    ...ringOf(4, 0.081, 0.14, (x, y, z, a) => ({ geo: at(new THREE.BoxGeometry(0.008, 0.05, 0.006).rotateY(a), x, y, z), role: "dark" }), Math.PI / 8),
  ],
  N: () => { // destrier: profile drawn facing +x, then turned to face +z
    const head = [[-0.062, 0.05], [-0.07, 0.13], [-0.045, 0.2], [-0.005, 0.245], [0.03, 0.25], [0.06, 0.225], [0.088, 0.19], [0.094, 0.16], [0.07, 0.145], [0.035, 0.15], [0.005, 0.115], [-0.02, 0.05]];
    const plate = [[-0.012, 0.24], [0.028, 0.252], [0.062, 0.228], [0.09, 0.192], [0.094, 0.162], [0.078, 0.166], [0.058, 0.205], [0.028, 0.228], [-0.01, 0.222]];
    const face = (g) => g.rotateY(-Math.PI / 2);
    return [
      { geo: BASE(), role: "dark" },
      { geo: face(extrude(head, 0.058, 0.008)), role: "livery" },
      { geo: face(extrude(plate, 0.066, 0.004)), role: "steel" },
      { geo: face(at(new THREE.ConeGeometry(0.014, 0.075, 12).rotateZ(0.55), 0.015, 0.285, 0)), role: "trim" },
      { geo: face(at(new THREE.ConeGeometry(0.009, 0.03, 8).rotateZ(-0.2), 0.05, 0.262, 0.02)), role: "livery" },
      { geo: face(at(new THREE.ConeGeometry(0.009, 0.03, 8).rotateZ(-0.2), 0.05, 0.262, -0.02)), role: "livery" },
      { geo: face(ball(0.007, 0.205, 0.055, 0.034)), role: "dark" },
      { geo: face(ball(0.007, 0.205, 0.055, -0.034)), role: "dark" },
    ];
  },
  B: () => [ // cleric
    { geo: BASE(), role: "dark" },
    { geo: lathe([[0.082, 0.05], [0.07, 0.12], [0.05, 0.2], [0.056, 0.225], [0.04, 0.235]]), role: "livery" },
    { geo: ball(0.03, 0.245), role: "ivory" },
    { geo: lathe([[0.034, 0.26], [0.04, 0.285], [0.026, 0.32], [0.0, 0.345]]), role: "trim" },
    { geo: box(0.005, 0.05, 0.075, 0, 0.3, 0), role: "dark" },
    { geo: box(0.004, 0.022, 0.004, 0, 0.352, 0), role: "trim" },
    { geo: box(0.014, 0.004, 0.004, 0, 0.355, 0), role: "trim" },
    { geo: at(cyl(0.004, 0.004, 0.3, 0.2, 8), 0.066, 0, 0.02), role: "trim" },
    { geo: at(new THREE.TorusGeometry(0.016, 0.0035, 8, 18, Math.PI * 1.4), 0.05, 0.352, 0.02), role: "trim" },
  ],
  Q: () => [ // lady
    { geo: BASE(), role: "dark" },
    { geo: lathe([[0.095, 0.05], [0.082, 0.13], [0.05, 0.22], [0.046, 0.26], [0.055, 0.275], [0.04, 0.285]]), role: "livery" },
    { geo: lathe([[0.055, 0.285], [0.04, 0.3], [0.03, 0.31]]), role: "trim" },
    { geo: ball(0.03, 0.325), role: "ivory" },
    { geo: at(new THREE.TorusGeometry(0.03, 0.006, 8, 24).rotateX(Math.PI / 2), 0, 0.352, 0), role: "trim" },
    ...ringOf(8, 0.03, 0.362, (x, y, z) => ({ geo: ball(0.007, y, x, z), role: "trim" })),
    { geo: ball(0.009, 0.382), role: "trim" },
  ],
  K: () => [ // lord
    { geo: BASE(), role: "dark" },
    { geo: lathe([[0.095, 0.05], [0.085, 0.14], [0.06, 0.25], [0.056, 0.29], [0.07, 0.305], [0.046, 0.315]]), role: "livery" },
    { geo: at(new THREE.CylinderGeometry(0.072, 0.1, 0.24, 16, 1, true, Math.PI / 2, Math.PI), 0, 0.17, 0), role: "dark" },
    { geo: ball(0.032, 0.345), role: "ivory" },
    { geo: at(new THREE.TorusGeometry(0.032, 0.007, 8, 24).rotateX(Math.PI / 2), 0, 0.372, 0), role: "trim" },
    ...ringOf(5, 0.03, 0.392, (x, y, z, a) => ({ geo: at(new THREE.BoxGeometry(0.012, 0.03, 0.008).rotateY(a), x, y, z), role: "trim" })),
    { geo: box(0.005, 0.03, 0.005, 0, 0.425, 0), role: "trim" },
    { geo: box(0.018, 0.005, 0.005, 0, 0.428, 0), role: "trim" },
    { geo: at(cyl(0.004, 0.004, 0.24, 0.26, 8), 0.068, 0, 0.03), role: "trim" },
    { geo: ball(0.012, 0.39, 0.068, 0.03), role: "trim" },
  ],
};
// One merged geometry per role per kind, built once.
const PIECE_GEO = {};
for (const kind of Object.keys(BUILD)) {
  const byRole = {};
  for (const { geo, role } of BUILD[kind]()) (byRole[role] ??= []).push(geo.index ? geo.toNonIndexed() : geo);
  PIECE_GEO[kind] = Object.fromEntries(Object.entries(byRole).map(([role, geos]) => [role, mergeGeometries(geos, false)]));
}
function newArmyMats(seat) {
  const gold = PAL[seat].trim === "#d4a63a";
  return {
    livery: new THREE.MeshPhysicalMaterial({ color: PAL[seat].cap, roughness: 0.38, metalness: 0.0, clearcoat: 0.6, clearcoatRoughness: 0.25, envMapIntensity: 0.6 }),
    steel: new THREE.MeshStandardMaterial({ color: "#aab3bd", metalness: 0.9, roughness: 0.38, envMapIntensity: 0.9 }),
    trim: new THREE.MeshStandardMaterial({ color: PAL[seat].trim, metalness: gold ? 1.0 : 0.15, roughness: 0.35, envMapIntensity: 0.9 }),
    stone: new THREE.MeshStandardMaterial({ color: "#a39d90", roughness: 0.9 }),
    dark: new THREE.MeshStandardMaterial({ color: "#2a2320", roughness: 0.8 }),
    ivory: new THREE.MeshStandardMaterial({ color: "#e9d7b8", roughness: 0.6 }),
  };
}
function makePiece(kind, seat, sq, halo) {
  const mats = newArmyMats(seat);
  const group = new THREE.Group();
  group.position.copy(sqPos(sq));
  const token = new THREE.Group();
  group.add(token);
  const body = [];
  for (const [role, geo] of Object.entries(PIECE_GEO[kind])) {
    const mesh = new THREE.Mesh(geo, mats[role]);
    mesh.castShadow = mesh.receiveShadow = true;
    token.add(mesh);
    body.push(mats[role]);
  }
  const haloMat = new THREE.MeshBasicMaterial({ color: hdr("#ffd264", 1.7), transparent: true });
  const haloMesh = new THREE.Mesh(haloGeo, haloMat);
  haloMesh.rotation.x = Math.PI / 2;
  haloMesh.position.y = haloY(kind);
  haloMesh.visible = !!halo;
  group.add(haloMesh);
  token.rotation.y = yawTo(group.position.clone().negate());
  scene.add(group);
  return { kind, seat, group, token, haloMesh, fade: 1, body, mats: [...body, haloMat], wantYaw: token.rotation.y };
}
function disposePiece(p) {
  scene.remove(p.group);
  for (const m of p.mats) m.dispose();
}
function setEmissive(p, color, k) {
  for (const m of p.body) { m.emissive.copy(color); m.emissiveIntensity = k; }
}
function applyFade(p) {
  for (const m of p.body) { m.transparent = p.fade < 0.999; m.opacity = p.fade; m.depthWrite = p.fade > 0.5; }
}
function setOpacity(p, a) {
  for (const m of p.body) { m.transparent = true; m.opacity = a; m.depthWrite = a > 0.5; }
}
EOF
```

- [ ] **Step 2: Point the halo, the instant-apply path and the run at the new piece shape**

```bash
python -I - <<'EOF'
import sys; sys.path.insert(0, "/c/Users/ahlev/AppData/Local/Temp/claude/C--Users-ahlev--claude-spares-spare-QbPeZi/65ffc00d-391d-4fd8-8049-1729cc327f11/scratchpad/meadow-cam")
from rep import rep
D = "/c/Users/ahlev/AppData/Local/Temp/claude/C--Users-ahlev--claude-spares-spare-QbPeZi/65ffc00d-391d-4fd8-8049-1729cc327f11/scratchpad/meadow-cam/parts/"
# fx: halo ignites at the piece's own top
rep(D + "70-fx.js", "h.position.y = HALO_Y + 0.4 * (1 - e);", "h.position.y = haloY(p.kind) + 0.4 * (1 - e);")
# rig: instant apply sets the halo height and faces the moved piece at the centre
rep(D + "80-rig.js", "h.position.y = HALO_Y; h.material.opacity = 1; }", "h.position.y = haloY(mover.kind); h.material.opacity = 1; }")
rep(D + "80-rig.js", "  pieces.set(dest, mover);\n  if (turn.evaporates) removePiece(mover);",
                      "  pieces.set(dest, mover);\n  mover.token.rotation.y = mover.wantYaw = yawTo(sqPos(dest).negate());\n  if (turn.evaporates) removePiece(mover);")
# rig: no billboard helper
rep(D + "80-rig.js", "const facing = (p) => Math.atan2(camera.position.x - p.group.position.x, camera.position.z - p.group.position.z);\n", "")
# rig: a knight turns toward its leap during the approach; every mover re-faces the centre after landing
rep(D + "80-rig.js", "  view.focus = mover.group.position;\n  const run = {", "  view.focus = mover.group.position;\n  if (mover.kind === \"N\") mover.wantYaw = yawTo(chord);\n  const run = {")
rep(D + "80-rig.js", "        pieces.set(dest, mover);\n        showCaption(i, true);", "        pieces.set(dest, mover);\n        mover.wantYaw = yawTo(destPos.clone().negate());\n        showCaption(i, true);")
# player: pieces are placed facing the centre, nothing to billboard
rep(D + "90-hud-player.js", "  for (const p of pieces.values()) p.token.rotation.y = facing(p);\n", "")
rep(D + "90-hud-player.js",
    "    // Tokens turn toward the lens gently, never whip around.\n    const turnBy = wrapRad(facing(p) - p.token.rotation.y) * Math.min(1, dt * 3), cap = D2R(90) * dt;\n    p.token.rotation.y += THREE.MathUtils.clamp(turnBy, -cap, cap);\n",
    "    // Only a mover re-faces (knight toward its leap, then back to the centre): eased, never above 60°/s.\n    const turnBy = wrapRad(p.wantYaw - p.token.rotation.y) * Math.min(1, dt * 2.5), cap = D2R(60) * dt;\n    if (Math.abs(turnBy) > 1e-5) p.token.rotation.y += THREE.MathUtils.clamp(turnBy, -cap, cap);\n")
EOF
grep -c "HALO_Y\|facing(" "$W"/parts/*.js
python -I "$W/build.py"
```
Expected: every grep count is `0` (no leftover `HALO_Y` or `facing(` references).

- [ ] **Step 3: Verify the pieces in the browser**

Reload. `window.orreryReview(0, 2.4)` (shoulder view of North's rook): a stone keep with four crenels and a red band; `window.orreryReview(1, 2.3)`: East's charcoal destrier with steel chamfron and cream plume facing its leap; `window.orreryReview(2, 2.4)`: South's blue cleric with mitre and crozier; `window.orreryReview(4, 2.6)`: North's red knight. From the overview (`orreryReview(0, 0.1)`) each kind is distinguishable: footmen (short, shield), keeps (square), destriers (head), clerics (mitre), ladies (crown), lords (tall crown with cross). All bases stay inside their squares on the inner ring. Shields and sceptres face the sundial. No console errors.

- [ ] **Step 4: Motion check**

```js
JSON.stringify(window.orreryTraceAll())
```
Expected: `camDegPerSec` within ±15 % of the Task 1 baseline; `yawDegPerSec` ≤ 61 on every turn (turns 2, 4, 5 are knights; the rook and bishop re-face after landing).

- [ ] **Step 5: Tick** "Procedural heraldic pieces" in `tasks/todo.md`.

---

### Task 7: Rule-event re-skin — circlet halo, pollen evaporation, cairn graves, shard colours

**Files:**
- Modify: `$W/parts/70-fx.js` (replace everything from `function igniteHalo` to the end), `$W/parts/80-rig.js` (evaporation mote colour, capture shockwave colour)

**Interfaces:**
- Consumes: `scene`, `sqPos`, `hdr`, `curtainVS`, `tween`, `motes`, `haloY`.
- Produces: `igniteHalo(p)`, `graves`, `graveMark(sq, instant)`, `consumeGrave(sq, instant)`, `disposeGrave(sq)`, `updateGraves(dt, time)` — same names and signatures the rig already calls.

- [ ] **Step 1: Replace the halo and grave section of the fx part**

```bash
python -I - <<'EOF'
import pathlib
p = pathlib.Path("/c/Users/ahlev/AppData/Local/Temp/claude/C--Users-ahlev--claude-spares-spare-QbPeZi/65ffc00d-391d-4fd8-8049-1729cc327f11/scratchpad/meadow-cam/parts/70-fx.js")
s = p.read_text(encoding="utf-8")
i = s.index("function igniteHalo(p) {")
assert i > 0
new_tail = r'''function igniteHalo(p) {
  const h = p.haloMesh, y0 = haloY(p.kind);
  h.visible = true;
  tween(1.0, (u) => {
    const e = 1 - Math.pow(1 - u, 3);
    h.scale.setScalar(2.4 - 1.4 * e);
    h.position.y = y0 + 0.4 * (1 - e);
    h.material.opacity = Math.min(1, u * 1.6);
  });
  motes(p.group.position.clone().setY(0.3), hdr("#ffd98a", 1.5), 30, 1.2);
}

// Graves: an ember cairn with a candle-flame shaft on the home square of a piece that fell unmoved.
const graves = new Map();
const beamFS = `uniform vec3 uColor; uniform float uOpacity; varying vec2 vUv;
void main() { float a = pow(1.0 - vUv.y, 2.2) * uOpacity; gl_FragColor = vec4(uColor * a, a); }`;
const cairnStoneGeo = new THREE.DodecahedronGeometry(0.022, 0);
const cairnMat = new THREE.MeshStandardMaterial({ color: "#6d665c", roughness: 0.95 });
function graveMark(sq, instant) {
  const grp = new THREE.Group();
  grp.position.copy(sqPos(sq));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    const s = new THREE.Mesh(cairnStoneGeo, cairnMat);
    s.position.set(Math.sin(a) * 0.1, 0.012, Math.cos(a) * 0.1);
    s.rotation.set(a, a * 1.3, 0);
    s.scale.setScalar(0.8 + ((i * 7) % 5) * 0.1);
    s.castShadow = true;
    grp.add(s);
  }
  const ringMat = new THREE.MeshBasicMaterial({ color: hdr("#ff7a2a", 2.4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.06, 0.095, 48), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.008;
  grp.add(ring);
  const beamMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(1.6, 0.75, 0.25) }, uOpacity: { value: 0.5 } },
    vertexShader: curtainVS, fragmentShader: beamFS,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.07, 0.7, 24, 1, true), beamMat);
  beam.position.y = 0.35;
  grp.add(beam);
  scene.add(grp);
  graves.set(sq, { grp, ring, beam, ringMat, beamMat, grow: instant ? 1 : 0, fade: 1, consumed: false });
}
function consumeGrave(sq, instant) {
  const g = graves.get(sq);
  if (!g) return;
  if (instant) disposeGrave(sq); else g.consumed = true;
}
function disposeGrave(sq) {
  const g = graves.get(sq);
  scene.remove(g.grp);
  g.ringMat.dispose(); g.beamMat.dispose();
  graves.delete(sq);
}
function updateGraves(dt, time) {
  for (const [sq, g] of [...graves]) {
    g.grow = Math.min(1, g.grow + dt * 1.1);
    if (g.consumed) { g.fade -= dt * 1.6; if (g.fade <= 0) { disposeGrave(sq); continue; } }
    const pulse = 0.7 + 0.2 * Math.sin(time * 3.2) + 0.1 * Math.sin(time * 11.7);
    g.grp.scale.setScalar(0.4 + 0.6 * g.grow);
    g.beam.scale.y = Math.max(0.001, g.grow);
    g.beam.position.y = 0.35 * g.grow;
    g.ringMat.opacity = pulse * g.fade;
    g.beamMat.uniforms.uOpacity.value = 0.5 * pulse * g.fade * g.grow;
  }
}
'''
p.write_text(s[:i] + new_tail, encoding="utf-8")
print("fx tail replaced; lines:", new_tail.count("\n"))
EOF
```

- [ ] **Step 2: Recolour the evaporation motes (pollen) and the capture ring**

```bash
python -I - <<'EOF'
import sys; sys.path.insert(0, "/c/Users/ahlev/AppData/Local/Temp/claude/C--Users-ahlev--claude-spares-spare-QbPeZi/65ffc00d-391d-4fd8-8049-1729cc327f11/scratchpad/meadow-cam")
from rep import rep
R = "/c/Users/ahlev/AppData/Local/Temp/claude/C--Users-ahlev--claude-spares-spare-QbPeZi/65ffc00d-391d-4fd8-8049-1729cc327f11/scratchpad/meadow-cam/parts/80-rig.js"
rep(R, 'motes(pos.clone().setY(0.02), hdr("#8fa6a0", 2.2), 90, 2.0);', 'motes(pos.clone().setY(0.02), hdr("#f6d98a", 1.8), 90, 2.0);')
rep(R, 'shockwave(at, hdr("#efe6d6", 0.9), { max: 0.45, life: 0.5 });', 'shockwave(at, hdr("#fff1d0", 0.9), { max: 0.45, life: 0.5 });')
EOF
python -I "$W/build.py"
```
`ASH` (the grey emissive tint while the evaporating piece crosses) stays as v4: dust is grey, pollen is gold.

- [ ] **Step 3: Verify each event in the browser**

- `window.orreryReview(1, 4.2)`: East's knight at 8C fading upward in a cloud of gold pollen motes.
- `window.orreryReview(2, 3.8)`: South's bishop wearing a golden circlet just above its mitre.
- `window.orreryReview(3, 4.0)`: an eight-stone cairn on 31D with an ember glow and a flickering flame shaft.
- `window.orreryReview(4, 3.6)`: North's knight on 31D; the cairn fading out, red shockwaves, the torn North banner.
No console errors.

- [ ] **Step 4: Tick** "Re-skin rule events" in `tasks/todo.md`.

---

### Task 8: HUD polish and phone-width check

The palette, copy, legend and Light control already live in `template.html` from Task 1. This task checks them against the finished scene and fixes what reads badly.

**Files:**
- Modify: `$W/template.html` (CSS only)

- [ ] **Step 1: Desktop read**

Reload at the pane's normal size. Check: title and lede legible over the bright sky (text shadows on); legend swatches match the scene (forked red banner, gold circlet, gold pollen dots, orange ember grave, red Avenger ring); the Light control sits on the same row as playback and the pressed preset is filled. If the title is hard to read over a bright Noon sky, add to the `.top > div` rule: `background: linear-gradient(rgba(43,32,22,0.55), transparent); padding: 8px 12px 20px; margin: -8px -12px 0; border-radius: 12px;` and rebuild.

- [ ] **Step 2: Phone width**

`mcp__Claude_Browser__resize_window` with `preset: "mobile"`, reload. Expect: legend and lede hidden, chips show only the notation token, playback and Light controls wrap onto separate lines without overflowing the panel, no horizontal scroll, the stage fills the viewport with `fov 60`. If the Light row overflows, add inside the `@media (max-width: 760px)` block: `.controls.light .lbl { display: none; } .controls button { padding: 9px 11px; }`. Then `resize_window` with `preset: "desktop"`.

- [ ] **Step 3: Rebuild and tick** "HUD: Light control, palette, copy" in `tasks/todo.md`.

```bash
python -I "$W/build.py"
```

---

### Task 9: Verification pass, publish the artifact, record the result

**Files:**
- Publish: `$W/meadow-cam.html` as a new artifact "Meadow Cam"
- Modify: `tasks/todo.md` (ticks + review notes), memory file `orrery-cam-prototype.md` (add the Meadow Cam pointer) and `MEMORY.md`

- [ ] **Step 1: Motion acceptance**

```js
JSON.stringify(window.orreryTraceAll())
```
Expected: `camDegPerSec` per turn within ±15 % of the Task 1 baseline; `yawDegPerSec` ≤ 61 everywhere. Paste the array into the todo review notes. If a turn is out of range, the cause is in this plan's rig edits (Task 6 Step 2) because no other task touches `80-rig.js` camera code; diff `$W/parts/80-rig.js` against `sed -n '710,933p' "$V4"` and remove anything not listed in Task 6 Step 2 or Task 7 Step 2.

- [ ] **Step 2: Event frames, all three presets**

For each preset (click Noon, Golden hour, Storm-break in turn, waiting 2.5 s after each), run and screenshot: `orreryReview(1, 4.2)` evaporation, `orreryReview(2, 3.8)` halo, `orreryReview(3, 4.0)` grave, `orreryReview(4, 3.6)` avenger, `orreryReview(0, 0.1)` overview. In Storm-break the mover and its square must be clearly the brightest thing in frame. `read_console_messages onlyErrors:true` → none.

- [ ] **Step 3: Reduced motion and WebGL-off text**

In `javascript_tool`: `document.getElementById("nogl").hidden` → `true` (WebGL is on; the fallback element exists and is hidden). Confirm `window.matchMedia("(prefers-reduced-motion: reduce)").matches` is `false` on this machine and that the start-up copy path for `true` is still present: `grep -c "reduced motion" "$W/meadow-cam.html"` → `1`.

- [ ] **Step 4: Publish**

Load the `artifact-design` skill (page contract) before publishing. Then `Artifact` publish with `file_path` = `C:\Users\ahlev\AppData\Local\Temp\claude\C--Users-ahlev--claude-spares-spare-QbPeZi\65ffc00d-391d-4fd8-8049-1729cc327f11\scratchpad\meadow-cam\meadow-cam.html`, `icon: "castle"`, `description: "Medieval meadow re-skin of the Roto Chess 3D move replay — same camera as Orrery Cam v4, sunlight that follows the mover, three Light presets."`, no `url` (new artifact). Open the returned URL in the built-in browser, wait 5 s, screenshot, and `read_console_messages onlyErrors:true` → none (the CDN importmap and Google Fonts must load from the artifact origin). Send the screenshot with `SendUserFile`.

- [ ] **Step 5: Record**

- `tasks/todo.md`: tick "Verify…" and "Publish…", add a `## Review` block under the Meadow Cam section: artifact URL, trace numbers, anything deferred (e.g. `GRASS_N` lowered, banner colour raised).
- Memory: append to `orrery-cam-prototype.md` a paragraph "Meadow Cam variant (2026-10-25)" with the artifact URL, the parts/build layout under the scratchpad path, and the rule that both variants share v4's rig; update its `description`. Add a line to `MEMORY.md` only if the index entry needs the new pointer.
- Tell the founder: URL, what differs from Orrery Cam, the three presets, and that nothing in `app/` changed.

---

## Self-review (done while writing)

- **Spec coverage.** Base/deliverable → T1, T9. Sky, horizon, meadow, clouds → T2 (sky), T3. Board (squares, slab, rails, sundial, bosses, jasper) → T4. Sunlight (sun, shaft, pool, spot, presets, 2 s tween) → T2. Pieces (six kinds, livery/steel/trim, base ≤ 0.22, facing rules, per-kind halo) → T6. Rule events (banner, circlet, pollen, cairn, avenger, capture colour) → T5, T7. HUD (Light control, copy, palette, legend, phone) → T1, T8. Verification (trace, frames, presets, fallback, phone) → T6 S4, T8, T9.
- **Placeholders.** None; every code step carries the code or an exact copy range.
- **Name consistency.** `haloY`, `yawTo`, `PIECE_TOP`, `wantYaw`, `body` (T6) match the edits in T6 S2 and T7 S1; `curtainVS` (T5) is what T7's beam uses; `updateLight`/`updateShaft`/`applyLight` (T2) match T2 S3 hooks; `updateWorld`/`cloudMat` (T3) match T3 S2 and T2's guarded use; `setActiveSeat`/`seatDots` (T4) match the rig's existing calls.
- **Scope.** One page, one plan. The only artifact published is the new "Meadow Cam".
