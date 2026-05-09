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
  index.html       — Landing page (RL3T logo, two CTA buttons)
  patent.html      — Main page: two-col patent text + floating 3D viewer
  progress.html    — Stub "Development Updates" page (placeholder content)
  style.css        — All styles
  script.js        — All JS (snapTo, fig-refs, tree, tabs, colors, hotspots, zoom, rotation)
  sketch.js        — p5.js particle background (used by index + progress)
  models/
    rojas.glb      — Primary model (ROJAS v22)
    alt.glb        — Alt embodiment (ALT v47)
    rebuild.glb    — Rebuild (REBUILD v1)
```

## Architecture: how the 3D overlay works
`patent.html` uses a fixed-position transparent overlay approach:

- `.patent-body` — full-width block, `pointer-events: none` (passes all events through)
- `.two-col` — the actual 672px text column, `position: relative; z-index: 15; pointer-events: auto`
- `.model-panel` — `position: fixed; inset: 0; pointer-events: none; z-index: 10` (the overlay container)
- `.viewer-wrap` — `position: absolute; left: 0; right: 0; top: 0; bottom: 0; pointer-events: auto`
- Result: model is controllable anywhere outside the 672px text column; text links/hovers work inside the column
- JS pointer-events partition: `.viewer-wrap` pointer-events toggled to `none` when mouse is over `.patent-intro` or `.two-col`

## Key CSS rules (style.css)

### model-viewer appearance
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
<svg style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">
  <defs>
    <filter id="model-outline" color-interpolation-filters="sRGB" x="-8%" y="-8%" width="116%" height="116%">
      <feMorphology in="SourceAlpha" operator="dilate" radius="0.6" result="dilated"/>
      <feFlood flood-color="#000" flood-opacity="0.20" result="outline-color"/>
      <feComposite in="outline-color" in2="dilated" operator="in" result="outline"/>
      <feComposite in="SourceGraphic" in2="outline" operator="over"/>
    </filter>
  </defs>
</svg>
```
Gives a subtle silhouette edge — radius and opacity can be nudged if needed.

### model-viewer attributes (patent.html)
```html
camera-orbit="40.4deg 71.9deg 53.153m"
camera-target="auto"
min-camera-orbit="-Infinity 0deg 5m"
max-camera-orbit="Infinity 180deg auto"
field-of-view="26.2deg"
shadow-intensity="1.2"
exposure="1.15"
environment-image="neutral"
interpolation-decay="80"
```

### Part tree panel (top-right, Fusion-style)
```css
.part-tree-panel {
  position: absolute;
  top: 3.8rem;
  right: 1.2rem;
  width: 230px;
}
```

### cam-cluster (rotation panel + cam-info, vertically stacked)
```css
.cam-cluster {
  position: absolute;
  top: 50%;
  right: 1.2rem;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  z-index: 25;
}
```

## Key JS (script.js)

### Color schemes
4 core + 3 experimental (forest, gold, aurora):
```js
const SCHEMES = {
  blueprint: { accent: '#1d4ed8', mid: '#3b82f6', bg: '#eff6ff', ar: 29,  ag: 78,  ab: 216 },
  teal:      { accent: '#0d9488', mid: '#2dd4bf', bg: '#f0fdfa', ar: 13,  ag: 148, ab: 136 },
  ember:     { accent: '#c2410c', mid: '#f97316', bg: '#fff7ed', ar: 194, ag: 65,  ab: 12  },
  plum:      { accent: '#7c3aed', mid: '#a78bfa', bg: '#f5f3ff', ar: 124, ag: 58,  ab: 237 },
  // experimental
  forest:    { accent: '#16a34a', mid: '#4ade80', bg: '#f0fdf4', ar: 22,  ag: 163, ab: 74  },
  gold:      { accent: '#d97706', mid: '#fcd34d', bg: '#fffbeb', ar: 217, ag: 119, ab: 6   },
  // aurora: animated — handled separately in applyScheme, cycles hue every ~18s
};
```

Aurora scheme: rAF loop cycling hue via `hslToRgb()`, updates all `--accent` CSS vars in real time.
`_stopAurora()` is called at the start of every `applyScheme()` call to cancel the loop.

### Scroll wheel zoom
```js
// intercepts ALL scroll (not just top mode), lower sensitivity
const step = topMode ? 0.00055 : 0.00030;
const newR = o.radius * (1 + e.deltaY * step);
viewer.cameraOrbit = `${o.theta}rad ${o.phi}rad ${newR.toFixed(3)}m`;
// { passive: false, capture: true }
```

