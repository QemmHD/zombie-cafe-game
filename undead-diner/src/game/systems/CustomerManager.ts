import { Customer } from '../entities/Customer';
import { stepAlong } from '../entities/move';
import { recipeById } from '../data/recipes';
import { CFG } from '../config';

/** Spawns customers and runs their enter → sit → order → eat → pay → leave loop. */
export class CustomerManager {
  world: any;
  spawnTimer = 2;
  skins = 6;

  constructor(world: any) { this.world = world; }

  menu(): string[] {
    const ids = new Set<string>();
    for (const st of this.world.furnitureSystem.stations()) {
      const r = recipeById(st.recipeId);
      if (r && this.world.recipes.isUnlocked(r.id)) ids.add(r.id);
    }
    if (ids.size === 0) this.world.recipes.unlocked().forEach((id: string) => ids.add(id));
    return [...ids];
  }

  freeTable() {
    return this.world.furnitureSystem.tables().find((t: any) => !t.occupiedBy && !t.dirty);
  }

  spawn() {
    if (this.world.customers.length >= CFG.maxCustomers) return;
    const table = this.freeTable();
    if (!table) return;
    const menu = this.menu();
    if (menu.length === 0) return;
    const order = menu[(Math.random() * menu.length) | 0];
    const vip = Math.random() < 0.08 + this.world.furnitureSystem.appeal() * 0.003;
    const ent = this.world.entrance;
    const c = new Customer(ent.col, ent.row, order, vip, (Math.random() * this.skins) | 0);
    table.occupiedBy = c;
    c.table = table;
    c.path = this.world.pf.find({ col: ent.col, row: ent.row }, { col: table.col, row: table.row });
    c.state = 'toTable';
    this.world.customers.push(c);
    this.world.spawnCustomerSprite(c);
  }

  update(dt: number) {
    // spawn pacing — faster when rating is high
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      const appeal = this.world.furnitureSystem.appeal();
      let iv = CFG.spawnIntervalBase - this.world.rating.value * 0.25 - appeal * 0.03;
      iv = Math.max(CFG.spawnIntervalMin, iv);
      this.spawnTimer = iv * (0.7 + Math.random() * 0.6);
      this.spawn();
    }

    for (let i = this.world.customers.length - 1; i >= 0; i--) {
      const c: Customer = this.world.customers[i];
      const r: any = c;
      if (c.state === 'toTable') {
        if (stepAlong(c, dt)) { c.state = 'sit'; }
      } else if (c.state === 'sit') {
        c.patience -= dt;
        if (c.patience <= 0) {
          // angry leave
          this.world.popup(c.col, c.row, '😠', 0xe7553b);
          this.world.rating.drop(CFG.ratingDropAngry);
          this.freeAndLeave(c, false);
        }
      } else if (c.state === 'eating') {
        c.eatTimer -= dt;
        if (c.eatTimer <= 0) {
          const rec = recipeById(c.order);
          const price = r.reward?.price ?? (rec ? rec.price : 10);
          const xp = r.reward?.xp ?? (rec ? rec.xp : 3);
          this.world.economy.addMoney(price);
          this.world.xp.add(xp);
          this.world.rating.gain(CFG.ratingGainServe);
          this.world.popup(c.col, c.row - 0.4, '+' + price, c.vip ? 0xffd24a : 0xffe066);
          this.world.coinBurst(c.col, c.row);
          if (c.vip && Math.random() < 0.3) { this.world.economy.addToxin(1); this.world.popup(c.col, c.row - 0.8, '+1 vial', 0xb56bd6); }
          this.freeAndLeave(c, true);
        }
      } else if (c.state === 'leaving') {
        if (stepAlong(c, dt)) {
          this.world.removeCustomerSprite(c);
          this.world.customers.splice(i, 1);
        }
      }
    }
  }

  // Free the table (dirty if they ate) and walk the customer out.
  freeAndLeave(c: Customer, ate: boolean) {
    if (c.table) {
      c.table.occupiedBy = null;
      if (ate) c.table.dirty = true;
      c.table = null;
    }
    c.served = true;
    c.state = 'leaving';
    const ent = this.world.entrance;
    c.path = this.world.pf.find({ col: Math.round(c.col), row: Math.round(c.row) }, { col: ent.col, row: ent.row });
  }
}
