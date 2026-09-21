// Anatomical hand rig for the SDF renderer. Proportions in millimetres of an
// adult hand (wrist to middle fingertip ~190). Local frame: +X distal,
// +Y radial (thumb side), +Z dorsal. Bones come out as segments with a radius
// at each end; the shader blends each hand's skin into one body.
import { v3, rotAxis } from './vec3.js';

const Z = [0, 0, 1];
const FINGERS = [
  { id: 'index',  meta: [[10, 22, 2], [92, 34, 3]],  mr: [10, 11.5], dir: [1, 0.07, 0],  len: [42, 26, 20], r: [9.4, 8.6, 7.0, 5.6] },
  { id: 'middle', meta: [[10, 8, 3],  [98, 11, 4]],  mr: [10.5, 12], dir: [1, 0.0, 0],   len: [46, 29, 22], r: [9.8, 9.0, 7.4, 6.0] },
  { id: 'ring',   meta: [[10, -6, 2], [92, -12, 3]], mr: [10, 11],   dir: [1, -0.06, 0], len: [42, 27, 21], r: [9.4, 8.6, 7.0, 5.6] },
  { id: 'pinky',  meta: [[8, -20, 0], [82, -34, 1]], mr: [9, 10],    dir: [1, -0.16, 0], len: [33, 21, 17], r: [8.0, 7.3, 6.0, 4.9] },
];
const FLEX = [0.80, 1.00, 0.40];
const REST = [0.16, 0.14, 0.08];

function chain(bones, base, dir, lens, flex, rad, group, k, spreadAxisTilt = 0) {
  let p = base.slice(), d = v3.norm(dir);
  const axis = v3.norm(v3.cross(Z, d));
  const out = [];
  for (let i = 0; i < lens.length; i++) {
    d = v3.norm(rotAxis(d, axis, flex[i]));
    const q = v3.add(p, v3.mul(d, lens[i]));
    out.push({ a: p, b: q, ra: rad[i], rb: rad[i + 1], group, mat: 0, k, shape: 0, dir: d, distal: i === lens.length - 1 });
    p = q;
  }
  bones.push(...out);
  return out;
}

/**
 * grip 0..1 closes the fingers; spread 0..1 fans them; thumbUp 0..1 lifts the
 * thumb away from the palm. Returns bones in local space for group `g`
 * (0 = hand A skin, 1 = hand B skin); cloth uses groups 2+, nails 6.
 */
