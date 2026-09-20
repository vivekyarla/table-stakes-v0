// A skeletal hand in three dimensions. Every bone is a capsule with an
// elliptical section (wide across the hand, thin through it), so the palm is
// a slab and the fingers are round. Joints flex about real axes, the whole hand
// is placed with a rotation, and the scene is projected and depth-sorted
// before ink.js engraves it. Local frame: +X distal, +Y radial (thumb side),
// +Z dorsal (back of the hand).
import { v3, rotAxis, eulerMat, matApply } from './vec3.js';
import { resample, normals, tubePoly, tubeEdges } from './geom.js';

const Z = [0, 0, 1];

// Knuckle positions and finger proportions; index is nearest the thumb (+Y).
const FINGERS = [
  { id: 'index',  knuckle: [196, 46, 2],  dir: [1, 0.06, 0],  len: [62, 40, 30], r: [17, 15, 12.5, 9.5] },
  { id: 'middle', knuckle: [204, 14, 3],  dir: [1, 0.0, 0],   len: [68, 46, 32], r: [17.5, 15.5, 13, 10] },
  { id: 'ring',   knuckle: [196, -18, 2], dir: [1, -0.05, 0], len: [62, 42, 30], r: [16.5, 14.5, 12, 9.5] },
  { id: 'pinky',  knuckle: [176, -48, 0], dir: [1, -0.14, 0], len: [48, 32, 24], r: [14.5, 12.5, 10.5, 8] },
];
const FLEX = [0.92, 1.12, 0.72];     // per-joint flexion at full grip
const REST = [0.10, 0.08, 0.04];     // a relaxed hand is never dead straight

/** Chain phalanges from a base along `dir`, flexing about the finger's own width axis. */
function chain(base, dir, lens, flex, rad, id, group) {
  const bones = [];
  let p = base.slice();
  let d = v3.norm(dir);
  const axis = v3.norm(v3.cross(Z, d));           // in the palm plane, across the finger
  for (let k = 0; k < lens.length; k++) {
    d = v3.norm(rotAxis(d, axis, flex[k]));
    const q = v3.add(p, v3.mul(d, lens[k]));
    bones.push({
      id: `${id}${k}`, group, kind: 'tube',
      p0: p, p1: q, ru: [rad[k], rad[k + 1]], rv: [rad[k], rad[k + 1]],
      u: axis, v: v3.norm(v3.cross(d, axis)),
      capEnd: k === lens.length - 1, joint: k,
      dir: d,
    });
    p = q;
  }
  return bones;
}

/** All bones of a right hand in local space for grip in [0,1]. */
export function handBones(grip, o = {}) {
  const g = Math.max(0, Math.min(1, grip));
  const bones = [];
  const Y = [0, 1, 0];

  bones.push({ id: 'forearm', group: 'arm', kind: 'flat',
    p0: [-360, -62, 46], p1: [-6, 0, 0], ru: [58, 40], rv: [48, 33], u: Y, v: Z, capEnd: false });
  // the back of the hand: a slab that widens toward the knuckles
  bones.push({ id: 'meta', group: 'hand', kind: 'flat',
    p0: [-14, 2, 0], p1: [198, 4, 1], ru: [40, 74], rv: [28, 31], u: Y, v: Z, capEnd: true, capBulge: 0.32 });
  // thenar: the thumb's muscle, a bulge on the radial edge sitting slightly palmar
  bones.push({ id: 'thenar', group: 'hand', kind: 'tube',
    p0: [-4, 30, -8], p1: [84, 50, -10], ru: [28, 24], rv: [22, 18], u: Y, v: Z, capEnd: true });

  for (const f of FINGERS) {
    const flex = FLEX.map((a, k) => REST[k] + a * g);
    bones.push(...chain(f.knuckle, f.dir, f.len, flex, f.r, f.id, 'fingers'));
    const k = f.knuckle, r = f.r[0] * 0.95;
    bones.push({ id: `${f.id}K`, group: 'knuckle', kind: 'tube',
      p0: [k[0] - 8, k[1], k[2] + 6], p1: [k[0] + 8, k[1], k[2] + 6], ru: [r, r], rv: [r * 0.8, r * 0.8],
      u: Y, v: Z, capEnd: true, soft: true });
  }
  // thumb: metacarpal from the wrist's radial corner, angled out, then two phalanges
  const tb = [-16, 38, -8];
  const tdir = v3.norm([0.76, 0.64, -0.12]);
  const tflex = [0.06 + 0.34 * g, 0.16 + 0.44 * g, 0.12 + 0.36 * g];
  const thumb = chain(tb, tdir, [66, 42, 30], tflex, [25, 22, 18, 13.5], 'thumb', 'thumb');
  bones.push(...thumb);
  return bones;
}

