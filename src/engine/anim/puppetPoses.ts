// Procedural cutout-puppet poses — pure math, no Phaser (engine rule).
//
// Ground truth (spec 92 §5): the original's characters are skeletal cutout
// puppets — bobblehead proportions, thick outlines, limbs swinging in chunky
// 2D rotations (walk=39f, eat=58f). We drive the same read procedurally so
// cadence ties exactly to the walker's step phase instead of canned frames.
//
// Conventions: angles in radians; art faces screen-LEFT, so POSITIVE rotation
// swings a limb forward. bobY is a root offset in art px at rig scale 1
// (negative = up); the rig scales it with the character.

export type PuppetStyle = 'human' | 'zombie';

export interface PuppetPose {
  bobY: number; // whole-body hop (negative = up); sitting uses positive (down)
  squash: number; // vertical body compression at footfall (1 = none) — weight
  torsoRot: number; // pelvis-anchored lean (carries arms + head with it)
  headRot: number; // extra head rotation on top of torso
  headBobY: number; // bobblehead lag, art px
  armL: number; // shoulder swing channels (rig applies per-part rest/damp)
  armR: number;
  legL: number; // hip swing channels
  legR: number;
}

export const REST_POSE: PuppetPose = {
  bobY: 0,
  squash: 1,
  torsoRot: 0,
  headRot: 0,
  headBobY: 0,
  armL: 0,
  armR: 0,
  legL: 0,
  legR: 0,
};

/**
 * Walk cycle. `phase` is the walker's step-synced bob phase (radians; one
 * stride pair per 2π — matches Walker.bobPhase so feet never skate). The
 * torso/head sway runs at half rate, so the full pose period is 4π (the body
 * rocks alternately over two strides; the phase accumulates, never wraps).
 */
export function walkPose(phase: number, style: PuppetStyle): PuppetPose {
  // Weight: the body compresses a touch at each footfall (bob at its lowest).
  const contact = 1 - Math.abs(Math.sin(phase)); // 1 at footfall, 0 mid-hop
  if (style === 'zombie') {
    // Shamble: hunched torso, arms dragging out front, uneven limping steps,
    // heavy head loll. Lurch uses a cubed sine so the hop snaps, drags, snaps.
    const lurch = Math.sin(phase);
    return {
      bobY: -6 * Math.abs(lurch * lurch * lurch),
      squash: 1 - 0.05 * contact,
      torsoRot: 0.1 + 0.05 * Math.sin(phase / 2),
      headRot: 0.12 * Math.sin(phase / 2 + 1.1),
      headBobY: -2.2 * Math.abs(Math.sin(phase - 0.7)),
      armL: 0.1 * Math.sin(phase + 0.4), // rig rest pose holds arms raised
      armR: 0.16 * Math.sin(phase),
      legL: 0.4 * Math.sin(phase),
      legR: -0.26 * Math.sin(phase + 0.35), // shorter trailing step = limp
    };
  }
  // Human: brisk symmetric stride, arms counter-swinging, light head bounce.
  return {
    bobY: -3.4 * Math.abs(Math.sin(phase)),
    squash: 1 - 0.035 * contact,
    torsoRot: 0.05 + 0.03 * Math.sin(phase / 2),
    headRot: 0.04 * Math.sin(phase / 2 - 0.6),
    headBobY: -1.6 * Math.abs(Math.sin(phase - 0.5)),
    armL: -0.4 * Math.sin(phase),
    armR: 0.4 * Math.sin(phase),
    legL: 0.5 * Math.sin(phase),
    legR: -0.5 * Math.sin(phase),
  };
}

/**
 * Seated on a chair: pelvis dropped to seat height, single-piece legs swung
 * forward, small breathing sway. `sitDrop` is in rig units (height 300 rig).
 */
export function sitPose(t: number, style: PuppetStyle): PuppetPose {
  const breath = Math.sin((t * Math.PI * 2) / 3.6);
  return {
    ...REST_POSE,
    bobY: 46, // down onto the seat
    squash: 1,
    torsoRot: (style === 'zombie' ? 0.1 : 0.02) + 0.012 * breath,
    headRot: 0.05 * Math.sin((t * Math.PI * 2) / 7.3),
    headBobY: -0.6 * (breath + 1) * 0.5,
    armL: 0.35,
    armR: 0.3,
    legL: 1.05, // swung forward — knees-over-the-seat read
    legR: 0.95,
  };
}

/** Standing idle. `t` is elapsed seconds — slow breath, occasional head tilt. */
export function idlePose(t: number, style: PuppetStyle): PuppetPose {
  const breath = Math.sin((t * Math.PI * 2) / 3.4);
  if (style === 'zombie') {
    return {
      ...REST_POSE,
      bobY: -0.9 * (breath + 1) * 0.5,
      torsoRot: 0.08 + 0.015 * breath,
      headRot: 0.1 * Math.sin((t * Math.PI * 2) / 6.5 + 0.8), // slow loll
      headBobY: 0,
      armL: 0.05 * breath,
      armR: 0.07 * Math.sin((t * Math.PI * 2) / 3.4 + 0.9),
    };
  }
  return {
    ...REST_POSE,
    bobY: -0.8 * (breath + 1) * 0.5,
    torsoRot: 0.012 * breath,
    headRot: 0.05 * Math.sin((t * Math.PI * 2) / 8.2),
  };
}

/** Seated eating: the sit pose plus a fork hand cycling to the mouth. */
export function eatPose(t: number, style: PuppetStyle): PuppetPose {
  const chew = Math.sin((t * Math.PI * 2) / 1.1);
  return {
    ...sitPose(t, style),
    headRot: 0.07 * Math.sin((t * Math.PI * 2) / 1.1 + Math.PI / 2),
    headBobY: -0.8 * (chew + 1) * 0.5,
    armL: 0.2,
    armR: 1.15 + 0.3 * chew, // raised to the mouth, bobbing
  };
}
