// San Francisco, drawn. World space is 1400 x 900, north up. Everything here
// is authored geometry or procedural detail engraved through ink.js; the
// result is recorded stroke by stroke so the map can draw itself in.
import { resample, normals } from './geom.js';

export const W = 1400, H = 900;

// ---- authored geometry -----------------------------------------------------
export const SF = [[298, 202],[313, 191],[332, 185],[351, 179],[366, 176],[389, 181],[412, 187],[442, 189],[465, 188],[484, 191],[503, 196],[522, 198],[541, 202],[560, 213],[579, 225],[594, 238],[607, 258],[613, 275],[617, 292],[617, 318],[622, 339],[626, 357],[619, 372],[615, 380],[624, 391],[634, 402],[651, 410],[664, 419],[655, 434],[645, 447],[653, 466],[657, 481],[643, 496],[632, 509],[626, 529],[621, 554],[617, 606],[556, 606],[480, 606],[404, 606],[328, 606],[290, 606],[286, 546],[286, 477],[288, 412],[290, 357],[290, 305],[290, 262],[290, 228],[290, 210]];
export const MARIN = [[-40,-40],[-40,205],[80,196],[150,182],[210,166],[260,150],[300,136],[340,122],[372,110],[400,104],
  [440,100],[480,104],[506,92],[528,64],[552,34],[575,-40]];
export const EASTBAY = [[1440,-40],[1440,940],[1010,940],[1000,860],[990,760],[992,640],[998,520],[1006,420],[1002,320],
  [1010,220],[1020,120],[1010,-40]];
export const TREASURE = [[792,214],[840,212],[846,284],[830,296],[812,300],[796,292],[788,255]];
export const ANGEL = { cx: 566, cy: 128, rx: 30, ry: 24 };
export const ALCATRAZ = { cx: 604, cy: 140, rx: 12, ry: 7 };
export const GG_PARK = [[297,340],[457,338],[458,366],[297,368]];
export const PRESIDIO = [[326,186],[412,182],[420,222],[404,254],[340,258],[322,224]];
export const LAKE_MERCED = { cx: 312, cy: 556, rx: 12, ry: 26 };
export const MCLAREN = { cx: 586, cy: 522, rx: 24, ry: 17 };
export const BRIDGES = [
  { name: 'Golden Gate', pts: [[366,176],[374,108]] },
  { name: 'Bay Bridge', pts: [[614,266],[800,290],[1000,300]] },
];
export const HILLS = [
  { name: 'Twin Peaks', x: 458, y: 402, r: 58, rings: 4 },
  { name: 'Mt Sutro', x: 448, y: 376, r: 36, rings: 3 },
  { name: 'Mt Davidson', x: 440, y: 462, r: 48, rings: 4 },
  { name: 'Bernal', x: 528, y: 462, r: 32, rings: 3 },
  { name: 'Potrero', x: 566, y: 400, r: 30, rings: 3 },
  { name: 'Nob Hill', x: 564, y: 246, r: 28, rings: 3 },
  { name: 'Russian Hill', x: 540, y: 224, r: 26, rings: 3 },
  { name: 'Telegraph', x: 574, y: 214, r: 16, rings: 2 },
  { name: 'Presidio', x: 378, y: 220, r: 26, rings: 3 },
  { name: 'Diamond Hts', x: 482, y: 436, r: 28, rings: 3 },
  { name: 'Hunters Pt', x: 642, y: 424, r: 24, rings: 2 },
  { name: 'Mt Olympus', x: 470, y: 352, r: 20, rings: 2 },
];
export const STREETS = [
  { name: 'Market', w: 1.3, pts: [[610,258],[578,290],[540,330],[500,368],[462,400]] },
  { name: 'Van Ness', w: 1.0, pts: [[510,190],[510,412]] },
  { name: 'Geary', w: 0.9, pts: [[292,280],[600,278]] },
  { name: 'Mission', w: 1.0, pts: [[602,272],[574,326],[552,392],[536,470],[520,584]] },
  { name: '19th Ave', w: 0.9, pts: [[340,340],[338,604]] },
  { name: 'Columbus', w: 0.9, pts: [[534,204],[586,246]] },
  { name: 'Embarcadero', w: 1.0, pts: [[534,200],[572,224],[600,246],[614,272],[618,320]] },
  { name: 'Great Hwy', w: 0.8, pts: [[292,312],[288,420],[290,560]] },
  { name: '3rd St', w: 0.9, pts: [[618,320],[626,360],[622,400],[640,432],[652,470]] },
  { name: 'Divisadero', w: 0.7, pts: [[438,190],[436,400]] },
  { name: 'Lombard', w: 0.7, pts: [[400,206],[560,208]] },
  { name: 'Cesar Chavez', w: 0.7, pts: [[496,470],[622,468]] },
  { name: 'Sloat', w: 0.7, pts: [[292,530],[500,528]] },
  { name: 'Fulton', w: 0.6, pts: [[297,336],[510,334]] },
  { name: 'Lincoln', w: 0.6, pts: [[297,370],[458,370]] },
];
export const LABELS = [
  { t: 'PACIFIC OCEAN', x: 120, y: 470, s: 20, sp: 6, a: -Math.PI / 2 },
  { t: 'SAN FRANCISCO BAY', x: 840, y: 470, s: 20, sp: 6, a: -Math.PI / 2 },
  { t: 'MARIN', x: 150, y: 90, s: 14, sp: 5 },
  { t: 'OAKLAND', x: 1200, y: 320, s: 14, sp: 5 },
  { t: 'Golden Gate Park', x: 377, y: 353, s: 11, i: true },
  { t: 'Presidio', x: 372, y: 246, s: 11, i: true },
  { t: 'Twin Peaks', x: 458, y: 416, s: 10, i: true },
  { t: 'Treasure Island', x: 818, y: 205, s: 9, i: true },
  { t: 'Alcatraz', x: 604, y: 128, s: 9, i: true },
  { t: 'Golden Gate', x: 356, y: 142, s: 9, i: true, a: -1.45 },
];

