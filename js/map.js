// The map at runtime, on Leaflet. Leaflet owns the projection, the bounds and
// the markers; the drawing is ours, engraved into a canvas over the map pane.
import { Ink, grainTile, playPartial } from './ink.js';
import { Rng } from './rng.js';
import { drawStatic, waterMask, LABELS } from './sfmap.js';

const cl = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
export const SF_BOUNDS = [[37.703, -122.520], [37.832, -122.360]];

export class SFMap {
  constructor(container, canvas, { seed = 7, dpr = Math.min(2, window.devicePixelRatio || 1), tiles = false, interactive = false } = {}) {
    this.container = container; this.canvas = canvas; this.dpr = dpr; this.seed = seed;
    this.ctx = canvas.getContext('2d');
    this.map = L.map(container, {
      zoomControl: false, attributionControl: !!tiles, dragging: interactive, scrollWheelZoom: interactive,
      doubleClickZoom: interactive, touchZoom: interactive, boxZoom: false, keyboard: interactive, zoomSnap: 0.1, zoomDelta: 0.25,
      inertia: false, fadeAnimation: false, zoomAnimation: false,
    });
    if (tiles) container.classList.add('tiles');
    if (tiles) L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', { attribution: '&copy; OpenStreetMap, &copy; CARTO', subdomains: 'abcd', maxZoom: 19 }).addTo(this.map);
    this.map.invalidateSize({ animate: false });
    this.fit();
    document.fonts?.ready.then(() => { this.map.invalidateSize({ animate: false }); this.fit(); });
    this.par = { x: 0, y: 0, tx: 0, ty: 0 };
    this.t0 = performance.now();
    this.build();
    this.map.on('moveend zoomend', () => this.build());
    let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { this.map.invalidateSize(); this.fit(); }, 120); });
  }
  /** Fit the city below the masthead band. */
  fit() {
    const band = this.titleBand();
    const narrow = this.container.getBoundingClientRect().width < 720;
    this.map.fitBounds(narrow ? [[37.703, -122.515], [37.812, -122.375]] : SF_BOUNDS, { paddingTopLeft: [0, band], paddingBottomRight: [0, 16] });
  }
  titleBand() {
    const m = document.getElementById('masthead');
    return m ? Math.round(m.getBoundingClientRect().height + 16) : 200;
  }

  project = ([lon, lat]) => { const p = this.map.latLngToContainerPoint([lat, lon]); return [p.x, p.y]; };

  /** (Re)record the engraving for the current size and view. */
  build() {
    const r = this.container.getBoundingClientRect();
    this.W = Math.round(r.width); this.H = Math.round(r.height);
    const { W, H, dpr } = this;
    this.canvas.width = Math.ceil(W * dpr); this.canvas.height = Math.ceil(H * dpr);
    this.canvas.style.width = W + 'px'; this.canvas.style.height = H + 'px';
    this.rng = new Rng(this.seed);
    this.ink = new Ink(W, H, { dpr, rng: this.rng, paper: '#F2EFE7', inks: { ink: { color: '#1C1815', reg: [0, 0] }, gold: { color: '#B98F32', reg: [0.8, -0.6] } } });
    const a = this.project([-122.45, 37.78]), b = this.project([-122.44, 37.78]);
    this.mpp = 881.0 / Math.hypot(b[0] - a[0], b[1] - a[1]);     // 0.01° lon at 37.78° ≈ 881 m
    this.mask = waterMask(this.project, W, H, 2);
    {   // water tint: the mask at grid resolution, scaled up smoothly
      const m = this.mask, c = document.createElement('canvas'); c.width = m.gw; c.height = m.gh;
      const id = c.getContext('2d').createImageData(m.gw, m.gh);
      for (let i = 0; i < m.g.length; i++) { const wtr = m.g[i] === 1; id.data[i * 4] = 40; id.data[i * 4 + 1] = 46; id.data[i * 4 + 2] = 58; id.data[i * 4 + 3] = wtr ? 22 : 0; }
      c.getContext('2d').putImageData(id, 0, 0);
      this.tint = c;
    }
    const S = this.ink.get('ink'), G = this.ink.get('gold');
    S.record(); G.record();
    drawStatic(this.ink, this.rng, this.project, W, H, this.mpp, this.mask);
    this.recInk = S.stopRecording(); this.recGold = G.stopRecording();
    this.played = { ink: 0, gold: 0 };
    this.static = document.createElement('canvas'); this.static.width = this.canvas.width; this.static.height = this.canvas.height;
    this.staticDone = false;
    if (this.reveal >= 1) { S.play(this.recInk, 0, this.recInk.length); G.play(this.recGold, 0, this.recGold.length); this.played = { ink: this.recInk.length, gold: this.recGold.length }; this._bake(); }
    // otherwise keep revealStart: a rebuild mid-reveal (fonts arriving, a resize)
    // replays what was already drawn from the fresh recording on the next frame
    this.reveal = this.reveal ?? 0;
    this.grain = grainTile(new Rng(this.seed + 1), 128, 0.05);
    this._waves(); this._clouds();
  }
  _bake() { const c = this.static.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, this.static.width, this.static.height); this.ink.composite(c, { paper: false }); this.staticDone = true; }
  _waves() {
    const r = new Rng(this.seed + 2), waves = [], { W, H } = this;
    for (let i = 0; i < Math.round(W * H / 420); i++) {
      const x = r.range(28, W - 28), y = r.range(28, H - 28);
      if (!this.mask.isWater(x, y)) continue;
      waves.push({ x, y, len: r.range(9, 22), ph: r.range(0, Math.PI * 2), sp: r.range(0.5, 1.1), tone: r.range(0.25, 0.55) });
    }
    this.waves = waves;
  }
  _clouds() {
    const r = new Rng(this.seed + 3); this.clouds = [];
    for (let i = 0; i < 5; i++) {
      const puffs = []; const n = 4 + (r.next() * 3 | 0);
      for (let k = 0; k < n; k++) puffs.push({ dx: (k - n / 2) * r.range(26, 40), dy: r.range(-14, 10), rr: r.range(26, 48) });
      this.clouds.push({ x: r.range(0, this.W), y: r.range(40, this.H - 80), v: r.range(6, 13), puffs, alpha: r.range(0.5, 0.85) });
    }
  }
  /**
   * The reveal: every recorded mark gets a start time, staggered in drawing
   * order, and takes a short while to draw. Marks in flight are drawn as a
   * moving pen on an overlay; finished marks are committed to the engraving.
   */
  _advanceReveal(now) {
    if (this.revealStart === null || this.revealStart === undefined) this.revealStart = now;
    const T = 1250, u = cl((now - this.revealStart) / T);
    const D = 0.22;                        // each mark draws over 16% of the window
    const S = this.ink.get('ink'), G = this.ink.get('gold');
    this.flight = [];
    for (const [rec, key, sep] of [[this.recInk, 'ink', S], [this.recGold, 'gold', G]]) {
      const N = rec.length;
      const done = Math.floor(cl((u - D) / (1 - D)) * N);   // marks whose start + D <= u
      if (done > this.played[key]) { sep.play(rec, this.played[key], done); this.played[key] = done; }
      const upTo = Math.min(N, Math.floor(cl(u / (1 - D)) * N));
      for (let i = this.played[key]; i < upTo; i++) {
        const st = (i / N) * (1 - D), f = cl((u - st) / D);
        if (f > 0 && rec[i].line && rec[i].line.P.length > 3) this.flight.push([rec[i], f, key]);
      }
    }
    this.reveal = u;
    if (u >= 1 && !this.staticDone) { this.flight = []; this._bake(); }
  }
  setPointer(nx, ny) { this.par.tx = nx; this.par.ty = ny; }

  frame(now = performance.now()) {
    const { ctx, dpr, W, H } = this;
    const t = (now - this.t0) / 1000;
    this.par.x += (this.par.tx - this.par.x) * 0.06; this.par.y += (this.par.ty - this.par.y) * 0.06;
    const px = this.par.x, py = this.par.y;
    if (!this.staticDone) this._advanceReveal(now);
    const wr0 = this.reveal;
    ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#F2EFE7'; ctx.fillRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W * 0.5, H * 0.45, H * 0.2, W * 0.5, H * 0.5, W * 0.75);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(60,50,40,0.10)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.globalAlpha = wr0;
    ctx.drawImage(this.tint, px * 6, py * 4, W, H); ctx.globalAlpha = 1;
    ctx.restore();
    if (this.staticDone) { ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.drawImage(this.static, px * 6, py * 4, W, H); ctx.restore(); }
    else {
      this.ink.composite(ctx, { paper: false, dx: px * 6, dy: py * 4 });
      if (this.flight && this.flight.length) {   // the pen, mid-stroke
        ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.translate(px * 6, py * 4); ctx.globalCompositeOperation = 'multiply';
        for (const [m, f, key] of this.flight) playPartial(ctx, m, f, key === 'gold' ? '#B98F32' : '#1C1815');
        ctx.restore();
      }
    }
    const wr = this.reveal;
    // waves
    ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.translate(px * 3, py * 2); ctx.lineCap = 'round'; ctx.lineWidth = 0.9;
    for (const w of this.waves) {
      const ph = w.ph + t * w.sp, a = 0.5 + 0.5 * Math.sin(ph), dx = Math.sin(ph * 0.5) * 2;
      ctx.strokeStyle = `rgba(28,24,21,${(w.tone * (0.35 + 0.65 * a) * wr).toFixed(3)})`;
      ctx.beginPath(); ctx.moveTo(w.x - w.len / 2 + dx, w.y);
      ctx.quadraticCurveTo(w.x - w.len / 4 + dx, w.y - 2.2, w.x + dx, w.y); ctx.quadraticCurveTo(w.x + w.len / 4 + dx, w.y + 2.2, w.x + w.len / 2 + dx, w.y); ctx.stroke();
    }
    ctx.restore();
    // clouds: shadow, puff, pencil edge
    ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const c of this.clouds) {
      const cx = ((c.x + t * c.v) % (W + 300)) - 150 + px * 18, cy = c.y + Math.sin(t * 0.2 + c.x) * 6 + py * 12, fade = wr * c.alpha;
      ctx.globalCompositeOperation = 'multiply';
      for (const p of c.puffs) { const gr = ctx.createRadialGradient(cx + p.dx + 26, cy + p.dy + 34, 0, cx + p.dx + 26, cy + p.dy + 34, p.rr * 1.15); gr.addColorStop(0, `rgba(60,52,44,${(0.2 * fade).toFixed(3)})`); gr.addColorStop(1, 'rgba(60,52,44,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx + p.dx + 26, cy + p.dy + 34, p.rr * 1.15, 0, Math.PI * 2); ctx.fill(); }
      ctx.globalCompositeOperation = 'source-over';
      for (const p of c.puffs) { const gr = ctx.createRadialGradient(cx + p.dx, cy + p.dy, 0, cx + p.dx, cy + p.dy, p.rr); gr.addColorStop(0, `rgba(255,253,248,${(0.95 * fade).toFixed(3)})`); gr.addColorStop(0.7, `rgba(255,253,248,${(0.75 * fade).toFixed(3)})`); gr.addColorStop(1, 'rgba(255,253,248,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx + p.dx, cy + p.dy, p.rr, 0, Math.PI * 2); ctx.fill(); }
      ctx.strokeStyle = `rgba(28,24,21,${(0.35 * fade).toFixed(3)})`; ctx.lineWidth = 0.9; ctx.beginPath();
      const f = c.puffs[0]; ctx.moveTo(cx + f.dx - f.rr * 0.7, cy + f.dy + f.rr * 0.35);
      for (const p of c.puffs) ctx.quadraticCurveTo(cx + p.dx, cy + p.dy + p.rr * 0.9, cx + p.dx + p.rr * 0.7, cy + p.dy + p.rr * 0.4);
      ctx.stroke();
    }
    ctx.restore();
    // lettering
    ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.translate(px * 6, py * 4);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    for (const Lb of LABELS) {
      const p = this.project([Lb.ll[1], Lb.ll[0]]);
      ctx.save(); ctx.translate(p[0], p[1]); if (Lb.a) ctx.rotate(Lb.a);
      ctx.font = Lb.i ? `italic 500 ${Lb.s}px "Playfair Display", Georgia, serif` : `500 ${Lb.s}px Inter, system-ui, sans-serif`;
      if (Lb.sp) ctx.letterSpacing = Lb.sp + 'px';
      // a paper halo so the lettering reads over the linework
      ctx.strokeStyle = `rgba(242,239,231,${(0.9 * wr).toFixed(3)})`; ctx.lineWidth = Lb.i ? 3.5 : 4; ctx.strokeText(Lb.t, 0, 0);
      ctx.fillStyle = `rgba(28,24,21,${((Lb.i ? 0.92 : 0.8) * wr).toFixed(3)})`; ctx.fillText(Lb.t, 0, 0); ctx.restore();
    }
    ctx.restore();
    // clear the masthead band: strokes fade to paper beneath the title
    const band = this.titleBand();
    ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const fg = ctx.createLinearGradient(0, 0, 0, band * 0.92);
    fg.addColorStop(0, 'rgba(242,239,231,0.72)'); fg.addColorStop(0.55, 'rgba(242,239,231,0.5)'); fg.addColorStop(1, 'rgba(242,239,231,0)');
    ctx.fillStyle = fg; ctx.fillRect(0, 0, W, band);
    ctx.restore();
    ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 0.45; ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = ctx.createPattern(this.grain, 'repeat'); ctx.fillRect(0, 0, W, H); ctx.restore();
  }
}
