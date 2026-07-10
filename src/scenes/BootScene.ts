import Phaser from 'phaser';

// Minimal boot: configure input, then hand off to the asset preloader.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.scene.start('Preload');
  }
}
