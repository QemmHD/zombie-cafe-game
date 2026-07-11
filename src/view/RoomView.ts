import Phaser from 'phaser';
import {
  BAND,
  CafeGrid,
  DEFAULT_FIT_ZOOM_FLOOR,
  ZOOM_MAX,
  clamp,
  HALF_H,
  HALF_W,
  entityDepth,
  furnitureSortKey,
  leftWallSectionTopLeft,
  rightWallSectionTopLeft,
  roomBounds,
  tileToWorld,
  worldToTile,
  type Placement,
  type Tile,
} from '../engine/contracts';

// Assets are authored @2x (floor 256x128 for a 128x64 tile); the view scales by 0.5.
const ART_SCALE = 0.5;

/** Sprite keys per furniture kind (M1 set; grows with the catalog art). */
const KIND_TEXTURE: Record<string, string> = {
  stove: 'stove',
  counter: 'counter',
  sink: 'sink',
  table: 'table',
  chair: 'chair',
};

/**
 * Per-kind width multiplier over the projected footprint diamond, plus a
 * display-height cap in tile-heights — keeps near-square source art from
 * towering over the room (a 2x2 diner table is wide, not monumental).
 */
const KIND_FIT: Record<string, { w: number; maxH: number }> = {
  stove: { w: 0.84, maxH: 2.6 },
  counter: { w: 0.95, maxH: 2.2 },
  sink: { w: 0.8, maxH: 2.6 },
  table: { w: 0.78, maxH: 2.4 },
  chair: { w: 0.62, maxH: 2.2 },
};

/**
 * RoomView (spec 01 §9 view layer): renders a CafeGrid — floor diamonds, the
 * two back walls, door mat, and furniture placements — with canonical depth
 * sorting, and keeps itself in sync through grid events. The engine stays
 * Phaser-free; this is the thin adapter.
 */
export class RoomView {
  readonly scene: Phaser.Scene;
  readonly grid: CafeGrid;

  private floorTiles = new Map<string, Phaser.GameObjects.Image>(); // "tx,ty" -> img
  private wallSprites: Phaser.GameObjects.Image[] = [];
  private furniture = new Map<string, Phaser.GameObjects.Image>(); // placementId -> img

  constructor(scene: Phaser.Scene, grid: CafeGrid) {
    this.scene = scene;
    this.grid = grid;
    this.buildFloor();
    this.buildWalls();
    this.buildDoor();
    for (const p of grid.placements().values()) this.addFurniture(p);

    grid.events.on('placed', ({ placement }) => this.addFurniture(placement));
    grid.events.on('removed', ({ placement }) => {
      this.furniture.get(placement.id)?.destroy();
      this.furniture.delete(placement.id);
      (scene.children.getByName(`sh_${placement.id}`) as Phaser.GameObjects.Ellipse | null)?.destroy();
    });
    grid.events.on('moved', ({ placement }) => {
      const img = this.furniture.get(placement.id);
      if (img) this.positionFurniture(img, placement);
    });
  }

