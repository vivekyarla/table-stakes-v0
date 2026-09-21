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
      const puffs = []; const n = 3 + (r.next() * 3 | 0);
      let x = 0;
      for (let k = 0; k < n; k++) { const rr = r.range(16, 34) * (k === 0 || k === n - 1 ? 0.75 : 1); puffs.push({ dx: x, dy: -rr * r.range(0.35, 0.7), rr }); x += rr * r.range(1.0, 1.4); }
      const mid = x / 2; for (const p of puffs) p.dx -= mid;
      // outline: upper envelope of the puffs, sampled left to right, then a lightly bumped base back
      const out = [], x0 = puffs[0].dx - puffs[0].rr, x1 = puffs[n - 1].dx + puffs[n - 1].rr;
      for (let xx = x0; xx <= x1; xx += 2.5) {
        let top = 4;
        for (const p of puffs) { const d = xx - p.dx; if (Math.abs(d) < p.rr) top = Math.min(top, p.dy - Math.sqrt(p.rr * p.rr - d * d)); }
        out.push([xx, top + r.range(-0.4, 0.4)]);
      }
      const baseY = 4;
      for (let xx = x1; xx >= x0; xx -= 6) out.push([xx, baseY + 1.5 * Math.sin(xx * 0.25 + i) + r.range(-0.3, 0.3)]);
      this.clouds.push({ x: r.range(0, this.W), y: r.range(40, this.H - 80), v: r.range(6, 13), puffs, outline: out, alpha: r.range(0.55, 0.9) });
    }
  }
  /**
   * The reveal: every recorded mark gets a start time, staggered in drawing
   * order, and takes a short while to draw. Marks in flight are drawn as a
   * moving pen on an overlay; finished marks are committed to the engraving.
   */
  _advanceReveal(now) {
    if (this.revealStart === null || this.revealStart === undefined) this.revealStart = now;
    const T = 2200, u = cl((now - this.revealStart) / T);
    const D = 0.16;                        // each mark draws over 16% of the window
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
    // clouds, drawn: a hatched shadow on the ground, then the cloud with a pencil edge
    ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const c of this.clouds) {
      const cx = ((c.x + t * c.v) % (W + 300)) - 150 + px * 18, cy = c.y + Math.sin(t * 0.2 + c.x) * 6 + py * 12, fade = wr * c.alpha;
      const path = (ox, oy) => {
        ctx.beginPath();
        const pts = c.outline;
        ctx.moveTo(cx + ox + pts[0][0], cy + oy + pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(cx + ox + pts[i][0], cy + oy + pts[i][1]);
        ctx.closePath();
      };
      const hatch = (ox, oy, spacing, ang, alpha, lw, fromY) => {
        ctx.save(); path(ox, oy); ctx.clip();
        ctx.strokeStyle = `rgba(28,24,21,${alpha.toFixed(3)})`; ctx.lineWidth = lw; ctx.lineCap = 'round';
        const R = 140, ca = Math.cos(ang), sa = Math.sin(ang), mx = cx + ox, my = cy + oy;
        for (let k = -R; k < R; k += spacing) {
          const nx = -sa * k, ny = ca * k; if (my + ny < fromY) continue;
          ctx.beginPath(); ctx.moveTo(mx + nx - ca * R, my + ny - sa * R); ctx.lineTo(mx + nx + ca * R, my + ny + sa * R); ctx.stroke();
        }
        ctx.restore();
      };
      // ground shadow
      ctx.globalCompositeOperation = 'multiply';
      ctx.save(); path(22, 30); ctx.fillStyle = `rgba(60,52,44,${(0.07 * fade).toFixed(3)})`; ctx.fill(); ctx.restore();
      hatch(22, 30, 3.6, -0.75, 0.15 * fade, 0.7, -1e9);
      // the cloud
      ctx.globalCompositeOperation = 'source-over';
      ctx.save(); path(0, 0); ctx.fillStyle = `rgba(247,245,239,${(0.9 * fade).toFixed(3)})`; ctx.fill(); ctx.restore();
      hatch(0, 0, 3.8, -0.55, 0.2 * fade, 0.6, cy - 6);
      ctx.save(); path(0, 0); ctx.strokeStyle = `rgba(28,24,21,${(0.6 * fade).toFixed(3)})`; ctx.lineWidth = 1.0; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore();
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
    const fg = ctx.createLinearGradient(0, band * 0.62, 0, band + 8);
    fg.addColorStop(0, 'rgba(242,239,231,1)'); fg.addColorStop(0.5, 'rgba(242,239,231,0.7)'); fg.addColorStop(1, 'rgba(242,239,231,0)');
    ctx.fillStyle = fg; ctx.fillRect(0, 0, W, band + 8);
    ctx.restore();
    ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 0.45; ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = ctx.createPattern(this.grain, 'repeat'); ctx.fillRect(0, 0, W, H); ctx.restore();
  }
}
