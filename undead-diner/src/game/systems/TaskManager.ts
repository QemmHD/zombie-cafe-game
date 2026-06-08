import { Zombie } from '../entities/Zombie';
import { stepAlong } from '../entities/move';
import { recipeById } from '../data/recipes';
import { CFG } from '../config';

export interface Portion { recipeId: string; price: number; xp: number; color: number; }

/** Assigns cook / serve / clean tasks to idle zombies and runs each zombie's
 *  task state machine (movement, cooking timers, serving, cleaning, energy). */
export class TaskManager {
  world: any;
  constructor(world: any) { this.world = world; }

  update(dt: number) {
    if (useAuto(this.world)) this.assign();
    for (const z of this.world.zombies as Zombie[]) this.step(z, dt);
  }

  /* ----------------------------- assignment --------------------------- */
  assign() {
    for (const z of this.world.zombies as Zombie[]) {
      if (!z.available()) continue;
      const t = this.findServe() || this.findCook() || this.findClean();
      if (!t) continue;
      z.task = t;
      if (t.kind === 'serve') {
        (t as any).customer.server = z;
        z.state = 'toCounter';
        z.path = this.world.pathTo(z, this.world.pickupTile());
      } else if (t.kind === 'cook') {
        t.station.claimedBy = z;
        z.state = 'toStation';
        z.path = this.world.pathTo(z, this.world.approachTile(t.station));
      } else {
        (t as any).table.cleaning = true;
        z.state = 'toDirty';
        z.path = this.world.pathTo(z, this.world.approachTile((t as any).table));
      }
    }
  }

  readyCount(recipeId: string): number {
    return (this.world.readyFood as Portion[]).filter((p) => p.recipeId === recipeId).length;
  }

  findServe(): any {
    for (const c of this.world.customers) {
      if (c.state !== 'sit' || c.server) continue;
      const idx = (this.world.readyFood as Portion[]).findIndex((p) => p.recipeId === c.order);
      if (idx >= 0) {
        const portion = this.world.readyFood.splice(idx, 1)[0];
        return { kind: 'serve', customer: c, portion, table: c.table };
      }
    }
    return null;
  }

  findCook(): any {
    const stations = this.world.furnitureSystem.stations().filter((s: any) => !s.claimedBy && !s.cooking && s.recipeId);
    let best: any = null, bestNeed = 0;
    for (const st of stations) {
      const rec = recipeById(st.recipeId);
      if (!rec || !this.world.recipes.isUnlocked(rec.id)) continue;
      if (!this.world.economy.canAfford(rec.cost)) continue;
      const want = this.world.customers.filter((c: any) => c.state === 'sit' && c.order === rec.id && !c.server).length;
      const buffer = Math.max(1, Math.ceil(this.world.furnitureSystem.tables().length / 3));
      const need = (want + buffer) - this.readyCount(rec.id);
      if (need > bestNeed) { bestNeed = need; best = st; }
    }
    return best && bestNeed > 0 ? { kind: 'cook', station: best, recipeId: best.recipeId } : null;
  }

  findClean(): any {
    const t = this.world.furnitureSystem.tables().find((tb: any) => tb.dirty && !tb.cleaning);
    return t ? { kind: 'clean', table: t } : null;
  }

  /* --------------------------- per-zombie step ------------------------ */
  step(z: Zombie, dt: number) {
    switch (z.state) {
      case 'idle':
      case 'rest':
        // drift home
        if (Math.abs(z.col - z.homeCol) > 0.05 || Math.abs(z.row - z.homeRow) > 0.05) {
          if (!z.path.length) z.path = [{ col: z.homeCol, row: z.homeRow }];
          stepAlong(z, dt);
        }
        break;

      case 'toStation': {
        const t = z.task; if (!t || !t.station || t.station.claimedBy !== z) { this.abort(z); break; }
        if (stepAlong(z, dt)) { z.state = 'cooking'; const rec = recipeById(t.recipeId)!; z.cookTimer = rec.cookTime / z.statCook; t.station.cooking = true; t.station.cookTotal = z.cookTimer; t.station.cookTimer = z.cookTimer; if (!this.world.economy.spend(rec.cost)) { this.abort(z); } }
        break;
      }
      case 'cooking': {
        const t = z.task; if (!t || !t.station) { this.abort(z); break; }
        z.cookTimer -= dt; t.station.cookTimer = z.cookTimer;
        if (z.cookTimer <= 0) {
          const rec = recipeById(t.recipeId)!;
          for (let s = 0; s < rec.servings; s++) this.world.readyFood.push({ recipeId: rec.id, price: rec.price, xp: rec.xp, color: rec.color });
          t.station.cooking = false; t.station.claimedBy = null;
          this.world.popup(t.station.col, t.station.row - 0.6, '+' + rec.servings + ' ' + rec.emoji, 0x7ac74f);
          z.energy -= CFG.cookCost; z.xp += 1;
          this.done(z);
        }
        break;
      }
      case 'toCounter': {
        const t = z.task; if (!t || !t.customer || t.customer.state !== 'sit') { this.returnPortion(z); this.abort(z); break; }
        if (stepAlong(z, dt)) { z.carry = t.portion; z.state = 'toTable'; z.path = this.world.pathTo(z, { col: t.table.col, row: t.table.row }); }
        break;
      }
      case 'toTable': {
        const t = z.task; if (!t || !t.customer || t.customer.state !== 'sit') { this.returnPortion(z); this.abort(z); break; }
        if (stepAlong(z, dt)) {
          const c = t.customer;
          c.state = 'eating'; c.eatTimer = CFG.eatTime;
          (c as any).reward = { price: z.carry!.price, xp: z.carry!.xp };
          z.carry = null; c.server = null;
          z.energy -= CFG.serveCost; z.xp += 1;
          this.world.popup(c.col, c.row - 0.4, '🍽', 0xffffff);
          this.done(z);
        }
        break;
      }
      case 'toDirty': {
        const t = z.task; if (!t || !t.table || !t.table.dirty) { if (t?.table) t.table.cleaning = false; this.abort(z); break; }
        if (stepAlong(z, dt)) { z.state = 'clean'; z.cookTimer = 1.2; }
        break;
      }
      case 'clean': {
        const t = z.task;
        z.cookTimer -= dt;
        if (z.cookTimer <= 0) {
          if (t?.table) { t.table.dirty = false; t.table.cleaning = false; }
          this.world.popup(t.table.col, t.table.row - 0.4, '✨', 0xbfe9ff);
          z.energy -= CFG.cleanCost;
          this.done(z);
        }
        break;
      }
    }
    if (z.energy <= 0) { z.energy = 0; this.returnPortion(z); z.state = 'rest'; z.task = null; }
  }

  returnPortion(z: Zombie) { if (z.carry) { this.world.readyFood.push(z.carry); z.carry = null; } }
  abort(z: Zombie) { z.task = null; z.state = z.energy < 5 ? 'rest' : 'idle'; z.path = []; }
  done(z: Zombie) { z.task = null; z.state = z.energy < 5 ? 'rest' : 'idle'; z.path = []; }
}

function useAuto(world: any): boolean {
  return world.auto;
}
