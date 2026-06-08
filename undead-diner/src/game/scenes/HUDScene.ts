import Phaser from 'phaser';

/**
 * HUDScene runs above GameScene. The main HUD is React DOM (see src/ui) so the
 * world stays the primary control surface; this scene is reserved for any
 * in-canvas overlays we add later.
 */
export default class HUDScene extends Phaser.Scene {
  constructor() { super({ key: 'HUD', active: false }); }
  create() { /* reserved */ }
}
