import Phaser from 'phaser';
import { PALETTE, GAME_WIDTH, BRAND } from '../config';
import { EventBus } from '../core/EventBus';
import { Economy } from '../core/Economy';
import { Save } from '../core/SaveManager';

// Top status bar (coins / brains / cafe level / roster) + a toast stack.
// Everything sits on a high-depth layer so it renders above the diner sprites.
export class Hud {
  private scene: Phaser.Scene;
  private layer: Phaser.GameObjects.Container;
  private coinsText!: Phaser.GameObjects.Text;
  private toxinText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private zombieText!: Phaser.GameObjects.Text;
  private toasts: Phaser.GameObjects.Container[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.layer = scene.add.container(0, 0).setDepth(5000);
    this.build();

    const unsubs = [
      EventBus.subscribe('coins-changed', () => this.refresh()),
      EventBus.subscribe('toxin-changed', () => this.refresh()),
      EventBus.subscribe('zombie-added', () => this.refresh()),
      EventBus.subscribe('cafe-level-up', () => this.refresh()),
      EventBus.subscribe('notify', (msg: string) => this.toast(msg)),
    ];
    // A restarted HUD scene must not leave stale handlers poking dead objects.
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => unsubs.forEach((u) => u()));
    this.refresh();
  }

  private chip(x: number, color: number, label: string): Phaser.GameObjects.Text {
    const s = this.scene;
    const box = s.add.rectangle(x, 26, 150, 34, PALETTE.panel, 0.92).setStrokeStyle(1, PALETTE.panelEdge).setOrigin(0, 0.5);
    const dot = s.add.circle(x + 18, 26, 8, color);
    const txt = s.add.text(x + 34, 26, label, { fontFamily: 'monospace', fontSize: '16px', color: '#e8ecf2' }).setOrigin(0, 0.5);
    this.layer.add([box, dot, txt]);
    return txt;
  }

  private build(): void {
    const s = this.scene;
    const bar = s.add.rectangle(0, 0, GAME_WIDTH, 52, PALETTE.bgTop, 0.94).setOrigin(0, 0).setStrokeStyle(1, PALETTE.panelEdge);
    this.layer.add(bar);

    this.coinsText = this.chip(12, PALETTE.coin, '0');
    this.toxinText = this.chip(174, PALETTE.toxic, '0');
    this.levelText = this.chip(336, PALETTE.toxic, 'Lv 1');
    this.zombieText = this.chip(498, PALETTE.blood, '0');

    const brand = s.add
      .text(GAME_WIDTH - 12, 26, `${BRAND.name}  v${BRAND.version}`, { fontFamily: 'monospace', fontSize: '12px', color: '#8891a4' })
      .setOrigin(1, 0.5);
    this.layer.add(brand);
  }

  private refresh(): void {
    this.coinsText.setText(this.fmt(Economy.coins));
    this.toxinText.setText(this.fmt(Economy.toxin));
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
    const c = s.add.container(GAME_WIDTH / 2, y).setDepth(6000);
    const bg = s.add.rectangle(0, 0, 500, 32, PALETTE.panel, 0.96).setStrokeStyle(1, PALETTE.toxicDark);
    const txt = s.add.text(0, 0, message, { fontFamily: 'monospace', fontSize: '14px', color: '#e8ecf2' }).setOrigin(0.5);
    c.add([bg, txt]);
    this.toasts.push(c);

    s.tweens.add({
      targets: c,
      y: y - 10,
      alpha: { from: 1, to: 0 },
      delay: 2400,
      duration: 700,
      onComplete: () => {
        c.destroy();
        this.toasts = this.toasts.filter((t) => t !== c);
      },
    });
  }
}
