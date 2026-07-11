import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, PALETTE } from '../config';
import type { Dish } from '../data/types';

const ROW_H = 46;
const PANEL_W = 560;
const MAX_ROWS = 7;

/**
 * The original's recipe menu ("tap your character and then tap the stove to
 * select an item" — TapGamers guide): each dish lists Price, Ready-in,
 * Servings, Total earnings and XP; you pay the price up front to start
 * cooking. Fixed to the camera, modal while open.
 */
export class CookbookPanel {
  private scene: Phaser.Scene;
  private root: Phaser.GameObjects.Container | null = null;
  private closedAt = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  get isOpen(): boolean {
    return this.root !== null;
  }

  /** True right after closing — the closing tap must not leak into the world. */
  get justClosed(): boolean {
    return performance.now() - this.closedAt < 200;
  }

  open(dishes: Dish[], coins: number, onPick: (d: Dish) => void, onClose: () => void): void {
    this.close();
    const rows = dishes.slice(0, MAX_ROWS);
    const panelH = 78 + rows.length * ROW_H + (dishes.length > MAX_ROWS ? 22 : 0);
    // Anchored at the camera's WORLD center and counter-scaled by zoom: unlike
    // scrollFactor(0), this keeps Phaser's input hit-testing aligned with what
    // the player sees (scroll-factor-zero hit areas live at world coords).
    const cam = this.scene.cameras.main;
    const cx = 0;
    const cy = 0;

    const root = this.scene.add
      .container(cam.worldView.centerX, cam.worldView.centerY)
      .setScale(1 / cam.zoom)
      .setDepth(20000);
    this.root = root;

    const dim = this.scene.add
      .rectangle(cx, cy, GAME_WIDTH * 2, GAME_HEIGHT * 2, 0x05070b, 0.55)
      .setInteractive();
    dim.on('pointerup', () => {
      this.close();
      onClose();
    });
    root.add(dim);

    const panel = this.scene.add
      .rectangle(cx, cy, PANEL_W, panelH, PALETTE.panel, 0.97)
      .setStrokeStyle(2, PALETTE.panelEdge)
      .setInteractive(); // swallow taps so the dim's close doesn't fire through
    root.add(panel);

    const top = cy - panelH / 2;
    root.add(
      this.scene.add
        .text(cx, top + 14, 'COOKBOOK', {
          fontFamily: 'monospace',
          fontSize: '18px',
          color: '#7ee081',
          fontStyle: 'bold',
        })
        .setOrigin(0.5, 0),
    );
    root.add(
      this.scene.add
        .text(cx, top + 36, 'pay up front — food burns if left on the stove', {
          fontFamily: 'monospace',
          fontSize: '11px',
          color: '#8891a4',
        })
        .setOrigin(0.5, 0),
    );

    rows.forEach((d, i) => {
      const ry = top + 66 + i * ROW_H + ROW_H / 2;
      const afford = coins >= d.price;
      const row = this.scene.add
        .rectangle(cx, ry, PANEL_W - 24, ROW_H - 6, afford ? 0x1a2130 : 0x141821, 1)
        .setStrokeStyle(1, afford ? PALETTE.panelEdge : 0x1c2230);
      if (afford) {
        row.setInteractive({ useHandCursor: true });
        row.on('pointerover', () => row.setFillStyle(0x243049));
        row.on('pointerout', () => row.setFillStyle(0x1a2130));
        row.on('pointerup', () => {
          this.close();
          onPick(d);
        });
      }
      root.add(row);

      const nameCol = afford ? '#e8ecf2' : '#5a6274';
      const statCol = afford ? '#8891a4' : '#454c5c';
      root.add(
        this.scene.add
          .text(cx - PANEL_W / 2 + 22, ry - 9, d.displayName, {
            fontFamily: 'monospace',
            fontSize: '14px',
            color: nameCol,
            fontStyle: 'bold',
          })
          .setOrigin(0, 0.5),
      );
      root.add(
        this.scene.add
          .text(cx - PANEL_W / 2 + 22, ry + 10, `$${d.price} · ready in ${fmtTime(d.cookTimeSeconds)} · ${d.servings} servings`, {
            fontFamily: 'monospace',
            fontSize: '11px',
            color: statCol,
          })
          .setOrigin(0, 0.5),
      );
      root.add(
        this.scene.add
          .text(cx + PANEL_W / 2 - 22, ry, `earns $${d.coinReward}\n+${d.xp} xp`, {
            fontFamily: 'monospace',
            fontSize: '11px',
            color: afford ? '#f2c14e' : '#5a5442',
            align: 'right',
          })
          .setOrigin(1, 0.5),
      );
    });

    if (dishes.length > MAX_ROWS) {
      root.add(
        this.scene.add
          .text(cx, top + 66 + rows.length * ROW_H + 4, `…${dishes.length - MAX_ROWS} more unlock as you level`, {
            fontFamily: 'monospace',
            fontSize: '11px',
            color: '#8891a4',
          })
          .setOrigin(0.5, 0),
      );
    }
  }

  close(): void {
    if (this.root) this.closedAt = performance.now();
    this.root?.destroy();
    this.root = null;
  }
}

function fmtTime(sec: number): string {
  const m = Math.round(sec / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm === 0 ? `${h}h` : `${h}h${rm}m`;
}
