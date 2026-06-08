import Phaser from 'phaser';

/**
 * UIScene runs on top of the GameScene for any in-canvas overlays. The main
 * HUD/panels are React DOM (see src/ui), so this scene is intentionally light
 * and reserved for future in-world widgets.
 */
export default class UIScene extends Phaser.Scene {
  constructor() { super({ key: 'UI', active: false }); }
  create() { /* reserved for in-canvas overlays */ }
}
