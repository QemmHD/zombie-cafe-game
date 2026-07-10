import Phaser from 'phaser';

// Minimal boot: dismiss the HTML splash, then hand off to the cafe.
// (No asset preload yet — the slice draws with primitives. When real art lands
// from the Higgsfield pipeline, a PreloadScene slots in here.)
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    const splash = document.getElementById('boot-splash');
    if (splash) {
      splash.style.opacity = '0';
      setTimeout(() => splash.remove(), 420);
    }
    this.scene.start('Cafe');
  }
}
