"""Assemble OpenStreetMap data into js/geo.js: land polygons from coastline
ways (land on the left, closed along the bounding box), parks, water, roads."""
import json, math, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
D = root / 'data'
BBOX = (-122.62, 37.66, -122.16, 37.95)   # lon0, lat0, lon1, lat1

def load(name):
    p = D / f'{name}.json'
    if not p.exists(): return []
    try: return json.load(open(p))['elements']
    except Exception: return []

# ---------- geometry helpers (planar in lon/lat scaled by cos(lat) for DP) ----------
KX = math.cos(math.radians(37.8)) * 111320.0; KY = 111320.0
def dp(pts, tol_m):
    if len(pts) < 3: return pts
    def d(p, a, b):
        ax, ay = a[0]*KX, a[1]*KY; bx, by = b[0]*KX, b[1]*KY; px, py = p[0]*KX, p[1]*KY
        dx, dy = bx-ax, by-ay; L = math.hypot(dx, dy)
        if L < 1e-9: return math.hypot(px-ax, py-ay)
        return abs(dy*(px-ax) - dx*(py-ay)) / L
    stack = [(0, len(pts)-1)]; keep = [False]*len(pts); keep[0] = keep[-1] = True
    while stack:
        i, j = stack.pop()
        if j <= i+1: continue
        m, dm = i, -1
        for k in range(i+1, j):
            dd = d(pts[k], pts[i], pts[j])
            if dd > dm: dm, m = dd, k
        if dm > tol_m: keep[m] = True; stack.append((i, m)); stack.append((m, j))
    return [p for p, k in zip(pts, keep) if k]
def area_km2(poly):
    s = 0
    for i in range(len(poly)):
        a, b = poly[i], poly[(i+1) % len(poly)]
        s += (a[0]*KX)*(b[1]*KY) - (b[0]*KX)*(a[1]*KY)
    return s / 2 / 1e6          # signed: + = CCW
def rnd(poly): return [[round(x, 5), round(y, 5)] for x, y in poly]

# ---------- coastline -> land polygons ----------
def coastline():
    ways = [e for e in load('coast') if e.get('type') == 'way' and 'geometry' in e]
    segs = {}
    for w in ways:
        pts = [(g['lon'], g['lat']) for g in w['geometry']]
        segs[w['id']] = (w['nodes'][0], w['nodes'][-1], pts)
    by_start = {}
    for wid, (a, b, pts) in segs.items(): by_start.setdefault(a, []).append(wid)
    used, chains = set(), []
    for wid in segs:
        if wid in used: continue
        a, b, pts = segs[wid]; used.add(wid); chain = list(pts); end = b
        while True:
            nxt = [x for x in by_start.get(end, []) if x not in used]
            if not nxt: break
            used.add(nxt[0]); _, end, p2 = segs[nxt[0]]; chain += p2[1:]
            if end == a: break
        chains.append((chain, end == a))
    lon0, lat0, lon1, lat1 = BBOX
    inside = lambda p: lon0 <= p[0] <= lon1 and lat0 <= p[1] <= lat1
    def clip_pt(p, q):   # p inside, q outside -> point on boundary
        t = 1.0
        for (c, lo, hi, idx) in ((p[0], lon0, lon1, 0), (p[1], lat0, lat1, 1)):
            for edge in (lo, hi):
                if (q[idx] - p[idx]) != 0:
                    tt = (edge - p[idx]) / (q[idx] - p[idx])
                    if 0 <= tt < t:
                        r = (p[0] + (q[0]-p[0])*tt, p[1] + (q[1]-p[1])*tt)
                        if lon0-1e-9 <= r[0] <= lon1+1e-9 and lat0-1e-9 <= r[1] <= lat1+1e-9: t = tt
        return (p[0] + (q[0]-p[0])*t, p[1] + (q[1]-p[1])*t)
    closed, open_pieces = [], []
    for chain, is_closed in chains:
        if is_closed and all(inside(p) for p in chain):
            closed.append(chain); continue
        cur = []
        n = len(chain)
        for i in range(n):
            p = chain[i]
            if inside(p):
                if not cur and i > 0: cur.append(clip_pt(p, chain[i-1]))
                cur.append(p)
            else:
                if cur: cur.append(clip_pt(cur[-1], p)); open_pieces.append(cur); cur = []
        if cur:
            if is_closed: closed.append(cur)   # closed but partially clipped: rare, approximate
            else: open_pieces.append(cur)
    # perimeter coordinate, counter-clockwise from the bottom-left corner
    W, Hh = lon1 - lon0, lat1 - lat0; P = 2*(W+Hh)
    def s_of(p):
        x, y = p
        if abs(y - lat0) < 1e-7: return x - lon0
        if abs(x - lon1) < 1e-7: return W + (y - lat0)
        if abs(y - lat1) < 1e-7: return W + Hh + (lon1 - x)
        return 2*W + Hh + (lat1 - y)
    def p_of(s):
        s %= P
        if s < W: return (lon0 + s, lat0)
        if s < W + Hh: return (lon1, lat0 + (s - W))
        if s < 2*W + Hh: return (lon1 - (s - W - Hh), lat1)
        return (lon0, lat1 - (s - 2*W - Hh))
    corners = [0, W, W+Hh, 2*W+Hh]
    pieces = [{'pts': pc, 's0': s_of(pc[0]), 's1': s_of(pc[-1]), 'used': False} for pc in open_pieces]
    polys = [c for c in closed]
    for start in pieces:
        if start['used']: continue
        poly = []; cur = start; guard = 0
        while guard < 500:
            guard += 1; cur['used'] = True; poly += cur['pts']
            s_end = cur['s1']
            # next piece: smallest CCW distance ahead along the boundary
            best, bd = None, None
            for cand in pieces:
                if cand['used'] and cand is not start: continue
                dd = (cand['s0'] - s_end) % P
                if cand is start and dd == 0: dd = P
                if bd is None or dd < bd: bd, best = dd, cand
            # corners between s_end and best.s0
            for c in sorted(corners, key=lambda c: (c - s_end) % P):
                if 0 < (c - s_end) % P < bd: poly.append(p_of(c))
            if best is None or best is start: break
            cur = best
        polys.append(poly)
    CORE = (-122.53, 37.70, -122.35, 37.84)
    def core(pts):
        cx = sum(p[0] for p in pts) / len(pts); cy = sum(p[1] for p in pts) / len(pts)
        return CORE[0] <= cx <= CORE[2] and CORE[1] <= cy <= CORE[3]
    def chaikin(pts, closed_ring, n=2):
        for _ in range(n):
            out = []
            m = len(pts)
            rng_ = range(m) if closed_ring else range(m - 1)
            if not closed_ring: out.append(pts[0])
            for i in rng_:
                a, b = pts[i], pts[(i + 1) % m]
                out.append((0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]))
                out.append((0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]))
            if not closed_ring: out.append(pts[-1])
            pts = out
        return pts
    out = []
    for ring in closed:
        if abs(area_km2(ring)) < 0.01: continue
        c = core(ring)
        r = dp(ring, 5.0 if c else 30.0)
        if not c: r = chaikin(r, True)
        r = rnd(r); r.append(r[0]); out.append({'c': 1 if c else 0, 'p': r})
    for pc in open_pieces:
        if len(pc) < 2: continue
        c = core(pc)
        r = dp(pc, 5.0 if c else 45.0)
        if not c and len(r) > 2: r = chaikin(r, False)
        out.append({'c': 1 if c else 0, 'p': rnd(r)})
    return out

