new p5(function(p) {
  const N = 180;
  let dots        = [];
  let scrollVel   = 0;
  let lastScrollY = 0;
  let mX = -9999, mY = -9999;
  let idleFrames  = 0;
  let switchTimer = 0;       // frames since last formation switch
  let cutCooldown = 0;       // frames until next cut allowed
  let cutEffect   = 0;       // 0–1, decays after a cut, expands repulsion radius
  let formIdx     = 0;
  let allFormations = [];
  let formation   = [];
  let accentR = 29, accentG = 78, accentB = 216;

  const SWITCH_INTERVAL = 300; // auto-advance every 5 s at 60 fps

  function readAccent() {
    const hex = (getComputedStyle(document.documentElement)
      .getPropertyValue('--accent') || '#1d4ed8').trim().replace('#', '');
    accentR = parseInt(hex.substr(0, 2), 16);
    accentG = parseInt(hex.substr(2, 2), 16);
    accentB = parseInt(hex.substr(4, 2), 16);
  }

  // ── Formation 0 — FIG. 6A side view ──────────────────────
  // Outer cylinder rails + top dome cap + sinusoidal spring coil + extraction loop
  function buildSideView() {
    const cx = p.width / 2, cy = p.height / 2;
    const W  = Math.min(p.width, p.height) * 0.115;
    const H  = Math.min(p.width, p.height) * 0.48;
    const top = cy - H * 0.5, bot = cy + H * 0.5;
    const pts = [];

    const railN = 22;
    for (let i = 0; i < railN; i++) pts.push({ x: cx - W, y: top + (i / (railN - 1)) * H });
    for (let i = 0; i < railN; i++) pts.push({ x: cx + W, y: top + (i / (railN - 1)) * H });

    const capN = 16;
    for (let i = 0; i <= capN; i++) {
      const a = Math.PI + (i / capN) * Math.PI;
      pts.push({ x: cx + W * Math.cos(a), y: top + W * 0.45 * Math.sin(a) });
    }

    const coilN = 102;
    for (let i = 0; i < coilN; i++) {
      const t = i / (coilN - 1);
      pts.push({
        x: cx + W * 0.88 * Math.cos(t * 6 * Math.PI * 2),
        y: (top + W * 0.05) + t * H * 0.88
      });
    }

    const loopN = N - pts.length;
    const lrx = W * 0.38, lry = W * 0.24, lcy = bot + lry + 4;
    for (let i = 0; i < loopN; i++) {
      const a = (i / loopN) * Math.PI * 2;
      pts.push({ x: cx + lrx * Math.cos(a), y: lcy + lry * Math.sin(a) });
    }
    return pts;
  }

  // ── Formation 1 — FIG. 4B top view ───────────────────────
  // Rosette r = R + A·cos(6θ) with inner channel ring
  function buildTopView() {
    const cx = p.width / 2, cy = p.height / 2;
    const R  = Math.min(p.width, p.height) * 0.21;
    const A  = R * 0.26;
    const pts = [];

    const outerN = 144;
    for (let i = 0; i < outerN; i++) {
      const t = (i / outerN) * Math.PI * 2;
      const r = R + A * Math.cos(6 * t);
      pts.push({ x: cx + r * Math.cos(t), y: cy + r * Math.sin(t) });
    }
    const innerN = N - outerN;
    const Ri = R * 0.22;
    for (let i = 0; i < innerN; i++) {
      const t = (i / innerN) * Math.PI * 2;
      pts.push({ x: cx + Ri * Math.cos(t), y: cy + Ri * Math.sin(t) });
    }
    return pts;
  }

  // ── Formation 2 — FIG. 4A isometric coil ─────────────────
  // Six foreshortened ellipses stacked vertically — the 3/4-angle spring view
  function buildIsoCoil() {
    const cx  = p.width / 2, cy = p.height / 2;
    const W   = Math.min(p.width, p.height) * 0.20;
    const H   = Math.min(p.width, p.height) * 0.44;
    const nT  = 6;
    const eR  = 0.30; // y-compression (foreshortening)
    const pts = [];
    const ppt = Math.floor(N / nT);

    for (let turn = 0; turn < nT; turn++) {
      const tcy = cy - H / 2 + (turn + 0.5) * (H / nT);
      const n   = turn < nT - 1 ? ppt : N - pts.length;
      for (let i = 0; i < n; i++) {
        const t = (i / n) * Math.PI * 2;
        pts.push({ x: cx + W * Math.cos(t), y: tcy + W * eR * Math.sin(t) });
      }
    }
    return pts;
  }

  function advanceFormation(wasCut) {
    formIdx   = (formIdx + 1) % allFormations.length;
    formation = allFormations[formIdx];
    switchTimer = 0;
    if (wasCut) {
      cutEffect   = 1.0;
      cutCooldown = 90; // ~1.5 s before next cut
    }
  }

  // ── Particle ──────────────────────────────────────────────
  class Dot {
    constructor(i) {
      this.x     = p.random(p.width);
      this.y     = p.random(p.height);
      this.vx    = p.random(-0.22, 0.22);
      this.vy    = p.random(-0.14, 0.08);
      this.layer = p.floor(p.random(3));
      this.r     = [1.1, 2.0, 3.2][this.layer];
      this.pf    = [0.10, 0.24, 0.44][this.layer];
      this.hi    = i;
      this.seed  = p.random(100);
    }

    update(sv, strength, repR) {
      // Perlin noise — always-on gentle drift keeps particles alive in formation
      const ns = 0.0025, nt = p.frameCount * 0.005;
      this.vx += (p.noise(this.x * ns,      this.y * ns,      nt + this.seed) - 0.5) * 0.18;
      this.vy += (p.noise(this.x * ns + 40, this.y * ns + 40, nt + this.seed) - 0.5) * 0.18;

      // Formation attraction
      if (strength > 0 && this.hi < formation.length) {
        this.vx += (formation[this.hi].x - this.x) * strength;
        this.vy += (formation[this.hi].y - this.y) * strength;
      }

      // Mouse repulsion (radius expands on cut for burst effect)
      const dx = this.x - mX, dy = this.y - mY;
      const d2 = dx * dx + dy * dy;
      if (d2 < repR * repR && d2 > 1) {
        const d = Math.sqrt(d2);
        this.vx += (dx / d) * ((repR - d) / repR) * 2.6;
        this.vy += (dy / d) * ((repR - d) / repR) * 2.6;
      }

      this.vx *= 0.93; this.vy *= 0.93;
      this.x  += this.vx;
      this.y  += this.vy + sv * this.pf;

      if (this.x < -8)           this.x = p.width  + 8;
      if (this.x > p.width  + 8) this.x = -8;
      if (this.y < -8)           this.y = p.height + 8;
      if (this.y > p.height + 8) this.y = -8;
    }
  }

  // ── Setup ─────────────────────────────────────────────────
  p.setup = function() {
    const cnv = p.createCanvas(p.windowWidth, p.windowHeight);
    cnv.id('p5Canvas');
    cnv.style('position',       'fixed');
    cnv.style('top',            '0');
    cnv.style('left',           '0');
    cnv.style('pointer-events', 'none');
    cnv.style('z-index',        '0');

    readAccent();
    for (let i = 0; i < N; i++) dots.push(new Dot(i));
    allFormations = [buildSideView(), buildTopView(), buildIsoCoil()];
    formation     = allFormations[0];

    let pmX = -9999, pmY = -9999;

    window.addEventListener('mousemove', e => {
      pmX = mX; pmY = mY;
      mX  = e.clientX; mY = e.clientY;
      idleFrames = 0;

      // Cut: fast swipe through the formation zone advances to next figure
      if (pmX > 0 && cutCooldown === 0) {
        const speed  = Math.sqrt((mX - pmX) ** 2 + (mY - pmY) ** 2);
        const cx     = p.width / 2, cy = p.height / 2;
        const inZone = Math.sqrt((mX - cx) ** 2 + (mY - cy) ** 2) <
                       Math.min(p.width, p.height) * 0.34;
        if (speed > 22 && inZone) advanceFormation(true);
      }
    }, { passive: true });

    window.addEventListener('touchmove', e => {
      if (e.touches.length) { mX = e.touches[0].clientX; mY = e.touches[0].clientY; idleFrames = 0; }
    }, { passive: true });
    window.addEventListener('touchend', () => { mX = -9999; mY = -9999; }, { passive: true });
  };

  // ── Draw ──────────────────────────────────────────────────
  p.draw = function() {
    p.clear();
    scrollVel *= 0.86;
    idleFrames++;
    switchTimer++;
    if (cutCooldown > 0) cutCooldown--;
    cutEffect = Math.max(0, cutEffect - 0.028); // decays over ~36 frames

    // Auto-advance every 5 seconds
    if (switchTimer >= SWITCH_INTERVAL) advanceFormation(false);

    const formT    = Math.max(0, Math.min(1, (idleFrames - 120) / 200));
    const strength = formT * 0.011;
    const repR     = 140 + cutEffect * 180; // up to 320 during a cut burst

    // Blend line/dot color from cool grey toward accent as shape forms
    const t  = formT * 0.38;
    const lr = Math.round(148 + (accentR - 148) * t);
    const lg = Math.round(162 + (accentG - 162) * t);
    const lb = Math.round(190 + (accentB - 190) * t);
    const nr = Math.round(135 + (accentR - 135) * t);
    const ng = Math.round(148 + (accentG - 148) * t);
    const nb = Math.round(180 + (accentB - 180) * t);

    const layers = [[], [], []];
    for (const d of dots) { d.update(scrollVel, strength, repR); layers[d.layer].push(d); }

    const ALPHA = [16, 34, 60];
    const LW    = [0.35, 0.65, 1.05];
    const CDIST = [85, 115, 145];

    for (let l = 0; l < 3; l++) {
      const pts = layers[l];
      const a   = ALPHA[l];

      p.strokeWeight(LW[l]);
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const d = p.dist(pts[i].x, pts[i].y, pts[j].x, pts[j].y);
          if (d < CDIST[l]) {
            p.stroke(lr, lg, lb, a * (1 - d / CDIST[l]));
            p.line(pts[i].x, pts[i].y, pts[j].x, pts[j].y);
          }
        }
      }
      p.noStroke();
      for (const d of pts) {
        p.fill(nr, ng, nb, a * 2.2);
        p.circle(d.x, d.y, d.r * 2);
      }
    }
  };

  p.windowResized = function() {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
    allFormations = [buildSideView(), buildTopView(), buildIsoCoil()];
    formation     = allFormations[formIdx];
  };

  window.addEventListener('scroll', () => {
    const sy = window.scrollY;
    scrollVel += (sy - lastScrollY) * 0.055;
    lastScrollY = sy;
  }, { passive: true });
});
