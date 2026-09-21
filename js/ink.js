// Engraving surface. Each "separation" is its own alpha layer (like a riso
// screen); they are tinted, mis-registered by a hair and multiplied onto the
// paper at composite time. Nothing here is an image asset — it is all strokes.
import { resample, normals, radiusAt, radPair, maxRadius, V } from './geom.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

class Sep {
  constructor(W, H, dpr, rng, color, reg) {
    this.W = W; this.H = H; this.color = color; this.reg = reg; this.rng = rng;
    this.cv = document.createElement('canvas');
    this.cv.width = Math.ceil(W * dpr); this.cv.height = Math.ceil(H * dpr);
    this.ctx = this.cv.getContext('2d');
    this.ctx.scale(dpr, dpr);
    this.ctx.lineCap = 'round'; this.ctx.lineJoin = 'round';
    this._ph = rng.next() * 1000;
  }
  clear() { this.ctx.save(); this.ctx.setTransform(1, 0, 0, 1, 0, 0); this.ctx.clearRect(0, 0, this.cv.width, this.cv.height); this.ctx.restore(); }
  path(pts, close = true) {
    const c = this.ctx; c.beginPath();
    c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
    if (close) c.closePath();
  }
  fill(pts, tone = 1) {
    if (this.rec) { this.rec.push({ pts, tone, clip: this._clip, line: this._line }); this._line = null; return; }
    const c = this.ctx; c.globalAlpha = tone; c.fillStyle = '#000'; this.path(pts); c.fill(); c.globalAlpha = 1;
  }
  /** Knock a shape back out of this separation so forms behind it are hidden. */
  erase(pts) {
    if (this.rec) { this.rec.push({ pts, erase: true, clip: this._clip }); return; }
    const c = this.ctx; c.save(); c.globalCompositeOperation = 'destination-out'; c.fillStyle = '#000'; this.path(pts); c.fill(); c.restore();
  }
  clip(pts) { if (this.rec) { this._clip = pts; return; } const c = this.ctx; c.save(); this.path(pts); c.clip(); }
  unclip() { if (this.rec) { this._clip = null; return; } this.ctx.restore(); }

  /** Record marks instead of drawing them, so they can be played back over time. */
  record() { this.rec = []; this._clip = null; return this.rec; }
  stopRecording() { const r = this.rec; this.rec = null; this._clip = null; return r; }
  /** Draw recorded marks [i0, i1). */
  play(rec, i0, i1) {
    const c = this.ctx;
    for (let i = i0; i < Math.min(i1, rec.length); i++) {
      const m = rec[i];
      if (m.clip) { c.save(); this.path(m.clip); c.clip(); }
      if (m.erase) { c.save(); c.globalCompositeOperation = 'destination-out'; c.fillStyle = '#000'; this.path(m.pts); c.fill(); c.restore(); }
      else { c.globalAlpha = m.tone; c.fillStyle = '#000'; this.path(m.pts); c.fill(); c.globalAlpha = 1; }
      if (m.clip) c.restore();
    }
  }

