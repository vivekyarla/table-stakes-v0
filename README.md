# Table Stakes v0

A guide to the best places in San Francisco to get a deal done — by Rox.

Everything on screen is generated in JavaScript. There are no image or model
assets in the render path. Open `index.html` over HTTP (ES modules do not load
from `file://`):

    python3 -m http.server 8000      # then http://localhost:8000

## The page

    index.html       shell: header lockup, map hero, title, hover card, guide, footer
    css/site.css     tokens (paper / ink / gold), type (Playfair Display + Inter), layout
    js/app.js        wiring: intro → map reveal → markers; hover card; click-to-scroll
    js/data.js       the spots. Add an entry here and it appears on the map and in the list.
    js/geo.js        real geometry from OpenStreetMap (coastline, parks, lakes, roads,
                     bridges), built by tools/build-geo.py from data/*.json
    js/sfmap.js      the engraving: how that geometry is drawn (coast, water lines,
                     hachured relief, parks, roads, compass) plus relief and lettering
    js/map.js        runtime on Leaflet: projection, bounds, markers; records the
                     engraving and draws it in over ~2.6s, then waves, clouds, parallax

The map runs on Leaflet (cdnjs). Spots are `lat`/`lon` in `js/data.js` and are
placed by Leaflet, so they are exact. `?tiles` adds a CARTO raster basemap
under the drawing; `?pan` enables dragging and zooming. Rebuild the geometry
with `python3 tools/build-geo.py` (re-fetch with the Overpass queries in
`data/q_*.ql`; OpenStreetMap data is ODbL — keep the attribution).

Sequence on load: handshake (4.2s, click or Esc to skip) → hands part and turn
to ink → the map draws itself in beneath → title rises → markers appear.
`prefers-reduced-motion` skips straight to the finished map.

QA switches on `index.html`: `?nointro`, `?t=<seconds>` (map clock),
`?card=<spot id>` (show a hover card), `?it=<0..1>` (intro at a fixed time),
`?debug` (print exceptions on the page).

## The intro: the handshake

Two business people's hands meet, clasp, shake twice and part. It is rendered
as a **signed-distance field, raymarched in a WebGL2 fragment shader**:

    js/rig.js      anatomical hand rig — capsule bones in millimetres, joint
                   flexion, spread, thumb opposition; suit sleeve + shirt cuff
    js/shake.js    the shake as a function of time t in [0,1]: poses, timing,
                   camera, light. `POSES` is the single tuning table.
    js/shader.js   SDF scene + lighting: smooth-min skin, soft shadows, AO,
                   wrap + subsurface skin term, pore-scale normal noise, grain
    js/gl.js       thin WebGL2 wrapper (one quad, one program, uniforms)
    js/vec3.js     vector / rotation helpers

Set `POSES.style = 1` for a toned-monochrome grade.

## Engraving surface (kept for the map)

    js/ink.js      nib strokes, contour/lengthwise hatching, separations, grain
    js/geom.js     spine + radii tube geometry
    js/rng.js      seeded RNG + value noise
    js/hands.js, js/hand3d.js   earlier engraved hand rigs — superseded by the
                                raymarched intro, retained for reference

## QA

Headless Chrome renders every page; exceptions print into the page so a
blank render is never silent.

    ./tools/shoot.sh "grid=12&w=430&cols=4" /tmp/grid.png "1820x1080"
    ./tools/shoot.sh "f=130&w=1000"         /tmp/frame.png "1020x620"
    ./tools/shoot.sh "f=130&w=1000&style=1" /tmp/mono.png  "1020x620"

Override any pose value inline, or sweep two of them in a grid:

    ./tools/shoot.sh "f=130&set=B_CLASP.roll=0.9,gripMax=0.7" /tmp/x.png "1020x620"
    ./tools/shoot.sh "f=130&x=A_CLASP.roll:-0.1,0.15,0.4&y=B_CLASP.roll:0.45,0.75,1.05" /tmp/sweep.png "1300x800" pose

Look at the clasp from another angle by moving the camera:

    ./tools/shoot.sh "f=130&w=700&set=cam.pos.0=0,cam.pos.1=520,cam.pos.2=120" /tmp/top.png "720x440"

The map alone, fully drawn or mid-reveal, and the whole page:

    ./tools/shoot.sh "r=1&t=3"                  /tmp/map.png  "1400x900" map
    ./tools/shoot.sh "r=0.35&t=1"               /tmp/half.png "1400x900" map
    ./tools/shoot.sh "nointro&card=cotogna&t=6" /tmp/page.png "1440x1500" index

`tools/build-artifact.py` writes `dist/table-stakes.html` — the page with its
stylesheet inlined and no document wrapper, for hosts that supply their own.
