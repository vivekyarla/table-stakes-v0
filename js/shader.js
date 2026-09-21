// Raymarched handshake. Hands are signed-distance fields: capsules blended
// with a smooth minimum, so knuckles, webbing and the thumb muscle emerge as
// flesh rather than parts. Suit sleeves and shirt cuffs are capped cylinders.
export const MAXB = 96;

export const VS = `#version 300 es
in vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

export const FS = `#version 300 es
precision highp float;
out vec4 fragColor;
uniform vec2 uRes;
uniform vec3 uCamPos, uCamTarget;
uniform float uFov;
uniform vec3 uLight;
uniform int uCount;
uniform vec4 uA[${MAXB}];   // start xyz, radius w
uniform vec4 uB[${MAXB}];   // end xyz, radius w
uniform vec4 uG[${MAXB}];   // group, material, smooth k, shape
uniform float uStyle;       // 0 = colour, 1 = toned monochrome
uniform vec3 uPaper;
uniform float uSeed;
uniform float uAlphaBg;     // 1 = background pixels transparent (live page)
uniform vec4 uSphA, uSphB;  // bounding spheres of each hand's skin (xyz, r)

// ---------- SDF primitives ----------
float sdRoundCone(vec3 p, vec3 a, vec3 b, float r1, float r2) {
  vec3 ba = b - a; float l2 = dot(ba, ba); float rr = r1 - r2;
  float a2 = l2 - rr * rr; float il2 = 1.0 / l2;
  vec3 pa = p - a; float y = dot(pa, ba); float z = y - l2;
  vec3 q = pa * l2 - ba * y; float x2 = dot(q, q);
  float y2 = y * y * l2; float z2 = z * z * l2;
  float k = sign(rr) * rr * rr * x2;
  if (sign(z) * a2 * z2 > k) return sqrt(x2 + z2) * il2 - r2;
  if (sign(y) * a2 * y2 < k) return sqrt(x2 + y2) * il2 - r1;
  return (sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}
// capped cylinder between a and b, radius r, edge rounded by e
float sdCyl(vec3 p, vec3 a, vec3 b, float r, float e) {
  vec3 ba = b - a; vec3 pa = p - a;
  float baba = dot(ba, ba); float paba = dot(pa, ba);
  float x = length(pa * baba - ba * paba) - (r - e) * baba;
  float y = abs(paba - baba * 0.5) - baba * 0.5;
  float x2 = x * x; float y2 = y * y * baba;
  float d = (max(x, y) < 0.0) ? -min(x2, y2) : (((x > 0.0) ? x2 : 0.0) + ((y > 0.0) ? y2 : 0.0));
  return sign(d) * sqrt(abs(d)) / baba - e;
}
float smin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}

// ---------- scene ----------
// returns distance; material in .y (0 skin, 1 suit, 2 shirt, 3 nail)
vec2 map(vec3 p) {
  float dA = 1e5, dB = 1e5, dNail = 1e5, dCloth = 1e5; float mCloth = 1.0;
  float sA = length(p - uSphA.xyz) - uSphA.w, sB = length(p - uSphB.xyz) - uSphB.w;
  bool nearA = sA < 30.0, nearB = sB < 30.0;
  for (int i = 0; i < ${MAXB}; i++) {
    if (i >= uCount) break;
    vec4 a = uA[i], b = uB[i], g = uG[i];
    int grp0 = int(g.x + 0.5);
    if (grp0 == 0 && !nearA) { dA = min(dA, sA); continue; }
    if (grp0 == 1 && !nearB) { dB = min(dB, sB); continue; }
    if (grp0 == 6 && !(nearA || nearB)) continue;
    float d;
    if (g.w < 0.5) d = sdRoundCone(p, a.xyz, b.xyz, a.w, b.w);
    else d = sdCyl(p, a.xyz, b.xyz, a.w, b.w);
    int grp = int(g.x + 0.5);
    if (grp == 0) dA = smin(dA, d, g.z);
    else if (grp == 1) dB = smin(dB, d, g.z);
    else if (grp == 6) dNail = min(dNail, d);
    else { if (d < dCloth) { dCloth = d; mCloth = g.y; } }
  }
  float dSkin = min(dA, dB);      // two hands press, they do not fuse
  vec2 r = vec2(dSkin, 0.0);
  if (dNail < r.x) r = vec2(dNail, 3.0);
  if (dCloth < r.x) r = vec2(dCloth, mCloth);
  return r;
}

