const viewer   = document.getElementById('mainViewer');
const figDisp  = document.getElementById('figDisplay');
const vBtns    = document.querySelectorAll('.vbtn');
const mTabs    = document.querySelectorAll('.mtab');

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
    // reset to perspective after load
    viewer.addEventListener('load', () => {
      viewer.cameraOrbit = '30deg 65deg 100%';
      if (figDisp) figDisp.textContent = `${name} — Perspective`;
    }, { once: true });

    vBtns.forEach(b => b.classList.remove('active'));
    vBtns[0]?.classList.add('active');
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
