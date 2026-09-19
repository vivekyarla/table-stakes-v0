// A posable hand. Arm and hand are ONE continuous tapering form — narrow at the
// wrist, widest at the knuckles — so the silhouette never shows a seam. Four
// long slender fingers fan off the knuckle line; the thumb lies along the
// radial edge. Local space: +x toward the fingertips, +y toward the pinky.
import { bez, resample, tubePoly, tubeEdges, subTubePoly, scaleRadii } from './geom.js';

const LIGHT = [-0.58, -0.66, 0.48];

function digit(base, ang, lengths, curls, grip, per = 7) {
  const pts = [base.slice()];
  let p = base.slice(), a = ang;
  for (let k = 0; k < lengths.length; k++) {
    a += curls[k] * grip;
    for (let s = 1; s <= per; s++) {
      const d = lengths[k] / per;
      p = [p[0] + Math.cos(a) * d, p[1] + Math.sin(a) * d];
      pts.push(p.slice());
    }
  }
  return pts;
}

// Fingers sit against each other and run nearly parallel; the divisions between
// them are lines, not gaps. Index knuckle sits furthest forward.
// Proportions taken off the reference: the hand mass is broad and the fingers
// are only about 4/5 its length, packed side by side.
const FINGERS = [
  { id: 'f0', base: [176, -62], ang: -0.03, len: [66, 50, 38], r: [20, 18.5, 15.5, 12], curl: [0.58, 0.70, 0.50] },
  { id: 'f1', base: [184, -21], ang: 0.00, len: [72, 56, 42], r: [20.5, 19, 16, 12.5], curl: [0.61, 0.74, 0.53] },
  { id: 'f2', base: [176, 20], ang: 0.04, len: [65, 50, 38], r: [19.5, 18, 15, 11.5], curl: [0.64, 0.77, 0.55] },
  { id: 'f3', base: [156, 58], ang: 0.10, len: [52, 40, 30], r: [17, 15.5, 13, 10], curl: [0.69, 0.83, 0.59] },
];

export function handParts(grip, spread = 1, bend = 1) {
  const parts = [];
  const spine = resample(bez([
    [-300, 92 * bend], [-206, 50 * bend], [-106, 12 * bend], [-30, 2],
    [50, 8], [136, 16], [216, 26],
  ], 26), 4);
  parts.push({
    id: 'armhand', kind: 'flat', spine,
    radii: {
      l: [64, 61, 58, 52, 58, 78, 88, 86],
      r: [64, 61, 58, 52, 56, 68, 76, 74],
    },
  });
  parts.push({
    id: 'thumb', kind: 'tube',
    spine: resample(digit([-22, -42], -0.48 + 0.34 * grip, [72, 52, 36],
      [0.20 + 0.36 * grip, 0.26 + 0.38 * grip, 0.18 + 0.28 * grip], 1), 4),
    radii: [34, 28, 21, 16],
  });
  for (const f of FINGERS) {
    parts.push({
      id: f.id, kind: 'tube',
      spine: resample(digit([f.base[0], f.base[1] * spread], f.ang, f.len, f.curl, grip), 4),
      radii: f.r,
    });
  }
  return parts;
}

function xf(pts, { x, y, a, s = 1 }) {
  const c = Math.cos(a), si = Math.sin(a);
  return pts.map(([px, py]) => [x + (px * c - py * si) * s, y + (px * si + py * c) * s]);
}