vec3 calcNormal(vec3 p) {
  const vec2 e = vec2(0.6, -0.6);
  return normalize(e.xyy * map(p + e.xyy).x + e.yyx * map(p + e.yyx).x +
                   e.yxy * map(p + e.yxy).x + e.xxx * map(p + e.xxx).x);
}
float softShadow(vec3 ro, vec3 rd, float mint, float maxt, float k) {
  float res = 1.0; float t = mint;
  for (int i = 0; i < 40; i++) {
    float h = map(ro + rd * t).x;
    if (h < 0.05) return 0.0;
    res = min(res, k * h / t);
    t += clamp(h, 0.8, 12.0);
    if (t > maxt) break;
  }
  return clamp(res, 0.0, 1.0);
}
float calcAO(vec3 p, vec3 n) {
  float occ = 0.0, sca = 1.0;
  for (int i = 0; i < 5; i++) {
    float h = 1.5 + 9.0 * float(i);
    float d = map(p + h * n).x;
    occ += (h - d) * sca; sca *= 0.8;
  }
  return clamp(1.0 - 0.02 * occ, 0.0, 1.0);
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed) * 43758.5453); }
float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float noise3(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash3(i), hash3(i + vec3(1,0,0)), f.x), mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x), mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y), f.z);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  vec3 fw = normalize(uCamTarget - uCamPos);
  vec3 rt = normalize(cross(fw, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(rt, fw);
  float fl = 0.5 / tan(uFov * 0.5);
  vec3 rd = normalize(uv.x * rt + uv.y * up + fl * fw);
  vec3 ro = uCamPos;

  // background: paper with a soft studio falloff
  vec2 suv = gl_FragCoord.xy / uRes;
  vec3 bg = uPaper * (1.0 - 0.10 * length(suv - vec2(0.5, 0.55)));
  vec3 col = bg;

  float t = 0.0; float tmax = 3000.0; vec2 h = vec2(0.0);
  bool hit = false;
  // start at the union bounding sphere; miss it and we are done
  {
    vec3 c = 0.5 * (uSphA.xyz + uSphB.xyz);
    float R = 0.5 * distance(uSphA.xyz, uSphB.xyz) + max(uSphA.w, uSphB.w) + 420.0;
    vec3 oc = ro - c; float b = dot(oc, rd); float cc = dot(oc, oc) - R * R; float disc = b * b - cc;
    if (disc < 0.0) { if (uAlphaBg > 0.5) { fragColor = vec4(0.0); return; } }
    else { t = max(0.0, -b - sqrt(disc)); tmax = -b + sqrt(disc); }
  }
  for (int i = 0; i < 96; i++) {
    vec3 p = ro + rd * t;
    h = map(p);
    if (h.x < 0.06) { hit = true; break; }
    t += h.x * 0.85;
    if (t > tmax) break;
  }
  if (hit) {
    vec3 p = ro + rd * t;
    vec3 n = calcNormal(p);
    vec3 L = normalize(uLight);
    float mat = h.y;
    if (mat < 0.5) {
      // pores and fine creases: perturb the normal with small-scale noise
      float e = 0.9;
      vec3 g = vec3(noise3(p * 0.9 + vec3(e, 0, 0)) - noise3(p * 0.9 - vec3(e, 0, 0)),
                    noise3(p * 0.9 + vec3(0, e, 0)) - noise3(p * 0.9 - vec3(0, e, 0)),
                    noise3(p * 0.9 + vec3(0, 0, e)) - noise3(p * 0.9 - vec3(0, 0, e)));
      n = normalize(n + 0.18 * (g - n * dot(g, n)) + 0.06 * (vec3(noise3(p * 4.0), noise3(p * 4.0 + 7.0), noise3(p * 4.0 + 13.0)) - 0.5));
    } else if (mat < 1.5) {
      float e = 0.6;
      vec3 g = vec3(noise3(p * 2.2 + vec3(e, 0, 0)) - noise3(p * 2.2 - vec3(e, 0, 0)),
                    noise3(p * 2.2 + vec3(0, e, 0)) - noise3(p * 2.2 - vec3(0, e, 0)),
                    noise3(p * 2.2 + vec3(0, 0, e)) - noise3(p * 2.2 - vec3(0, 0, e)));
      n = normalize(n + 0.12 * (g - n * dot(g, n)));
    }
    vec3 alb; float rough; float spec;
    if (mat < 0.5)      { alb = vec3(0.78, 0.60, 0.52) * (0.94 + 0.12 * noise3(p * 0.35)); alb = mix(alb, alb * vec3(1.08, 0.86, 0.82), 0.5 * noise3(p * 0.12 + 3.0)); rough = 0.54; spec = 0.12; }
    else if (mat < 1.5) { alb = vec3(0.10, 0.11, 0.14); rough = 0.95; spec = 0.03; }
    else if (mat < 2.5) { alb = vec3(0.93, 0.92, 0.89); rough = 0.85; spec = 0.04; }
    else                { alb = vec3(0.84, 0.66, 0.60); rough = 0.25; spec = 0.35; }

    float ndl = dot(n, L);
    float sha = softShadow(p + n * 0.4, L, 0.5, 900.0, 10.0);
    float ao = calcAO(p, n);
    // wrap lighting gives skin its soft terminator; the shadow edge warms
    float wrap = (mat < 0.5 || mat > 2.5) ? 0.45 : 0.15;
    float dif = clamp((ndl + wrap) / (1.0 + wrap), 0.0, 1.0) * mix(0.55, 1.0, sha);
    vec3 sss = (mat < 0.5) ? vec3(0.95, 0.35, 0.25) * pow(clamp(1.0 - abs(ndl), 0.0, 1.0), 2.5) * 0.48 * mix(0.5, 1.0, sha) : vec3(0.0);
    vec3 key = vec3(1.0, 0.94, 0.86) * 1.35;
    vec3 sky = vec3(0.66, 0.70, 0.78) * (0.55 + 0.45 * n.y);
    vec3 fill = vec3(0.95, 0.9, 0.9) * 0.42 * clamp(dot(n, normalize(vec3(0.7, -0.1, 0.5))), 0.0, 1.0);
    vec3 rim = vec3(1.0, 0.9, 0.75) * 0.5 * pow(clamp(1.0 - dot(n, -rd), 0.0, 1.0), 3.0) * clamp(dot(n, normalize(vec3(-0.3, 0.6, -0.8))), 0.0, 1.0);
    vec3 hv = normalize(L - rd);
    float sp = pow(clamp(dot(n, hv), 0.0, 1.0), mix(8.0, 90.0, 1.0 - rough)) * spec * sha;
    vec3 bounce = vec3(0.9, 0.82, 0.76) * 0.22 * clamp(dot(n, normalize(vec3(0.0, -1.0, 0.35))), 0.0, 1.0);
    col = alb * (key * dif + sky * 0.62 * ao + fill * ao + bounce * ao) + sss + rim * ao + key * sp;
    col *= mix(0.6, 1.0, ao);
    // light fog toward the paper so far parts sit back
    col = mix(col, bg, clamp((t - 900.0) / 2400.0, 0.0, 0.35));
    if (uStyle > 1.5) {
      // black and white, with the hands in gold
      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      if (mat < 0.5 || mat > 2.5) {
        vec3 g = mix(vec3(0.22, 0.15, 0.04), vec3(1.0, 0.88, 0.50), pow(lum * 1.15, 0.85));
        g += vec3(1.0, 0.92, 0.70) * sp * 2.2;
        col = g;
      } else {
        col = mix(vec3(0.09, 0.08, 0.075), vec3(0.97, 0.96, 0.93), pow(lum, 0.9));
      }
    }
  }

  if (!hit && uAlphaBg > 0.5) { fragColor = vec4(0.0); return; }
  // grade: optional toned monochrome, grain, vignette
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  vec3 toned = mix(vec3(0.16, 0.14, 0.12), vec3(0.97, 0.95, 0.91), lum);
  col = mix(col, toned, clamp(uStyle, 0.0, 1.0) * step(uStyle, 1.5));
  col += (hash(gl_FragCoord.xy) - 0.5) * 0.03;
  col *= 1.0 - (uAlphaBg > 0.5 ? 0.0 : 0.18) * pow(length(suv - 0.5) * 1.35, 2.5);
  fragColor = vec4(pow(clamp(col, 0.0, 1.0), vec3(1.0 / 1.05)), 1.0);
}`;
