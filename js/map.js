// The map at runtime. The static engraving is recorded once and drawn in over
// ~2.4s; after that only the live layers move: waves, clouds and their shadows,
// a little parallax, and the spot markers (which live in the DOM).
import { Ink, grainTile } from './ink.js';
import { Rng } from './rng.js';
import { W, H, drawStatic, isWater, LABELS } from './sfmap.js';

const cl = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

export class SFMap {
  constructor(canvas, { seed = 7, dpr = Math.min(2, window.devicePixelRatio || 1) } = {}) {
    this.canvas = canvas; this.dpr = dpr; this.seed = seed;
    this.rng = new Rng(seed);
    this.ink = new Ink(W, H, { dpr, rng: this.rng, paper: '#F2EFE7',
      inks: { ink: { color: '#1C1815', reg: [0, 0] }, gold: { color: '#B98F32', reg: [0.8, -0.6] } } });
    this.ctx = canvas.getContext('2d');
    this.par = { x: 0, y: 0, tx: 0, ty: 0 };
    this.reveal = 0;            // 0..1, how much of the engraving has been drawn
    this.revealStart = null;
    this.built = false;
    this.t0 = performance.now();
    this._buildStatic();
    this._buildWaves();
    this._buildClouds();
    this.grain = grainTile(this.rng, 128, 0.05);
    this.static = document.createElement('canvas');
    this.static.width = Math.ceil(W * dpr); this.static.height = Math.ceil(H * dpr);
  }

  _buildStatic() {
    const S = this.ink.get('ink'), G = this.ink.get('gold');
    S.record(); G.record();
    drawStatic(this.ink, this.rng);
    this.recInk = S.stopRecording(); this.recGold = G.stopRecording();
    this.played = { ink: 0, gold: 0 };
    this.built = true;
  }
  _buildWaves() {
    // little "~" marks scattered over water, denser near shore
    const r = this.rng, waves = [];
    for (let i = 0; i < 2600; i++) {
      const p = [r.range(30, W - 30), r.range(30, H - 30)];
      if (!isWater(p)) continue;
      waves.push({ x: p[0], y: p[1], len: r.range(9, 22), ph: r.range(0, Math.PI * 2), sp: r.range(0.5, 1.1), tone: r.range(0.25, 0.55) });
    }
    this.waves = waves;
  }
  _buildClouds() {
    const r = this.rng;
    this.clouds = [];
    for (let i = 0; i < 6; i++) {
      const puffs = [];
      const n = 4 + (r.next() * 3 | 0);
      for (let k = 0; k < n; k++) puffs.push({ dx: (k - n / 2) * r.range(26, 40), dy: r.range(-14, 10), rr: r.range(28, 52) });
      this.clouds.push({ x: r.range(0, W), y: r.range(40, H - 80), v: r.range(6, 13), puffs, alpha: r.range(0.5, 0.9) });
    }
  }

