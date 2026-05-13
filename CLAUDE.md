# RL3T Patent Website — Session Context

## Project overview
Interactive patent visualization website for **US 12,507,882 B2** (Adaptive and Radially Expanding Speculum, inventor Arlette Geller, assignee RL3T LLC).

- **Repo:** `JOO-K/AGpat` on GitHub
- **Live site:** `https://joo-k.github.io/AGpat/`
- **Local path:** `C:\Users\ericd\ArletteGellerNew\website\`
- **Git user:** JOO-K

## File structure
```
website/
  index.html       — Landing page: full-bg 3D viewer, glass CTA buttons, color swatches, particle sketch
  patent.html      — Main page: USPTO front matter + two-col patent text + floating 3D viewer
  progress.html    — Stub "Development Updates" page (placeholder content only)
  style.css        — All styles (landing + patent + shared)
  script.js        — All JS for patent.html (viewer, tree, colors, gizmo, zoom, rotation, hotspots)
  sketch.js        — p5.js particle background (index.html + progress.html); calls window.onFormationChange(idx)
  images/
    fig6b.png              — Close-up figure 6B image
    figs/
      page_01.png … page_16.png  — 16 patent drawing sheets (the actual USPTO figures)
    page_21.png … page_25.png   — Patent body pages 21–25
  models/
    rojas.glb        — Primary model (ROJAS v22) — 3 materials: Body(16), Drawstring & Knot(20), Ring(22)
    alt.glb          — Alt embodiment (ALT v47)
    rebuild.glb      — Rebuild (REBUILD v1)
    newmodels/       — Staged next versions (nd_13.glb, rojas.glb, rebuild.glb) — not yet live
    rojas_old.glb / rojas_original_backup.glb / rojas_reexport.glb — backups
    alt_old.glb / rebuild_old.glb — backups
    alt.obj / alt.stl / alt.usdz — export variants
    rebuild.obj / rebuild.stl / rebuild.usdz
    rojas.obj / rojas.stl / rojas.usdz
    new-dimensions.usdz
```

## Landing page architecture (index.html)

### Full-background 3D model viewer
`.landing-bg` — `position: fixed; inset: 0; z-index: 0; pointer-events: auto`
`#landingViewer` — auto-rotate 20deg/s, 3s delay; camera-controls + disable-pan + disable-zoom
Initial camera: `35.0deg 62.0deg 167.397m`, FOV `7deg` (locked min/max)

### Formation → camera sync
sketch.js calls `window.onFormationChange(idx)` when particle formation changes.
The landing page handles it by animating the viewer camera to one of three presets:
```js
const LANDING_ORBITS = [
  { orbit: '49.2deg 70.9deg 167.397m',    fov: '7.0deg' },  // large cylinder
  { orbit: '145.1deg 0.0deg 167.397m',    fov: '7.0deg' },  // flower (top)
  { orbit: '-220.2deg 154.9deg 167.397m', fov: '7.0deg' },  // small cylinder
];
```
Sync is skipped if user interacted with model in the last 3 seconds.

### Landing color schemes
4 core schemes only on landing (no experimental). Each includes a `model` RGB array for tinting the landing viewer via materials API:
```js
const L_SCHEMES = {
  blueprint: { accent:'#1d4ed8', mid:'#3b82f6', bg:'#eff6ff', ar:29,  ag:78,  ab:216, model:[0.42,0.62,0.95] },
  teal:      { accent:'#0d9488', mid:'#2dd4bf', bg:'#f0fdfa', ar:13,  ag:148, ab:136, model:[0.30,0.82,0.74] },
  ember:     { accent:'#c2410c', mid:'#f97316', bg:'#fff7ed', ar:194, ag:65,  ab:12,  model:[0.88,0.50,0.28] },
  plum:      { accent:'#7c3aed', mid:'#a78bfa', bg:'#f5f3ff', ar:124, ag:58,  ab:237, model:[0.70,0.50,0.94] },
};
```
`applyLandingScheme()` sets CSS vars, updates swatch active state, calls `applyModelColor()`, updates sketch accent, and applies colored drop-shadow to the landing viewer.

