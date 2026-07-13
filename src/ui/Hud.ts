import Phaser from 'phaser';
import { PALETTE, GAME_WIDTH, BRAND } from '../config';
import { EventBus } from '../core/EventBus';
import { Economy } from '../core/Economy';
import { Save } from '../core/SaveManager';

const FONT = "'Trebuchet MS', Verdana, sans-serif"; // chunky cartoon lettering
const BAR_H = 52;

// Top status bar in the original's language: star meter first (top-left),
// then cash / toxin / level / staff on warm cream cards. Bright, not gloomy.
export class Hud {
  private scene: Phaser.Scene;
  private layer: Phaser.GameObjects.Container;
  private coinsText!: Phaser.GameObjects.Text;
  private toxinText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private zombieText!: Phaser.GameObjects.Text;
  private stars: Phaser.GameObjects.Text[] = [];
  private ratingNum!: Phaser.GameObjects.Text;
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
      EventBus.subscribe('rating-changed', () => this.refresh()),
      EventBus.subscribe('notify', (msg: string) => this.toast(msg)),
    ];
    // A restarted HUD scene must not leave stale handlers poking dead objects.
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => unsubs.forEach((u) => u()));
    this.refresh();
  }

  private chip(x: number, w: number, color: number | null, label: string): Phaser.GameObjects.Text {
    const s = this.scene;
    const box = s.add
      .rectangle(x, BAR_H / 2, w, 34, 0xfffdf4, 1)
      .setStrokeStyle(2, PALETTE.panelEdge)
      .setOrigin(0, 0.5);
    this.layer.add(box);
    let tx = x + 12;
    if (color !== null) {
      const dot = s.add.circle(x + 16, BAR_H / 2, 8, color).setStrokeStyle(2, 0x6b543a);
      this.layer.add(dot);
      tx = x + 30;
    }
    const txt = s.add
      .text(tx, BAR_H / 2, label, { fontFamily: FONT, fontSize: '16px', color: '#3a2c1c', fontStyle: 'bold' })
      .setOrigin(0, 0.5);
    this.layer.add(txt);
    return txt;
  }

  private build(): void {
    const s = this.scene;
    const bar = s.add
      .rectangle(0, 0, GAME_WIDTH, BAR_H, PALETTE.panel, 0.97)
      .setOrigin(0, 0)
      .setStrokeStyle(2, PALETTE.panelEdge);
    this.layer.add(bar);

    // Star meter — the original parks it top-left; it IS the scoreboard.
    for (let i = 0; i < 5; i++) {
      const star = s.add
        .text(14 + i * 26, BAR_H / 2, '★', { fontFamily: FONT, fontSize: '24px', color: '#f2b13c' })
        .setOrigin(0.5)
        .setStroke('#6b543a', 3);
      this.stars.push(star);
      this.layer.add(star);
    }
    this.ratingNum = s.add
      .text(14 + 5 * 26, BAR_H / 2, '3.0', { fontFamily: FONT, fontSize: '13px', color: '#8a7a62', fontStyle: 'bold' })
      .setOrigin(0, 0.5);
    this.layer.add(this.ratingNum);

    this.coinsText = this.chip(196, 124, PALETTE.coin, '0');
    this.toxinText = this.chip(330, 110, PALETTE.toxic, '0');
    this.levelText = this.chip(450, 96, null, 'Lv 1');
    this.zombieText = this.chip(556, 110, PALETTE.blood, '0');

    const brand = s.add
      .text(GAME_WIDTH - 12, BAR_H / 2, `${BRAND.name}  v${BRAND.version}`, {
        fontFamily: FONT,
        fontSize: '12px',
        color: '#8a7a62',
        fontStyle: 'bold',
      })
      .setOrigin(1, 0.5);
    this.layer.add(brand);
  }

  private refresh(): void {
    this.coinsText.setText(`$${this.fmt(Economy.coins)}`);
    this.toxinText.setText(this.fmt(Economy.toxin));
    this.levelText.setText(`Lv ${Save.data.cafeLevel}`);
    this.zombieText.setText(`${Save.data.zombies.length} 🧟`);
    const r = Save.data.rating;
    this.stars.forEach((star, i) => {
      if (r >= i + 0.75) star.setColor('#f2b13c').setAlpha(1);
      else if (r >= i + 0.25) star.setColor('#f2b13c').setAlpha(0.45);
      else star.setColor('#d8cdb8').setAlpha(1);
    });
    this.ratingNum.setText(r.toFixed(1));
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
    const bg = s.add.rectangle(0, 0, 520, 34, 0xfffdf4, 0.97).setStrokeStyle(2, PALETTE.panelEdge);
    const txt = s.add
      .text(0, 0, message, { fontFamily: FONT, fontSize: '14px', color: '#3a2c1c', fontStyle: 'bold' })
      .setOrigin(0.5);
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
