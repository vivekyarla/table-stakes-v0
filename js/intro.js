// Runs the handshake live over the page, then hands over to the map. The
// scene is raymarched into an offscreen WebGL canvas at reduced resolution and
// blitted onto the visible 2-D canvas, which keeps the page compositing simple.
import { createRenderer } from './gl.js';
import { sceneAt, POSES } from './shake.js';

export function runIntro(canvas, { duration = 4200, scale = 0.5, onProgress, onDone, seed = 7, fixedT = null } = {}) {
  const glc = document.createElement('canvas');
  let R;
  try { R = createRenderer(glc); } catch (e) { onDone?.(); return { stop() {} }; }
  POSES.alphaBg = true;
  const ctx = canvas.getContext('2d');
  let raf = 0, t0 = 0, stopped = false, lastT = null;
  const size = () => {
    canvas.width = innerWidth; canvas.height = innerHeight;   // resizing clears the canvas
    glc.width = Math.max(320, Math.round(innerWidth * scale)); glc.height = Math.max(180, Math.round(innerHeight * scale));
    if (lastT !== null) draw(lastT);                            // so repaint the frame we were on
  };
  const dbg = location.search.includes('debug');
  const draw = (t) => {
    lastT = t;
    const scene = sceneAt(t, seed);
    R.render(scene, glc.width, glc.height);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(glc, 0, 0, canvas.width, canvas.height);
    if (dbg) {
      const px = new Uint8Array(4);
      R.gl.readPixels(glc.width >> 1, glc.height >> 1, 1, 1, R.gl.RGBA, R.gl.UNSIGNED_BYTE, px);
      const sA = scene.bones.filter((b) => b.group === 0).length, sB = scene.bones.filter((b) => b.group === 1).length;
      const c2 = ctx.getImageData(canvas.width >> 1, canvas.height >> 1, 1, 1).data;
      const rect = canvas.getBoundingClientRect();
      dispatchEvent(new ErrorEvent('error', { message: `intro t=${t.toFixed(2)} gl=${glc.width}x${glc.height} glpx=${Array.from(px).join(',')} 2dpx=${Array.from(c2).join(',')} canvas=${canvas.width}x${canvas.height} rect=${Math.round(rect.width)}x${Math.round(rect.height)} vis=${getComputedStyle(canvas).visibility}/${getComputedStyle(canvas).opacity} bones A=${sA} B=${sB} alphaBg=${scene.alphaBg} cam=${JSON.stringify(scene.cam)}` }));
    }
  };
  size(); addEventListener('resize', size);
  if (fixedT !== null) { draw(fixedT); onProgress?.(fixedT); return { stop() {} }; }   // QA: one frame, no clock
  const frame = (now) => {
    if (stopped) return;
    if (!t0) t0 = now;
    const t = Math.min(1, (now - t0) / duration);
    draw(t);
    onProgress?.(t);
    if (t < 1) raf = requestAnimationFrame(frame);
    else { removeEventListener('resize', size); onDone?.(); }
  };
  raf = requestAnimationFrame(frame);
  return { stop() { stopped = true; cancelAnimationFrame(raf); removeEventListener('resize', size); onDone?.(); } };
}
