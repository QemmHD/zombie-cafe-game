import { Furniture } from '../entities/Furniture';
import { shopById } from '../data/furniture';
import { CFG } from '../config';

/** Creates/removes furniture, owns their sprites' placement, and maintains
 *  the pathfinding blocked-tile set (kitchen line routes around). */
export class FurnitureSystem {
  world: any;
  constructor(world: any) { this.world = world; }

  add(itemId: string, col: number, row: number): Furniture | null {
    const item = shopById(itemId);
    if (!item) return null;
    const f = new Furniture(item.id, item.kind, item.texture, col, row);
    f.appeal = item.appeal || 0;
    if (item.station) {
      f.station = item.station;
      f.recipeId = this.world.recipes.defaultFor(item.station);
    }
    this.world.furniture.push(f);
    this.world.spawnFurnitureSprite(f);
    this.refreshBlocked();
    return f;
  }

  remove(f: Furniture) {
    const i = this.world.furniture.indexOf(f);
    if (i >= 0) this.world.furniture.splice(i, 1);
    if (f.occupiedBy) { /* customer will be cleaned up by its manager */ }
    f.sprite?.destroy();
    this.refreshBlocked();
  }

  refreshBlocked() {
    const blocks = this.world.furniture
      .filter((f: Furniture) => f.kind === 'station' || f.kind === 'counter' || f.kind === 'decor')
      .map((f: Furniture) => ({ col: f.col, row: f.row }));
    this.world.pf.setBlocked(blocks);
  }

  at(col: number, row: number): Furniture | undefined {
    return this.world.furniture.find((f: Furniture) => f.col === col && f.row === row);
  }
  tables(): Furniture[] { return this.world.furniture.filter((f: Furniture) => f.kind === 'table'); }
  stations(): Furniture[] { return this.world.furniture.filter((f: Furniture) => f.kind === 'station'); }
  counters(): Furniture[] { return this.world.furniture.filter((f: Furniture) => f.kind === 'counter'); }
  decor(): Furniture[] { return this.world.furniture.filter((f: Furniture) => f.kind === 'decor'); }

  appeal(): number { return this.decor().reduce((a, f) => a + (f.appeal || 0), 0); }

  refund(item: string): number {
    const s = shopById(item);
    return s ? Math.round(s.cost * CFG.refundRate) : 0;
  }
}
