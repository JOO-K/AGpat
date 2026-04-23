const viewer   = document.getElementById('mainViewer');
const figDisp  = document.getElementById('figDisplay');
const vBtns    = document.querySelectorAll('.vbtn');
const mTabs    = document.querySelectorAll('.mtab');

/* ── Per-material color palette ───────────────────────── */
const MAT_COLORS = [
  [0.52, 0.74, 0.96, 1.0],  // steel blue  — applicator body
  [0.96, 0.72, 0.32, 1.0],  // amber       — expansor spring
  [0.50, 0.88, 0.62, 1.0],  // mint        — extraction mechanism
  [0.90, 0.50, 0.50, 1.0],  // rose        — drawstring/loop
  [0.78, 0.60, 0.94, 1.0],  // lavender    — extra parts
  [0.94, 0.88, 0.44, 1.0],  // gold        — extra parts
];

function applyColors(mv) {
  const mats = mv.model?.materials;
  if (!mats?.length) return;
  mats.forEach((m, i) => {
    m.pbrMetallicRoughness.setBaseColorFactor(MAT_COLORS[i % MAT_COLORS.length]);
    m.pbrMetallicRoughness.roughnessFactor = 0.55;
    m.pbrMetallicRoughness.metallicFactor  = 0.15;
  });
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
      viewer.cameraOrbit = '30deg 65deg 90%';
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