/** Place a hand: rotate by (yaw, pitch, roll) and translate; scale uniformly. */
export function placeHand(bones, { pos = [0, 0, 0], yaw = 0, pitch = 0, roll = 0, scale = 1 } = {}) {
  const M = eulerMat(yaw, pitch, roll);
  const T = (p) => v3.add(pos, v3.mul(matApply(M, p), scale));
  const D = (d) => v3.norm(matApply(M, d));
  return bones.map((b) => ({
    ...b,
    p0: T(b.p0), p1: T(b.p1),
    ru: b.ru.map((r) => r * scale), rv: b.rv.map((r) => r * scale),
    u: D(b.u), v: D(b.v), dir: b.dir ? D(b.dir) : undefined,
  }));
}

/** Orthographic camera from yaw/pitch: returns basis {R, U, V} with V toward the viewer. */
export function camera(yaw = 0, pitch = 0) {
  const M = eulerMat(yaw, pitch, 0);
  return { R: matApply(M, [1, 0, 0]), U: matApply(M, [0, 1, 0]), V: matApply(M, [0, 0, 1]) };
}

/**
 * Project bones to screen tubes. For an elliptical section the silhouette
 * half-width across the projected axis is sqrt((ru u·n)^2 + (rv v·n)^2) where
 * n is the screen-perpendicular lifted into 3-D.
 */
export function project(bones, cam, cx, cy) {
  const out = [];
  for (const b of bones) {
    const s2 = (p) => [cx + v3.dot(p, cam.R), cy - v3.dot(p, cam.U)];
    const a = s2(b.p0), c = s2(b.p1);
    const depth = (v3.dot(b.p0, cam.V) + v3.dot(b.p1, cam.V)) / 2;
    let dx = c[0] - a[0], dy = c[1] - a[1];
    const L = Math.hypot(dx, dy);
    if (L < 1e-6) { dx = 1; dy = 0; } else { dx /= L; dy /= L; }
    const n2 = [-dy, dx];
    const N3 = v3.add(v3.mul(cam.R, n2[0]), v3.mul(cam.U, -n2[1]));
    const proj = (k) => Math.hypot(b.ru[k] * v3.dot(b.u, N3), b.rv[k] * v3.dot(b.v, N3));
    // how much of the section's thickness we see end-on (foreshortening)
    const along = b.dir ? Math.abs(v3.dot(b.dir, cam.V)) : 0;
    out.push({
      ...b, a, c, depth, len2: L,
      radii: [proj(0), proj(1)],
      endFacing: along,
      dorsal: b.v ? v3.dot(b.v, cam.V) : 0,
    });
  }
  return out;
}

/** Rotation for a hand: roll about its own long axis, then tilt in the screen plane, then yaw. */
export function handMat(yaw, tilt, roll) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const ct = Math.cos(tilt), st = Math.sin(tilt);
  const cr = Math.cos(roll), sr = Math.sin(roll);
  const Ry = [[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]];
  const Rz = [[ct, -st, 0], [st, ct, 0], [0, 0, 1]];
  const Rx = [[1, 0, 0], [0, cr, -sr], [0, sr, cr]];
  const mm = (A, B) => { const M = [[0,0,0],[0,0,0],[0,0,0]]; for (let i=0;i<3;i++) for (let j=0;j<3;j++) M[i][j]=A[i][0]*B[0][j]+A[i][1]*B[1][j]+A[i][2]*B[2][j]; return M; };
  return mm(Ry, mm(Rz, Rx));
}

