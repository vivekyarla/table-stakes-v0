// Opening: two big clouds cover the page and part like curtains, left and
// right, while the map draws itself in beneath. Same soft style as the clouds
// on the map, prerendered once so the motion is only a translate per frame.
import { Rng } from './rng.js';

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function runCurtain(canvas, { hold = 220, duration = 1500, onStart, onProgress, onDone, fixedT = null, seed = 7 } = {}) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, devicePixelRatio || 1);
  let W = 0, H = 0, L, R, cw, raf = 0, t0 = 0, done = false, lastT = 0;

  function curtain(side) {
    const rng = new Rng(seed + (side === 'L' ? 11 : 23));
    cw = Math.ceil(W * 0.55); const ch = H + 160; const M = 480;   // inner margin so lobes and shadows are never clipped
    const puff = document.createElement('canvas'), shadow = document.createElement('canvas');
    for (const c of [puff, shadow]) { c.width = Math.ceil((cw + M) * dpr); c.height = Math.ceil(ch * dpr); }
    const px = puff.getContext('2d'), sx = shadow.getContext('2d');
    px.scale(dpr, dpr); sx.scale(dpr, dpr);
    // a solid back so nothing shows through, then cumulus lobes along the inner edge
    const solidW = cw * 0.88;
    px.fillStyle = '#FAF8F2';
    px.fillRect(side === 'L' ? 0 : cw + M - solidW, 0, solidW, ch);
    const base = Math.max(120, Math.min(W, H) * 0.24);
    const edge = side === 'L' ? cw : M;                     // x of the inner edge on this canvas
    const dirIn = side === 'L' ? 1 : -1;                      // toward the centre of the screen
    const lobes = [];
    for (let y = -base * 0.4; y < ch + base * 0.4; y += base * rng.range(0.95, 1.35)) {
      const r = base * rng.range(0.6, 1.3);
      const bulge = rng.range(-0.55, 0.6);                    // how far this lobe pushes past the edge
      const x = edge + dirIn * r * bulge;
      lobes.push({ x, y, r });
      // a smaller lobe riding on its shoulder, and filler behind it
      lobes.push({ x: x - dirIn * r * rng.range(0.25, 0.55), y: y - r * rng.range(0.5, 0.85), r: r * rng.range(0.4, 0.62) });
      lobes.push({ x: x - dirIn * r * rng.range(0.9, 1.3), y: y + r * rng.range(-0.4, 0.4), r: r * rng.range(0.85, 1.1) });
    }
    // ground shadow, cast on the map
    for (const p of lobes) {
      const g = sx.createRadialGradient(p.x, p.y, p.r * 0.2, p.x, p.y, p.r * 1.15);
      g.addColorStop(0, 'rgba(60,52,44,0.30)'); g.addColorStop(1, 'rgba(60,52,44,0)');
      sx.fillStyle = g; sx.beginPath(); sx.arc(p.x, p.y, p.r * 1.15, 0, Math.PI * 2); sx.fill();
    }
    // the body
    for (const p of lobes) {
      const g = px.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      g.addColorStop(0, 'rgba(252,250,245,1)'); g.addColorStop(0.8, 'rgba(252,250,245,1)'); g.addColorStop(1, 'rgba(252,250,245,0)');
      px.fillStyle = g; px.beginPath(); px.arc(p.x, p.y, p.r, 0, Math.PI * 2); px.fill();
    }
    // volume: shade each lobe's underside and catch light on its crown, only where cloud exists
    px.globalCompositeOperation = 'source-atop';
    for (const p of lobes) {
      const sg = px.createRadialGradient(p.x + p.r * 0.1, p.y + p.r * 0.55, p.r * 0.1, p.x + p.r * 0.1, p.y + p.r * 0.55, p.r * 1.05);
      sg.addColorStop(0, 'rgba(150,140,126,0.42)'); sg.addColorStop(1, 'rgba(150,140,126,0)');
      px.fillStyle = sg; px.beginPath(); px.arc(p.x + p.r * 0.1, p.y + p.r * 0.55, p.r * 1.05, 0, Math.PI * 2); px.fill();
    }
    for (const p of lobes) {
      const hg = px.createRadialGradient(p.x - p.r * 0.25, p.y - p.r * 0.45, 0, p.x - p.r * 0.25, p.y - p.r * 0.45, p.r * 0.9);
      hg.addColorStop(0, 'rgba(255,255,252,0.9)'); hg.addColorStop(1, 'rgba(255,255,252,0)');
      px.fillStyle = hg; px.beginPath(); px.arc(p.x - p.r * 0.25, p.y - p.r * 0.45, p.r * 0.9, 0, Math.PI * 2); px.fill();
    }
    // a soft grey wash over the solid back so it reads as the cloud's mass, not paper
    const wg = px.createLinearGradient(side === 'L' ? 0 : cw + M, 0, side === 'L' ? solidW : cw + M - solidW, 0);
    wg.addColorStop(0, 'rgba(150,140,126,0.22)'); wg.addColorStop(1, 'rgba(150,140,126,0.04)');
    px.fillStyle = wg; px.fillRect(0, 0, cw + M, ch);
    px.globalCompositeOperation = 'source-over';
    return { puff, shadow, w: cw + M, h: ch };
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
    const lx = -e * travel, rx = W - R.w + e * travel;
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