// ---- helpers ---------------------------------------------------------------
export function ellipse(e, n = 40) {
  const out = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; out.push([e.cx + Math.cos(a) * e.rx, e.cy + Math.sin(a) * e.ry]); }
  return out;
}
/** Offset a closed polygon outward by d (vertex-normal offset on a resampled ring). */
export function offsetPoly(poly, d, step = 6) {
  const P = resample(poly.concat([poly[0]]), step); P.pop();
  const n = P.length, out = [];
  // orientation: make normals point outward whichever way the polygon winds
  let area = 0; for (let i = 0; i < n; i++) { const a = P[i], b = P[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
  const sgn = area > 0 ? -1 : 1;
  for (let i = 0; i < n; i++) {
    const a = P[(i - 1 + n) % n], b = P[(i + 1) % n];
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    out.push([P[i][0] + (-dy / L) * d * sgn, P[i][1] + (dx / L) * d * sgn]);
  }
  return out;
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
export function pointInPoly(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
export const LANDS = () => [SF, MARIN, EASTBAY, TREASURE, ellipse(ANGEL), ellipse(ALCATRAZ)];
export function isWater(p) { return !LANDS().some((L) => pointInPoly(p, L)) || pointInPoly(p, ellipse(LAKE_MERCED)); }

/** A hill: a few loose, drifting contours and hachures running down the slopes. */
function hill(S, rng, x, y, r, rings, tone = 1) {
  let cx = x, cy = y;
  for (let k = 0; k < rings; k++) {
    const t = 1 - k / rings;
    cx += rng.range(-0.08, 0.08) * r; cy += rng.range(-0.06, 0.06) * r;
    const ring = wobbleRing(rng, cx, cy, r * t * 0.9, 56, 0.3, x * 0.013 + k * 1.7);
    S.stroke(ring.concat([ring[0]]), { w: 0.5 + 0.25 * (1 - t), tremor: 0.7, freq: 0.05, ends: [1, 1], tone: tone * (0.45 + 0.25 * (1 - t)), step: 2.5 });
  }
  // hachures: short strokes downslope, heavier on the shadowed south-east side
  const n = Math.round(r * 1.7);
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, Math.PI * 2);
    const shade = 0.5 + 0.5 * Math.cos(a - 0.8);          // 1 facing SE, 0 facing NW
    if (rng.next() > 0.35 + 0.65 * shade) continue;
    const r0 = r * rng.range(0.3, 0.7), len = r * rng.range(0.1, 0.2) * (0.6 + 0.6 * shade);
    const wob = rng.range(-0.25, 0.25);
    const p0 = [x + Math.cos(a) * r0, y + Math.sin(a) * r0 * 0.86];
    const p1 = [x + Math.cos(a + wob) * (r0 + len), y + Math.sin(a + wob) * (r0 + len) * 0.86];
    S.stroke([p0, p1], { w: 0.45 + 0.5 * shade, tremor: 0.4, ends: [0.3, 0.7], tone: tone * (0.3 + 0.5 * shade), step: 2 });
  }
}

// ---- the drawing -----------------------------------------------------------
/**
 * Engrave the static map into the ink and gold separations. Order matters:
 * it is the order the map draws itself in on screen.
 */
export function drawStatic(ink, rng) {
  const S = ink.get('ink'), G = ink.get('gold');
  const coast = (poly, w) => S.stroke(poly.concat([poly[0]]), { w, tremor: 0.9, freq: 0.02, ends: [1, 1], step: 2.5 });

  // 1. coastlines
  coast(SF, 2.1); coast(MARIN, 1.7); coast(EASTBAY, 1.7); coast(TREASURE, 1.3);
  coast(ellipse(ANGEL), 1.2); coast(ellipse(ALCATRAZ), 1.0);
  // 2. water lines hugging every shore, fading out — the engraved-map convention
  for (const L of [SF, MARIN, EASTBAY, TREASURE, ellipse(ANGEL, 48), ellipse(ALCATRAZ, 30)]) {
    const ds = [4, 9, 15];
    ds.forEach((d, k) => {
      const ring = offsetPoly(L, d, 7);
      S.stroke(ring.concat([ring[0]]), { w: 0.9 - k * 0.12, tremor: 0.7, freq: 0.03, ends: [1, 1], tone: 0.72 - k * 0.14, step: 3 });
    });
  }
  // 3. hills: contour rings, clipped to the peninsula
  S.clip(SF);
  for (const h of HILLS) hill(S, rng, h.x, h.y, h.r, h.rings);
  S.unclip();
  // Marin and East Bay get looser hills
  S.clip(MARIN);
  for (const c of [[70, 70, 66], [210, 92, 56], [320, 66, 40], [440, 44, 34]]) hill(S, rng, c[0], c[1], c[2], 3, 0.7);
  S.unclip();
  S.clip(EASTBAY);
  for (const c of [[1290, 130, 84], [1330, 430, 76], [1280, 690, 86], [1180, 560, 40]]) hill(S, rng, c[0], c[1], c[2], 3, 0.7);
  S.unclip();
  // 4. parks: stippled green-ish (in ink terms: a soft tone) with an edge
  for (const P of [GG_PARK, PRESIDIO, ellipse(MCLAREN, 36)]) {
    S.texture(P, { n: 900, len: 3.5, angle: 0.3, spread: 1.2, w: 0.55, tone: 0.34 });
    S.stroke(P.concat([P[0]]), { w: 0.8, tremor: 0.8, ends: [1, 1], tone: 0.6, step: 3 });
  }
  const lm = ellipse(LAKE_MERCED, 36);
  S.stroke(lm.concat([lm[0]]), { w: 0.9, tremor: 0.7, ends: [1, 1], tone: 0.7, step: 3 });
  S.hatchPoly(lm, { angle: 0, spacing: 4, w: 0.5, tremor: 0.5, tone: 0.35 });
  // 5. streets, clipped to land
  S.clip(SF);
  for (const st of STREETS) S.stroke(st.pts, { w: st.w, tremor: 0.5, freq: 0.02, ends: [0.9, 0.9], tone: 0.62, step: 3 });
  // the grid: faint blocks in the flats
  const grid = (x0, y0, x1, y1, ang, sp) => {
    const box = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    S.hatchPoly(box, { angle: ang, spacing: sp, w: 0.35, tremor: 0.3, tone: 0.22 });
    S.hatchPoly(box, { angle: ang + Math.PI / 2, spacing: sp, w: 0.35, tremor: 0.3, tone: 0.22 });
  };
  grid(470, 185, 650, 300, 0.03, 9);        // downtown / Nob / Russian
  grid(300, 250, 470, 350, 0.0, 10);        // Richmond
  grid(300, 396, 420, 540, 0.0, 10);        // Sunset
  grid(520, 300, 660, 520, -0.58, 9);       // SoMa / Mission, on the Market grid
  S.unclip();
  // 6. bridges
  for (const b of BRIDGES) {
    S.stroke(b.pts, { w: 1.6, tremor: 0.4, ends: [1, 1], step: 3 });
    const P = resample(b.pts, 3);
    const nm = normals(P);
    for (let i = 4; i < P.length - 4; i += 5) {
      const p = P[i], n = nm[i];
      S.stroke([[p[0] - n[0] * 2.2, p[1] - n[1] * 2.2], [p[0] + n[0] * 2.2, p[1] + n[1] * 2.2]], { w: 0.5, tremor: 0.2, tone: 0.7 });
    }
    // towers
    const tw = b.name === 'Golden Gate' ? [0.33, 0.67] : [0.22, 0.42];
    for (const f of tw) { const i = Math.floor(f * (P.length - 1)); const p = P[i], n = nm[i]; S.stroke([[p[0] - n[0] * 7, p[1] - n[1] * 7], [p[0] + n[0] * 7, p[1] + n[1] * 7]], { w: 1.8, tremor: 0.3 }); }
  }
  // 7. a compass rose and the neat line, in gold
  const cx = 1230, cy = 760;
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 - Math.PI / 2;
    const tip = [cx + Math.cos(a) * 46, cy + Math.sin(a) * 46];
    const l = [cx + Math.cos(a + 0.35) * 12, cy + Math.sin(a + 0.35) * 12], r = [cx + Math.cos(a - 0.35) * 12, cy + Math.sin(a - 0.35) * 12];
    G.fill([tip, l, [cx, cy], r], k === 0 ? 1 : 0.55);
    S.stroke([tip, l, [cx, cy], r, tip], { w: 0.8, tremor: 0.4, tone: 0.9, step: 2 });
  }
  const ring = ellipse({ cx, cy, rx: 30, ry: 30 }, 48);
  S.stroke(ring.concat([ring[0]]), { w: 0.7, tremor: 0.4, ends: [1, 1], tone: 0.8, step: 2 });
  S.stroke(ellipse({ cx, cy, rx: 34, ry: 34 }, 48).concat([[cx + 34, cy]]), { w: 0.4, tremor: 0.3, ends: [1, 1], tone: 0.6, step: 2 });
  const neat = [[18, 18], [W - 18, 18], [W - 18, H - 18], [18, H - 18]];
  S.stroke(neat.concat([neat[0]]), { w: 1.2, tremor: 0.5, ends: [1, 1], tone: 0.9, step: 4 });
  const neat2 = [[26, 26], [W - 26, 26], [W - 26, H - 26], [26, H - 26]];
  G.stroke(neat2.concat([neat2[0]]), { w: 0.9, tremor: 0.4, ends: [1, 1], tone: 0.9, step: 4 });
}