export function placeHand2(bones, { pos = [0, 0, 0], yaw = 0, tilt = 0, roll = 0, scale = 1 } = {}) {
  const M = handMat(yaw, tilt, roll);
  const T = (p) => v3.add(pos, v3.mul(matApply(M, p), scale));
  const D = (d) => v3.norm(matApply(M, d));
  return bones.map((b) => ({
    ...b, p0: T(b.p0), p1: T(b.p1),
    ru: b.ru.map((r) => r * scale), rv: b.rv.map((r) => r * scale),
    u: D(b.u), v: D(b.v), dir: b.dir ? D(b.dir) : undefined,
  }));
}

/**
 * Engrave projected bones far-to-near. Each bone knocks out what is behind it,
 * is shaded from its own kind, and is outlined along its real silhouette only.
 */
export function engrave(S, drawables, o = {}) {
  const light = o.light ?? [-0.55, -0.66, 0.5];
  const OW = o.ow ?? 1.9;
  const sorted = drawables.slice().sort((p, q) => p.depth - q.depth);
  for (const d of sorted) {
    if (d.len2 < 0.5) continue;
    const spine = resample([d.a, d.c], 4);
    if (spine.length < 2) continue;
    const radii = d.radii;
    const cb = d.capBulge ?? 1;
    const poly = tubePoly(spine, radii, { cap0: true, cap1: true, capBulge: cb });
    S.erase(poly);
    if (d.kind === 'flat') {
      S.hatchAlong(spine, radii, {
        light, spacing: 4.4, w: 0.7, ambient: 0.34, threshold: 0.2, flat: 0.24,
        trim: d.id === 'forearm' ? [0.46, 0.04] : [0.06, 0.05], tremor: 0.6,
      });
      if (d.id === 'meta') {
        // strokes curving across the back of the hand toward the knuckles
        S.hatchTube(spine, radii, { light, spacing: 6.2, w: 0.6, ambient: 0.5, threshold: 0.3, bow: 0.5, shrink: 0.86, trim: [0.5, 0.04], tone: 0.7, cross: 2 });
      }
    } else {
      S.hatchTube(spine, radii, {
        light, spacing: 3.1, w: 0.7, ambient: 0.24, threshold: 0.28, bow: 0.16, shrink: 0.9,
        trim: [0.02, d.capEnd ? 0.04 : 0.02], cross: 0.6,
      });
      if ((d.group === 'fingers' || d.group === 'thumb') && d.dorsal > 0.3 && d.len2 > 10) {
        S.texture(poly, { n: Math.round(d.len2 * 0.9), len: 4, angle: Math.atan2(d.c[1] - d.a[1], d.c[0] - d.a[0]) + 0.2, spread: 0.7, w: 0.45, tone: 0.4 * d.dorsal });
      }
    }
    const e = tubeEdges(spine, radii, { capBulge: cb });
    const runs = ['left', 'right'];
    if (d.capEnd) runs.push('cap1');
    const thenar = d.id === 'thenar' || d.soft;
    if (d.soft) runs.length = 0;
    const L2 = (() => { const l = Math.hypot(light[0], light[1]) || 1; return [light[0] / l, light[1] / l]; })();
    const base = OW * (thenar ? 0.55 : d.kind === 'tube' ? 0.9 : 1.05);
    const weights = (pts, outward) => pts.map((p, i) => {
      const nrm = outward(p, i);
      const f = 0.5 - 0.5 * (nrm[0] * L2[0] + nrm[1] * L2[1]);
      return base * (0.45 + 1.05 * f);
    });
    const nm = normals(spine);
    for (const k of runs) {
      let ws;
      if (k === 'left') ws = weights(e.left, (p, i) => nm[Math.min(i, nm.length - 1)]);
      else if (k === 'right') ws = weights(e.right, (p, i) => { const q = nm[Math.min(i, nm.length - 1)]; return [-q[0], -q[1]]; });
      else { const c = spine[spine.length - 1]; ws = weights(e.cap1, (p) => { const dx = p[0] - c[0], dy = p[1] - c[1], l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; }); }
      S.stroke(e[k], { w: base, widths: ws, tremor: 0.5, ends: [0.85, 0.85], step: 2, tone: thenar ? 0.6 : 1 });
    }

    // fingernail on a distal phalanx when its back faces us
    if (d.capEnd && d.group !== 'hand' && d.dorsal > 0.35 && d.endFacing < 0.8) {
      const t0 = 0.42, t1 = 0.92;
      const p = (t) => [d.a[0] + (d.c[0] - d.a[0]) * t, d.a[1] + (d.c[1] - d.a[1]) * t];
      const r = radii[1] * 0.62 * (1 - d.endFacing * 0.5);
      const dx = (d.c[0] - d.a[0]) / d.len2, dy = (d.c[1] - d.a[1]) / d.len2;
      const n = [-dy, dx];
      const P0 = p(t0), P1 = p(t1), Pm = p((t0 + t1) / 2);
      S.stroke([[P0[0] + n[0] * r * 0.5, P0[1] + n[1] * r * 0.5], [Pm[0] + n[0] * r, Pm[1] + n[1] * r], [P1[0] + n[0] * r * 0.55, P1[1] + n[1] * r * 0.55]],
        { w: OW * 0.45, tremor: 0.35, ends: [0.4, 0.4], tone: 0.8 });
      S.stroke([[P0[0] - n[0] * r * 0.5, P0[1] - n[1] * r * 0.5], [Pm[0] - n[0] * r, Pm[1] - n[1] * r], [P1[0] - n[0] * r * 0.55, P1[1] - n[1] * r * 0.55]],
        { w: OW * 0.45, tremor: 0.35, ends: [0.4, 0.4], tone: 0.8 });
      S.stroke([[P0[0] + n[0] * r * 0.5, P0[1] + n[1] * r * 0.5], [P0[0] - n[0] * r * 0.5, P0[1] - n[1] * r * 0.5]],
        { w: OW * 0.4, tremor: 0.3, ends: [0.3, 0.3], tone: 0.7 });
    }
    // a crease where a phalanx begins
    if (d.group === 'fingers' || d.group === 'thumb') {
      if (d.joint > 0) {
        const dx = (d.c[0] - d.a[0]) / d.len2, dy = (d.c[1] - d.a[1]) / d.len2;
        const n = [-dy, dx], r = radii[0] * 0.7;
        const q = [d.a[0] + dx * 3, d.a[1] + dy * 3];
        S.stroke([[q[0] - n[0] * r, q[1] - n[1] * r], [q[0] + n[0] * r, q[1] + n[1] * r]],
          { w: OW * 0.42, tremor: 0.45, ends: [0.25, 0.25], tone: 0.7 });
      }
    }
    // cuff on the forearm
    if (d.id === 'forearm') {
      const n = spine.length;
      const sub = (t0, t1, opts) => {
        const i0 = Math.floor(t0 * (n - 1)), i1 = Math.ceil(t1 * (n - 1));
        const sp = spine.slice(i0, i1 + 1);
        const rr = [radii[0] + (radii[1] - radii[0]) * t0, radii[0] + (radii[1] - radii[0]) * t1];
        return tubePoly(sp, rr, opts);
      };
      S.hatchPoly(sub(0, 0.34, { cap0: true, cap1: false }), { angle: Math.atan2(d.c[1] - d.a[1], d.c[0] - d.a[0]) + 1.5, spacing: 7.4, w: 0.62, tremor: 0.9, tone: 0.3 });
      S.hatchPoly(sub(0.34, 0.47, { cap0: false, cap1: false }), { angle: Math.atan2(d.c[1] - d.a[1], d.c[0] - d.a[0]) + 1.42, spacing: 3.8, w: 0.8, tremor: 0.6, tone: 0.72 });
      const seam = (t, wgt) => {
        const i = Math.round(t * (n - 1)), p = spine[i];
        const dx = (d.c[0] - d.a[0]) / d.len2, dy = (d.c[1] - d.a[1]) / d.len2;
        const r = radii[0] + (radii[1] - radii[0]) * t;
        S.stroke([[p[0] + dy * r, p[1] - dx * r], [p[0] - dy * r, p[1] + dx * r]], { w: OW * wgt, tremor: 0.45, ends: [0.5, 0.5] });
      };
      seam(0.34, 0.85); seam(0.47, 1.3);
    }
    // skin on the back of the hand
    if (d.id === 'meta' && d.dorsal > 0.2) {
      S.texture(poly, { n: Math.round(640 * (radii[1] / 70)), len: 7, angle: Math.atan2(d.c[1] - d.a[1], d.c[0] - d.a[0]) + 0.1, spread: 0.6, w: 0.55, tone: 0.5 * d.dorsal });
    }
  }
}
