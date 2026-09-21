// Page wiring: intro → map reveal; Leaflet markers with an on-cursor card; click-to-scroll.
import { runCurtain } from './curtain.js';
import { SFMap } from './map.js';
import { SPOTS, RATING, TICKER } from './data.js';

const q = new URLSearchParams(location.search);
const $ = (s, r = document) => r.querySelector(s);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const HS = `<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-handshake"/></svg>`;
const shakes = (n, max = 3) => `<span class="shakes" aria-label="${n} of ${max} handshakes">` + Array.from({ length: max }, (_, i) => `<i class="${i < n ? 'on' : ''}">${HS}</i>`).join('') + '</span>';

const hero = $('#hero'), card = $('#card'), title = $('#masthead');
let map;
function showCard(s) {
  card.innerHTML = `<b>${s.name}</b><span class="nb">${s.neighborhood} · ${s.kind}</span>${shakes(s.handshakes)}<p>${s.line}</p><em>Click for the full entry ↓</em>`;
  card.classList.add('on');
}
const hideCard = () => card.classList.remove('on');
hero.addEventListener('pointermove', (e) => {
  const r = hero.getBoundingClientRect();
  map?.setPointer((e.clientX - r.left) / r.width - 0.5, (e.clientY - r.top) / r.height - 0.5);
  if (card.classList.contains('on')) placeCard(e.clientX - r.left, e.clientY - r.top);
});
function placeCard(x, y) {
  const r = hero.getBoundingClientRect(), cw = card.offsetWidth, ch = card.offsetHeight;
  let cx = x + 18, cy = y + 18;
  if (cx + cw > r.width - 12) cx = x - cw - 18;
  if (cy + ch > r.height - 12) cy = y - ch - 18;
  card.style.transform = `translate(${cx}px, ${cy}px)`;
}
hero.addEventListener('pointerleave', () => map?.setPointer(0, 0));

function startMap() {
  map = new SFMap($('#leaflet'), $('#map'), { seed: +(q.get('s') || 7), tiles: q.has('tiles'), interactive: q.has('pan') });
  for (const s of SPOTS) {
    const icon = L.divIcon({ className: 'marker-wrap', iconSize: [30, 30], iconAnchor: [15, 15],
      html: `<button class="marker" data-id="${s.id}" aria-label="${s.name}, ${s.handshakes} handshakes"><span class="pin"><svg viewBox="0 0 100 100"><use href="#i-sparkle"/></svg></span><span class="name">${s.name}</span></button>` });
    const m = L.marker([s.lat, s.lon], { icon, keyboard: false }).addTo(map.map);
    const el = m.getElement().querySelector('.marker');
    el.addEventListener('pointerenter', (e) => { showCard(s); const r = hero.getBoundingClientRect(); placeCard(e.clientX - r.left, e.clientY - r.top); });
    el.addEventListener('pointerleave', hideCard);
    el.addEventListener('focus', () => { showCard(s); const p = map.project([s.lon, s.lat]); placeCard(p[0], p[1]); });
    el.addEventListener('blur', hideCard);
    el.addEventListener('click', () => { hideCard(); $('#spot-' + s.id).scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' }); });
  }
  const loop = (now) => { map.frame(now); if (map.reveal >= 1) hero.classList.add('ready'); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  if (q.has('t')) { const tt = +q.get('t'); map.t0 = performance.now() - tt * 1000; map.revealStart = performance.now() - Math.min(tt, 3) * 1000; }
  if (q.has('debug')) setTimeout(() => {
    const s = SPOTS[0], p = map.project([s.lon, s.lat]);
    const el = document.querySelector('.marker-wrap'), r = el.getBoundingClientRect(), h = hero.getBoundingClientRect();
    const sz = map.map.getSize();
    dispatchEvent(new ErrorEvent('error', { message: `proj=${p.map(Math.round)} markerCenter=${Math.round(r.left + r.width / 2 - h.left)},${Math.round(r.top + r.height / 2 - h.top)} hero=${Math.round(h.width)}x${Math.round(h.height)} leaflet=${sz.x}x${sz.y} panePos=${JSON.stringify(map.map._getMapPanePos())} icon=${el.style.transform}` }));
  }, 800);
  if (q.has('card')) { const s = SPOTS.find((x) => x.id === q.get('card')) || SPOTS[0]; setTimeout(() => { showCard(s); const p = map.project([s.lon, s.lat]); placeCard(p[0], p[1]); }, 50); }
}

// ticker: the run is laid twice so the loop is seamless at -50%
const run = TICKER.map((t) => `<span>${t.toUpperCase()}</span><i><svg viewBox="0 0 100 100"><use href="#i-sparkle"/></svg></i>`).join('');
$('#ticker .track').innerHTML = run + run;

const gmaps = (s) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(`${s.name}, ${s.address}, San Francisco, CA`);
$('#list').innerHTML = SPOTS.map((s, i) => `
  <article class="spot" id="spot-${s.id}">
    <div class="num">№ ${String(i + 1).padStart(2, '0')}</div>
    <div class="body">
      <header><h2>${s.name}</h2>
        <div class="meta"><span>${s.kind}</span><span>${s.neighborhood}</span><span><a href="${gmaps(s)}" target="_blank" rel="noopener">${s.address}</a></span></div>
        <div class="hours">${s.hours}</div>
        <div class="rating">${shakes(s.handshakes)}<span class="verdict">${RATING[s.handshakes]}</span></div></header>
      <p class="notes"><b>Deal notes</b>${s.dealNotes}</p>
      <div class="tip"><b>Tip</b><p>${s.tip}</p></div>
    </div>
    ${s.photo ? `<figure class="photo"><img src="${s.photo}" alt="${s.name}"></figure>`
              : `<figure class="photo empty"><svg viewBox="0 0 100 100"><use href="#i-sparkle"/></svg><span>Photo to come</span></figure>`}
  </article>`).join('');

const introCanvas = $('#intro'), introWrap = $('#intro-wrap');
if (q.has('nointro') || reduced) { introWrap.remove(); title.classList.add('now'); title.classList.add('on'); hero.classList.add('now'); startMap(); }
else {
  const cur = runCurtain(introCanvas, {
    fixedT: q.has('it') ? +q.get('it') : null,
    onStart: () => startMap(),                              // the map draws in beneath the clouds
    onProgress: (t) => { if (t > 0.2) title.classList.add('on'); },
    onDone: () => { title.classList.add('on'); introWrap.remove(); },
  });
  introWrap.addEventListener('click', () => cur.skip(), { once: true });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') cur.skip(); }, { once: true });
}
