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

// Assets are authored @2x (floor 168x108 for an 84x54 tile); the view scales by 0.5.
const ART_SCALE = 0.5;

/** The original tints its white wall panel at runtime — the starter is lemon. */
const WALL_TINT = 0xf5ec74;

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
    this.buildStreet();
    this.buildFloor();
    this.buildWalls();
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

  /**
   * Original framing: the room FILLS the screen (fit to width; the vertical
   * overflow is reachable by drag-pan, like the original's scroll). Camera
   * bounds keep the pan inside room + street.
   */
  fitCamera(marginPx = 10): number {
    const b = roomBounds(this.grid.w, this.grid.h);
    const maxY = b.maxY + 56; // include a strip of the front lawn
    const cam = this.scene.cameras.main;
    const zw = (cam.width - marginPx * 2) / (b.maxX - b.minX);
    const zh = (cam.height - 64) / (maxY - b.minY); // leave room for the HUD bar
    // Original framing: the starter room fills the screen edge-to-edge; larger
    // cafes overflow and the player drag-scrolls (authentic).
    const zoom = clamp(Math.min(zw, zh), DEFAULT_FIT_ZOOM_FLOOR, ZOOM_MAX);
    cam.setZoom(zoom);
    const pad = 90;
    cam.setBounds(b.minX - pad, b.minY - pad, b.maxX - b.minX + pad * 2, maxY - b.minY + pad * 2);
    cam.centerOn((b.minX + b.maxX) / 2, (b.minY + maxY) / 2 + 26);
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

  /**
   * Ground truth (spec 92): the street runs BEHIND the cafe — sidewalk + curb
   * + striped road past the two back walls, glimpsed at the top corners and
   * through the doorway. The FRONT of the lot is a grass apron. All render-only.
   */
  private buildStreet(): void {
    // Street behind the right-back wall (rows ty = -1 sidewalk, -2 road)
    for (let tx = -5; tx < this.grid.w + 5; tx++) {
      for (const [ty, key] of [[-1, 'sidewalk'], [-2, 'road_stripe']] as const) {
        const c = tileToWorld(tx, ty);
        this.scene.add.image(c.x, c.y, key).setScale(ART_SCALE).setDepth(-20 + (tx + ty) / 1000);
      }
    }
    // Street wrapping behind the left-back wall (columns tx = -1, -2)
    for (let ty = 0; ty < this.grid.h + 5; ty++) {
      for (const [tx, key] of [[-1, 'sidewalk'], [-2, 'road_stripe']] as const) {
        const c = tileToWorld(tx, ty);
        this.scene.add.image(c.x, c.y, key).setScale(ART_SCALE).setDepth(-20 + (tx + ty) / 1000);
      }
    }
    // Grass apron in front (the original's lawn — tombstones live here later)
    for (let row = 0; row < 2; row++) {
      for (let tx = -2; tx < this.grid.w + 3; tx++) {
        const c = tileToWorld(tx, this.grid.h + row);
        this.scene.add.image(c.x, c.y, 'grass').setScale(ART_SCALE).setDepth(-20 + (tx + this.grid.h + row) / 1000);
      }
      for (let ty = 0; ty < this.grid.h; ty++) {
        const c = tileToWorld(this.grid.w + row, ty);
        this.scene.add.image(c.x, c.y, 'grass').setScale(ART_SCALE).setDepth(-20 + (this.grid.w + row + ty) / 1000);
      }
    }
  }

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
    const door = this.grid.door();
    for (let k = 0; k < this.grid.w; k++) {
      const p = rightWallSectionTopLeft(k);
      const isDoor = door.ty === 0 && k === door.tx;
      this.wallSprites.push(
        this.scene.add
          .image(p.x, p.y, isDoor ? 'wall_door' : 'wall')
          .setOrigin(0, 0)
          .setScale(ART_SCALE)
          .setTint(WALL_TINT) // white panel, tinted — the original's own technique
          .setDepth(BAND.WALL + k),
      );
    }
    for (let m = 0; m < this.grid.h; m++) {
      const p = leftWallSectionTopLeft(m);
      const isDoor = door.tx === 0 && m === door.ty;
      this.wallSprites.push(
        this.scene.add
          .image(p.x, p.y, isDoor ? 'wall_door' : 'wall')
          .setOrigin(0, 0)
          .setScale(ART_SCALE)
          .setFlipX(true)
          .setTint(WALL_TINT)
          .setDepth(BAND.WALL + m),
      );
    }
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

  /**
   * Shared sprite-fitting math for placed furniture AND move-mode ghosts:
   * width tracks the projected footprint diamond, height capped per kind,
   * bottom anchored on the footprint's front vertex.
   */
  layoutSprite(img: Phaser.GameObjects.Image, kind: string, fw: number, fh: number, anchor: Tile): void {
    const cx = anchor.tx + (fw - 1) / 2;
    const cy = anchor.ty + (fh - 1) / 2;
    const c = tileToWorld(cx, cy);
    const bottomY = c.y + (HALF_H * (fw + fh)) / 2;
    const fit = KIND_FIT[kind] ?? { w: 0.85, maxH: 2.5 };
    let scale = ((fw + fh) * HALF_W * fit.w) / img.width;
    const maxH = fit.maxH * 2 * HALF_H;
    if (img.height * scale > maxH) scale = maxH / img.height;
    img.setScale(scale);
    img.setPosition(c.x, bottomY + 2);
  }

  private positionFurniture(img: Phaser.GameObjects.Image, p: Placement): void {
    const { w: fw, h: fh } = p.footprint;
    this.layoutSprite(img, p.kind, fw, fh, p.anchor);
    img.setDepth(entityDepth(furnitureSortKey(p), false));

    // Grounding shadow: soft and tight — the bright style can't carry blobs.
    const c = tileToWorld(p.anchor.tx + (fw - 1) / 2, p.anchor.ty + (fh - 1) / 2);
    const bottomY = c.y + (HALF_H * (fw + fh)) / 2;
    const shadowKey = `sh_${p.id}`;
    (this.scene.children.getByName(shadowKey) as Phaser.GameObjects.Ellipse | null)?.destroy();
    this.scene.add
      .ellipse(c.x, bottomY - 3, img.displayWidth * 0.72, HALF_H * (fw + fh) * 0.42, 0x2a2a2a, 0.13)
      .setName(shadowKey)
      .setDepth(BAND.FLOOR_OVERLAY);
  }
}
