// The handshake as a function of time. Hands approach, clasp, shake twice and
// withdraw to the edges, leaving the frame clear for the map.
import { Ink, grainTile } from './ink.js';
import { Rng } from './rng.js';
import { drawHand } from './hands.js';

const cl = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeIn = (t) => t * t * t;

export const PHASES = { enter: [0, 0.32], clasp: [0.26, 0.44], shake: [0.44, 0.74], part: [0.74, 1] };

export function poseAt(t, W = 1000, H = 560) {
  const C = [W * 0.5, H * 0.54];
  const s = Math.min(W / 1000, H / 560) * 0.92;

  const enter = cl((t - PHASES.enter[0]) / (PHASES.enter[1] - PHASES.enter[0]));
  const grip = cl((t - PHASES.clasp[0]) / (PHASES.clasp[1] - PHASES.clasp[0]));
  const sh = cl((t - PHASES.shake[0]) / (PHASES.shake[1] - PHASES.shake[0]));
  const part = cl((t - PHASES.part[0]) / (PHASES.part[1] - PHASES.part[0]));

  const d = (1 - easeOut(enter)) * 1150 * s + easeIn(part) * 1250 * s;
  const closeIn = easeInOut(grip) * 58 * s;

  const osc = sh > 0 && sh < 1 ? Math.sin(sh * Math.PI * 2 * 2.2) * Math.exp(-sh * 1.9) : 0;
  const dy = osc * 28 * s, dr = osc * 0.055;
  // a shake closes the fingers around the other hand, it does not make a fist
  const gv = cl(grip * 0.70 * (1 - easeIn(part) * 0.8) + 0.04);

  const aA = 0.30, aB = Math.PI - 0.16;
  const reach = 178 * s, sep = 56 * s;

  // A rides above the clasp and B below it, so A's fingers close down over B's
  // hand while B's close up over A's — a grip rather than two interleaved combs
  const mk = (a, lead, sgn) => {
    const dir = [Math.cos(a), Math.sin(a)];
    const travel = closeIn - d * lead;
    let x = C[0] - dir[0] * reach + dir[0] * travel;
    let y = C[1] - dir[1] * reach + dir[1] * travel - sep * sgn;
    const ca = Math.cos(dr), sa = Math.sin(dr);
    const rx = C[0] + (x - C[0]) * ca - (y - C[1]) * sa;
    const ry = C[1] + (x - C[0]) * sa + (y - C[1]) * ca + dy;
    return { x: rx, y: ry, a: a + dr, s, grip: sgn > 0 ? gv : gv * 0.88, bend: sgn };
  };
  return { A: mk(aA, 1, 1), B: mk(aB, 0.94, -1), t, settle: cl(grip) };
}

export function makeInk(W, H, seed, dpr = 2) {
  const rng = new Rng(seed);
  const ink = new Ink(W, H, {
    dpr, rng, paper: '#F2EFE7',
    inks: {
      ink: { color: '#1A1714', reg: [0, 0] },
      gold: { color: '#B98F32', reg: [1.1, -0.9] },
    },
  });
  return { ink, rng };
}

/** Render one frame of the handshake into ctx. */
export function drawShakeFrame(ctx, t, W, H, seed = 7, dpr = 2, cache = {}) {
  if (!cache.ink || cache.W !== W || cache.H !== H || cache.seed !== seed || cache.dpr !== dpr) {
    Object.assign(cache, { ...makeInk(W, H, seed, dpr), W, H, seed, dpr });
    cache.grain = grainTile(cache.rng, 128, 0.055);
  }
  const { ink, rng } = cache;
  rng.r = new Rng(seed).r; // same marks every time this frame is drawn
  ink.clear();
  const S = ink.get('ink');
  const p = poseAt(t, W, H);

  // far hand first, then the near one over it
  drawHand(S, p.B, { thumbLast: false });
  drawHand(S, p.A, { thumbLast: true });

  ink.composite(ctx);

  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = 0.5; ctx.globalCompositeOperation = 'overlay';
  const pat = ctx.createPattern(cache.grain, 'repeat');
  ctx.fillStyle = pat; ctx.fillRect(0, 0, W, H);
  ctx.restore();
}
