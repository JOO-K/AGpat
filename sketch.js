new p5(function(p) {
  const N = 65;
  let dots = [];
  let scrollVel = 0;
  let lastScrollY = 0;

  class Dot {
    constructor() {
      this.x = p.random(p.width);
      this.y = p.random(p.height);
      this.layer = p.floor(p.random(3));            // 0=back 1=mid 2=front
      this.vx = p.random(-0.22, 0.22);
      this.vy = p.random(-0.14, 0.08);
      this.r   = [1.1, 2.0, 3.2][this.layer];
      this.pf  = [0.10, 0.24, 0.44][this.layer];   // parallax factor
    }
    update(sv) {
      this.x += this.vx;
      this.y += this.vy + sv * this.pf;
      if (this.x < -8)             this.x = p.width  + 8;
      if (this.x > p.width  + 8)  this.x = -8;
      if (this.y < -8)             this.y = p.height + 8;
      if (this.y > p.height + 8)  this.y = -8;
    }
  }

  p.setup = function() {
    let cnv = p.createCanvas(p.windowWidth, p.windowHeight);
    cnv.id('p5Canvas');
    cnv.style('position',       'fixed');
    cnv.style('top',            '0');
    cnv.style('left',           '0');
    cnv.style('pointer-events', 'none');
    cnv.style('z-index',        '0');
    for (let i = 0; i < N; i++) dots.push(new Dot());
  };

  p.draw = function() {
    p.clear();
    scrollVel *= 0.86;

    // bucket by layer
    let layers = [[], [], []];
    for (let d of dots) { d.update(scrollVel); layers[d.layer].push(d); }

    const ALPHA  = [16, 34, 60];
    const LW     = [0.35, 0.65, 1.05];
    const CDIST  = [85, 115, 145];

    for (let l = 0; l < 3; l++) {
      let pts = layers[l];
      let a   = ALPHA[l];

      // connections
      p.strokeWeight(LW[l]);
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          let d = p.dist(pts[i].x, pts[i].y, pts[j].x, pts[j].y);
          if (d < CDIST[l]) {
            p.stroke(148, 162, 190, a * (1 - d / CDIST[l]));
            p.line(pts[i].x, pts[i].y, pts[j].x, pts[j].y);
          }
        }
      }

      // nodes
      p.noStroke();
      for (let d of pts) {
        p.fill(135, 148, 180, a * 2.2);
        p.circle(d.x, d.y, d.r * 2);
      }
    }
  };

  p.windowResized = function() {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
  };

  window.addEventListener('scroll', () => {
    let sy = window.scrollY;
    scrollVel += (sy - lastScrollY) * 0.055;
    lastScrollY = sy;
  }, { passive: true });
});
