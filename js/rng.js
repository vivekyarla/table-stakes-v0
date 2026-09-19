// Seeded RNG + value noise. Everything procedural draws from these so a given
// seed always reproduces the same picture.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  constructor(seed = 1) { this.seed = seed; this.r = mulberry32(seed); this._n = new Float32Array(1024); 
    const g = mulberry32(seed ^ 0x9e3779b9);
    for (let i = 0; i < 1024; i++) this._n[i] = g() * 2 - 1;
  }
  next() { return this.r(); }
  range(a, b) { return a + (b - a) * this.r(); }
  sign() { return this.r() < 0.5 ? -1 : 1; }
  pick(arr) { return arr[(this.r() * arr.length) | 0]; }
  // smooth 1-D value noise in [-1,1]
  noise(x) {
    const i = Math.floor(x), f = x - i;
    const a = this._n[((i % 1024) + 1024) % 1024];
    const b = this._n[(((i + 1) % 1024) + 1024) % 1024];
    const u = f * f * (3 - 2 * f);
    return a * (1 - u) + b * u;
  }
  // fractal noise, `oct` octaves
  fbm(x, oct = 3) {
    let s = 0, amp = 1, f = 1, norm = 0;
    for (let i = 0; i < oct; i++) { s += this.noise(x * f) * amp; norm += amp; amp *= 0.5; f *= 2.07; }
    return s / norm;
  }
}
