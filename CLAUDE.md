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
  script.js        — All JS (snapTo, fig-refs, tree, tabs, colors, hotspots)
  sketch.js        — p5.js particle background (used by index + progress)
  models/
    rojas.glb      — Primary model (1.9MB, ROJAS v22) — single mesh, 0 GLTF materials
    alt.glb        — Alt embodiment (1.3MB, ALT v47) — same
    rebuild.glb    — Rebuild (1.2MB, REBUILD v1) — same
```

## Architecture: how the 3D overlay works
`patent.html` uses a fixed-position transparent overlay approach:

- `.patent-body` — full-width block, `pointer-events: none` (passes all events through)
- `.two-col` — the actual 672px text column, `position: relative; z-index: 15; pointer-events: auto`
- `.model-panel` — `position: fixed; inset: 0; pointer-events: none; z-index: 10` (the overlay container)
- `.viewer-wrap` — `position: absolute; left: 30%; right: 0; top: 0; bottom: 0; pointer-events: auto` (right 70% of screen, left 15% overlaps text)
- Result: model is controllable anywhere outside the 672px text column; text links/hovers work inside the column

## Key CSS rules (style.css)

### model-viewer appearance
```css
.main-viewer {
  background: transparent !important;
  --poster-color: transparent !important;
  filter: drop-shadow(0 0 2px rgba(90,90,90,0.45)) drop-shadow(0 0 6px rgba(60,60,60,0.18));
}
```

### Part tree panel (top-right, Fusion-style)
```css
.part-tree-panel {
  position: absolute;
  top: 3.8rem;   /* clears the sticky .patent-nav */
  right: 1.2rem;
  width: 230px;
  max-height: calc(100vh - 12rem);
  overflow-y: auto;
  background: rgba(255,255,255,0.94);
  backdrop-filter: blur(8px);
  border: 1px solid var(--rule);
  pointer-events: auto;
  z-index: 20;
}
```

### Hotspot highlight (active state on tree click)
```css
.hs.hs-active .hs-n {
  background: var(--accent);
  color: #fff;
  transform: scale(1.4);
  box-shadow: 0 0 0 4px rgba(29,78,216,0.25), 0 2px 10px rgba(0,0,0,0.2);
}
```

## Key JS (script.js)

### applyColors — Three.js fallback (GLBs have 0 GLTF materials)
```js
function applyColors(mv) {
  const mats = mv.model?.materials;
  if (mats?.length) { /* GLTF materials path */ return; }
  // All current GLBs are single mesh — this fallback applies one color
  try {
    mv.model.scene.traverse(obj => {
      if (!obj.isMesh) return;
      const list = Array.isArray(obj.material) ? obj.material : [obj.material];
      list.forEach((m, i) => {
        if (m.color) m.color.setRGB(...MAT_COLORS[i % MAT_COLORS.length].slice(0, 3));
        m.roughness = 0.5; m.metalness = 0.1; m.needsUpdate = true;
      });
    });
  } catch (_) {}
}
```

### Part tree click — zooms camera + highlights hotspot
```js
document.querySelectorAll('.tree-row[data-orbit]').forEach(row => {
  row.addEventListener('click', () => {
    snapTo(row.dataset.orbit, row.dataset.label, row.dataset.src);
    document.querySelectorAll('.tree-row.active').forEach(r => r.classList.remove('active'));
    row.classList.add('active');
    const rn = row.querySelector('.tree-rn')?.textContent.trim();
    document.querySelectorAll('.hs.hs-active').forEach(h => h.classList.remove('hs-active'));
    if (rn) document.getElementById(`hs-${rn}`)?.classList.add('hs-active');
  });
});
```

## Part tree hierarchy (patent reference numbers)
```
Speculum Assembly (10)
  Applicator (14)
    Outer Tube (28)
    Plunger (26)
  Speculum (12)
    Expansor (16)
      Distal Transitions (38)    — peaks
      Longitudinal Sections (44)
      Proximal Transitions (40)  — valleys
        Loops / Coils (42)
    Extraction Mechanism (18)
      Drawstring (20)
      Loop / Ring (22)
```

## Hotspot IDs and positions (in model-viewer)
All on `mainViewer`, slot names are `hotspot-{rn}`, element IDs are `hs-{rn}`:
- `hs-16` Expansor — position `33 0 203`
- `hs-38` Distal Transitions — position `0 0 290`
- `hs-40` Proximal Transitions — position `30 0 118`
- `hs-44` Longitudinal Sections — position `-33 0 203`
- `hs-42` Loops/Coils — position `20 -30 118`
- `hs-20` Drawstring — position `0 -37 114`
- `hs-22` Loop/Ring — position `-15 -35 112`
- `hs-26` Plunger — position `0 0 295`
- `hs-28` Outer Tube — position `-33 0 260`

## Camera orbit presets used
- Perspective default: `30deg 65deg 90%`
- FIG 1 (exploded): `-20deg 60deg 135%`
- FIG 2 (assembled): `40deg 65deg 105%`
- FIG 4B (top, expanded): `0deg 3deg 100%`
- FIG 5A (contracted): `30deg 65deg 68%`
- FIG 5B (top, contracted): `0deg 3deg 68%`
- FIG 6A (side): `90deg 90deg 100%`
- FIG 6B (enlarged drawstring): `85deg 88deg 52%`

## Known limitations / pending work
- **Per-part colors:** All three GLBs are single-mesh with no material groups. The Three.js fallback applies one color to the whole model. True per-part colors require re-exporting from source 3D files (Fusion 360 or Blender) with separate named mesh primitives per part and different materials assigned.
- **progress.html:** Stub only. Needs real content (development history, prototype iterations, commercialization roadmap).
- **RL3T logo:** Currently text placeholder. Real logo asset not yet provided.
- **Hotspot positions:** May need tuning depending on exact GLB scale/origin. Coordinates are in mm (model-viewer interprets based on model units).

## Dependencies
- `model-viewer` v3.5.0 from Google CDN (patent.html only)
- `p5.js` v1.9.4 from cdnjs (index.html + progress.html, for particle background via sketch.js)
- Google Fonts: EB Garamond + IBM Plex Mono

## CSS variables
```css
--ink: #111; --dim: #888; --rule: #d0d0d0; --bg: #fff;
--accent: #1d4ed8; --acc-mid: #3b82f6; --acc-bg: #eff6ff;
--col-w: 295px; --pt-size: 12px; --pt-lh: 1.205;
```

## Deploy
```bash
git add <files>
git commit -m "message"
git push origin main
# GitHub Pages auto-deploys from main branch
```