  /** A nib stroke: slight tremor along its length, pressure taper at the ends. */
  stroke(pts, o = {}) {
    if (o.clipTest) {   // keep only the runs of the line that pass the test
      const P0 = resample(pts, o.step ?? 1.6); let run = [];
      const opts = { ...o, clipTest: null };
      for (const p of P0) { if (o.clipTest(p[0], p[1])) run.push(p); else { if (run.length > 2) this.stroke(run, opts); run = []; } }
      if (run.length > 2) this.stroke(run, opts);
      return;
    }
    const w = o.w ?? 1.6, tremor = o.tremor ?? 0.7, freq = o.freq ?? 0.035;
    const ends = o.ends ?? [0.18, 0.12], tone = o.tone ?? 1;
    const ph = o.phase ?? (this._ph += 7.31);
    const P = resample(pts, o.step ?? 1.6);
    if (P.length < 2) return;
    const nm = normals(P), rng = this.rng;
    const n = P.length, L = [], R = [];
    // per-point widths, matched by arc length
    let wAt = null;
    if (o.widths && o.widths.length === pts.length) {
      const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      const tot = cum[cum.length - 1] || 1;
      const pc = [0]; for (let i = 1; i < n; i++) pc.push(pc[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
      const ptot = pc[n - 1] || 1;
      let j = 0;
      wAt = (i) => {
        const s_ = (pc[i] / ptot) * tot;
        while (j < cum.length - 2 && cum[j + 1] < s_) j++;
        const f = (s_ - cum[j]) / ((cum[j + 1] - cum[j]) || 1);
        return o.widths[j] * (1 - f) + o.widths[Math.min(j + 1, o.widths.length - 1)] * f;
      };
    }
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const wBase = wAt ? wAt(i) : w;
      const off = tremor * rng.fbm(i * freq * 10 + ph, 3);
      const p = [P[i][0] + nm[i][0] * off, P[i][1] + nm[i][1] * off];
      // pressure: thin at the ends, full through the middle, with a little wobble
      let pr = 1;
      if (t < 0.22) pr = ends[0] + (1 - ends[0]) * (t / 0.22);
      if (t > 0.80) pr = Math.min(pr, ends[1] + (1 - ends[1]) * ((1 - t) / 0.20));
      pr *= 1 + 0.16 * rng.fbm(i * 0.09 + ph * 1.7, 2);
      const hw = Math.max(0.12, (wBase * pr) / 2);
      L.push([p[0] + nm[i][0] * hw, p[1] + nm[i][1] * hw]);
      R.push([p[0] - nm[i][0] * hw, p[1] - nm[i][1] * hw]);
    }
    if (this.rec) this._line = { P, w };
    this.fill(L.concat(R.reverse()), tone);
  }

  /**
   * Contour-hatch a tube: one clean stroke per station, wrapping across the
   * form and covering only the shadowed part of the section. Length and weight
   * follow a Lambert term, which is what makes a cylinder read as round.
   */
  hatchTube(spine, radii, o = {}) {
    const light = o.light ?? [-0.55, -0.72, 0.42];
    const spacing = o.spacing ?? 4.4, w = o.w ?? 1.0, tone = o.tone ?? 1;
    const ambient = o.ambient ?? 0.32, thr = o.threshold ?? 0.3;
    const bow = o.bow ?? 0.18, tremor = o.tremor ?? 0.3;
    const shrink = o.shrink ?? 0.92, gamma = o.gamma ?? 1.0;
    const trim = o.trim ?? [0.02, 0.02];
    const Ln = (() => { const l = Math.hypot(...light); return light.map((v) => v / l); })();
    const P = resample(spine, spacing);
    const nm = normals(P);
    const n = P.length, US = 28;
    const i0 = Math.max(0, Math.floor(n * trim[0])), i1 = Math.min(n - 1, Math.ceil(n * (1 - trim[1])));
    for (let i = i0; i <= i1; i++) {
      const t = i / (n - 1);
      const rp = radPair(radii, t);
      const r = ((rp[0] + rp[1]) / 2) * shrink;
      if (r < 1.2) continue;
      const p = P[i], nrm = nm[i];
      const tg = [nrm[1], -nrm[0]];
      let u0 = null, u1 = null, acc = 0, cnt = 0;
      for (let k = 0; k <= US; k++) {
        const u = -1 + (2 * k) / US;
        const z = Math.sqrt(Math.max(0, 1 - u * u));
        const lum = Math.max(0, nrm[0] * u * Ln[0] + nrm[1] * u * Ln[1] + z * Ln[2]);
        const d = Math.pow(clamp(1 - (ambient + lum * (1 - ambient)), 0, 1), gamma);
        if (d >= thr) { if (u0 === null) u0 = u; u1 = u; acc += d; cnt++; }
      }
      if (u0 === null || cnt < 2) continue;
      const avg = acc / cnt;
      const jit = this.rng.range(-0.05, 0.05);
      const a = [p[0] + nrm[0] * (u0 + jit) * r, p[1] + nrm[1] * (u0 + jit) * r];
      const b = [p[0] + nrm[0] * (u1 + jit) * r, p[1] + nrm[1] * (u1 + jit) * r];
      const mid = [(a[0] + b[0]) / 2 + tg[0] * bow * r * 0.4, (a[1] + b[1]) / 2 + tg[1] * bow * r * 0.4];
      this.stroke([a, mid, b], {
        w: w * (0.5 + 0.95 * avg), tremor, ends: [0.28, 0.28],
        tone: tone * clamp(0.4 + avg, 0, 1), step: 1.4,
      });
      const crossThr = o.cross ?? 0.62;
      if (avg > crossThr && (i % 2 === 0)) {
        const k = spacing * 0.95;
        const uu0 = u0 + (u1 - u0) * 0.18, uu1 = u1 - (u1 - u0) * 0.1;
        const a2 = [p[0] + nrm[0] * uu0 * r + tg[0] * k, p[1] + nrm[1] * uu0 * r + tg[1] * k];
        const b2 = [p[0] + nrm[0] * uu1 * r - tg[0] * k, p[1] + nrm[1] * uu1 * r - tg[1] * k];
        this.stroke([a2, b2], { w: w * 0.8, tremor: tremor * 0.8, ends: [0.3, 0.3], tone: tone * 0.8, step: 1.4 });
      }
    }
  }

  /**
   * Lengthwise shading for a flat form. Strokes run along the spine and
   * converge as it narrows — the tendons on the back of a hand. They are broken
   * into short runs so the result reads as tone, not as wood grain.
   */
  hatchAlong(spine, radii, o = {}) {
    const light = o.light ?? [-0.55, -0.70, 0.45];
    const spacing = o.spacing ?? 5, w = o.w ?? 0.72, tone = o.tone ?? 1;
    const ambient = o.ambient ?? 0.5, thr = o.threshold ?? 0.3;
    const flat = o.flat ?? 0.3, trim = o.trim ?? [0.04, 0.04], tremor = o.tremor ?? 0.55;
    const Ln = (() => { const l = Math.hypot(...light); return light.map((v) => v / l); })();
    const P = resample(spine, 3);
    const nm = normals(P);
    const n = P.length;
    const lines = Math.max(3, Math.round((2 * maxRadius(radii)) / spacing));
    const i0 = Math.max(1, Math.floor(n * trim[0])), i1 = Math.min(n - 2, Math.floor(n * (1 - trim[1])));
    if (i1 <= i0 + 2) return;
    for (let k = 0; k <= lines; k++) {
      const u = -1 + (2 * k) / lines + this.rng.range(-0.05, 0.05);
      if (Math.abs(u) > 0.97) continue;
      const z = Math.pow(Math.max(0, 1 - u * u), flat);
      const mid = (i0 + i1) >> 1;
      const lum = Math.max(0, nm[mid][0] * u * Ln[0] + nm[mid][1] * u * Ln[1] + z * Ln[2]);
      const d = clamp(1 - (ambient + lum * (1 - ambient)), 0, 1);
      if (d < thr) continue;
      const runs = this.rng.next() < 0.45 ? 2 : 1;
      for (let rIdx = 0; rIdx < runs; rIdx++) {
        const span = i1 - i0;
        const len = Math.round(span * this.rng.range(0.3, runs === 1 ? 0.85 : 0.46));
        const a = i0 + Math.round(this.rng.range(0, Math.max(1, span - len)));
        const b = Math.min(i1, a + len);
        if (b - a < 3) continue;
        const pts = [];
        for (let i = a; i <= b; i++) {
          const rp = radPair(radii, i / (n - 1));
          const r = u < 0 ? rp[1] : rp[0];
          pts.push([P[i][0] + nm[i][0] * u * r, P[i][1] + nm[i][1] * u * r]);
        }
        this.stroke(pts, {
          w: w * (0.55 + 0.8 * d), tremor, ends: [0.2, 0.18],
          tone: tone * clamp(0.4 + d, 0, 1), step: 2,
        });
      }
    }
  }

  /** Short broken flicks inside a region — skin texture, not smooth tone. */
  texture(poly, o = {}) {
    const n = o.n ?? 160, len = o.len ?? 6, w = o.w ?? 0.6;
    const ang = o.angle ?? 0, spreadA = o.spread ?? 0.5, tone = o.tone ?? 0.55;
    let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
    for (const p of poly) { minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); miny = Math.min(miny, p[1]); maxy = Math.max(maxy, p[1]); }
    this.clip(poly);
    for (let i = 0; i < n; i++) {
      const x = this.rng.range(minx, maxx), y = this.rng.range(miny, maxy);
      const a = ang + this.rng.range(-spreadA, spreadA);
      const L = len * this.rng.range(0.5, 1.5);
      this.stroke([[x, y], [x + Math.cos(a) * L, y + Math.sin(a) * L]],
        { w: w * this.rng.range(0.7, 1.3), tremor: 0.25, ends: [0.3, 0.3], tone: tone * this.rng.range(0.5, 1) });
    }
    this.unclip();
  }

