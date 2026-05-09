/* ── Color scheme switcher ────────────────────────────── */
const SCHEMES = {
  blueprint: { accent: '#1d4ed8', mid: '#3b82f6', bg: '#eff6ff', ar: 29,  ag: 78,  ab: 216 },
  teal:      { accent: '#0d9488', mid: '#2dd4bf', bg: '#f0fdfa', ar: 13,  ag: 148, ab: 136 },
  ember:     { accent: '#c2410c', mid: '#f97316', bg: '#fff7ed', ar: 194, ag: 65,  ab: 12  },
  plum:      { accent: '#7c3aed', mid: '#a78bfa', bg: '#f5f3ff', ar: 124, ag: 58,  ab: 237 },
  // experimental
  forest:    { accent: '#16a34a', mid: '#4ade80', bg: '#f0fdf4', ar: 22,  ag: 163, ab: 74  },
  gold:      { accent: '#d97706', mid: '#fcd34d', bg: '#fffbeb', ar: 217, ag: 119, ab: 6   },
};

/* HSL → [r,g,b] 0-255 */
function hslToRgb(h, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k = (n + h / 30) % 12;
    return Math.round((l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)))) * 255);
  };
  return [f(0), f(8), f(4)];
}

let _auroraRaf = null;
function _stopAurora() {
  if (_auroraRaf) { cancelAnimationFrame(_auroraRaf); _auroraRaf = null; }
}

function applyScheme(name) {
  _stopAurora();

  if (name === 'aurora') {
    const t0 = performance.now();
    (function tick(now) {
      const h   = ((now - t0) / 18000 * 360) % 360;           // full cycle ~18 s
      const lum = 44 + Math.sin((now - t0) / 2400) * 3;       // subtle ±3% brightness pulse
      const [ar, ag, ab] = hslToRgb(h, 78, lum);
      const [mr, mg, mb] = hslToRgb((h + 28) % 360, 68, lum + 16);
      const css = document.documentElement.style;
      css.setProperty('--accent',   `rgb(${ar},${ag},${ab})`);
      css.setProperty('--acc-mid',  `rgb(${mr},${mg},${mb})`);
      css.setProperty('--acc-bg',   `hsl(${h.toFixed(0)},90%,97%)`);
      css.setProperty('--accent-r', ar);
      css.setProperty('--accent-g', ag);
      css.setProperty('--accent-b', ab);
      _auroraRaf = requestAnimationFrame(tick);
    })(t0);
    document.querySelectorAll('.swatch').forEach(sw =>
      sw.classList.toggle('active', sw.dataset.scheme === 'aurora')
    );
    return;
  }

  const s = SCHEMES[name];
  if (!s) return;
  const r = document.documentElement.style;
  r.setProperty('--accent',   s.accent);
  r.setProperty('--acc-mid',  s.mid);
  r.setProperty('--acc-bg',   s.bg);
  r.setProperty('--accent-r', s.ar);
  r.setProperty('--accent-g', s.ag);
  r.setProperty('--accent-b', s.ab);
  document.querySelectorAll('.swatch').forEach(sw => {
    sw.classList.toggle('active', sw.dataset.scheme === name);
  });
}

document.querySelectorAll('.swatch').forEach(sw => {
  sw.addEventListener('click', () => applyScheme(sw.dataset.scheme));
});

const viewer   = document.getElementById('mainViewer');
const figDisp  = document.getElementById('figDisplay');
const vBtns    = document.querySelectorAll('.vbtn, .vc-btn');
const mTabs    = document.querySelectorAll('.mtab');

let topMode = false;
const TOP_FOV    = 10.0;
const NORMAL_FOV = 26.2;

/* ── Per-part visibility state ────────────────────────── */
const visState = {};  // matIdx → false means hidden (default: visible)
function isVisible(i) { return visState[i] !== false; }

