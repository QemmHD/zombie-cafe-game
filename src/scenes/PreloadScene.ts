import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, PALETTE } from '../config';

// Loads the Higgsfield-generated art (isometric room + character/prop sprites),
// shows a themed progress bar, then dismisses the HTML splash and enters the cafe.
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  preload(): void {
    // Resolve assets against the Vite base path so it works on GitHub Pages
    // (served under /zombie-cafe-game/) and in local dev (served under /).
    this.load.setBaseURL(import.meta.env.BASE_URL);
    this.load.image('cafe_bg', 'art/cafe_bg.jpg');
    this.load.image('zombie_waiter', 'art/zombie_waiter.png');
    this.load.image('customer', 'art/customer.png');
    this.load.image('stove', 'art/stove.png');

    this.buildProgressBar();
  }

  private buildProgressBar(): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, PALETTE.bgTop).setOrigin(0);
    this.add.text(cx, cy - 44, 'DEADBEAT DINER', {
      fontFamily: 'monospace', fontSize: '30px', color: '#7ee081', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.add.text(cx, cy - 16, "the service is to die for", {
      fontFamily: 'monospace', fontSize: '12px', color: '#8891a4',
    }).setOrigin(0.5);
    this.add.rectangle(cx, cy + 10, 320, 16, PALETTE.panel).setStrokeStyle(1, PALETTE.panelEdge);
    const fill = this.add.rectangle(cx - 158, cy + 10, 0, 12, PALETTE.toxic).setOrigin(0, 0.5);
    this.load.on('progress', (p: number) => {
      fill.width = 316 * p;
    });
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
