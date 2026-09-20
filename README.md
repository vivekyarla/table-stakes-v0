# Table Stakes v0

A guide to the best places in San Francisco to get a deal done — by Rox.

Everything on screen is generated in JavaScript. There are no image or model
assets in the render path.

## Intro: the handshake

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
