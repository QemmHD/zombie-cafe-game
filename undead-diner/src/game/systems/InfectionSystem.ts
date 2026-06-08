import { Customer } from '../entities/Customer';
import { useGame, toast } from '../store';
import { CFG } from '../config';

/** Spend toxin to infect a seated customer; they transform into a zombie worker
 *  with random stats (a green cloud puff plays at the scene layer). */
export class InfectionSystem {
  world: any;
  constructor(world: any) { this.world = world; }

  infect(c: Customer): boolean {
    if (this.world.zombies.length >= this.world.staff.maxZombies()) { toast('Staff is full — add tables / level up.'); return false; }
    if (!this.world.economy.spendToxin(CFG.infectCost)) { toast('Not enough toxin.'); return false; }
    // free the table & remove the customer
    if (c.table) { c.table.occupiedBy = null; c.table = null; }
    if ((c as any).server) (c as any).server = null;
    const idx = this.world.customers.indexOf(c);
    if (idx >= 0) this.world.customers.splice(idx, 1);
    this.world.removeCustomerSprite(c);
    // green cloud + new zombie
    this.world.greenPuff(c.col, c.row);
    const z = this.world.staff.create(c.col, c.row, {
      speed: 0.8 + Math.random() * 0.8,
      cook: 0.8 + Math.random() * 0.8,
      serve: 0.8 + Math.random() * 0.8
    });
    z.state = 'idle';
    this.world.popup(c.col, c.row - 0.5, 'INFECTED!', 0x7ac74f);
    useGame.getState().patch({ mode: 'none' });
    return true;
  }
}
