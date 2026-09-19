# Table Stakes v0

A guide to the best places in San Francisco to get a deal done — by Rox.

Everything on screen is drawn procedurally in JavaScript from a seed. There are
no raster assets in the render path; change the seed and every stroke is redrawn.

## Layout

    js/rng.js      seeded RNG + value noise
    js/geom.js     spine/tube geometry (forms are a spine + radii)
    js/ink.js      the engraving surface: nib strokes, contour and lengthwise
                   hatching, skin texture, ink separations, grain
    js/hands.js    the posable hand rig (grip 0..1 drives the finger chains)
    js/shake.js    the handshake as a pure function of animation time
    assets/        Rox marks, vectorised from the brand artwork
    qa/            headless QA pages
    tools/         render scripts

## QA

Render a contact sheet of the intro:

    ./tools/shoot.sh "grid=12&w=430&cols=4" /tmp/grid.png "1820x1080"

One frame large, or a different seed:

    ./tools/shoot.sh "f=120&w=1100" /tmp/frame.png "1120x680"
    ./tools/shoot.sh "grid=12&s=9"  /tmp/seed9.png

A single hand, at any grip, with parts isolated:

    ./tools/shoot.sh "only=all&grip=0.7" /tmp/hand.png "1000x580" hand
    ./tools/shoot.sh "only=arm"          /tmp/arm.png  "1000x580" hand

Both QA pages print exceptions into the page, so a blank render is never silent.
