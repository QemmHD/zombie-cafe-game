import { shopById } from '../data/furniture';
import { toast, useGame } from '../store';

/** Build mode: the only place the big object buttons appear. Tap a tray item,
 *  then tap a floor tile to place. Exiting returns to normal tap-the-world play. */
export class BuildModeSystem {
  world: any;
  constructor(world: any) { this.world = world; }

  active() { return useGame.getState().mode === 'build'; }
  enter() { useGame.getState().patch({ mode: 'build', buildItem: null, panel: null }); this.world.selection.clear(); }
  exit() { useGame.getState().patch({ mode: 'none', buildItem: null }); }

  tryPlace(col: number, row: number): boolean {
    const item = useGame.getState().buildItem;
    if (!item) { toast('Pick something from the tray first.'); return false; }
    const def = shopById(item);
    if (!def) return false;
    if (!this.world.iso.inUsable(col, row) || this.world.furnitureAt(col, row)) { toast('Can’t build there.'); return false; }
    if (def.unlockLevel > useGame.getState().level) { toast('Unlocks at level ' + def.unlockLevel + '.'); return false; }
    if (!this.world.economy.canAfford(def.cost)) { toast('Not enough money.'); return false; }
    this.world.economy.spend(def.cost);
    this.world.addFurniture(item, col, row);
    this.world.popup(col, row, '-' + def.cost, 0xe7553b);
    this.world.sfx?.('build');
    return true;
  }

  sellAt(col: number, row: number): boolean {
    const f = this.world.furnitureAt(col, row);
    if (!f) return false;
    const def = shopById(f.itemId);
    const refund = def ? Math.round(def.cost * 0.6) : 0;
    this.world.removeFurniture(f);
    this.world.economy.addMoney(refund);
    this.world.popup(col, row, '+' + refund, 0x7ac74f);
    return true;
  }
}
