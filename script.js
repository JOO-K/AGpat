/* ── Color scheme switcher ────────────────────────────── */
const SCHEMES = {
  blueprint: { accent: '#1d4ed8', mid: '#3b82f6', bg: '#eff6ff' },
  teal:      { accent: '#0d9488', mid: '#2dd4bf', bg: '#f0fdfa' },
  ember:     { accent: '#c2410c', mid: '#f97316', bg: '#fff7ed' },
  plum:      { accent: '#7c3aed', mid: '#a78bfa', bg: '#f5f3ff' },
};

function applyScheme(name) {
  const s = SCHEMES[name];
  if (!s) return;
  const r = document.documentElement.style;
  r.setProperty('--accent',  s.accent);
  r.setProperty('--acc-mid', s.mid);
  r.setProperty('--acc-bg',  s.bg);
  document.querySelectorAll('.swatch').forEach(sw => {
    sw.classList.toggle('active', sw.dataset.scheme === name);
  });
}

document.querySelectorAll('.swatch').forEach(sw => {
  sw.addEventListener('click', () => applyScheme(sw.dataset.scheme));
});

const viewer   = document.getElementById('mainViewer');
const figDisp  = document.getElementById('figDisplay');
const vBtns    = document.querySelectorAll('.vbtn');
const mTabs    = document.querySelectorAll('.mtab');

/* ── Per-material color palette ───────────────────────── */
const MAT_COLORS = [
  [0.52, 0.74, 0.96, 1.0],  // steel blue
  [0.96, 0.72, 0.32, 1.0],  // amber
  [0.50, 0.88, 0.62, 1.0],  // mint
  [0.90, 0.50, 0.50, 1.0],  // rose
  [0.78, 0.60, 0.94, 1.0],  // lavender
  [0.94, 0.88, 0.44, 1.0],  // gold
];

function applyColors(mv) {
  // Try GLTF materials API first
  const mats = mv.model?.materials;
  if (mats?.length) {
    mats.forEach((m, i) => {
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
function snapTo(orbit, label, src) {
  if (!viewer) return;

  const load = () => { viewer.cameraOrbit = orbit; };

  if (src) {
    const resolved = new URL(src, location.href).href;
    if (viewer.src !== resolved) {
      viewer.src = src;
      viewer.addEventListener('load', load, { once: true });
    } else {
      load();
    }
  } else {
    load();
  }

  if (figDisp) figDisp.textContent = label || '';

  vBtns.forEach(b => {
    b.classList.toggle('active', b.dataset.orbit === orbit);
  });
}

/* ── FIG reference click in text ─────────────────── */
document.querySelectorAll('.fig-ref').forEach(el => {
  el.style.cursor = 'pointer';
  el.addEventListener('click', () => {
    snapTo(el.dataset.orbit, el.dataset.label, el.dataset.src);
    // briefly flash the fig-display to confirm the change
    if (figDisp) {
      figDisp.style.color = 'var(--ink)';
      setTimeout(() => figDisp.style.color = '', 600);
    }
  });
});

/* ── View preset buttons ──────────────────────────── */
vBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    snapTo(btn.dataset.orbit, btn.dataset.label, btn.dataset.src);
  });
});

/* ── Model selector tabs ──────────────────────────── */
mTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    mTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    const src  = tab.dataset.src;
    const name = tab.dataset.name;

    viewer.src = src;
    viewer.addEventListener('load', () => {
      viewer.cameraOrbit = '45deg 54.74deg 90%';
      if (figDisp) figDisp.textContent = `${name} — Perspective`;
      applyColors(viewer);
    }, { once: true });

    vBtns.forEach(b => b.classList.remove('active'));
    vBtns[0]?.classList.add('active');
  });
});

/* ── Initial material colors ──────────────────────── */
viewer.addEventListener('load', () => applyColors(viewer), { once: true });

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

/* ── Part tree navigation ─────────────────────────── */
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

/* ── IntersectionObserver: auto-update on scroll ──── */
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const s = entry.target;
    if (s.dataset.orbit) snapTo(s.dataset.orbit, s.dataset.label, s.dataset.src);
    document.querySelectorAll('section.in-view').forEach(x => x.classList.remove('in-view'));
    s.classList.add('in-view');
  });
}, { threshold: 0.25 });

document.querySelectorAll('section[data-orbit]').forEach(s => observer.observe(s));

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

  let theta = 45 * Math.PI/180;
  let phi   = 54.74 * Math.PI/180;
  draw(theta, phi);

  // sync with camera
  function syncFromCamera() {
    try {
      const o = viewer.getCameraOrbit();
      theta = o.theta; phi = o.phi;
      draw(theta, phi);
    } catch(_) {}
  }
  viewer.addEventListener('camera-change', syncFromCamera);
  viewer.addEventListener('load', syncFromCamera);

  // drag to rotate model
  let dragging = false, lastX = 0, lastY = 0;

  canvas.addEventListener('mousedown', e => {
    e.preventDefault(); e.stopPropagation();
    dragging = true; lastX = e.clientX; lastY = e.clientY;
  });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    try {
      const o = viewer.getCameraOrbit();
      const newPhi = Math.max(0.01, Math.min(Math.PI - 0.01, o.phi + dy * 0.013));
      viewer.cameraOrbit = `${o.theta - dx * 0.013}rad ${newPhi}rad ${o.radius}m`;
    } catch(_) {}
  });
  document.addEventListener('mouseup', () => { dragging = false; });

  // touch support
  let lastTouch = null;
  canvas.addEventListener('touchstart', e => {
    e.preventDefault(); lastTouch = e.touches[0];
  }, { passive: false });
  document.addEventListener('touchmove', e => {
    if (!lastTouch) return;
    const t = e.touches[0];
    const dx = t.clientX - lastTouch.clientX, dy = t.clientY - lastTouch.clientY;
    lastTouch = t;
    try {
      const o = viewer.getCameraOrbit();
      const newPhi = Math.max(0.01, Math.min(Math.PI - 0.01, o.phi + dy * 0.013));
      viewer.cameraOrbit = `${o.theta - dx * 0.013}rad ${newPhi}rad ${o.radius}m`;
    } catch(_) {}
  }, { passive: true });
  document.addEventListener('touchend', () => { lastTouch = null; });
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
