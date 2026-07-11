import Phaser from 'phaser';
import {
  eatPose,
  idlePose,
  walkPose,
  type PuppetPose,
  type PuppetStyle,
} from '../../engine/contracts';
import customerRig from '../../data/puppets/customer.json';
import zombieRig from '../../data/puppets/zombie_waiter.json';

interface RigPart {
  name: string;
  tex: string;
  w: number;
  h: number;
  pivot: [number, number]; // joint location as a fraction of the part sprite
  attach: [number, number]; // joint position: feet-space (root) or pelvis-space (upper)
  group: 'root' | 'upper';
  z: number;
  channel?: 'legL' | 'legR' | 'armL' | 'armR' | 'head';
  swing?: number; // damp factor on the pose channel (tray arm barely swings)
  rest?: number; // constant rotation offset
}

interface RigData {
  style: PuppetStyle;
  height: number;
  pelvis: [number, number];
  parts: RigPart[];
}

const RIGS: Record<string, RigData> = {
  customer: customerRig as RigData,
  zombie_waiter: zombieRig as RigData,
};

export type PuppetMotion = 'auto' | 'eat';

/**
 * The original's characters are skeletal cutout puppets (spec 92 §5) — this is
 * our runtime equivalent: a jointed container built from a rig JSON, driven by
 * the engine's procedural poses so limb cadence is step-synced, never canned.
 * Legs hang off the root at the hips; torso+arms+head ride a pelvis-anchored
 * `upper` container so a torso lean carries everything above it.
 */
export class PuppetBody extends Phaser.GameObjects.Container {
  rigKey!: string;
  private rig!: RigData;
  private rigRoot!: Phaser.GameObjects.Container;
  private upper!: Phaser.GameObjects.Container;
  private jointImgs = new Map<string, Phaser.GameObjects.Image>();
  private headAttachY = 0;
  baseScale = 1;

  private motion: PuppetMotion = 'auto';
  private idleT = Math.random() * 10; // desync idle breathing between actors
  private flipped = false;
  private tintColor: number | null = null;

  constructor(scene: Phaser.Scene, rigKey: string, heightPx: number) {
    super(scene, 0, 0);
    scene.add.existing(this);
    this.setRig(rigKey, heightPx);
  }

  /** Build (or rebuild, e.g. customer -> zombie on infection) from a rig. */
  setRig(rigKey: string, heightPx: number): void {
    const rig = RIGS[rigKey];
    if (!rig) throw new Error(`unknown puppet rig: ${rigKey}`);
    this.rigKey = rigKey;
    this.rig = rig;
    this.rigRoot?.destroy();
    this.jointImgs.clear();

    this.rigRoot = this.scene.add.container(0, 0);
    this.add(this.rigRoot);
    this.upper = this.scene.add.container(rig.pelvis[0], rig.pelvis[1]);

    const parts = [...rig.parts].sort((a, b) => a.z - b.z);
    let upperAdded = false;
    for (const p of parts) {
      // The upper container slots into z-order where its lowest part sits.
      if (p.group === 'upper' && !upperAdded) {
        this.rigRoot.add(this.upper);
        upperAdded = true;
      }
      const img = this.scene.add.image(p.attach[0], p.attach[1], p.tex);
      img.setOrigin(p.pivot[0], p.pivot[1]);
      img.setDisplaySize(p.w, p.h);
      (p.group === 'upper' ? this.upper : this.rigRoot).add(img);
      this.jointImgs.set(p.name, img);
      if (p.name === 'head') this.headAttachY = p.attach[1];
    }

    this.baseScale = heightPx / rig.height;
    // Container's computed displayWidth/Height derive from this unscaled size.
    this.setSize(rig.height * 0.52, rig.height);
    this.setScale(this.flipped ? -this.baseScale : this.baseScale, this.baseScale);
    if (this.tintColor !== null) this.setTintAll(this.tintColor);
    this.applyPose(idlePose(this.idleT, rig.style));
  }

  get style(): PuppetStyle {
    return this.rig.style;
  }

  /** 2 authored facings, mirrored — flip = the whole cutout flips (authentic). */
  setFlipX(flip: boolean): void {
    if (flip === this.flipped) return;
    this.flipped = flip;
    this.setScale(flip ? -this.baseScale : this.baseScale, this.baseScale);
  }

  setMotion(m: PuppetMotion): void {
    this.motion = m;
  }

  /**
   * Advance the puppet one frame. `phase` is the walker's step-synced bob
   * phase; `moving` picks walk vs idle unless an explicit motion overrides.
   */
  tickPose(dtSec: number, moving: boolean, phase: number): void {
    this.idleT += dtSec;
    const pose =
      this.motion === 'eat'
        ? eatPose(this.idleT, this.rig.style)
        : moving
          ? walkPose(phase, this.rig.style)
          : idlePose(this.idleT, this.rig.style);
    this.applyPose(pose);
  }

  private applyPose(pose: PuppetPose): void {
    this.rigRoot.y = pose.bobY;
    this.upper.rotation = pose.torsoRot;
    for (const p of this.rig.parts) {
      if (!p.channel) continue;
      const img = this.jointImgs.get(p.name);
      if (!img) continue;
      const channel = p.channel === 'head' ? pose.headRot : pose[p.channel];
      img.rotation = (p.rest ?? 0) + (p.swing ?? 1) * channel;
      if (p.channel === 'head') img.y = this.headAttachY + pose.headBobY;
    }
  }

  setTintAll(color: number): void {
    this.tintColor = color;
    for (const img of this.jointImgs.values()) img.setTint(color);
  }

  clearTintAll(): void {
    this.tintColor = null;
    for (const img of this.jointImgs.values()) img.clearTint();
  }

  /** Tap target covering the assembled body (local feet-origin space). */
  enableTap(): void {
    const w = this.rig.height * 0.52;
    this.setInteractive(
      new Phaser.Geom.Rectangle(-w / 2, -this.rig.height, w, this.rig.height),
      Phaser.Geom.Rectangle.Contains,
    );
    if (this.input) this.input.cursor = 'pointer';
  }
}
