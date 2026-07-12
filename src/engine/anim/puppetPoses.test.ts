import { describe, it, expect } from 'vitest';
import { walkPose, idlePose, eatPose, sitPose, REST_POSE, type PuppetStyle } from './puppetPoses';

const STYLES: PuppetStyle[] = ['human', 'zombie'];
const CHANNELS = Object.keys(REST_POSE) as (keyof typeof REST_POSE)[];

describe('walkPose', () => {
  it('is 4π-periodic (limbs per stride, torso sway per stride pair — no pop)', () => {
    for (const style of STYLES) {
      const a = walkPose(1.234, style);
      const b = walkPose(1.234 + Math.PI * 4, style);
      for (const c of CHANNELS) expect(b[c]).toBeCloseTo(a[c], 10);
      // limb channels loop every single stride
      const s = walkPose(1.234 + Math.PI * 2, style);
      for (const c of ['legL', 'legR', 'armL', 'armR', 'bobY'] as const) {
        expect(s[c]).toBeCloseTo(a[c], 10);
      }
    }
  });

  it('human legs and arms counter-swing symmetrically', () => {
    for (const phase of [0.3, 1.1, 2.8, 4.6]) {
      const p = walkPose(phase, 'human');
      expect(p.legR).toBeCloseTo(-p.legL, 10);
      expect(p.armR).toBeCloseTo(-p.armL, 10);
      // arms oppose the same-side leg (natural gait)
      expect(Math.sign(p.armL)).toBe(-Math.sign(p.legL));
    }
  });

  it('zombie gait is asymmetric (limp) and hunched forward', () => {
    const p = walkPose(1.0, 'zombie');
    expect(Math.abs(p.legR)).not.toBeCloseTo(Math.abs(p.legL), 2);
    // hunch persists across the whole cycle
    for (const phase of [0, 1, 2, 3, 4, 5, 6]) {
      expect(walkPose(phase, 'zombie').torsoRot).toBeGreaterThan(0);
    }
  });

  it('bob never pushes the body below the ground line', () => {
    for (const style of STYLES) {
      for (let phase = 0; phase < Math.PI * 2; phase += 0.1) {
        expect(walkPose(phase, style).bobY).toBeLessThanOrEqual(0);
      }
    }
  });

  it('joint angles stay within cutout-puppet range (< 45°)', () => {
    for (const style of STYLES) {
      for (let phase = 0; phase < Math.PI * 2; phase += 0.05) {
        const p = walkPose(phase, style);
        for (const c of ['armL', 'armR', 'legL', 'legR', 'torsoRot', 'headRot'] as const) {
          expect(Math.abs(p[c]), `${style}.${c}@${phase}`).toBeLessThan(Math.PI / 4);
        }
      }
    }
  });
});

describe('idlePose / eatPose', () => {
  it('idle keeps limbs near rest (no marching in place)', () => {
    for (const style of STYLES) {
      for (const t of [0, 1.7, 3.3, 9.9]) {
        const p = idlePose(t, style);
        expect(Math.abs(p.legL)).toBeLessThan(0.05);
        expect(Math.abs(p.legR)).toBeLessThan(0.05);
        expect(p.bobY).toBeLessThanOrEqual(0);
      }
    }
  });

  it('eating raises the fork arm to the face and cycles it', () => {
    const up = eatPose(1.1 * 0.25, 'human'); // chew peak
    const down = eatPose(1.1 * 0.75, 'human'); // chew trough
    expect(up.armR).toBeGreaterThan(1.0);
    expect(down.armR).toBeLessThan(up.armR);
    // both well above walk-swing range: the arm is clearly "up"
    expect(down.armR).toBeGreaterThan(0.5);
  });

  it('sitting drops the pelvis and swings the legs forward (and eat inherits it)', () => {
    for (const style of STYLES) {
      const s = sitPose(2.2, style);
      expect(s.bobY).toBeGreaterThan(30); // down onto the seat
      expect(s.legL).toBeGreaterThan(0.8);
      expect(s.legR).toBeGreaterThan(0.8);
      const e = eatPose(2.2, style);
      expect(e.bobY).toBe(s.bobY);
      expect(e.legL).toBe(s.legL);
    }
  });

  it('walk squash compresses at footfall, never stretches past rest', () => {
    for (const style of STYLES) {
      for (let phase = 0; phase < Math.PI * 2; phase += 0.1) {
        const p = walkPose(phase, style);
        expect(p.squash).toBeLessThanOrEqual(1);
        expect(p.squash).toBeGreaterThan(0.9);
      }
      expect(walkPose(0, style).squash).toBeLessThan(1); // footfall = compressed
      expect(walkPose(Math.PI / 2, style).squash).toBeCloseTo(1, 5); // mid-hop
    }
  });
});
