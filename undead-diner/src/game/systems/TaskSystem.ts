import { recipeById } from '../data/recipes';
import { CFG } from '../config';
import type { ZombieWorker } from '../objects/ZombieWorker';

/** Runs each zombie's task state machine. With Auto on, also assigns tasks to
 *  idle zombies (serve > clean > cook); with Auto off, only player commands act. */
export class TaskSystem {
  world: any;
  cmd: any;
  constructor(world: any, cmd: any) { this.world = world; this.cmd = cmd; }

  update(dt: number) {
    if (this.world.auto) this.autoAssign();
    for (const z of this.world.zombies as ZombieWorker[]) this.step(z, dt);
  }

  autoAssign() {
    for (const z of this.world.zombies as ZombieWorker[]) {
      if (!z.available()) continue;
      const cust = this.world.customers.find((c: any) => c.state === 'sit' && !c.server && this.world.findReadyIndex(c.order) >= 0);
      if (cust) { this.cmd.serve(z, cust); continue; }
      const dirty = this.world.tables().find((t: any) => t.dirty && !t.cleaning);
      if (dirty) { this.cmd.clean(z, dirty); continue; }
      const st = this.pickCookStation();
      if (st) { this.cmd.cook(z, st, st.recipeId); continue; }
    }
  }

  pickCookStation() {
    let best: any = null, need = 0;
    for (const st of this.world.stations()) {
      if (st.claimedBy || st.cooking) continue;
      const rec = recipeById(st.recipeId);
      if (!rec || !this.world.recipes.isUnlocked(rec.id) || !this.world.economy.canAfford(rec.cost)) continue;
      const want = this.world.customers.filter((c: any) => c.state === 'sit' && c.order === rec.id && !c.server).length;
      const buffer = Math.max(1, Math.ceil(this.world.tables().length / 3));
      const ready = this.world.readyFood.filter((p: any) => p.recipeId === rec.id).length;
      const n = (want + buffer) - ready;
      if (n > need) { need = n; best = st; }
    }
    return need > 0 ? best : null;
  }

  step(z: ZombieWorker, dt: number) {
    z.speedTiles = z.spd;
    switch (z.state) {
      case 'idle':
      case 'rest':
        z.energy = Math.min(z.maxEnergy, z.energy + (z.state === 'rest' ? CFG.energyRegen : CFG.energyRegen * 0.25) * dt);
        if (z.state === 'rest' && z.energy >= z.maxEnergy * 0.55) z.state = 'idle';
        if (Math.abs(z.col - z.homeCol) > 0.05 || Math.abs(z.row - z.homeRow) > 0.05) {
          if (!z.path.length) z.path = [{ col: z.homeCol, row: z.homeRow }];
          z.step(dt);
        }
        break;
      case 'walk':
        if (z.step(dt)) { const t = z.task; z.task = null; z.state = t && t.kind === 'rest' ? 'rest' : 'idle'; }
        break;
      case 'toStation': {
        const t = z.task; if (!t || !t.station || t.station.claimedBy !== z) { this.abort(z); break; }
        if (z.step(dt)) {
          const rec = recipeById(t.recipeId!)!;
          if (!this.world.economy.spend(rec.cost)) { this.abort(z); break; }
          z.state = 'cooking'; z.timer = rec.cookTime / z.statCook;
          t.station.cooking = true; t.station.cookTotal = z.timer; t.station.cookTimer = z.timer;
        }
        break;
      }
      case 'cooking': {
        const t = z.task; if (!t || !t.station) { this.abort(z); break; }
        z.timer -= dt; t.station.cookTimer = z.timer;
        if (z.timer <= 0) {
          const rec = recipeById(t.recipeId!)!;
          for (let s = 0; s < rec.servings; s++) this.world.readyFood.push({ recipeId: rec.id, price: rec.price, xp: rec.xp, color: rec.color });
          t.station.cooking = false; t.station.claimedBy = null;
          this.world.popup(t.station.col, t.station.row, '+' + rec.servings + ' ' + rec.emoji, 0x7ac74f);
          z.energy -= CFG.cookCost; z.xp += 1;
          this.done(z);
        }
        break;
      }
      case 'toCounter': {
        const t = z.task; if (!t || !t.customer || t.customer.state !== 'sit') { this.returnPortion(z); this.abort(z); break; }
        if (z.step(dt)) { z.carry = t.portion!; z.state = 'toTable'; z.path = this.world.pathTo(z, this.world.iso.approach(t.table.col, t.table.row)); }
        break;
      }
      case 'toTable': {
        const t = z.task; if (!t || !t.customer || t.customer.state !== 'sit') { this.returnPortion(z); this.abort(z); break; }
        if (z.step(dt)) { z.state = 'serving'; z.timer = 0.4; }
        break;
      }
      case 'serving': {
        z.timer -= dt;
        if (z.timer <= 0) {
          const c = z.task!.customer;
          c.state = 'eating'; c.eatTimer = CFG.eatTime; c.reward = { price: z.carry!.price, xp: z.carry!.xp };
          c.server = null; z.carry = null; z.energy -= CFG.serveCost; z.xp += 1;
          this.world.popup(c.col, c.row, '🍽', 0xffffff);
          this.done(z);
        }
        break;
      }
      case 'toDirty': {
        const t = z.task; if (!t || !t.table || !t.table.dirty) { if (t && t.table) t.table.cleaning = false; this.abort(z); break; }
        if (z.step(dt)) { z.state = 'cleaning'; z.timer = 1.2; }
        break;
      }
      case 'cleaning': {
        z.timer -= dt;
        if (z.timer <= 0) { const tb = z.task!.table; tb.dirty = false; tb.cleaning = false; this.world.popup(tb.col, tb.row, '✨', 0xbfe9ff); z.energy -= CFG.cleanCost; this.done(z); }
        break;
      }
    }
    if (z.energy <= 0) { z.energy = 0; this.returnPortion(z); z.task = null; z.state = 'rest'; z.path = [{ col: z.homeCol, row: z.homeRow }]; }
  }

  returnPortion(z: ZombieWorker) { if (z.carry) { this.world.readyFood.push(z.carry); z.carry = null; } }
  abort(z: ZombieWorker) { z.task = null; z.path = []; z.state = z.energy < 5 ? 'rest' : 'idle'; }
  done(z: ZombieWorker) { z.task = null; z.path = []; z.state = z.energy < 5 ? 'rest' : 'idle'; }
}