  /** Fit the camera to the room with a margin; returns the applied zoom. */
  fitCamera(marginPx = 40): number {
    const b = roomBounds(this.grid.w, this.grid.h);
    const cam = this.scene.cameras.main;
    const zw = (cam.width - marginPx * 2) / (b.maxX - b.minX);
    const zh = (cam.height - marginPx * 2) / (b.maxY - b.minY);
    const zoom = clamp(Math.min(zw, zh), DEFAULT_FIT_ZOOM_FLOOR, ZOOM_MAX);
    cam.setZoom(zoom);
    cam.centerOn((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2 + 12);
    return zoom;
  }

  /** Screen-space pointer -> tile, via the camera's exact inverse (zero drift). */
  pointerTile(pointer: Phaser.Input.Pointer): Tile {
    return worldToTile(pointer.worldX, pointer.worldY);
  }

  /** World position of a continuous tile-space point (for walkers/effects). */
  worldOf(fx: number, fy: number): Phaser.Math.Vector2 {
    const p = tileToWorld(fx, fy);
    return new Phaser.Math.Vector2(p.x, p.y);
  }

  /** The rendered sprite for a placement (stoves wire tap + fx through this). */
  furnitureSprite(placementId: string): Phaser.GameObjects.Image | undefined {
    return this.furniture.get(placementId);
  }

  // ── construction ───────────────────────────────────────────────────────────

  private buildFloor(): void {
    for (let ty = 0; ty < this.grid.h; ty++) {
      for (let tx = 0; tx < this.grid.w; tx++) {
        const c = tileToWorld(tx, ty);
        // Checker parity delivers the classic diner floor from one skin pair.
        const key = (tx + ty) % 2 === 0 ? 'floor_a' : 'floor_b';
        const img = this.scene.add
          .image(c.x, c.y, key)
          .setScale(ART_SCALE)
          .setDepth(BAND.FLOOR + (tx + ty) / 1000);
        this.floorTiles.set(`${tx},${ty}`, img);
      }
    }
  }

  private buildWalls(): void {
    for (let k = 0; k < this.grid.w; k++) {
      const p = rightWallSectionTopLeft(k);
      this.wallSprites.push(
        this.scene.add.image(p.x, p.y, 'wall').setOrigin(0, 0).setScale(ART_SCALE).setDepth(BAND.WALL + k),
      );
    }
    for (let m = 0; m < this.grid.h; m++) {
      const p = leftWallSectionTopLeft(m);
      this.wallSprites.push(
        this.scene.add
          .image(p.x, p.y, 'wall')
          .setOrigin(0, 0)
          .setScale(ART_SCALE)
          .setFlipX(true)
          .setDepth(BAND.WALL + m),
      );
    }
  }

  private buildDoor(): void {
    const d = this.grid.door();
    const c = tileToWorld(d.tx, d.ty);
    this.scene.add
      .image(c.x, c.y, 'door_mat')
      .setScale(ART_SCALE)
      .setDepth(BAND.FLOOR_OVERLAY - 1);
  }

  private addFurniture(p: Placement): void {
    const tex = KIND_TEXTURE[p.kind];
    if (!tex) return; // kinds without art yet (decor etc.) simply don't render in M1
    const img = this.scene.add.image(0, 0, tex).setOrigin(0.5, 1);
    this.positionFurniture(img, p);
    img.setInteractive({ useHandCursor: true });
    img.setData('placementId', p.id);
    this.furniture.set(p.id, img);
  }

  private positionFurniture(img: Phaser.GameObjects.Image, p: Placement): void {
    const { w: fw, h: fh } = p.footprint;
    // Footprint center in tile space; sprite bottom sits on the footprint's
    // front (screen-bottom) vertex: centerY + HALF_H*(fw+fh)/2.
    const cx = p.anchor.tx + (fw - 1) / 2;
    const cy = p.anchor.ty + (fh - 1) / 2;
    const c = tileToWorld(cx, cy);
    const bottomY = c.y + (HALF_H * (fw + fh)) / 2;
    const fit = KIND_FIT[p.kind] ?? { w: 0.85, maxH: 2.5 };
    // Width tracks the projected footprint diamond; height is capped so
    // near-square art can't tower (players notice everything).
    let scale = ((fw + fh) * HALF_W * fit.w) / img.width;
    const maxH = fit.maxH * 2 * HALF_H;
    if (img.height * scale > maxH) scale = maxH / img.height;
    img.setScale(scale);
    img.setPosition(c.x, bottomY + 2);
    img.setDepth(entityDepth(furnitureSortKey(p), false));

    // Grounding shadow: nothing sits ON the floor without one.
    const shadowKey = `sh_${p.id}`;
    (this.scene.children.getByName(shadowKey) as Phaser.GameObjects.Ellipse | null)?.destroy();
    this.scene.add
      .ellipse(c.x, bottomY - 4, img.displayWidth * 0.86, HALF_H * (fw + fh) * 0.6, 0x000000, 0.28)
      .setName(shadowKey)
      .setDepth(BAND.FLOOR_OVERLAY);
  }
}