### CTA buttons (landing)
Two L-shaped SVG path buttons, `position: fixed; right: 30px`:
- **Primary** (Development Updates) — dark glass fill, top: 62px; links to patent.html (stub — should eventually go to progress.html)
- **Secondary** (Patent & 3D Model) — light glass fill, top: 30px; animated stroke-draw on hover; links to patent.html

Pointer-events: only the transparent `cta-hitarea` path is interactive — text overlays have `pointer-events: none`.
Horizontal accent lines (`::before`) animate in from right on load via `clip-path`.

### Landing camera readout
`#landingCamInfo` — fixed bottom-left, shows orbit + fov in a rAF loop. Has copy button.

## Architecture: how the 3D overlay works (patent.html)
- `.patent-body` — full-width block, `pointer-events: none`
- `.two-col` — 672px text column, `position: relative; z-index: 15; pointer-events: auto`
- `.patent-intro` — bibliographic front matter, `pointer-events: auto; z-index: 15`
- `.model-panel` — `position: fixed; inset: 0; pointer-events: none; z-index: 16` (overlay container)
- `.viewer-wrap` — `position: absolute; inset: 0; pointer-events: auto`
- JS pointer-events partition: `.viewer-wrap` pointer-events toggled to `none` when mouse is over `.patent-intro` or `.two-col`

## Key CSS rules (style.css)

### model-viewer appearance (patent.html)
```css
.main-viewer {
  background: transparent !important;
  --poster-color: transparent !important;
  filter:
    url(#model-outline)
    drop-shadow(0 2px 8px  rgba(0,0,0,0.14))
    drop-shadow(0 6px 32px rgba(0,0,0,0.09));
  transform: translateX(15vw);
}
```

### SVG outline filter (in patent.html, just before </body>)
```html
<filter id="model-outline" ...>
  <feMorphology operator="dilate" radius="0.6" .../>
  <feFlood flood-color="#000" flood-opacity="0.20" .../>
  <feComposite operator="in" .../> <feComposite operator="over"/>
</filter>
```

### model-viewer attributes (patent.html)
```
camera-orbit="40.4deg 71.9deg 53.153m"
field-of-view="26.2deg"
shadow-intensity="1.2" / exposure="1.15" / environment-image="neutral"
interpolation-decay="80"
min-camera-orbit="-Infinity 0deg 5m" / max-camera-orbit="Infinity 180deg auto"
```

### Part tree panel (top-right)
```css
.part-tree-panel { position: absolute; top: 3.8rem; right: 1.2rem; width: 230px; }
```

### cam-cluster (rotation panel + cam-info, vertically stacked, center-right)
```css
.cam-cluster { position: absolute; top: 50%; right: 1.2rem; transform: translateY(-50%); display: flex; flex-direction: column; gap: 0.55rem; z-index: 25; }
```

### View controls (bottom-right)
`.view-controls` — `position: absolute; bottom: 3.5rem; right: 1.2rem`
Contains `.view-presets` (column of SVG `.vc-btn` buttons), `.zoom-bar` (absolute-positioned vertical slider), and `.vc-btn-lg` (RESET VIEW).

### Zoom bar
`.zoom-bar` — `position: absolute; right: 4px; top: 0; bottom: 58px; width: 18px` inside `.view-controls`.
Fill and thumb move on camera-change events.

### Gizmo panel (bottom-left of viewer)
`.gizmo-panel` — `position: absolute; bottom: 1.8rem; right: calc(260px + 2.4rem)`
Contains `#gizmoCanvas` (76×76 canvas) + `.controls-hint` (mouse legend).

### SVG view buttons (.vc-btn)
Parallelogram-shaped SVG paths. Small buttons: light glass, accent tinted. Large RESET: dark glass.
Active state has stronger accent fill.

## Key JS (script.js)

### Color schemes (patent.html)
7 schemes total — 4 core + 3 experimental (forest, gold, aurora). Aurora is an rAF hue-cycling loop.
`_stopAurora()` called at start of every `applyScheme()`.

### Scroll wheel zoom
```js
const step = topMode ? 0.00110 : 0.00060;  // (note: higher than original — tuned up)
viewer.cameraOrbit = `${o.theta}rad ${o.phi}rad ${newR.toFixed(3)}m`;
// { passive: false, capture: true }
```