  /** Straight parallel hatching clipped to a polygon — for cuffs and flat planes. */
  hatchPoly(poly, o = {}) {
    const ang = o.angle ?? -1.05, spacing = o.spacing ?? 4, w = o.w ?? 1, tone = o.tone ?? 1;
    let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
    for (const p of poly) { minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); miny = Math.min(miny, p[1]); maxy = Math.max(maxy, p[1]); }
    const cx = (minx + maxx) / 2, cy = (miny + maxy) / 2;
    const R = Math.hypot(maxx - minx, maxy - miny) / 2 + 6;
    const d = [Math.cos(ang), Math.sin(ang)], n = [-d[1], d[0]];
    this.clip(poly);
    for (let s = -R; s <= R; s += spacing) {
      const jitter = this.rng.range(-0.35, 0.35);
      const c = [cx + n[0] * (s + jitter), cy + n[1] * (s + jitter)];
      this.stroke([[c[0] - d[0] * R, c[1] - d[1] * R], [c[0] + d[0] * R, c[1] + d[1] * R]],
        { w, tremor: o.tremor ?? 0.5, tone, ends: [0.5, 0.5] });
    }
    this.unclip();
  }
}

/** Draw the first `f` of a recorded stroke's centreline onto ctx (pen in motion). */
export function playPartial(ctx, m, f, color) {
    if (!m.line || m.line.P.length < 2) return;
    const P = m.line.P, n = Math.max(2, Math.ceil(P.length * f));
    if (m.clip) { ctx.save(); ctx.beginPath(); ctx.moveTo(m.clip[0][0], m.clip[0][1]); for (let i = 1; i < m.clip.length; i++) ctx.lineTo(m.clip[i][0], m.clip[i][1]); ctx.closePath(); ctx.clip(); }
    ctx.globalAlpha = m.tone; ctx.strokeStyle = color; ctx.lineWidth = m.line.w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(P[0][0], P[0][1]);
    for (let i = 1; i < n; i++) ctx.lineTo(P[i][0], P[i][1]);
    ctx.stroke(); ctx.globalAlpha = 1;
    if (m.clip) ctx.restore();
}

