// The engraving of San Francisco, drawn over real OpenStreetMap geometry.
// Everything is projected through the map (Leaflet's Web Mercator), so it is
// exact; the hand of the drawing is in how the lines are laid down.
import { GEO } from './geo.js';
import { resample, normals } from './geom.js';

// Places that are not in the data: relief and lettering. [lat, lon].
export const HILLS = [
  { name: 'Twin Peaks', ll: [37.7544, -122.4477], r: 620 },
  { name: 'Mt Sutro', ll: [37.7576, -122.4575], r: 380 },
  { name: 'Mt Davidson', ll: [37.7379, -122.4545], r: 520 },
  { name: 'Bernal Heights', ll: [37.7433, -122.4147], r: 360 },
  { name: 'Potrero Hill', ll: [37.7597, -122.3990], r: 320 },
  { name: 'Nob Hill', ll: [37.7930, -122.4161], r: 300 },
  { name: 'Russian Hill', ll: [37.8014, -122.4184], r: 260 },
  { name: 'Telegraph Hill', ll: [37.8024, -122.4058], r: 170 },
  { name: 'Diamond Heights', ll: [37.7420, -122.4380], r: 300 },
  { name: 'Mt Olympus', ll: [37.7628, -122.4440], r: 180 },
  { name: 'Presidio', ll: [37.7960, -122.4630], r: 260 },
  { name: 'Marin Headlands', ll: [37.8290, -122.5000], r: 900 },
  { name: 'Angel Island', ll: [37.8610, -122.4326], r: 600 },
  { name: 'Yerba Buena', ll: [37.8090, -122.3650], r: 260 },
];
export const LABELS = [
  { t: 'PACIFIC OCEAN', ll: [37.735, -122.545], s: 20, sp: 6, a: -Math.PI / 2 },
  { t: 'SAN FRANCISCO BAY', ll: [37.775, -122.352], s: 20, sp: 6, a: -Math.PI / 2 },
  { t: 'MARIN', ll: [37.856, -122.520], s: 14, sp: 5 },
  { t: 'OAKLAND', ll: [37.812, -122.283], s: 14, sp: 5 },
  { t: 'Golden Gate Park', ll: [37.7694, -122.4862], s: 11, i: true },
  { t: 'Presidio', ll: [37.7989, -122.4662], s: 11, i: true },
  { t: 'Twin Peaks', ll: [37.7515, -122.4477], s: 10, i: true },
  { t: 'Treasure Island', ll: [37.8235, -122.3706], s: 9, i: true },
  { t: 'Alcatraz', ll: [37.8267, -122.4230], s: 9, i: true },
  { t: 'Golden Gate', ll: [37.8205, -122.4790], s: 9, i: true, a: -1.35 },
  { t: 'Mission', ll: [37.7590, -122.4150], s: 10, i: true },
  { t: 'SoMa', ll: [37.7790, -122.4060], s: 10, i: true },
  { t: 'Jackson Square', ll: [37.7960, -122.4030], s: 9, i: true },
];

/** Rasterise the coastline and flood from open water: 1 = water, 0 = land. */
export function waterMask(project, W, H, cell = 2) {
  const gw = Math.ceil(W / cell), gh = Math.ceil(H / cell);
  const g = new Uint8Array(gw * gh);          // 0 unknown, 1 water, 2 coast
  const mark = (x, y) => { if (x >= 0 && y >= 0 && x < gw && y < gh) g[y * gw + x] = 2; };
  for (const line of GEO.coast) {
    for (let i = 1; i < line.length; i++) {
      const a = project(line[i - 1]), b = project(line[i]);
      const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / cell));
      for (let k = 0; k <= n; k++) mark(Math.floor((a[0] + (b[0] - a[0]) * k / n) / cell), Math.floor((a[1] + (b[1] - a[1]) * k / n) / cell));
    }
  }
  const seeds = [[37.725, -122.520], [37.800, -122.360], [37.835, -122.445]].map(([lat, lon]) => project([lon, lat]));
  const stack = [];
  for (const s of seeds) {
    const x = Math.floor(s[0] / cell), y = Math.floor(s[1] / cell);
    if (x >= 0 && y >= 0 && x < gw && y < gh && g[y * gw + x] === 0) { g[y * gw + x] = 1; stack.push(y * gw + x); }
  }
  while (stack.length) {
    const i = stack.pop(), x = i % gw, y = (i / gw) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
      const j = ny * gw + nx;
      if (g[j] === 0) { g[j] = 1; stack.push(j); }
    }
  }
  return { isWater: (x, y) => { const i = Math.floor(y / cell) * gw + Math.floor(x / cell); return g[i] === 1; }, gw, gh, cell, g };
}

