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
  WALL_H,
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

/**
 * The original tints its white wall panel at runtime, and lights the two
 * planes differently (measured off the starter cafe): the NW/left wall is the
 * light warm yellow, the NE/right wall a darker saturated mustard — that
 * ~15% luminance gap is what makes the room corner read at a glance.
 */
const WALL_TINT_LEFT = 0xe6dc70;
const WALL_TINT_RIGHT = 0xc2b843;

/** Sprite keys per furniture kind (M1 set; grows with the catalog art). */
const KIND_TEXTURE: Record<string, string> = {
  stove: 'stove',
  counter: 'counter',
  sink: 'sink',
  table: 'table',
  chair: 'chair',
  fridge: 'fridge',
};

/**
 * Per-kind width multiplier over the projected footprint diamond, plus a
 * display-height cap in tile-heights — keeps near-square source art from
 * towering over the room (a 2x2 diner table is wide, not monumental).
 */
/*
 * Scale metric (audit-locked): characters (CHAR_H 94) must stand >= 1.2x any
 * table's total sprite height, matching the original's chef:table ratio of
 * 1.24. The fridge is the room's ONLY piece taller than a character — its
 * silhouette anchors the back wall. maxH is in tile-heights (x54px).
 */
const KIND_FIT: Record<string, { w: number; maxH: number }> = {
  stove: { w: 0.95, maxH: 1.5 },
  counter: { w: 0.98, maxH: 1.3 },
  sink: { w: 0.85, maxH: 1.3 },
  table: { w: 1.2, maxH: 1.45 },
  chair: { w: 0.6, maxH: 1.25 },
  fridge: { w: 0.72, maxH: 1.95 },
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
    // Original framing: the cafe DOMINATES the screen — the audit measured the
    // reference room at ~90%+ of the frame vs our timid 60%. Overshoot the
    // vertical fit by 25% (top/bottom slivers stay reachable by drag-pan,
    // exactly like the original's scroll) but never crop horizontally.
    const zoom = clamp(Math.min(zw, zh * 1.25), DEFAULT_FIT_ZOOM_FLOOR, ZOOM_MAX);
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
    // Grass blankets the ENTIRE visible world first (the audit found raw
    // canvas on ~40% of the frame) — streets and the floor slab draw over it,
    // so no pan position can ever expose void.
    for (let tx = -6; tx <= this.grid.w + 5; tx++) {
      for (let ty = -6; ty <= this.grid.h + 4; ty++) {
        const c = tileToWorld(tx, ty);
        this.scene.add.image(c.x, c.y, 'grass').setScale(ART_SCALE).setDepth(-30 + (tx + ty) / 1000);
      }
    }
    // Street behind the right-back wall (rows ty = -1 sidewalk, -2 road)
    for (let tx = -5; tx < this.grid.w + 5; tx++) {
      for (const [ty, key] of [[-1, 'sidewalk'], [-2, 'road_stripe'], [-3, 'asphalt']] as const) {
        const c = tileToWorld(tx, ty);
        this.scene.add.image(c.x, c.y, key).setScale(ART_SCALE).setDepth(-20 + (tx + ty) / 1000);
      }
    }
    // Street wrapping behind the left-back wall (columns tx = -1, -2).
    // flipX mirrors the stripe/curb art onto the +ty axis so the center line
    // chains continuously down THIS road too.
    for (let ty = 0; ty < this.grid.h + 5; ty++) {
      for (const [tx, key] of [[-1, 'sidewalk'], [-2, 'road_stripe'], [-3, 'asphalt']] as const) {
        const c = tileToWorld(tx, ty);
        this.scene.add
          .image(c.x, c.y, key)
          .setScale(ART_SCALE)
          .setFlipX(true)
          .setDepth(-20 + (tx + ty) / 1000);
      }
    }
  }

  private buildFloor(): void {
    for (let ty = 0; ty < this.grid.h; ty++) {
      for (let tx = 0; tx < this.grid.w; tx++) {
        const c = tileToWorld(tx, ty);
        // One uniform skin — the original's floor is a single ceramic field
        // (the audit killed our invented checkerboard). The 2x2 grout inside
        // the tile art carries the pattern.
        const img = this.scene.add
          .image(c.x, c.y, 'floor_a')
          .setScale(ART_SCALE)
          .setDepth(BAND.FLOOR + (tx + ty) / 1000);
        this.floorTiles.set(`${tx},${ty}`, img);
      }
    }
    this.buildSlabRim();
  }

  /**
   * The original strokes its ground plane: a dark rim along the floor's two
   * exposed front edges makes the slab sit IN the lot instead of floating on
   * it like a decal.
   */
  private buildSlabRim(): void {
    const w = this.grid.w;
    const h = this.grid.h;
    const east = tileToWorld(w - 1, 0);
    const south = tileToWorld(w - 1, h - 1);
    const west = tileToWorld(0, h - 1);
    const g = this.scene.add.graphics().setDepth(BAND.FLOOR_OVERLAY - 70);
    g.lineStyle(3, 0x34342f, 0.85);
    g.beginPath();
    g.moveTo(east.x + HALF_W, east.y);
    g.lineTo(south.x, south.y + HALF_H);
    g.lineTo(west.x - HALF_W, west.y);
    g.strokePath();
    g.lineStyle(1, 0x6e6e66, 0.8);
    g.beginPath();
    g.moveTo(east.x + HALF_W - 2, east.y - 1);
    g.lineTo(south.x, south.y + HALF_H - 3);
    g.lineTo(west.x - HALF_W + 2, west.y - 1);
    g.strokePath();
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
          .setTint(WALL_TINT_RIGHT) // white panel, tinted — the original's own technique
          .setDepth(BAND.WALL + k),
      );
      if (isDoor) this.addDoorOverlay(p.x, p.y, false, k);
      this.addWallShadow(p.x, p.y, false);
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
          .setTint(WALL_TINT_LEFT)
          .setDepth(BAND.WALL + m),
      );
      if (isDoor) this.addDoorOverlay(p.x, p.y, true, m);
      this.addWallShadow(p.x, p.y, true);
    }
    // Dark seam down the corner fold — the measured original carries a
    // near-black ochre crease where the two planes meet.
    this.scene.add
      .image(0, -HALF_H - WALL_H, 'corner_seam')
      .setOrigin(0.5, 0)
      .setScale(ART_SCALE)
      .setDepth(BAND.WALL + this.grid.w + this.grid.h + 1);
  }

  /**
   * The door frame/leaf renders UNTINTED above its wall section — baked into
   * the tinted panel, its steel-blue glass would multiply into olive mud.
   */
  private addDoorOverlay(x: number, y: number, flip: boolean, section: number): void {
    this.scene.add
      .image(x, y, 'door_overlay')
      .setOrigin(0, 0)
      .setScale(ART_SCALE)
      .setFlipX(flip)
      .setDepth(BAND.WALL + section + 0.5);
  }

  /** Baked contact-shadow strip where the wall meets the floor — grounds the
   * room the way the original's pre-rendered wall art does. */
  private addWallShadow(sectionX: number, sectionY: number, flip: boolean): void {
    this.scene.add
      .image(sectionX, sectionY + WALL_H, 'ao_strip')
      .setOrigin(0, 0)
      .setScale(ART_SCALE)
      .setFlipX(flip)
      .setDepth(BAND.FLOOR_OVERLAY - 60);
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
    // No drop-shadow ellipse: the original grounds furniture with painted
    // grime and contact lines, never a floating gray blob (audit-confirmed).
    (this.scene.children.getByName(`sh_${p.id}`) as Phaser.GameObjects.Ellipse | null)?.destroy();
  }
}