export class Ink {
  constructor(W, H, { dpr = 2, rng, paper = '#F2EFE7', inks = {} } = {}) {
    this.W = W; this.H = H; this.dpr = dpr; this.rng = rng; this.paper = paper;
    this.seps = {};
    for (const [name, cfg] of Object.entries(inks)) {
      this.seps[name] = new Sep(W, H, dpr, rng, cfg.color, cfg.reg ?? [0, 0]);
    }
  }
  get(name) { return this.seps[name]; }
  clear() { for (const s of Object.values(this.seps)) s.clear(); }

  /** Tint each separation, offset it a hair, multiply it down onto the paper. */
  composite(ctx, { paper = true, dx = 0, dy = 0 } = {}) {
    const { W, H, dpr } = this;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (paper) { ctx.fillStyle = this.paper; ctx.fillRect(0, 0, W, H); }
    if (!this._tmp) { this._tmp = document.createElement('canvas'); this._tmp.width = Math.ceil(W * dpr); this._tmp.height = Math.ceil(H * dpr); }
    const tmp = this._tmp;
    const tc = tmp.getContext('2d');
    for (const s of Object.values(this.seps)) {
      tc.setTransform(1, 0, 0, 1, 0, 0);
      tc.globalCompositeOperation = 'source-over';
      tc.clearRect(0, 0, tmp.width, tmp.height);
      tc.drawImage(s.cv, 0, 0);
      tc.globalCompositeOperation = 'source-in';
      tc.fillStyle = s.color; tc.fillRect(0, 0, tmp.width, tmp.height);
      ctx.globalCompositeOperation = 'multiply';
      ctx.drawImage(tmp, s.reg[0] + dx, s.reg[1] + dy, W, H);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }
}

/** A reusable grain tile — cheaper than per-frame ImageData noise. */
export function grainTile(rng, size = 128, amount = 0.07) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d');
  const img = x.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = 128 + (rng.next() * 2 - 1) * 255 * amount;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return c;
}