### Zoom bar range (set on model load)
```js
minR = r * 0.35;   maxR = r * 3.0;
viewer.setAttribute('max-camera-orbit', `Infinity 180deg ${maxR.toFixed(1)}m`);
```

### Top mode
Flag set when TOP preset clicked. Different scroll step (0.00110). Exits when `phi > 0.26 rad`, scales radius to compensate FOV change.

### Model rotation panel
X/Y/Z sliders in `.rot-panel`. Uses `viewer.orientation = "Xdeg Ydeg Zdeg"`.
LERP-smoothed (LERP=0.15), rAF loop. Resets on model load. Values included in camText readout as `rot X:n Y:n Z:n`.

### Per-model camera defaults
```js
const MODEL_CAM = {
  'models/rojas.glb':   { orbit: '40.4deg 71.9deg 53.153m',  target: null,                   fov: '26.2deg' },
  'models/alt.glb':     { orbit: '30.5deg 66.5deg 128.400m', target: '-2.043 -1.926 -2.963', fov: '20.1deg' },
  'models/rebuild.glb': { orbit: '45deg 54.74deg 120%',      target: null,                   fov: '30deg'   },  // placeholder
};
```

### Dynamic part tree
`buildPartTree(mv, activeSrc)` reads `mv.model.materials` and generates `.tree-list` innerHTML dynamically.
Uses `PART_ORBIT_MAP` and `PART_RN_MAP` to assign camera angles and patent reference numbers by material name:
```js
const PART_ORBIT_MAP = {
  'Body': '30deg 65deg 90%', 'Expansor': '30deg 65deg 90%',
  'Drawstring & Knot': '85deg 88deg 52%', 'Ring': '85deg 88deg 52%', ...
};
const PART_RN_MAP = { 'Body': '16', 'Drawstring & Knot': '20', 'Ring': '22', ... };
```

### Per-part visibility
`visState` object (matIdx → false = hidden). `setPartVisibility(idx, visible)` toggles BLEND/OPAQUE.
Eye-icon toggle buttons (`.tree-vis-btn`) — toggled class `.vis-hidden`.

### Part highlight / dim
- `highlightPart(matIdx)` — selected part gets vivid `HIGHLIGHT_COLORS`, others get grey [0.6,0.6,0.6]
- `dimExceptPart(matIdx)` — selected stays at `MAT_COLORS`, others get alpha 0.22 (semi-transparent)
- Tree row click: first click activates + highlights, second click on same row deactivates + restores all colors

### MAT_COLORS (per-material palette)
```js
const MAT_COLORS = [
  [0.52, 0.74, 0.96, 1.0],  // steel blue (Body/16)
  [0.96, 0.72, 0.32, 1.0],  // amber (Drawstring/20)
  [0.50, 0.88, 0.62, 1.0],  // mint (Ring/22)
  [0.90, 0.50, 0.50, 1.0],  // rose
  [0.78, 0.60, 0.94, 1.0],  // lavender
  [0.94, 0.88, 0.44, 1.0],  // gold
];
```

### Trackball gizmo
Canvas-drawn sphere: radial gradient fill, lat/lon wire lines (30° spacing, front-face only), XYZ axis arrows.
Drag on gizmo orbits the main viewer camera (dx/dy → theta/phi delta × 0.013).
rAF loop in sync with camera — reads `getCameraOrbit()` every frame.

### Hotspots (ROJAS only — hidden on other models)
3 pill-label buttons:
- `hs-28` Outer Tube — position `−0.5 11.5 0` — orbit `-20deg 60deg 130%`
- `hs-16` Expansor — position `2 7.5 0.5` — orbit `30deg 65deg 90%`
- `hs-20` Drawstring — position `0 3.5 0` — orbit `85deg 88deg 52%`
Clicking sets `.hs-active` class (accent background). Tree row click mirrors `hs-active` via matching rn.