function wobbleRing(rng, cx, cy, r, n = 48, amp = 0.16, ph = 0) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (1 + amp * rng.fbm(a * 1.7 + ph, 3) + 0.06 * rng.fbm(a * 5 + ph * 3, 2));
    out.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.86]);
  }
  return out;
}
function hill(S, rng, x, y, r, rings, isLand, tone = 1) {
  let cx = x, cy = y;
  for (let k = 0; k < rings; k++) {
    const t = 1 - k / rings;
    cx += rng.range(-0.08, 0.08) * r; cy += rng.range(-0.06, 0.06) * r;
    const ring = wobbleRing(rng, cx, cy, r * t * 0.9, 56, 0.3, x * 0.013 + k * 1.7);
    const pts = ring.filter((p) => isLand(p[0], p[1]));
    if (pts.length < 8) continue;
    S.stroke(ring.concat([ring[0]]), { w: 0.5 + 0.25 * (1 - t), tremor: 0.7, freq: 0.05, ends: [1, 1], tone: tone * (0.4 + 0.25 * (1 - t)), step: 2.5, clipTest: isLand });
  }
  const n = Math.round(r * 2.4);
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, Math.PI * 2);
    const shade = 0.5 + 0.5 * Math.cos(a - 0.8);
    if (rng.next() > 0.35 + 0.65 * shade) continue;
    const r0 = r * rng.range(0.3, 0.7), len = r * rng.range(0.1, 0.2) * (0.6 + 0.6 * shade);
    const wob = rng.range(-0.25, 0.25);
    const p0 = [x + Math.cos(a) * r0, y + Math.sin(a) * r0 * 0.86];
    const p1 = [x + Math.cos(a + wob) * (r0 + len), y + Math.sin(a + wob) * (r0 + len) * 0.86];
    if (!isLand(p0[0], p0[1]) || !isLand(p1[0], p1[1])) continue;
    S.stroke([p0, p1], { w: 0.45 + 0.5 * shade, tremor: 0.4, ends: [0.3, 0.7], tone: tone * (0.3 + 0.5 * shade), step: 2 });
  }
}

/**
 * Engrave the static map. `project([lon, lat]) -> [x, y]` in CSS px,
 * `mpp` = metres per pixel, `mask` from waterMask(). Draw order is reveal order.
 */
export function drawStatic(ink, rng, project, W, H, mpp, mask) {
  const S = ink.get('ink'), G = ink.get('gold');
  const isLand = (x, y) => !mask.isWater(x, y);
  const P = (line) => line.map(project);

  // 1. coastlines
  for (const line of GEO.coast) S.stroke(P(line), { w: 1.9, tremor: 0.8, freq: 0.02, ends: [1, 1], step: 2.5 });
  // 2. water lines on the water side of every shore (land is on the left of a coastline way)
  for (const line of GEO.coast) {
    const pts = resample(P(line), 6); if (pts.length < 3) continue;
    const nm = normals(pts);
    [5, 11, 18].forEach((d, k) => {
      const off = pts.map((p, i) => [p[0] - nm[i][0] * d, p[1] - nm[i][1] * d]);   // right-hand side
      S.stroke(off, { w: 0.85 - k * 0.12, tremor: 0.7, freq: 0.03, ends: [1, 1], tone: 0.7 - k * 0.15, step: 3, clipTest: mask.isWater });
    });
  }
  // 3. relief
  for (const h of HILLS) { const c = project([h.ll[1], h.ll[0]]); hill(S, rng, c[0], c[1], h.r / mpp, 1, isLand, 0.9); }
  // 4. parks and lakes
  for (const poly of GEO.parks) {
    const pts = P(poly);
    S.texture(pts, { n: Math.round(Math.abs(polyArea(pts)) / 42), len: 3.5, angle: 0.3, spread: 1.2, w: 0.55, tone: 0.34 });
    S.stroke(pts.concat([pts[0]]), { w: 0.8, tremor: 0.8, ends: [1, 1], tone: 0.55, step: 3 });
  }
  for (const poly of GEO.water) {
    const pts = P(poly);
    S.stroke(pts.concat([pts[0]]), { w: 0.9, tremor: 0.7, ends: [1, 1], tone: 0.7, step: 3 });
    S.hatchPoly(pts, { angle: 0, spacing: 4, w: 0.5, tremor: 0.5, tone: 0.35 });
  }
  // 5. roads, lightest first; bridges heavier, with ties
  for (const rank of [1, 2, 3]) for (const rd of GEO.roads) {
    if (rd.r !== rank) continue;
    const pts = P(rd.p);
    if (rd.b) {
      S.stroke(pts, { w: 1.6, tremor: 0.4, ends: [1, 1], step: 3 });
      const R = resample(pts, 3), nm = normals(R);
      for (let i = 4; i < R.length - 4; i += 6) { const p = R[i], n = nm[i]; S.stroke([[p[0] - n[0] * 2.2, p[1] - n[1] * 2.2], [p[0] + n[0] * 2.2, p[1] + n[1] * 2.2]], { w: 0.5, tremor: 0.2, tone: 0.7 }); }
    } else {
      S.stroke(pts, { w: [0.5, 0.75, 0.95][rank - 1], tremor: 0.45, freq: 0.02, ends: [0.9, 0.9], tone: [0.4, 0.56, 0.66][rank - 1], step: 3 });
    }
  }
  // 6. compass and neat line, in gold
  const cx = W - 96, cy = H - 96;
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 - Math.PI / 2;
    const tip = [cx + Math.cos(a) * 40, cy + Math.sin(a) * 40];
    const l = [cx + Math.cos(a + 0.35) * 11, cy + Math.sin(a + 0.35) * 11], r = [cx + Math.cos(a - 0.35) * 11, cy + Math.sin(a - 0.35) * 11];
    G.fill([tip, l, [cx, cy], r], k === 0 ? 1 : 0.55);
    S.stroke([tip, l, [cx, cy], r, tip], { w: 0.8, tremor: 0.4, tone: 0.9, step: 2 });
  }
  const ring = []; for (let i = 0; i <= 48; i++) ring.push([cx + Math.cos(i / 48 * Math.PI * 2) * 27, cy + Math.sin(i / 48 * Math.PI * 2) * 27]);
  S.stroke(ring, { w: 0.7, tremor: 0.4, ends: [1, 1], tone: 0.8, step: 2 });
  const neat = [[12, 12], [W - 12, 12], [W - 12, H - 12], [12, H - 12]];
  G.stroke(neat.concat([neat[0]]), { w: 1.0, tremor: 0.4, ends: [1, 1], tone: 0.95, step: 4 });
}
function polyArea(p) { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; }
