import Phaser from 'phaser';
import { PALETTE, GAME_WIDTH } from '../config';
import { EventBus } from '../core/EventBus';
import { Economy } from '../core/Economy';
import { Save } from '../core/SaveManager';
import { xpToNext } from '../engine/contracts';

const FONT = "'Trebuchet MS', Verdana, sans-serif"; // chunky cartoon lettering

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
  private xpFill!: Phaser.GameObjects.Rectangle;
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
      EventBus.subscribe('xp-changed', () => this.refresh()),
      EventBus.subscribe('notify', (msg: string) => this.toast(msg)),
    ];
    // A restarted HUD scene must not leave stale handlers poking dead objects.
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => unsubs.forEach((u) => u()));
    this.refresh();
  }

  /** Floating rounded pill — the world stays visible around each HUD group
   * (the original's HUD is corner chips over the scene, never a solid bar). */
  private pill(x: number, w: number): void {
    const g = this.scene.add.graphics();
    g.fillStyle(0x2a2118, 0.25);
    g.fillRoundedRect(x + 2, 12, w, 34, 17); // soft drop shadow
    g.fillStyle(0xfffdf4, 0.94);
    g.fillRoundedRect(x, 10, w, 34, 17);
    g.lineStyle(2, PALETTE.panelEdge, 1);
    g.strokeRoundedRect(x, 10, w, 34, 17);
    this.layer.add(g);
  }

  private chip(x: number, w: number, color: number | null, label: string): Phaser.GameObjects.Text {
    const s = this.scene;
    this.pill(x, w);
    let tx = x + 14;
    if (color !== null) {
      const dot = s.add.circle(x + 18, 27, 8, color).setStrokeStyle(2, 0x6b543a);
      this.layer.add(dot);
      tx = x + 32;
    }
    const txt = s.add
      .text(tx, 27, label, { fontFamily: FONT, fontSize: '16px', color: '#3a2c1c', fontStyle: 'bold' })
      .setOrigin(0, 0.5);
    this.layer.add(txt);
    return txt;
  }

  private build(): void {
    const s = this.scene;
    // Star meter — the original parks it top-left; it IS the scoreboard.
    this.pill(8, 182);
    for (let i = 0; i < 5; i++) {
      const star = s.add
        .text(26 + i * 26, 27, '★', { fontFamily: FONT, fontSize: '24px', color: '#f2b13c' })
        .setOrigin(0.5)
        .setStroke('#6b543a', 3);
      this.stars.push(star);
      this.layer.add(star);
    }
    this.ratingNum = s.add
      .text(26 + 5 * 26 - 8, 27, '3.0', { fontFamily: FONT, fontSize: '13px', color: '#8a7a62', fontStyle: 'bold' })
      .setOrigin(0, 0.5);
    this.layer.add(this.ratingNum);

    // Resource chips hug the top-right corner; the roofline stays visible.
    this.coinsText = this.chip(GAME_WIDTH - 428, 116, PALETTE.coin, '0');
    this.toxinText = this.chip(GAME_WIDTH - 304, 96, PALETTE.toxic, '0');
    this.levelText = this.chip(GAME_WIDTH - 200, 96, null, 'Lv 1');
    this.zombieText = this.chip(GAME_WIDTH - 96, 88, PALETTE.blood, '0');
    // XP progress toward the next cafe level, inside the level chip.
    const xpX = GAME_WIDTH - 200 + 12;
    const xpBack = s.add.rectangle(xpX, 39, 72, 4, 0xe4dbc4, 1).setOrigin(0, 0.5);
    this.xpFill = s.add.rectangle(xpX, 39, 0, 4, PALETTE.toxic, 1).setOrigin(0, 0.5);
    this.layer.add(xpBack);
    this.layer.add(this.xpFill);
  }

  private refresh(): void {
    this.coinsText.setText(`$${this.fmt(Economy.coins)}`);
    this.toxinText.setText(this.fmt(Economy.toxin));
    this.levelText.setText(`Lv ${Save.data.cafeLevel}`);
    this.zombieText.setText(`${Save.data.zombies.length} 🧟`);
    this.xpFill.width = 72 * Math.min(1, Save.data.playerXP / xpToNext(Save.data.cafeLevel));
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