export function handBones(g, { grip = 0.1, spread = 0.4, thumbUp = 0.5, thumbAdduct = [0.95, -0.10, -0.28], fingerGrip = [1, 1, 1, 1], thumbGrip = 1 } = {}) {
  const bones = [];
  const skin = (a, b, ra, rb, k = 10) => bones.push({ a, b, ra, rb, group: g, mat: 0, k, shape: 0 });

  // forearm and wrist
  skin([-120, 0, 0], [-40, 0, 0], 33, 29, 6);
  skin([-44, 0, 0], [6, 0, 0], 28, 25, 10);
  // palm: metacarpals blended into a slab, plus the two muscle pads
  for (const f of FINGERS) skin(f.meta[0], f.meta[1], f.mr[0], f.mr[1], 22);
  skin([6, 2, -2], [70, 2, -1], 18, 22, 22);                // central mass
  // the muscle pads swell as the grip closes
  skin([0, 20, -9], [44, 36, -12], 14 + 2.5 * grip, 16 + 3 * grip, 18);   // thenar
  skin([2, -18, -7], [62, -30, -6], 11 + 2 * grip, 12 + 2.5 * grip, 16);  // hypothenar
  // extensor tendons, standing up under the skin as the fingers pull
  for (const f of FINGERS) {
    const k = f.meta[1];
    bones.push({ a: [-4, k[1] * 0.35, 10], b: [k[0] - 6, k[1], f.mr[1] * 0.74], ra: 1.4 + 1.4 * grip, rb: 2.0 + 1.8 * grip, group: g, mat: 0, k: 10, shape: 0 });
  }
  // interossei: the soft ridges between the metacarpals
  for (let i = 0; i < 3; i++) {
    const a = FINGERS[i].meta, b = FINGERS[i + 1].meta;
    bones.push({ a: [12, (a[0][1] + b[0][1]) / 2, 9], b: [78, (a[1][1] + b[1][1]) / 2, 12 + 2 * grip], ra: 4.5 + 1.5 * grip, rb: 5 + 2 * grip, group: g, mat: 0, k: 16, shape: 0 });
  }
  // the ulnar styloid at the wrist, and the long thumb tendon along the radial edge
  bones.push({ a: [-30, -22, 12], b: [-24, -24, 13], ra: 6, rb: 6, group: g, mat: 0, k: 9, shape: 0 });
  bones.push({ a: [-34, 14, 14], b: [4, 32, 8], ra: 1.6 + 1.2 * grip, rb: 2.2 + 1.4 * grip, group: g, mat: 0, k: 10, shape: 0 });
  // veins wandering across the back of the hand
  bones.push({ a: [-20, 8, 19.5], b: [30, 20, 19.5], ra: 1.8, rb: 1.6, group: g, mat: 0, k: 12, shape: 0 });
  bones.push({ a: [30, 20, 19.5], b: [70, 30, 18.5], ra: 1.6, rb: 1.3, group: g, mat: 0, k: 12, shape: 0 });
  bones.push({ a: [-10, -14, 19], b: [46, -6, 18.5], ra: 1.6, rb: 1.3, group: g, mat: 0, k: 12, shape: 0 });
  bones.push({ a: [46, -6, 18.5], b: [80, 8, 16], ra: 1.3, rb: 1.0, group: g, mat: 0, k: 12, shape: 0 });

  // fingers
  const spreadK = (spread - 0.4) * 0.35;
  for (let i = 0; i < FINGERS.length; i++) {
    const f = FINGERS[i];
    const fan = -(i - 1.5) * spreadK;
    const dir = v3.norm(rotAxis(f.dir, Z, fan));
    const gi = grip * fingerGrip[i];
    const flex = FLEX.map((a, k) => REST[k] + a * gi);
    // knuckle: the metacarpal head shows as the finger bends
    bones.push({ a: [f.meta[1][0] - 3, f.meta[1][1], 3], b: [f.meta[1][0] + 3, f.meta[1][1], 3], ra: f.mr[1] * (0.62 + 0.28 * gi), rb: f.mr[1] * (0.62 + 0.28 * gi), group: g, mat: 0, k: 9, shape: 0 });
    const ph = chain(bones, f.meta[1], dir, f.len, flex, f.r, g, 8);
    for (const b of ph) { b.part = 'finger'; b.fi = i; }
    // nail: a slim ridge on the back of the distal phalanx
    const d = ph[2];
    const n = v3.norm(v3.cross(v3.cross(d.dir, Z), d.dir));      // local dorsal, perpendicular to the finger
    const c0 = v3.add(v3.lerp(d.a, d.b, 0.40), v3.mul(n, d.rb * 0.62));
    const c1 = v3.add(v3.lerp(d.a, d.b, 0.92), v3.mul(n, d.rb * 0.58));
    bones.push({ a: c0, b: c1, ra: d.rb * 0.66, rb: d.rb * 0.5, group: 6, mat: 3, k: 0, shape: 0 });
  }
  // thumb: metacarpal from the wrist's radial corner, then two phalanges
  const tb = [-2, 30, -12];
  let tdir = v3.norm([0.60, 0.72, -0.34 - 0.3 * (1 - thumbUp)]);
  tdir = v3.norm(rotAxis(tdir, [1, 0, 0], -0.5 * (1 - thumbUp)));
  const adduct = Math.min(1, grip * 1.3) * 0.9;
  tdir = v3.norm(v3.lerp(tdir, v3.norm(thumbAdduct), adduct));
  const tg = grip * thumbGrip;
  const tflex = [0.06 + 0.06 * tg, 0.14 + 0.12 * tg, 0.12 + 0.12 * tg];
  const tph = chain(bones, tb, tdir, [46, 32, 26], tflex, [13, 12, 10.5, 8.2], g, 9);
  for (const b of tph) b.part = 'thumb';
  const td = tph[2];
  const tn = v3.norm(v3.cross(v3.cross(td.dir, [0, 0.4, 1]), td.dir));
  bones.push({ a: v3.add(v3.lerp(td.a, td.b, 0.40), v3.mul(tn, td.rb * 0.62)), b: v3.add(v3.lerp(td.a, td.b, 0.92), v3.mul(tn, td.rb * 0.58)),
               ra: td.rb * 0.68, rb: td.rb * 0.5, group: 6, mat: 3, k: 0, shape: 0 });

  // suit sleeve and shirt cuff over the forearm
  const cg = 2 + g * 2;
  bones.push({ a: [-780, 0, 0], b: [-52, 0, 0], ra: 46, rb: 3.5, group: cg, mat: 1, k: 0, shape: 1 });
  bones.push({ a: [-60, 0, 0], b: [-24, 0, 0], ra: 36, rb: 1.5, group: cg + 1, mat: 2, k: 0, shape: 1 });
  bones.push({ a: [-59, 0, 0], b: [-52, 0, 0], ra: 47.5, rb: 2.5, group: cg, mat: 1, k: 0, shape: 1 });
  return bones;
}

/** Rotate by roll (own X), tilt (Z), yaw (Y), then scale and translate. */
export function place(bones, { pos = [0, 0, 0], yaw = 0, tilt = 0, roll = 0, scale = 1 } = {}) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), ct = Math.cos(tilt), st = Math.sin(tilt), cr = Math.cos(roll), sr = Math.sin(roll);
  const R = (p) => {
    // roll about X
    let x = p[0], y = p[1] * cr - p[2] * sr, z = p[1] * sr + p[2] * cr;
    // tilt about Z
    let x2 = x * ct - y * st, y2 = x * st + y * ct, z2 = z;
    // yaw about Y
    return [x2 * cy + z2 * sy, y2, -x2 * sy + z2 * cy];
  };
  const T = (p) => v3.add(pos, v3.mul(R(p), scale));
  return bones.map((b) => ({ ...b, a: T(b.a), b: T(b.b), ra: b.ra * scale, rb: b.rb * scale }));
}

/** Distance from a point to a capsule's surface (negative inside). */
function capDist(p, b) {
  const ab = v3.sub(b.b, b.a), ap = v3.sub(p, b.a);
  const t = Math.max(0, Math.min(1, v3.dot(ap, ab) / (v3.dot(ab, ab) || 1)));
  const q = v3.add(b.a, v3.mul(ab, t));
  return v3.len(v3.sub(p, q)) - (b.ra + (b.rb - b.ra) * t);
}
/** How far the finger/thumb tips of `hand` sit inside the palm of `other` (world space). */
export function penetration(hand, other, part) {
  const palm = other.filter((b) => b.mat === 0 && !b.part);
  const tips = hand.filter((b) => b.part === part && b.rb < b.ra);   // distal phalanges taper
  let worst = -1e9;
  for (const tb of tips) {
    for (const s of [0.5, 1.0]) {
      const p = v3.lerp(tb.a, tb.b, s), r = tb.ra + (tb.rb - tb.ra) * s;
      for (const pb of palm) worst = Math.max(worst, -(capDist(p, pb)) + r * 0.85);
    }
  }
  return worst;   // > 0 means the tips are inside the other hand by that much
}