export function drawHand(S, pose, o = {}) {
  const parts = handParts(pose.grip, pose.spread ?? 1, pose.bend ?? 1);
  const T = { x: pose.x, y: pose.y, a: pose.a, s: pose.s ?? 1 };
  const W = (p) => ({ ...p, spine: xf(p.spine, T), radii: scaleRadii(p.radii, T.s) });
  const get = (id) => W(parts.find((p) => p.id === id));
  const OW = (o.ow ?? 2.0) * Math.max(0.72, T.s);
  const only = o.only ?? 'all';
  const want = (k) => only === 'all' || only === k;

  /** Shade a form, then stroke only the runs of its silhouette that are real edges. */
  const form = (p, opt = {}) => {
    const cb = opt.capBulge ?? 1;
    const poly = tubePoly(p.spine, p.radii, { cap0: true, cap1: true, capBulge: cb });
    S.erase(poly);
    if (p.kind === 'flat') {
      S.hatchAlong(p.spine, p.radii, {
        light: LIGHT, spacing: opt.spacing ?? 5.6, w: opt.hw ?? 0.68,
        ambient: opt.ambient ?? 0.52, threshold: opt.threshold ?? 0.32,
        flat: opt.flat ?? 0.24, trim: opt.trim ?? [0.05, 0.04], tremor: 0.6,
      });
    } else {
      S.hatchTube(p.spine, p.radii, {
        light: LIGHT, spacing: opt.spacing ?? 4.4, w: opt.hw ?? 0.66,
        ambient: opt.ambient ?? 0.42, threshold: opt.threshold ?? 0.40,
        bow: opt.bow ?? 0.16, shrink: 0.9, trim: opt.trim ?? [0.02, 0.02],
      });
    }
    const e = tubeEdges(p.spine, p.radii, { capBulge: cb });
    for (const k of opt.edges ?? ['left', 'right', 'cap1']) {
      S.stroke(e[k], { w: opt.ow ?? OW, tremor: 0.5, ends: [0.85, 0.85], step: 2 });
    }
    return { poly, e };
  };

  // one continuous arm + hand; no cap strokes, so nothing seams
  const ah = get('armhand');
  if (want('arm')) form(ah, { spacing: 5.6, ambient: 0.46, threshold: 0.3, trim: [0.44, 0.05], capBulge: 0.3, edges: ['left', 'right', 'cap1'] });

  S.texture(subTubePoly(ah.spine, ah.radii, 0.42, 1, { cap0: false, cap1: true, capBulge: 0.3 }),
    { n: Math.round(520 * T.s), len: 8 * T.s, angle: T.a + 0.12, spread: 0.6, w: 0.55, tone: 0.55 });

  // fingers lie over the hand, open at the base so they flow out of the knuckles
  if (want('fingers')) for (let i = 3; i >= 0; i--) {
    form(get('f' + i), { spacing: 3.6, ambient: 0.34, threshold: 0.42, ow: OW * 0.88, trim: [0.0, 0.05], edges: ['left', 'right', 'cap1'] });
  }

  // knuckles: soft bumps where each finger leaves the hand
  if (want('fingers')) for (const f of FINGERS) {
    const b = xf([[f.base[0] - 4, f.base[1] * (pose.spread ?? 1)]], T)[0];
    const r = 9 * T.s;
    S.stroke([[b[0] - r * Math.cos(T.a + 1.4), b[1] - r * Math.sin(T.a + 1.4)],
              [b[0] + r * Math.cos(T.a + 1.4), b[1] + r * Math.sin(T.a + 1.4)]],
             { w: OW * 0.62, tremor: 0.5, ends: [0.3, 0.3], tone: 0.75 });
  }

  // joint creases across each finger
  if (want('fingers')) for (const f of FINGERS) {
    const p = get(f.id);
    for (const ft of [0.36, 0.68]) {
      const i = Math.round(ft * (p.spine.length - 1));
      const a2 = p.spine[Math.min(p.spine.length - 1, i + 1)], b2 = p.spine[Math.max(0, i - 1)];
      const d = Math.atan2(a2[1] - b2[1], a2[0] - b2[0]) + Math.PI / 2;
      const r = p.radii[1] * 0.66;
      S.stroke([[p.spine[i][0] - Math.cos(d) * r, p.spine[i][1] - Math.sin(d) * r],
                [p.spine[i][0] + Math.cos(d) * r, p.spine[i][1] + Math.sin(d) * r]],
               { w: OW * 0.42, tremor: 0.45, ends: [0.25, 0.25], tone: 0.7 });
    }
  }

  // thumb reads over the hand, open at its base
  if (want('thumb') || only === 'all') form(get('thumb'), { spacing: 3.8, ambient: 0.32, threshold: 0.32, ow: OW * 0.92, edges: ['left', 'right', 'cap1'] });

  // sleeve fabric, then a compact cuff band at the wrist
  const n = ah.spine.length;
  const sleeve = subTubePoly(ah.spine, ah.radii, 0, 0.34, { cap0: true, cap1: false });
  S.hatchPoly(sleeve, { angle: T.a + 1.5, spacing: 7.4, w: 0.62, tremor: 0.9, tone: 0.3 });
  const band = subTubePoly(ah.spine, ah.radii, 0.34, 0.47, { cap0: false, cap1: false });
  S.hatchPoly(band, { angle: T.a + 1.42, spacing: 3.8, w: 0.8, tremor: 0.6, tone: 0.72 });
  const seam = (ft, wgt) => {
    const idx = Math.max(1, Math.min(n - 1, Math.round(ft * (n - 1))));
    const a2 = ah.spine[idx], b2 = ah.spine[idx - 1];
    const d = Math.atan2(a2[1] - b2[1], a2[0] - b2[0]) + Math.PI / 2;
    const r = 62 * T.s;
    S.stroke([[a2[0] - Math.cos(d) * r, a2[1] - Math.sin(d) * r],
              [a2[0] + Math.cos(d) * r, a2[1] + Math.sin(d) * r]],
             { w: OW * wgt, tremor: 0.45, ends: [0.5, 0.5] });
  };
  seam(0.34, 0.85);
  seam(0.47, 1.3);
  return { parts, T };
}
