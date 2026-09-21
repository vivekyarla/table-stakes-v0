// The handshake over time. Two right hands: A enters from the left, B from
// the right. They rise into the frame, turn vertical, meet palm to palm,
// close, pump twice from the elbow, and part.
import { handBones, place } from './rig.js';

const cl = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeIn = (t) => t * t * t;
const mix = (a, b, t) => a + (b - a) * t;

export const PHASES = { enter: [0, 0.30], clasp: [0.24, 0.42], shake: [0.42, 0.74], part: [0.74, 1] };

export const POSES = {
  // approach: arm reaching forward, hand relaxed and turned a little palm-in
  A_APPROACH: { pos: [-330, -70, 40], yaw: -0.14, tilt: 0.16, roll: -0.95 },
  B_APPROACH: { pos: [330, -30, -20], yaw: Math.PI - 0.14, tilt: -0.10, roll: 1.25 },
  // clasp: vertical, thumbs up, B tucked behind A with palms meeting
  A_CLASP:    { pos: [-70, 4, 15], yaw: 0.10, tilt: -0.35, roll: 0.15 },
  B_CLASP:    { pos: [70, -6, -15], yaw: Math.PI + 0.10, tilt: -0.35, roll: 0.75 },
  cam: { pos: [20, 110, 480], target: [0, -14, 0], fov: 0.66 },
  light: [-0.55, 0.78, 0.55],
  gripMax: 0.85,
  thumbAdduct: [0.95, -0.10, -0.28],
  style: 0.0,
  only: 0,      // 0 both, 1 hand A, 2 hand B
  alphaBg: false,
  inkOut: true,  // hands desaturate to ink as they part
};

function lerpPose(p, q, t) {
  return { pos: [mix(p.pos[0], q.pos[0], t), mix(p.pos[1], q.pos[1], t), mix(p.pos[2], q.pos[2], t)],
           yaw: mix(p.yaw, q.yaw, t), tilt: mix(p.tilt, q.tilt, t), roll: mix(p.roll, q.roll, t) };
}

export function poseAt(t) {
  const enter = cl((t - PHASES.enter[0]) / (PHASES.enter[1] - PHASES.enter[0]));
  const grip = cl((t - PHASES.clasp[0]) / (PHASES.clasp[1] - PHASES.clasp[0]));
  const sh = cl((t - PHASES.shake[0]) / (PHASES.shake[1] - PHASES.shake[0]));
  const part = cl((t - PHASES.part[0]) / (PHASES.part[1] - PHASES.part[0]));

  const posRel = easeInOut(cl((part - 0.25) / 0.75));
  const gRel = easeInOut(cl(part / 0.35));
  const travel = (1 - easeOut(enter)) * 470 + posRel * 380;
  const lift = (1 - easeOut(enter)) * -70 + posRel * -40;   // arms come up into frame, drop away after
  const settle = easeInOut(grip) * (1 - posRel);
  // two pumps from the elbow, decaying
  const osc = sh > 0 && sh < 1 ? Math.sin(sh * Math.PI * 2 * 2.0) * Math.exp(-sh * 1.6) * (1 - Math.pow(1 - Math.min(1, sh * 6), 2)) : 0;
  const g = cl(0.06 + grip * (POSES.gripMax - 0.06) * (1 - gRel * 0.94));

  const A = lerpPose(POSES.A_APPROACH, POSES.A_CLASP, settle);
  const B = lerpPose(POSES.B_APPROACH, POSES.B_CLASP, settle);
  A.pos[0] -= travel; B.pos[0] += travel * 0.94;
  A.pos[1] += lift;   B.pos[1] += lift * 0.9;
  for (const P of [A, B]) { P.pos[1] += osc * 34; P.tilt += osc * 0.13; P.pos[2] += osc * 6; }
  const spread = mix(0.55, 0.15, settle);
  return { A: { ...A, grip: g, spread, thumbUp: mix(0.45, 0.15, settle) },
           B: { ...B, grip: mix(g * 0.6, g * 1.0, settle), spread, thumbUp: mix(0.25, 0.2, settle) }, settle, t };
}

/** World-space bones + camera for frame time t. */
export function sceneAt(t, seed = 7) {
  const p = poseAt(t);
  const bones = [];
  if (POSES.only !== 1) bones.push(...place(handBones(1, { grip: p.B.grip, spread: p.B.spread, thumbUp: p.B.thumbUp, thumbAdduct: POSES.thumbAdduct }), p.B));
  if (POSES.only !== 2) bones.push(...place(handBones(0, { grip: p.A.grip, spread: p.A.spread, thumbUp: p.A.thumbUp, thumbAdduct: POSES.thumbAdduct }), p.A));
  const part = cl((t - PHASES.part[0]) / (PHASES.part[1] - PHASES.part[0]));
  const style = Math.max(POSES.style, POSES.inkOut ? easeInOut(cl((part - 0.15) / 0.6)) : 0);
  return { bones, cam: POSES.cam, light: POSES.light, style, seed, pose: p, alphaBg: POSES.alphaBg };
}