## View preset buttons (exact values)
```
3/4:   orbit 37.0deg 42.9deg 53.153m  target -0.010 7.262 0.205   fov 26.2deg
TOP:   orbit 41.5deg 0.0deg 110.4m    target -0.010 7.262 0.205   fov 10.0deg
SIDE:  orbit 35.4deg 87.6deg 97.817m  target -0.010 7.262 0.205   fov 17.6deg
CLOSE: orbit 190.1deg 72.7deg 15.246m target -0.202 7.526 -3.249  fov 12.0deg
RESET: orbit 40.4deg 71.9deg 53.153m  fov 26.2deg
```

## Fig-ref camera angles (current)
```
FIG 1:   -20deg 60deg 135%          (percentage orbit, not yet metre-based)
FIG 2:   40deg 65deg 105%           (percentage orbit)
FIG 3A:  37.1deg 55.8deg 57.796m    target -0.491 10.752 -0.703  fov 15.7deg
FIG 3B:  37.1deg 55.8deg 57.796m    target -0.491 10.752 -0.703  fov 15.7deg
FIG 3C:  35.4deg 87.6deg 97.817m    target -0.010 7.262 0.205    fov 17.6deg  (= SIDE)
FIG 3D:  35.4deg 87.6deg 97.817m    target -0.010 7.262 0.205    fov 17.6deg
FIG 4A:  30deg 65deg 100%           (percentage orbit)
FIG 4B:  41.5deg 0.0deg 110.4m      target -0.010 7.262 0.205    fov 10.0deg  (= TOP)
FIG 5A:  30deg 65deg 68%            (percentage orbit)
FIG 5B:  0deg 0.5deg 68%            (percentage orbit)
FIG 6A:  90deg 90deg 100%           (percentage orbit)
FIG 6B:  85deg 88deg 52%            (percentage orbit)
FIG 7A:  30deg 65deg 100% — alt.glb
FIG 7B:  0deg 3deg 100%  — alt.glb
FIG 8A:  45deg 65deg 100% — alt.glb
FIG 8B:  0deg 3deg 100%  — alt.glb
```
FIGs 1, 2, 4A, 5A, 5B, 6A, 6B still use percentage orbit values — not yet converted to exact metres.

## Color scheme swatches (patent.html nav)
```
THEME  [blueprint] [teal] [ember] [plum]  |  EXPERIMENTAL  [aurora] [forest] [gold]
```
Divider is `.scheme-divider` (1px vertical rule). Aurora swatch has spinning conic gradient animation.

## CSS variables
```css
--ink: #111; --dim: #888; --rule: #d0d0d0; --bg: #fff;
--accent: #1d4ed8; --acc-mid: #3b82f6; --acc-bg: #eff6ff;
--accent-r: 29; --accent-g: 78; --accent-b: 216;
--col-w: 295px; --pt-size: 12px; --pt-lh: 1.205;
--text-col: 712px;
```

## Dependencies
- `model-viewer` v3.5.0 from Google CDN (index.html + patent.html)
- `p5.js` v1.9.4 from cdnjs (index.html + progress.html)
- `d3-delaunay@6` from jsdelivr (index.html — used by sketch.js for particle formations)
- Google Fonts: EB Garamond + IBM Plex Mono + Inter (Inter only in index.html)

## Known limitations / pending work
- **REBUILD v1 default camera:** still using placeholder `45deg 54.74deg 120%`
- **Fig angles:** FIG 1, 2, 4A, 5A, 5B, 6A, 6B still use percentage orbit values, not metre-based exact angles
- **progress.html:** Built — scroll-animated skeleton SVG + vertical timeline (5 phases, anime.js, expandable blocks)
- **Primary CTA button:** Fixed — now links to `progress.html`
- **Hotspot positions:** May need fine-tuning (current Y-up coordinates are estimated)
- **newmodels/ folder:** Contains staged next model versions (nd_13.glb, rojas.glb, rebuild.glb) — not yet wired into the site
- **Patent figures:** images/figs/ has all 16 drawing sheets as PNGs — not yet embedded in patent.html

## Deploy
```bash
cd C:\Users\ericd\ArletteGellerNew\website
git add <files>
git commit -m "message"
git push origin main
# GitHub Pages auto-deploys from main branch (~1-2 min)
```
