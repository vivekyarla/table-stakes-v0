// Thin WebGL2 wrapper: one fullscreen quad, one shader, uniforms per frame.
import { VS, FS, MAXB } from './shader.js';

export function createRenderer(canvas) {
  const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false });
  if (!gl) throw new Error('WebGL2 unavailable');
  const mk = (type, src) => {
    const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
    return sh;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, mk(gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = (n) => gl.getUniformLocation(prog, n);
  const u = { res: U('uRes'), camPos: U('uCamPos'), camTarget: U('uCamTarget'), fov: U('uFov'), light: U('uLight'),
              count: U('uCount'), A: U('uA'), B: U('uB'), G: U('uG'), style: U('uStyle'), paper: U('uPaper'), seed: U('uSeed') };
  const fA = new Float32Array(MAXB * 4), fB = new Float32Array(MAXB * 4), fG = new Float32Array(MAXB * 4);

  function render(scene, W, H) {
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    gl.viewport(0, 0, W, H);
    const n = Math.min(scene.bones.length, MAXB);
    fA.fill(0); fB.fill(0); fG.fill(0);
    for (let i = 0; i < n; i++) {
      const b = scene.bones[i];
      fA.set([b.a[0], b.a[1], b.a[2], b.ra], i * 4);
      fB.set([b.b[0], b.b[1], b.b[2], b.rb], i * 4);
      fG.set([b.group, b.mat, b.k ?? 8, b.shape ?? 0], i * 4);
    }
    gl.uniform2f(u.res, W, H);
    gl.uniform3fv(u.camPos, scene.cam.pos);
    gl.uniform3fv(u.camTarget, scene.cam.target);
    gl.uniform1f(u.fov, scene.cam.fov);
    gl.uniform3fv(u.light, scene.light ?? [-0.55, 0.75, 0.6]);
    gl.uniform1i(u.count, n);
    gl.uniform4fv(u.A, fA); gl.uniform4fv(u.B, fB); gl.uniform4fv(u.G, fG);
    gl.uniform1f(u.style, scene.style ?? 0);
    gl.uniform3fv(u.paper, scene.paper ?? [0.949, 0.937, 0.906]);
    gl.uniform1f(u.seed, scene.seed ?? 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.finish();
  }
  return { gl, render };
}
