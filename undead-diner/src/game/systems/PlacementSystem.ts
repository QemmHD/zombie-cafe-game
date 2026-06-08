import { shopById } from '../data/furniture';
import { useGame, toast } from '../store';

/** Handles build/edit mode: validates the tile under the pointer and places
 *  furniture, spending money. */
export class PlacementSystem {
  world: any;
  constructor(world: any) { this.world = world; }

  inUsable(col: number, row: number): boolean {
    return col >= 0 && row >= 0 && col < this.world.usableCols && row < this.world.usableRows;
  }
  tileFree(col: number, row: number): boolean {
    return !this.world.furnitureSystem.at(col, row);
  }
  canPlace(col: number, row: number): boolean {
    return this.inUsable(col, row) && this.tileFree(col, row);
  }

  tryPlace(col: number, row: number): boolean {
    const mode = useGame.getState().mode;
    if (!mode.startsWith('build:')) return false;
    const itemId = mode.split(':')[1];
    const item = shopById(itemId);
    if (!item) return false;
    if (!this.canPlace(col, row)) { toast('Can’t build there.'); return false; }
    if (!this.world.economy.canAfford(item.cost)) { toast('Not enough money.'); return false; }
    this.world.economy.spend(item.cost);
    this.world.furnitureSystem.add(itemId, col, row);
    this.world.popup(col, row, '-' + item.cost, 0xe7553b);
    this.world.sfx?.('build');
    return true;
  }
}
