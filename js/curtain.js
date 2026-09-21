// Opening: two big clouds cover the page and part like curtains, left and
// right, while the map draws itself in beneath. Same soft style as the clouds
// on the map, prerendered once so the motion is only a translate per frame.
import { Rng } from './rng.js';

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function runCurtain(canvas, { hold = 90, duration = 820, onStart, onProgress, onDone, fixedT = null, seed = 7 } = {}) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, devicePixelRatio || 1);
  let W = 0, H = 0, L, R, cw, raf = 0, t0 = 0, done = false, lastT = 0;

  function curtain(side) {
    const rng = new Rng(seed + (side === 'L' ? 11 : 23));
    cw = Math.ceil(W * 0.55); const ch = H + 160;
    const puff = document.createElement('canvas'), shadow = document.createElement('canvas');
    for (const c of [puff, shadow]) { c.width = Math.ceil((cw + 160) * dpr); c.height = Math.ceil(ch * dpr); }
    const px = puff.getContext('2d'), sx = shadow.getContext('2d');
    px.scale(dpr, dpr); sx.scale(dpr, dpr);
    // a solid back so nothing shows through, then big puffs that make the inner edge ragged
    const solidW = cw * 0.62;
    px.fillStyle = '#FBF9F4';
    px.fillRect(side === 'L' ? 0 : cw + 160 - solidW, 0, solidW, ch);
    const base = Math.max(110, Math.min(W, H) * 0.2);
    const puffs = [];
    // rows of puffs stepping toward the inner edge; the last column makes the bumps
    for (let y = -60; y < ch + 60; y += base * 0.85) {
      for (let k = 0; k < 4; k++) {
        const f = 0.58 + k * 0.14 + rng.range(-0.04, 0.04);
        const x = side === 'L' ? f * cw : cw + 160 - f * cw;
        puffs.push({ x, y: y + rng.range(-base * 0.45, base * 0.45), r: base * rng.range(0.75, 1.35) * (k === 3 ? rng.range(0.7, 1.15) : 1) });
      }
    }
    for (const p of puffs) {
      const g = sx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 1.12);
      g.addColorStop(0, 'rgba(60,52,44,0.28)'); g.addColorStop(1, 'rgba(60,52,44,0)');
      sx.fillStyle = g; sx.beginPath(); sx.arc(p.x, p.y, p.r * 1.12, 0, Math.PI * 2); sx.fill();
    }
    for (const p of puffs) {
      const g = px.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      g.addColorStop(0, 'rgba(255,253,248,1)'); g.addColorStop(0.72, 'rgba(255,253,248,0.96)'); g.addColorStop(1, 'rgba(255,253,248,0)');
      px.fillStyle = g; px.beginPath(); px.arc(p.x, p.y, p.r, 0, Math.PI * 2); px.fill();
    }
    return { puff, shadow, w: cw + 160, h: ch };
  }
  function build() {
    W = innerWidth; H = innerHeight;
    canvas.width = Math.ceil(W * dpr); canvas.height = Math.ceil(H * dpr);
    L = curtain('L'); R = curtain('R');
  }
  function draw(t) {
    lastT = t;
    const e = easeInOut(t);
    const travel = L.w + 40;
    const lx = -e * travel, rx = W - R.w + 80 + e * travel;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(L.shadow, lx + 34, -80 + 44, L.w, L.h);
    ctx.drawImage(R.shadow, rx - 34, -80 + 44, R.w, R.h);
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(L.puff, lx, -80, L.w, L.h);
    ctx.drawImage(R.puff, rx, -80, R.w, R.h);
  }
  build();
  const onResize = () => { build(); draw(lastT); };   // resizing clears the canvas
  addEventListener('resize', onResize);
  onStart?.();
  if (fixedT !== null) { draw(fixedT); onProgress?.(fixedT); return { skip() {} }; }
  const finish = () => { if (done) return; done = true; cancelAnimationFrame(raf); removeEventListener('resize', onResize); onDone?.(); };
  const frame = (now) => {
    if (done) return;
    if (!t0) t0 = now;
    const t = Math.min(1, Math.max(0, (now - t0 - hold) / duration));
    draw(t); onProgress?.(t);
    if (t < 1) raf = requestAnimationFrame(frame); else finish();
  };
  raf = requestAnimationFrame(frame);
  return { skip: finish };
}