# ---------- parks / water ----------
def areas():
    parks, water = [], []
    for e in load('parks'):
        tags = e.get('tags', {})
        rings = []
        if e['type'] == 'way' and 'geometry' in e:
            pts = [(g['lon'], g['lat']) for g in e['geometry']]
            if len(pts) > 3 and pts[0] == pts[-1]: rings.append(pts[:-1])
        elif e['type'] == 'relation':
            for m in e.get('members', []):
                if m.get('role') == 'outer' and 'geometry' in m:
                    pts = [(g['lon'], g['lat']) for g in m['geometry']]
                    if len(pts) > 3: rings.append(pts[:-1] if pts[0] == pts[-1] else pts)
        for r in rings:
            a = abs(area_km2(r))
            if tags.get('natural') == 'water':
                if a >= 0.03: water.append(rnd(dp(r, 5.0)))
            elif a >= 0.06: parks.append(rnd(dp(r, 6.0)))
    return parks, water

# ---------- roads ----------
def roads():
    out = []
    rank = {'motorway': 3, 'trunk': 3, 'primary': 2, 'secondary': 1}
    for e in load('minor_w') + load('minor_e') + load('minor'):
        if e.get('type') != 'way' or 'geometry' not in e: continue
        pts = [(g['lon'], g['lat']) for g in e['geometry']]
        if len(pts) < 2: continue
        out.append({'r': 0, 'b': 0, 'p': rnd(dp(pts, 8.0))})
    for e in load('roads'):
        if e.get('type') != 'way' or 'geometry' not in e: continue
        t = e.get('tags', {})
        pts = [(g['lon'], g['lat']) for g in e['geometry']]
        if len(pts) < 2: continue
        r = rank.get(t.get('highway'), 1)
        cx = sum(x for x, y in pts) / len(pts); cy = sum(y for x, y in pts) / len(pts)
        in_sf = -122.53 <= cx <= -122.35 and 37.70 <= cy <= 37.84
        if r < 3 and not in_sf: continue
        if r == 1 and not in_sf: continue
        out.append({'r': r, 'b': 1 if t.get('bridge') else 0, 'p': rnd(dp(pts, 9.0))})
    return out

coast = coastline(); parks, water = areas(); rds = roads()
geo = {'bbox': BBOX, 'coast': coast, 'parks': parks, 'water': water, 'roads': rds}
js = '// Real geometry from OpenStreetMap (ODbL), built by tools/build-geo.py. [lon, lat].\nexport const GEO = ' + json.dumps(geo, separators=(',', ':')) + ';\n'
(root / 'js/geo.js').write_text(js)
print('coast pieces', len(coast), 'points', sum(len(c['p']) for c in coast))
print('parks', len(parks), 'water', len(water), 'roads', len(rds), 'bytes', len(js))
# debug plot
from PIL import Image, ImageDraw
Wd, Hd = 1400, 900
lon0, lat0, lon1, lat1 = BBOX
def S(p): return ((p[0]-lon0)/(lon1-lon0)*Wd, (lat1-p[1])/(lat1-lat0)*Hd)
im = Image.new('RGB', (Wd, Hd), (200, 215, 230)); dr = ImageDraw.Draw(im)
for line in coast: dr.line([S(p) for p in line['p']], fill=(30, 30, 30), width=2)
for poly in parks: dr.polygon([S(p) for p in poly], fill=(190, 210, 170), outline=(90, 120, 80))
for poly in water: dr.polygon([S(p) for p in poly], fill=(170, 195, 220))
for rd in rds: dr.line([S(p) for p in rd['p']], fill=(170, 160, 150) if rd['r'] == 0 else (120, 100, 90) if rd['r'] < 3 else (60, 40, 40), width=max(1, rd['r']))
cot = S((-122.40262, 37.79716)); dr.ellipse([cot[0]-5, cot[1]-5, cot[0]+5, cot[1]+5], fill=(200, 140, 30))
im.save(D / 'debug_geo.png'); print('debug plot written')