/* ── Per-material color palette ───────────────────────── */
const MAT_COLORS = [
  [0.52, 0.74, 0.96, 1.0],  // steel blue
  [0.96, 0.72, 0.32, 1.0],  // amber
  [0.50, 0.88, 0.62, 1.0],  // mint
  [0.90, 0.50, 0.50, 1.0],  // rose
  [0.78, 0.60, 0.94, 1.0],  // lavender
  [0.94, 0.88, 0.44, 1.0],  // gold
];

/* ── Shift model right so it clears the text column ──── */
function applyModelOffset() {
  try {
    const t = viewer.getCameraTarget();
    viewer.cameraTarget = `${(t.x - 38).toFixed(1)}m ${t.y.toFixed(1)}m ${t.z.toFixed(1)}m`;
  } catch(_) {}
}

function applyColors(mv) {
  const mats = mv.model?.materials;
  if (mats?.length) {
    mats.forEach((m, i) => {
      if (!isVisible(i)) {
        m.setAlphaMode?.('BLEND');
        m.pbrMetallicRoughness.setBaseColorFactor([0, 0, 0, 0]);
        return;
      }
      m.setAlphaMode?.('OPAQUE');
      m.pbrMetallicRoughness.setBaseColorFactor(MAT_COLORS[i % MAT_COLORS.length]);
      m.pbrMetallicRoughness.roughnessFactor = 0.5;
      m.pbrMetallicRoughness.metallicFactor  = 0.1;
    });
    return;
  }
  // Fallback: these models have no GLTF materials, apply color via Three.js scene
  // NOTE: per-part colors require re-exporting the GLB with separate named meshes
  try {
    mv.model.scene.traverse(obj => {
      if (!obj.isMesh) return;
      const list = Array.isArray(obj.material) ? obj.material : [obj.material];
      list.forEach((m, i) => {
        if (m.color) m.color.setRGB(...MAT_COLORS[i % MAT_COLORS.length].slice(0, 3));
        m.roughness = 0.5;
        m.metalness = 0.1;
        m.needsUpdate = true;
      });
    });
  } catch (_) {}
}

/* ── Snap camera + optionally swap model ──────────── */
function snapTo(orbit, label, src, target, fov, resetTurntable = false) {
  if (!viewer) return;
  viewer.removeAttribute('auto-rotate');
  if (resetTurntable) viewer.resetTurntableRotation?.(0);
  if (target) {
    const parts = target.trim().split(/\s+/);
    viewer.cameraTarget = parts.map(v => v.replace(/m$/, '') + 'm').join(' ');
  } else {
    viewer.cameraTarget = 'auto';
  }
  if (fov) viewer.fieldOfView = fov;
  viewer.cameraOrbit = orbit;
  if (figDisp) figDisp.textContent = label || '';
  vBtns.forEach(b => b.classList.toggle('active', b.dataset.orbit === orbit));
}

/* ── FIG reference click in text ─────────────────── */
document.querySelectorAll('.fig-ref').forEach(el => {
  el.style.cursor = 'pointer';
  el.addEventListener('click', () => {
    snapTo(el.dataset.orbit, el.dataset.label, el.dataset.src, el.dataset.target, el.dataset.fov, true);
    if (el.dataset.highlight !== undefined) {
      // give model-viewer one frame to settle before touching materials
      requestAnimationFrame(() => dimExceptPart(parseInt(el.dataset.highlight)));
    } else {
      requestAnimationFrame(() => applyColors(viewer));
    }
    if (figDisp) {
      figDisp.style.color = 'var(--ink)';
      setTimeout(() => figDisp.style.color = '', 600);
    }
  });
});

/* ── View preset buttons ──────────────────────────── */
vBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    topMode = btn.dataset.label === 'Top View';
    snapTo(btn.dataset.orbit, btn.dataset.label, btn.dataset.src, btn.dataset.target, btn.dataset.fov);
  });
});

