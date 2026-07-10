import Phaser from 'phaser';
import { PALETTE, GAME_WIDTH, BRAND } from '../config';
import { EventBus } from '../core/EventBus';
import { Economy } from '../core/Economy';
import { Save } from '../core/SaveManager';

// Top status bar (coins / brains / cafe level) + a lightweight toast stack.
export class Hud {
  private scene: Phaser.Scene;
  private coinsText!: Phaser.GameObjects.Text;
  private brainsText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private zombieText!: Phaser.GameObjects.Text;
  private toasts: Phaser.GameObjects.Container[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.build();

    EventBus.subscribe('coins-changed', () => this.refresh());
    EventBus.subscribe('brains-changed', () => this.refresh());
    EventBus.subscribe('zombie-added', () => this.refresh());
    EventBus.subscribe('notify', (msg: string) => this.toast(msg));
    this.refresh();
  }

  private chip(x: number, color: number, label: string): Phaser.GameObjects.Text {
    const s = this.scene;
    s.add.rectangle(x, 26, 150, 34, PALETTE.panel).setStrokeStyle(1, PALETTE.panelEdge).setOrigin(0, 0.5);
    s.add.circle(x + 18, 26, 8, color);
    return s.add
      .text(x + 34, 26, label, { fontFamily: 'monospace', fontSize: '16px', color: '#e8ecf2' })
      .setOrigin(0, 0.5);
  }

  private build(): void {
    const s = this.scene;
    s.add.rectangle(0, 0, GAME_WIDTH, 52, PALETTE.bgTop).setOrigin(0, 0).setStrokeStyle(1, PALETTE.panelEdge);

    this.coinsText = this.chip(12, PALETTE.coin, '0');
    this.brainsText = this.chip(174, PALETTE.brains, '0');
    this.levelText = this.chip(336, PALETTE.toxic, 'Lv 1');
    this.zombieText = this.chip(498, PALETTE.blood, '0');

    s.add
      .text(GAME_WIDTH - 12, 26, `${BRAND.name}  v${BRAND.version}`, {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#8891a4',
      })
      .setOrigin(1, 0.5);
  }

  private refresh(): void {
    this.coinsText.setText(this.fmt(Economy.coins));
    this.brainsText.setText(this.fmt(Economy.brains));
    this.levelText.setText(`Lv ${Save.data.cafeLevel}`);
    this.zombieText.setText(`${Save.data.zombies.length} 🧟`);
  }

  private fmt(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 10_000) return (n / 1000).toFixed(1) + 'k';
    return Math.floor(n).toString();
  }

  toast(message: string): void {
    const s = this.scene;
    const y = 68 + this.toasts.length * 40;
    const c = s.add.container(GAME_WIDTH / 2, y);
    const bg = s.add.rectangle(0, 0, 460, 32, PALETTE.panel, 0.95).setStrokeStyle(1, PALETTE.toxicDark);
    const txt = s.add
      .text(0, 0, message, { fontFamily: 'monospace', fontSize: '14px', color: '#e8ecf2' })
      .setOrigin(0.5);
    c.add([bg, txt]).setDepth(1000);
    this.toasts.push(c);

    s.tweens.add({
      targets: c,
      y: y - 10,
      alpha: { from: 1, to: 0 },
      delay: 2200,
      duration: 600,
      onComplete: () => {
        c.destroy();
        this.toasts = this.toasts.filter((t) => t !== c);
      },
    });
  }
}