  /** Draw the next slice of the engraving into the separations. */
  _advanceReveal(now) {
    if (this.revealStart === null) this.revealStart = now;
    const T = 2600;
    const u = cl((now - this.revealStart) / T);
    const target = easeOut(u);
    const S = this.ink.get('ink'), G = this.ink.get('gold');
    const ni = Math.floor(this.recInk.length * target), ng = Math.floor(this.recGold.length * target);
    if (ni > this.played.ink) { S.play(this.recInk, this.played.ink, ni); this.played.ink = ni; }
    if (ng > this.played.gold) { G.play(this.recGold, this.played.gold, ng); this.played.gold = ng; }
    this.reveal = target;
    if (u >= 1 && !this.staticDone) {
      // bake the finished engraving once; frames after this are cheap
      const c = this.static.getContext('2d');
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, this.static.width, this.static.height);
      this.ink.composite(c);
      this.staticDone = true;
    }
  }

  setPointer(nx, ny) { this.par.tx = nx; this.par.ty = ny; }

  /** Map-world -> canvas CSS pixel. */
  project(x, y) {
    const r = this.canvas.getBoundingClientRect();
    return [x * (r.width / W), y * (r.height / H)];
  }

  frame(now = performance.now()) {
    const { ctx, dpr } = this;
    const t = (now - this.t0) / 1000;
    this.par.x += (this.par.tx - this.par.x) * 0.06; this.par.y += (this.par.ty - this.par.y) * 0.06;
    const px = this.par.x, py = this.par.y;
    if (!this.staticDone) this._advanceReveal(now);

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#F2EFE7'; ctx.fillRect(0, 0, W, H);
    // paper: a soft studio falloff
    const g = ctx.createRadialGradient(W * 0.5, H * 0.45, H * 0.2, W * 0.5, H * 0.5, W * 0.75);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(60,50,40,0.10)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // the engraving, with a touch of parallax
    if (this.staticDone) {
      ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.drawImage(this.static, px * 6, py * 4, W, H);
      ctx.restore();
    } else {
      this.ink.composite(ctx, { paper: false, dx: px * 6, dy: py * 4 });
    }

    // waves
    ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.translate(px * 3, py * 2);
    ctx.lineCap = 'round'; ctx.lineWidth = 0.9;
    const wr = this.reveal;
    for (const w of this.waves) {
      const ph = w.ph + t * w.sp;
      const a = 0.5 + 0.5 * Math.sin(ph);
      ctx.strokeStyle = `rgba(28,24,21,${(w.tone * (0.35 + 0.65 * a) * wr).toFixed(3)})`;
      const dx = Math.sin(ph * 0.5) * 2;
      ctx.beginPath();
      ctx.moveTo(w.x - w.len / 2 + dx, w.y);
      ctx.quadraticCurveTo(w.x - w.len / 4 + dx, w.y - 2.2, w.x + dx, w.y);
      ctx.quadraticCurveTo(w.x + w.len / 4 + dx, w.y + 2.2, w.x + w.len / 2 + dx, w.y);
      ctx.stroke();
    }
    ctx.restore();

    // clouds: shadow on the ground, then the puff, then a drawn edge
    ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const c of this.clouds) {
      const cx = ((c.x + t * c.v) % (W + 300)) - 150 + px * 18, cy = c.y + Math.sin(t * 0.2 + c.x) * 6 + py * 12;
      const fade = wr * c.alpha;
      // shadow
      ctx.globalCompositeOperation = 'multiply';
      for (const p of c.puffs) {
        const gr = ctx.createRadialGradient(cx + p.dx + 26, cy + p.dy + 34, 0, cx + p.dx + 26, cy + p.dy + 34, p.rr * 1.15);
        gr.addColorStop(0, `rgba(60,52,44,${(0.22 * fade).toFixed(3)})`); gr.addColorStop(1, 'rgba(60,52,44,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx + p.dx + 26, cy + p.dy + 34, p.rr * 1.15, 0, Math.PI * 2); ctx.fill();
      }
      // puff
      ctx.globalCompositeOperation = 'source-over';
      for (const p of c.puffs) {
        const gr = ctx.createRadialGradient(cx + p.dx, cy + p.dy, 0, cx + p.dx, cy + p.dy, p.rr);
        gr.addColorStop(0, `rgba(255,253,248,${(0.95 * fade).toFixed(3)})`); gr.addColorStop(0.7, `rgba(255,253,248,${(0.75 * fade).toFixed(3)})`); gr.addColorStop(1, 'rgba(255,253,248,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx + p.dx, cy + p.dy, p.rr, 0, Math.PI * 2); ctx.fill();
      }
      // a pencil edge along the underside
      ctx.strokeStyle = `rgba(28,24,21,${(0.35 * fade).toFixed(3)})`; ctx.lineWidth = 0.9;
      ctx.beginPath();
      const first = c.puffs[0], last = c.puffs[c.puffs.length - 1];
      ctx.moveTo(cx + first.dx - first.rr * 0.7, cy + first.dy + first.rr * 0.35);
      for (const p of c.puffs) ctx.quadraticCurveTo(cx + p.dx, cy + p.dy + p.rr * 0.9, cx + p.dx + p.rr * 0.7, cy + p.dy + p.rr * 0.4);
      ctx.stroke();
    }
    ctx.restore();

    // labels (canvas text so they engrave with the map)
    ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.translate(px * 6, py * 4);
    ctx.fillStyle = `rgba(28,24,21,${(0.85 * wr).toFixed(3)})`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const L of LABELS) {
      ctx.save(); ctx.translate(L.x, L.y); if (L.a) ctx.rotate(L.a);
      ctx.font = L.i ? `italic ${L.s}px "Playfair Display", Georgia, serif` : `500 ${L.s}px Inter, system-ui, sans-serif`;
      if (L.sp) { ctx.letterSpacing = L.sp + 'px'; }
      ctx.fillText(L.t, 0, 0);
      ctx.restore();
    }
    ctx.restore();

    // grain
    ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 0.45; ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = ctx.createPattern(this.grain, 'repeat'); ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}