/* ── Hotspot labels: click to zoom to part ────────── */
document.querySelectorAll('.hs').forEach(hs => {
  hs.addEventListener('click', () => {
    topMode = false;
    document.querySelectorAll('.hs.hs-active').forEach(h => h.classList.remove('hs-active'));
    hs.classList.add('hs-active');
    snapTo(hs.dataset.orbit, hs.dataset.label, null, hs.dataset.target, hs.dataset.fov);
  });
});

/* ── Top mode: exit on rotation, restore normal FOV ── */
viewer.addEventListener('camera-change', e => {
  if (!topMode || e.detail?.source !== 'user-interaction') return;
  try {
    const o = viewer.getCameraOrbit();
    if (Math.abs(o.phi) > 0.26) {
      topMode = false;
      const scale = Math.tan(TOP_FOV / 2 * Math.PI / 180) / Math.tan(NORMAL_FOV / 2 * Math.PI / 180);
      viewer.cameraOrbit = `${o.theta}rad ${o.phi}rad ${(o.radius * scale).toFixed(3)}m`;
      viewer.fieldOfView = NORMAL_FOV + 'deg';
    }
  } catch(_) {}
});

/* ── Per-model default camera positions ───────────── */
const MODEL_CAM = {
  'models/rojas.glb':   { orbit: '40.4deg 71.9deg 53.153m',  target: null,                    fov: '26.2deg' },
  'models/alt.glb':     { orbit: '30.5deg 66.5deg 128.400m', target: '-2.043 -1.926 -2.963',  fov: '20.1deg' },
  'models/rebuild.glb': { orbit: '45deg 54.74deg 120%',      target: null,                    fov: '30deg'   },
};

/* ── Model selector tabs ──────────────────────────── */
mTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    mTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    const src  = tab.dataset.src;
    const name = tab.dataset.name;

    viewer.src = src;
    viewer.addEventListener('load', () => {
      const cam = MODEL_CAM[src] || MODEL_CAM['models/rebuild.glb'];
      if (cam.target) {
        const parts = cam.target.trim().split(/\s+/);
        viewer.cameraTarget = parts.map(v => v + 'm').join(' ');
      } else {
        viewer.cameraTarget = 'auto';
      }
      viewer.fieldOfView  = cam.fov;
      viewer.cameraOrbit  = cam.orbit;
      viewer.jumpCameraToGoal();
      if (figDisp) figDisp.textContent = `${name} — Perspective`;
      applyColors(viewer);
      buildPartTree(viewer, src);
    }, { once: true });

    const showHotspots = src === 'models/rojas.glb';
    document.querySelectorAll('.hs').forEach(h => h.style.display = showHotspots ? '' : 'none');

    vBtns.forEach(b => b.classList.remove('active'));
    vBtns[0]?.classList.add('active');
  });
});

/* ── Initial model load ──────────────────────────── */
viewer.addEventListener('load', () => {
  applyColors(viewer);
  buildPartTree(viewer);
  viewer.cameraOrbit = '40.4deg 71.9deg 53.153m';
  viewer.fieldOfView = '26.2deg';
  viewer.jumpCameraToGoal();
}, { once: true });

/* ── Part tree collapse / expand ──────────────────── */
document.querySelectorAll('.tree-toggle').forEach(toggle => {
  toggle.addEventListener('click', e => {
    e.stopPropagation();
    const item     = toggle.closest('.tree-item');
    const children = item?.querySelector(':scope > .tree-children');
    if (!children) return;
    const open = children.style.display !== 'none';
    children.style.display = open ? 'none' : '';
    toggle.textContent = open ? '▶' : '▼';
  });
});

/* ── Per-part highlight (dims unselected materials) ── */
const HIGHLIGHT_COLORS = [
  [0.18, 0.55, 1.00, 1.0],  // vivid blue
  [1.00, 0.60, 0.05, 1.0],  // vivid amber
  [0.10, 0.85, 0.42, 1.0],  // vivid green
];

