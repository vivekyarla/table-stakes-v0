// Small 2-D geometry helpers. Forms are built as "tubes": a spine polyline plus
// a radius at each station, which is what the engraver shades.
export const V = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1]],
  mul: (a, s) => [a[0] * s, a[1] * s],
  len: (a) => Math.hypot(a[0], a[1]),
  norm: (a) => { const l = Math.hypot(a[0], a[1]) || 1; return [a[0] / l, a[1] / l]; },
  lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
};

/** Sample a cubic bezier chain [P0,C1,C2,P1,C1,C2,P2,...] */
export function bez(pts, per = 24) {
  const out = [];
  for (let i = 0; i + 3 < pts.length + 1 && i + 3 <= pts.length - 1; i += 3) {
    const [p0, c1, c2, p1] = [pts[i], pts[i + 1], pts[i + 2], pts[i + 3]];
    for (let k = 0; k <= per; k++) {
      if (k === 0 && out.length) continue;
      const t = k / per, m = 1 - t;
      out.push([
        m * m * m * p0[0] + 3 * m * m * t * c1[0] + 3 * m * t * t * c2[0] + t * t * t * p1[0],
        m * m * m * p0[1] + 3 * m * m * t * c1[1] + 3 * m * t * t * c2[1] + t * t * t * p1[1],
      ]);
    }
  }
  return out;
}

/** Resample a polyline to roughly even spacing. */
export function resample(pts, step = 2) {
  if (pts.length < 2) return pts.slice();
  const out = [pts[0]];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = out.length ? pts[i - 1] : pts[i - 1], b = pts[i];
    let d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (d < 1e-9) continue;
    let t = (step - carry) / d;
    while (t <= 1) { out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); t += step / d; }
    carry = (1 - (t - step / d)) * d;
  }
  const last = pts[pts.length - 1];
  if (Math.hypot(last[0] - out[out.length - 1][0], last[1] - out[out.length - 1][1]) > step * 0.4) out.push(last);
  return out;
}

/** Unit normals (left-hand) along a polyline. */
export function normals(pts) {
  return pts.map((_, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const d = V.norm([b[0] - a[0], b[1] - a[1]]);
    return [-d[1], d[0]];
  });
}

/** Smoothly interpolate radius control values — linear steps read as facets. */
export function radiusAt(radii, t) {
  const m = radii.length;
  if (m === 1) return radii[0];
  const x = Math.max(0, Math.min(1, t)) * (m - 1);
  const k = Math.min(m - 2, Math.floor(x)), f = x - k;
  const p0 = radii[Math.max(0, k - 1)], p1 = radii[k], p2 = radii[k + 1], p3 = radii[Math.min(m - 1, k + 2)];
  const f2 = f * f, f3 = f2 * f;
  return 0.5 * ((2 * p1) + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f2 + (-p0 + 3 * p1 - 3 * p2 + p3) * f3);
}

/**
 * Radii may be a plain array (symmetric) or {l, r} for an asymmetric form —
 * a hand is wider on the thumb side than the little-finger side.
 */
export function radPair(radii, t) {
  if (Array.isArray(radii)) { const r = radiusAt(radii, t); return [r, r]; }
  return [radiusAt(radii.l, t), radiusAt(radii.r, t)];
}
export function scaleRadii(radii, s) {
  return Array.isArray(radii) ? radii.map((r) => r * s)
    : { l: radii.l.map((r) => r * s), r: radii.r.map((r) => r * s) };
}
export function maxRadius(radii) {
  return Array.isArray(radii) ? Math.max(...radii) : Math.max(...radii.l, ...radii.r);
}

/**
 * The silhouette of a tube, split into its four runs so a caller can stroke the
 * sides but leave an end open where one form flows into the next.
 */
export function tubeEdges(spine, radii, { steps = 14, capBulge = 1 } = {}) {
  const n = spine.length, nm = normals(spine);
  const RP = (i) => radPair(radii, i / (n - 1));
  const left = [], right = [];
  for (let i = 0; i < n; i++) {
    const [rl, rr] = RP(i);
    left.push([spine[i][0] + nm[i][0] * rl, spine[i][1] + nm[i][1] * rl]);
    right.push([spine[i][0] - nm[i][0] * rr, spine[i][1] - nm[i][1] * rr]);
  }
  // cap1 sweeps left[n-1] -> right[n-1], bulging past the end of the spine
  const c1 = spine[n - 1], r1 = (RP(n - 1)[0] + RP(n - 1)[1]) / 2, n1 = nm[n - 1];
  const t1 = V.norm([c1[0] - spine[n - 2][0], c1[1] - spine[n - 2][1]]);
  const cap1 = [];
  for (let k = 0; k <= steps; k++) {
    const a = Math.PI * (k / steps);
    cap1.push([c1[0] + n1[0] * r1 * Math.cos(a) + t1[0] * r1 * capBulge * Math.sin(a),
               c1[1] + n1[1] * r1 * Math.cos(a) + t1[1] * r1 * capBulge * Math.sin(a)]);
  }
  // cap0 sweeps right[0] -> left[0]
  const c0 = spine[0], r0 = (RP(0)[0] + RP(0)[1]) / 2, n0 = nm[0];
  const t0 = V.norm([c0[0] - spine[1][0], c0[1] - spine[1][1]]);
  const cap0 = [];
  for (let k = 0; k <= steps; k++) {
    const a = Math.PI * (k / steps);
    cap0.push([c0[0] - n0[0] * r0 * Math.cos(a) + t0[0] * r0 * capBulge * Math.sin(a),
               c0[1] - n0[1] * r0 * Math.cos(a) + t0[1] * r0 * capBulge * Math.sin(a)]);
  }
  return { left, right, cap0, cap1 };
}

/** Closed outline polygon for a tube, optionally with rounded caps. */
export function tubePoly(spine, radii, { cap0 = true, cap1 = true, capBulge = 1 } = {}) {
  const e = tubeEdges(spine, radii, { capBulge });
  let out = e.left.slice();
  if (cap1) out = out.concat(e.cap1);
  out = out.concat(e.right.slice().reverse());
  if (cap0) out = out.concat(e.cap0);
  return out;
}

/** A sub-range of a tube (t0..t1 along its spine) as a closed polygon. */
export function subTubePoly(spine, radii, t0, t1, opts) {
  const n = spine.length;
  const i0 = Math.max(0, Math.floor(t0 * (n - 1))), i1 = Math.min(n - 1, Math.ceil(t1 * (n - 1)));
  const sub = spine.slice(i0, i1 + 1);
  const m = Math.max(2, sub.length), sl = [], srr = [];
  for (let k = 0; k < m; k++) {
    const t = t0 + (t1 - t0) * (k / (m - 1));
    const [a, b] = radPair(radii, t);
    sl.push(a); srr.push(b);
  }
  return tubePoly(sub, { l: sl, r: srr }, opts || {});
}