### Zoom bar range (set on model load)
```js
minR = r * 0.35;   // 35% of load radius
maxR = r * 3.0;    // 3× load radius
viewer.setAttribute('max-camera-orbit', `Infinity 180deg ${maxR.toFixed(1)}m`);
```

### Top mode (near-orthographic TOP view)
`topMode` flag set when TOP preset clicked. Different scroll step. Exits when `phi > 0.26 rad` (user tilts camera), scales radius to compensate FOV change.

### Model rotation panel
X/Y/Z sliders above cam-info. Uses `viewer.orientation = "Xdeg Ydeg Zdeg"` (official model-viewer API).
Lerp-smoothed: LERP=0.15, rAF loop. Resets on model tab switch.
camText copy output includes `rot X:n Y:n Z:n` on 4th line.

### Per-model camera defaults
```js
const MODEL_CAM = {
  'models/rojas.glb':   { orbit: '40.4deg 71.9deg 53.153m',  target: null,                    fov: '26.2deg' },
  'models/alt.glb':     { orbit: '30.5deg 66.5deg 128.400m', target: '-2.043 -1.926 -2.963',  fov: '20.1deg' },
  'models/rebuild.glb': { orbit: '45deg 54.74deg 120%',      target: null,                    fov: '30deg'   },
};
```

### Hotspots (ROJAS only — hidden on other models)
3 pill-label buttons, shown only when `src === 'models/rojas.glb'`:
- `hs-28` Outer Tube — position `−0.5 11.5 0`
- `hs-16` Expansor — position `2 7.5 0.5`
- `hs-20` Drawstring — position `0 3.5 0`

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
FIG 1:   -20deg 60deg 135%          (no target/fov override)
FIG 2:   40deg 65deg 105%
FIG 3A:  37.1deg 55.8deg 57.796m    target -0.491 10.752 -0.703  fov 15.7deg
FIG 3B:  37.1deg 55.8deg 57.796m    target -0.491 10.752 -0.703  fov 15.7deg  (same as 3A)
FIG 3C:  35.4deg 87.6deg 97.817m    target -0.010 7.262 0.205    fov 17.6deg  (SIDE)
FIG 3D:  35.4deg 87.6deg 97.817m    target -0.010 7.262 0.205    fov 17.6deg  (SIDE)
FIG 4A:  30deg 65deg 100%
FIG 4B:  41.5deg 0.0deg 110.4m      target -0.010 7.262 0.205    fov 10.0deg  (TOP)
FIG 5A:  30deg 65deg 68%
FIG 5B:  0deg 3deg 68%
FIG 6A:  90deg 90deg 100%
FIG 6B:  85deg 88deg 52%
FIG 7A/8A: alt.glb model
FIG 7B/8B: alt.glb model
```
Remaining figs (1, 2, 5A, 5B, 6A, 6B) still use old % orbit values — not yet updated to exact metres.

## Color scheme swatches (patent.html nav)
```
THEME  [blueprint] [teal] [ember] [plum]  |  EXPERIMENTAL  [aurora] [forest] [gold]
```
Divider is `.scheme-divider` (1px vertical rule). Aurora swatch is `.swatch-aurora` with spinning conic gradient.

## Known limitations / pending work
- **REBUILD v1 default camera:** not yet provided by user — using placeholder `45deg 54.74deg 120%`
- **Fig angles:** FIG 1, 2, 5A, 5B, 6A, 6B still use percentage orbit values, not metre-based exact angles
- **Per-part colors:** All GLBs are single-mesh with no material groups. True per-part colors require re-exporting from Fusion 360/Blender with separate named mesh primitives.
- **progress.html:** Stub only, needs real content.
- **Hotspot positions:** May need fine-tuning (current Y-up coordinates are estimated).

## Dependencies
- `model-viewer` v3.5.0 from Google CDN (patent.html only)
- `p5.js` v1.9.4 from cdnjs (index.html + progress.html)
- Google Fonts: EB Garamond + IBM Plex Mono

## CSS variables
```css
--ink: #111; --dim: #888; --rule: #d0d0d0; --bg: #fff;
--accent: #1d4ed8; --acc-mid: #3b82f6; --acc-bg: #eff6ff;
--accent-r: 29; --accent-g: 78; --accent-b: 216;
--col-w: 295px; --pt-size: 12px; --pt-lh: 1.205;
```

## Deploy
```bash
cd C:\Users\ericd\ArletteGellerNew\website
git add <files>
git commit -m "message"
git push origin main
# GitHub Pages auto-deploys from main branch (~1-2 min)
```