function highlightPart(matIdx) {
  const mats = viewer.model?.materials;
  if (!mats?.length) return;
  mats.forEach((m, i) => {
    m.setAlphaMode?.('OPAQUE');
    const color = i === matIdx
      ? HIGHLIGHT_COLORS[i % HIGHLIGHT_COLORS.length]
      : [0.60, 0.60, 0.60, 1.0];
    m.pbrMetallicRoughness.setBaseColorFactor(color);
  });
}

function dimExceptPart(matIdx) {
  const mats = viewer.model?.materials;
  if (!mats?.length) return;
  mats.forEach((m, i) => {
    if (!isVisible(i)) {
      m.setAlphaMode?.('BLEND');
      m.pbrMetallicRoughness.setBaseColorFactor([0, 0, 0, 0]);
      return;
    }
    if (i === matIdx) {
      m.setAlphaMode?.('OPAQUE');
      m.pbrMetallicRoughness.setBaseColorFactor(MAT_COLORS[i % MAT_COLORS.length]);
      m.pbrMetallicRoughness.roughnessFactor = 0.5;
      m.pbrMetallicRoughness.metallicFactor  = 0.1;
    } else {
      m.setAlphaMode?.('BLEND');
      const c = MAT_COLORS[i % MAT_COLORS.length];
      m.pbrMetallicRoughness.setBaseColorFactor([c[0], c[1], c[2], 0.22]);
      m.pbrMetallicRoughness.roughnessFactor = 0.5;
      m.pbrMetallicRoughness.metallicFactor  = 0.1;
    }
  });
}

function setPartVisibility(matIdx, visible) {
  visState[matIdx] = visible;
  const mats = viewer.model?.materials;
  if (!mats?.length) return;
  const m = mats[matIdx];
  if (!m) return;
  if (visible) {
    m.setAlphaMode?.('OPAQUE');
    m.pbrMetallicRoughness.setBaseColorFactor(MAT_COLORS[matIdx % MAT_COLORS.length]);
    m.pbrMetallicRoughness.roughnessFactor = 0.5;
    m.pbrMetallicRoughness.metallicFactor  = 0.1;
  } else {
    m.setAlphaMode?.('BLEND');
    m.pbrMetallicRoughness.setBaseColorFactor([0, 0, 0, 0]);
  }
}

/* ── Dynamic part tree ─────────────────────────────────── */
const PART_ORBIT_MAP = {
  'Expansor': '30deg 65deg 90%', 'Body': '30deg 65deg 90%',
  'Drawstring': '85deg 88deg 52%', 'Drawstring & Knot': '85deg 88deg 52%', 'Knot': '85deg 88deg 52%',
  'Ring': '85deg 88deg 52%', 'Loop': '85deg 88deg 52%',
  'Plunger': '-20deg 60deg 130%', 'Outer Tube': '-20deg 60deg 130%',
};
const PART_RN_MAP = {
  'Expansor': '16', 'Body': '16',
  'Drawstring': '20', 'Drawstring & Knot': '20', 'Knot': '20',
  'Ring': '22', 'Loop': '22',
  'Plunger': '26', 'Outer Tube': '28',
};

function buildPartTree(mv, activeSrc) {
  const treeList = document.querySelector('.tree-list');
  if (!treeList) return;
  const mats = mv.model?.materials;
  if (!mats?.length) return;
  const src = activeSrc || document.querySelector('.mtab.active')?.dataset.src || 'models/rojas.glb';

  treeList.innerHTML = mats.map((mat, i) => {
    const name   = mat.name || `Part ${i + 1}`;
    const rn     = PART_RN_MAP[name] || '';
    const orbit  = PART_ORBIT_MAP[name] || '30deg 65deg 90%';
    return `<li class="tree-item">
      <div class="tree-row" data-orbit="${orbit}" data-label="${name}" data-src="${src}" data-mat-idx="${i}">
        <span class="tree-dot">·</span>
        <span class="tree-name">${name}</span>${rn ? `<span class="tree-rn">${rn}</span>` : ''}
        <button class="tree-vis-btn" data-mat-idx="${i}" title="Toggle visibility">
          <svg width="11" height="8" viewBox="0 0 11 8" fill="none">
            <ellipse cx="5.5" cy="4" rx="4.5" ry="3" stroke="currentColor" stroke-width="1.1"/>
            <circle cx="5.5" cy="4" r="1.4" fill="currentColor"/>
          </svg>
        </button>
      </div>
    </li>`;
  }).join('');
}

