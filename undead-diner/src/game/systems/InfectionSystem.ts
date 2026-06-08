import { CFG } from '../config';
import { toast, useGame } from '../store';

/** Tap a customer -> Infect popup -> spend toxin -> green smoke -> new zombie. */
export class InfectionSystem {
  world: any;
  constructor(world: any) { this.world = world; }

  infect(c: any): boolean {
    if (this.world.zombies.length >= this.world.maxZombies()) { toast('Staff is full — add tables / level up.'); return false; }
    if (!this.world.economy.spendToxin(CFG.infectCost)) { toast('Not enough toxin (need ' + CFG.infectCost + ').'); return false; }
    if (c.table) { c.table.occupiedBy = null; c.table = null; }
    this.world.removeCustomer(c);
    this.world.greenPuff(c.col, c.row);
    this.world.createZombie(c.col, c.row, {
      speed: 0.8 + Math.random() * 0.8, cook: 0.8 + Math.random() * 0.8,
      serve: 0.8 + Math.random() * 0.8, clean: 0.8 + Math.random() * 0.8
    });
    this.world.popup(c.col, c.row, 'INFECTED!', 0x7ac74f);
    useGame.getState().patch({ customerPopup: null });
    return true;
  }
}
