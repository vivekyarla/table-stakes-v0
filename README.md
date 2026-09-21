# Table Stakes v0

The best spots in San Francisco to get a deal done, ranked. By Rox.

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
placed by Leaflet, so they are exact. Each entry carries `kind`, `address`
(linked to Google Maps), `hours`, `handshakes`, `dealNotes`, `tip`, and an
optional `photo` URL , leave it `null` and a placeholder shows. `?tiles` adds a CARTO raster basemap
under the drawing; `?pan` enables dragging and zooming. Rebuild the geometry
with `python3 tools/build-geo.py` (re-fetch with the Overpass queries in
`data/q_*.ql`; OpenStreetMap data is ODbL , keep the attribution).

Sequence on load: clouds part (about 1.7s, click or Esc to skip), the map draws
itself in beneath them (0.8s), title rises, markers appear.
`prefers-reduced-motion` skips straight to the finished map.

QA switches on `index.html`: `?nointro`, `?t=<seconds>` (map clock),
`?card=<spot id>` (show a hover card), `?it=<0..1>` (intro at a fixed time),
`?tiles` (raster basemap under the drawing), `?pan` (drag/zoom),
`?debug` (print exceptions and marker/projection agreement on the page).
`qa/phone.html` frames the page at 390px , headless Chrome will not lay out
narrower than 500px on its own.

## The opening

Two big clouds cover the page and part like curtains (`js/curtain.js`,
about 1.7s, click or Esc to skip) while the map draws itself in
beneath. `prefers-reduced-motion` skips straight to the finished map.

## Engraving surface (kept for the map)

    js/ink.js      nib strokes, contour/lengthwise hatching, separations, grain
    js/geom.js     spine + radii tube geometry
    js/rng.js      seeded RNG + value noise

## QA

Headless Chrome renders every page; exceptions print into the page so a
blank render is never silent.

    ./tools/shoot.sh "nointro&card=cotogna&t=6" /tmp/page.png "1440x1500" index
    ./tools/shoot.sh "it=0.5"                   /tmp/open.png "1440x900"  index   # curtains half open
    ./tools/shoot.sh "r=1&t=3"                  /tmp/map.png  "1400x900"  map
    ./tools/shoot.sh "r=0.35&t=1"               /tmp/half.png "1400x900"  map

`tools/build-artifact.py` writes `dist/table-stakes.html`, the page with its
stylesheet inlined and no document wrapper, for hosts that supply their own.