/* ── Tree event delegation (handles dynamically-built rows) ── */
document.querySelector('.tree-list')?.addEventListener('click', e => {
  const visBtn = e.target.closest('.tree-vis-btn');
  if (visBtn) {
    e.stopPropagation();
    const idx = parseInt(visBtn.dataset.matIdx);
    const nowVisible = !isVisible(idx);
    setPartVisibility(idx, nowVisible);
    visBtn.classList.toggle('vis-hidden', !nowVisible);
    return;
  }
  const row = e.target.closest('.tree-row[data-orbit]');
  if (!row) return;
  const wasActive = row.classList.contains('active');
  const matIdx    = row.dataset.matIdx !== undefined ? parseInt(row.dataset.matIdx) : -1;
  document.querySelectorAll('.tree-row.active').forEach(r => r.classList.remove('active'));
  const rn = row.querySelector('.tree-rn')?.textContent.trim();
  document.querySelectorAll('.hs.hs-active').forEach(h => h.classList.remove('hs-active'));
  if (wasActive) {
    applyColors(viewer);
  } else {
    row.classList.add('active');
    if (rn) document.getElementById(`hs-${rn}`)?.classList.add('hs-active');
    if (matIdx >= 0) highlightPart(matIdx); else applyColors(viewer);
  }
});

/* ── Auto-rotate: stop permanently on first interaction ── */
viewer.addEventListener('pointerdown', () => viewer.removeAttribute('auto-rotate'), { once: true });



/* ── Cover viewer: stop auto-rotate on first touch ── */
const coverViewer = document.getElementById('coverViewer');
if (coverViewer) {
  const stop = () => coverViewer.removeAttribute('auto-rotate');
  coverViewer.addEventListener('camera-change', stop, { once: true });
}

