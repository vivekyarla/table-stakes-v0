// Page wiring: intro → map reveal, markers, hover card, click-to-scroll.
import { runIntro } from './intro.js';
import { SFMap } from './map.js';
import { W, H } from './sfmap.js';
import { SPOTS, RATING } from './data.js';

const q = new URLSearchParams(location.search);
const $ = (s, r = document) => r.querySelector(s);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const HANDSHAKE = `<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-handshake"/></svg>`;
const shakes = (n, max = 3) => {
  let s = '<span class="shakes" aria-label="' + n + ' of ' + max + ' handshakes">';
  for (let i = 0; i < max; i++) s += `<i class="${i < n ? 'on' : ''}">${HANDSHAKE}</i>`;
  return s + '</span>';
};

// ---- map -------------------------------------------------------------------
const hero = $('#hero'), mapCanvas = $('#map'), markersEl = $('#markers'), card = $('#card');
let map;
function sizeMap() {
  const r = hero.getBoundingClientRect();
  mapCanvas.style.width = r.width + 'px'; mapCanvas.style.height = (r.width * H / W) + 'px';
  placeMarkers();
}
function placeMarkers() {
  if (!map) return;
  for (const el of markersEl.children) {
    const s = SPOTS.find((x) => x.id === el.dataset.id);
    const [x, y] = map.project(s.x, s.y);
    el.style.left = x + 'px'; el.style.top = y + 'px';
  }
}
function buildMarkers() {
  markersEl.innerHTML = SPOTS.map((s) => `
    <button class="marker" data-id="${s.id}" aria-label="${s.name}, ${s.handshakes} handshakes">
      <span class="pin"><svg viewBox="0 0 100 100"><use href="#i-sparkle"/></svg></span>
      <span class="name">${s.name}</span>
    </button>`).join('');
  for (const el of markersEl.children) {
    const s = SPOTS.find((x) => x.id === el.dataset.id);
    el.addEventListener('pointerenter', () => showCard(s));
    el.addEventListener('pointerleave', hideCard);
    el.addEventListener('focus', () => showCard(s));
    el.addEventListener('blur', hideCard);
    el.addEventListener('click', () => { hideCard(); $('#spot-' + s.id).scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' }); });
  }
}
function showCard(s) {
  card.innerHTML = `<b>${s.name}</b><span class="nb">${s.neighborhood} · ${s.kind}</span>${shakes(s.handshakes)}<p>${s.line}</p><em>Click for the full entry ↓</em>`;
  card.classList.add('on');
}
function hideCard() { card.classList.remove('on'); }
hero.addEventListener('pointermove', (e) => {
  const r = hero.getBoundingClientRect();
  map?.setPointer((e.clientX - r.left) / r.width - 0.5, (e.clientY - r.top) / r.height - 0.5);
  if (card.classList.contains('on')) {
    const cw = card.offsetWidth, ch = card.offsetHeight;
    let x = e.clientX - r.left + 18, y = e.clientY - r.top + 18;
    if (x + cw > r.width - 12) x = e.clientX - r.left - cw - 18;
    if (y + ch > r.height - 12) y = e.clientY - r.top - ch - 18;
    card.style.transform = `translate(${x}px, ${y}px)`;
  }
});
hero.addEventListener('pointerleave', () => map?.setPointer(0, 0));

function startMap() {
  map = new SFMap(mapCanvas, { seed: +(q.get('s') || 7), dpr: Math.min(2, devicePixelRatio || 1) });
  buildMarkers(); sizeMap();
  addEventListener('resize', sizeMap);
  const loop = (now) => { map.frame(now); if (map.reveal >= 1) markersEl.classList.add('on'); requestAnimationFrame(loop); };
  if (q.has('card')) {   // QA: show a spot's card as if hovered
    const s = SPOTS.find((x) => x.id === q.get('card')) || SPOTS[0];
    setTimeout(() => { showCard(s); const [x, y] = map.project(s.x, s.y); card.style.transform = `translate(${x + 18}px, ${y + 18}px)`; }, 50);
  }
  requestAnimationFrame(loop);
  if (q.has('t')) { const tt = +q.get('t'); map.t0 = performance.now() - tt * 1000; map.revealStart = performance.now() - Math.min(tt, 3) * 1000; }
}

// ---- list ------------------------------------------------------------------
$('#list').innerHTML = SPOTS.map((s, i) => `
  <article class="spot" id="spot-${s.id}">
    <div class="num">№ ${String(i + 1).padStart(2, '0')}</div>
    <header>
      <h2>${s.name}</h2>
      <div class="meta"><span>${s.neighborhood}</span><span>${s.address}</span><span>${s.kind}</span></div>
      <div class="rating">${shakes(s.handshakes)}<span class="verdict">${RATING[s.handshakes]}</span></div>
    </header>
    <dl>
      <dt>Best for</dt><dd>${s.bestFor}</dd>
      <dt>The move</dt><dd>${s.theMove}</dd>
      <dt>Deal notes</dt><dd>${s.dealNotes}</dd>
      <dt>Hours</dt><dd>${s.hours}</dd>
    </dl>
  </article>`).join('');

// ---- intro -----------------------------------------------------------------
const introCanvas = $('#intro'), introWrap = $('#intro-wrap'), title = $('#title');
const skip = () => { intro?.stop(); };
let intro = null;
if (q.has('nointro') || reduced) {
  introWrap.remove(); title.classList.add('on'); startMap();
} else {
  let mapStarted = false;
  intro = runIntro(introCanvas, {
    duration: 4200, scale: Math.min(0.55, 900 / innerWidth), fixedT: q.has('it') ? +q.get('it') : null,
    onProgress: (t) => {
      // the map begins drawing as the hands part; the title rises with it
      if (t > 0.70) introWrap.classList.add('reveal');
      if (t > 0.74 && !mapStarted) { mapStarted = true; startMap(); }
      if (t > 0.86) title.classList.add('on');
    },
    onDone: () => { if (!mapStarted) { mapStarted = true; startMap(); } title.classList.add('on'); introWrap.classList.add('gone'); setTimeout(() => introWrap.remove(), 900); },
  });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') skip(); }, { once: true });
  if (q.has('debug')) { const wrap = (fn) => (...a) => { try { return fn(...a); } catch (e) { dispatchEvent(new ErrorEvent('error', { message: e.stack || String(e) })); throw e; } }; }
  introWrap.addEventListener('click', skip, { once: true });
}
