import { recipeById } from '../data/recipes';
import { toast } from '../store';
import type { ZombieWorker } from '../objects/ZombieWorker';

/** Turns a (selected zombie + tapped target) into a task the zombie performs. */
export class CommandSystem {
  world: any;
  constructor(world: any) { this.world = world; }

  reserve(order: string) {
    const i = this.world.findReadyIndex(order);
    return i < 0 ? null : this.world.readyFood.splice(i, 1)[0];
  }

  cook(z: ZombieWorker, station: any, recipeId: string): boolean {
    const rec = recipeById(recipeId);
    if (!rec) return false;
    if (station.claimedBy && station.claimedBy !== z) { toast('That station is busy.'); return false; }
    z.task = { kind: 'cook', station, recipeId };
    station.claimedBy = z;
    z.state = 'toStation';
    z.path = this.world.pathTo(z, this.world.iso.approach(station.col, station.row));
    return true;
  }

  serve(z: ZombieWorker, customer: any): boolean {
    if (customer.state !== 'sit') { toast('They are not waiting to be served.'); return false; }
    if (customer.server && customer.server !== z) { toast('Someone is already serving them.'); return false; }
    const portion = this.reserve(customer.order);
    if (!portion) { toast('No ' + (recipeById(customer.order)?.name || 'food') + ' ready — cook it first!'); return false; }
    customer.server = z;
    z.task = { kind: 'serve', customer, portion, table: customer.table };
    z.state = 'toCounter';
    z.path = this.world.pathTo(z, this.world.pickupTile());
    return true;
  }

  clean(z: ZombieWorker, table: any): boolean {
    if (!table.dirty) { toast('That table is clean.'); return false; }
    z.task = { kind: 'clean', table };
    (table as any).cleaning = true;
    z.state = 'toDirty';
    z.path = this.world.pathTo(z, this.world.iso.approach(table.col, table.row));
    return true;
  }

  move(z: ZombieWorker, tile: { col: number; row: number }) {
    z.task = { kind: 'move', dest: tile };
    z.state = 'walk';
    z.path = this.world.pathTo(z, tile);
  }
  rest(z: ZombieWorker) {
    z.task = { kind: 'rest' };
    z.state = 'walk';
    z.path = this.world.pathTo(z, { col: z.homeCol, row: z.homeRow });
  }
}