/* ── Trackball gizmo ─────────────────────────────────── */
(function() {
  const canvas = document.getElementById('gizmoCanvas');
  if (!canvas || !viewer) return;

  const ctx  = canvas.getContext('2d');
  const SIZE = canvas.width;          // 76
  const CR   = SIZE * 0.42;           // sphere radius in px
  const CX   = SIZE / 2, CY = SIZE / 2;

  function dot3(a, b) { return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; }
  function cross3(a, b) {
    return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  }
  function norm3(v) {
    const l = Math.sqrt(dot3(v, v));
    return l > 1e-9 ? v.map(x => x/l) : [0,1,0];
  }

  function viewBasis(theta, phi) {
    const fwd = [
      Math.sin(phi) * Math.sin(theta),
      Math.cos(phi),
     -Math.sin(phi) * Math.cos(theta)
    ];
    let right = norm3(cross3(fwd, [0,1,0]));
    if (Math.abs(dot3(right, right)) < 0.001) right = [1,0,0];
    const up = norm3(cross3(right, fwd));
    return { fwd, right, up };
  }

  function proj(p, right, up) {
    return [CX + CR * dot3(p, right), CY - CR * dot3(p, up)];
  }

  function drawSphereLines(fwd, right, up) {
    // latitude rings
    for (let latDeg = -60; latDeg <= 60; latDeg += 30) {
      const lat = latDeg * Math.PI / 180;
      const yr  = Math.sin(lat), xzr = Math.cos(lat);
      ctx.beginPath();
      let pen = false;
      for (let i = 0; i <= 72; i++) {
        const t = (i / 72) * Math.PI * 2;
        const p = [xzr * Math.cos(t), yr, xzr * Math.sin(t)];
        if (dot3(p, fwd) > -0.04) {
          const [px, py] = proj(p, right, up);
          pen ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
          pen = true;
        } else { pen = false; }
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.20)';
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }
    // longitude arcs
    for (let lonDeg = 0; lonDeg < 360; lonDeg += 30) {
      const lon = lonDeg * Math.PI / 180;
      ctx.beginPath();
      let pen = false;
      for (let i = 0; i <= 72; i++) {
        const t = (i / 72) * Math.PI * 2;
        const p = [Math.sin(t)*Math.cos(lon), Math.cos(t), Math.sin(t)*Math.sin(lon)];
        if (dot3(p, fwd) > -0.04) {
          const [px, py] = proj(p, right, up);
          pen ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
          pen = true;
        } else { pen = false; }
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.20)';
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }
  }

  function drawAxes(fwd, right, up) {
    const AXES = [
      { v:[1,0,0], col:'#f87171', lbl:'X' },
      { v:[0,1,0], col:'#4ade80', lbl:'Y' },
      { v:[0,0,1], col:'#60a5fa', lbl:'Z' },
    ];
    // back-facing first (dimmed)
    AXES.forEach(({ v, col, lbl }) => {
      if (dot3(v, fwd) >= 0) return;
      const s = 0.76;
      const [px, py] = proj(v.map(c => c*s), right, up);
      ctx.beginPath(); ctx.moveTo(CX, CY); ctx.lineTo(px, py);
      ctx.strokeStyle = col + '44'; ctx.lineWidth = 1; ctx.stroke();
    });
    // front-facing on top
    AXES.forEach(({ v, col, lbl }) => {
      if (dot3(v, fwd) < 0) return;
      const s = 0.80;
      const [px, py] = proj(v.map(c => c*s), right, up);
      ctx.beginPath(); ctx.moveTo(CX, CY); ctx.lineTo(px, py);
      ctx.strokeStyle = col + 'cc'; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.beginPath(); ctx.arc(px, py, SIZE*0.055, 0, Math.PI*2);
      ctx.fillStyle = col + 'dd'; ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.round(SIZE*0.12)}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(lbl, px, py);
    });
  }

  function draw(theta, phi) {
    ctx.clearRect(0, 0, SIZE, SIZE);
    const { fwd, right, up } = viewBasis(theta, phi);

    // sphere fill
    const grd = ctx.createRadialGradient(CX-CR*.28, CY-CR*.32, CR*.04, CX, CY, CR);
    grd.addColorStop(0,   'rgba(232,238,255,0.94)');
    grd.addColorStop(0.6, 'rgba(155,175,228,0.84)');
    grd.addColorStop(1,   'rgba(75,100,170,0.76)');
    ctx.beginPath(); ctx.arc(CX, CY, CR, 0, Math.PI*2);
    ctx.fillStyle = grd; ctx.fill();

    drawSphereLines(fwd, right, up);
    drawAxes(fwd, right, up);

    // outline
    ctx.beginPath(); ctx.arc(CX, CY, CR, 0, Math.PI*2);
    ctx.strokeStyle = 'rgba(110,135,195,0.65)'; ctx.lineWidth = 1.2; ctx.stroke();
  }

  // rAF loop — always in sync with camera including auto-rotate
  let theta = 45 * Math.PI/180, phi = 54.74 * Math.PI/180;
  const camText = document.getElementById('camText');
  (function loop() {
    try {
      const o = viewer.getCameraOrbit();
      theta = o.theta; phi = o.phi;
      if (camText) {
        const td  = (o.theta * 180 / Math.PI).toFixed(1);
        const pd  = (o.phi   * 180 / Math.PI).toFixed(1);
        const r   = o.radius.toFixed(3);
        const t   = viewer.getCameraTarget();
        const tx  = t.x.toFixed(3), ty = t.y.toFixed(3), tz = t.z.toFixed(3);
        const fov = viewer.getFieldOfView?.()?.toFixed(1) ?? '—';
        const rx  = document.getElementById('rotX')?.value ?? '0';
        const ry  = document.getElementById('rotY')?.value ?? '0';
        const rz  = document.getElementById('rotZ')?.value ?? '0';
        camText.textContent =
          `orbit  ${td}deg ${pd}deg ${r}m\n` +
          `target ${tx} ${ty} ${tz}\n` +
          `fov    ${fov}deg\n` +
          `rot    X:${rx} Y:${ry} Z:${rz}`;
      }
    } catch(_) {}
    draw(theta, phi);
    requestAnimationFrame(loop);
  })();

  // drag to orbit camera
  let dragging = false, lastX = 0, lastY = 0;

  function startDrag(x, y) {
    dragging = true; lastX = x; lastY = y;
    viewer.removeAttribute('auto-rotate');
  }
  function moveDrag(x, y) {
    if (!dragging) return;
    const dx = x - lastX, dy = y - lastY;
    lastX = x; lastY = y;
    try {
      const o   = viewer.getCameraOrbit();
      const phi2 = Math.max(0.01, Math.min(Math.PI - 0.01, o.phi + dy * 0.013));
      viewer.cameraOrbit = `${o.theta - dx * 0.013}rad ${phi2}rad ${o.radius}m`;
    } catch(_) {}
  }

  canvas.addEventListener('mousedown',  e => { e.preventDefault(); e.stopPropagation(); startDrag(e.clientX, e.clientY); });
  document.addEventListener('mousemove', e => moveDrag(e.clientX, e.clientY));
  document.addEventListener('mouseup',   () => { dragging = false; });

  canvas.addEventListener('touchstart', e => { e.preventDefault(); startDrag(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
  document.addEventListener('touchmove', e => { if (dragging) moveDrag(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
  document.addEventListener('touchend',  () => { dragging = false; });
})();

/* ── Model/text pointer-events partition ─────────────── */
(function() {
  const vw      = document.querySelector('.viewer-wrap');
  const regions = ['.patent-intro', '.two-col'].map(s => document.querySelector(s)).filter(Boolean);
  if (!vw) return;
  document.addEventListener('mousemove', e => {
    const over = regions.some(el => {
      const r = el.getBoundingClientRect();
      return e.clientX >= r.left && e.clientX <= r.right &&
             e.clientY >= r.top  && e.clientY <= r.bottom;
    });
    vw.style.pointerEvents = over ? 'none' : 'auto';
  }, { passive: true });
})();

/* ── Zoom bar (tracks orbit radius, same axis as scroll wheel) ── */
(function() {
  const track = document.getElementById('zoomTrack');
  const fill  = document.getElementById('zoomFill');
  const thumb = document.getElementById('zoomThumb');
  if (!track || !viewer) return;

  let minR = null, maxR = null, dragging = false;

  function setUI(r) {
    if (minR === null) return;
    const t = 1 - Math.max(0, Math.min(1, (r - minR) / (maxR - minR)));
    fill.style.height  = (t * 100).toFixed(1) + '%';
    thumb.style.bottom = (t * 100).toFixed(1) + '%';
  }

  viewer.addEventListener('load', () => {
    try {
      const r = viewer.getCameraOrbit().radius;
      minR = r * 0.35;
      maxR = r * 3.0;
      viewer.setAttribute('max-camera-orbit', `Infinity 180deg ${maxR.toFixed(1)}m`);
      setUI(r);
    } catch(_) {}
  });

  viewer.addEventListener('camera-change', () => {
    if (!dragging) {
      try { setUI(viewer.getCameraOrbit().radius); } catch(_) {}
    }
  });

  function applyFromEvent(e) {
    if (minR === null) return;
    const y    = e.touches ? e.touches[0].clientY : e.clientY;
    const rect = track.getBoundingClientRect();
    const t    = Math.max(0, Math.min(1, (y - rect.top) / rect.height));
    const r    = minR + t * (maxR - minR);
    const o    = viewer.getCameraOrbit();
    viewer.cameraOrbit = `${o.theta}rad ${o.phi}rad ${r.toFixed(3)}m`;
    setUI(r);
  }

  track.addEventListener('mousedown',  e => { dragging = true;  applyFromEvent(e); e.preventDefault(); });
  track.addEventListener('touchstart', e => { dragging = true;  applyFromEvent(e); }, { passive: true });
  document.addEventListener('mousemove',  e => { if (dragging) applyFromEvent(e); });
  document.addEventListener('touchmove',  e => { if (dragging) applyFromEvent(e); }, { passive: true });
  document.addEventListener('mouseup',   () => { dragging = false; });
  document.addEventListener('touchend',  () => { dragging = false; });
})();

/* ── Model rotation panel (lerp-smoothed) ─────────────── */
(function() {
  const sliders = {
    x: document.getElementById('rotX'),
    y: document.getElementById('rotY'),
    z: document.getElementById('rotZ'),
  };
  const vals = {
    x: document.getElementById('rotXVal'),
    y: document.getElementById('rotYVal'),
    z: document.getElementById('rotZVal'),
  };
  const resetBtn = document.getElementById('rotReset');
  if (!sliders.x || !viewer) return;

  const LERP = 0.15;
  const target  = { x: 0, y: 0, z: 0 };
  const current = { x: 0, y: 0, z: 0 };
  let rafId = null;

  function tick() {
    const dx = target.x - current.x;
    const dy = target.y - current.y;
    const dz = target.z - current.z;
    if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) < 0.01) {
      current.x = target.x; current.y = target.y; current.z = target.z;
      viewer.orientation = `${current.x}deg ${current.y}deg ${current.z}deg`;
      rafId = null;
      return;
    }
    current.x += dx * LERP;
    current.y += dy * LERP;
    current.z += dz * LERP;
    viewer.orientation = `${current.x.toFixed(2)}deg ${current.y.toFixed(2)}deg ${current.z.toFixed(2)}deg`;
    rafId = requestAnimationFrame(tick);
  }

  function onSlider() {
    target.x = parseFloat(sliders.x.value);
    target.y = parseFloat(sliders.y.value);
    target.z = parseFloat(sliders.z.value);
    vals.x.textContent = target.x.toFixed(1) + '°';
    vals.y.textContent = target.y.toFixed(1) + '°';
    vals.z.textContent = target.z.toFixed(1) + '°';
    if (!rafId) rafId = requestAnimationFrame(tick);
  }

  function resetRotation() {
    target.x = 0; target.y = 0; target.z = 0;
    current.x = 0; current.y = 0; current.z = 0;
    sliders.x.value = 0; sliders.y.value = 0; sliders.z.value = 0;
    vals.x.textContent = '0°'; vals.y.textContent = '0°'; vals.z.textContent = '0°';
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    viewer.orientation = '0deg 0deg 0deg';
  }

  ['x', 'y', 'z'].forEach(axis => sliders[axis].addEventListener('input', onSlider));
  resetBtn?.addEventListener('click', resetRotation);
  viewer.addEventListener('load', resetRotation);
})();

/* ── Scroll wheel: gentle zoom for all modes ────────────── */
(function() {
  viewer.addEventListener('wheel', e => {
    e.preventDefault();
    e.stopImmediatePropagation();
    try {
      const o    = viewer.getCameraOrbit();
      const step = topMode ? 0.00110 : 0.00060;
      const newR = o.radius * (1 + e.deltaY * step);
      // model-viewer's min/max-camera-orbit clamps the result automatically
      viewer.cameraOrbit = `${o.theta}rad ${o.phi}rad ${newR.toFixed(3)}m`;
    } catch(_) {}
  }, { passive: false, capture: true });
})();
