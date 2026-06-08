import Phaser from 'phaser';
import { CFG } from '../config';
import { IsoWorld, Tile } from '../iso/IsoWorld';
import { PathfindingSystem } from '../systems/PathfindingSystem';
import { EconomySystem } from '../systems/EconomySystem';
import { XPLevelSystem, xpToNext } from '../systems/XPLevelSystem';
import { RatingSystem } from '../systems/RatingSystem';
import { RecipeSystem } from '../systems/RecipeSystem';
import { SaveSystem } from '../systems/SaveSystem';
import { SelectionSystem } from '../systems/SelectionSystem';
import { CommandSystem } from '../systems/CommandSystem';
import { TaskSystem } from '../systems/TaskSystem';
import { InfectionSystem } from '../systems/InfectionSystem';
import { BuildModeSystem } from '../systems/BuildModeSystem';
import { RaidSystem } from '../systems/RaidSystem';
import { ZombieWorker } from '../objects/ZombieWorker';
import { Customer } from '../objects/Customer';
import { Table, Counter, Station, Decor } from '../objects/Furniture';
import { recipeById, recipesForStation } from '../data/recipes';
import { shopById } from '../data/furniture';
import { useGame, toast } from '../store';
import { bus } from '../eventBus';

type Furniture = Table | Counter | Station | Decor;
interface Portion { recipeId: string; price: number; xp: number; color: number; }

export default class GameScene extends Phaser.Scene {
  iso!: IsoWorld;
  pf!: PathfindingSystem;
  economy = new EconomySystem();
  xp = new XPLevelSystem();
  rating = new RatingSystem();
  recipes = new RecipeSystem();
  saveSys = new SaveSystem();
  selection!: SelectionSystem;
  command!: CommandSystem;
  taskSys!: TaskSystem;
  infection!: InfectionSystem;
  build!: BuildModeSystem;
  raid!: RaidSystem;

  zombies: ZombieWorker[] = [];
  customers: Customer[] = [];
  furniture: Furniture[] = [];
  readyFood: Portion[] = [];

  auto = true;
  entrance!: Tile;
  private floorG!: Phaser.GameObjects.Graphics;
  private fxG!: Phaser.GameObjects.Graphics;
  private bubbles = new Map<number, Phaser.GameObjects.Text>();
  private steamFx = new Map<number, any>();
  private flyFx = new Map<number, any>();
  private decals: any[] = [];
  private spawnT = 1.5;
  private autosaveT = 0;

  constructor() { super('Game'); }

  create() {
    this.iso = new IsoWorld(CFG.designW / 2 - 10, 150);
    this.pf = new PathfindingSystem(this.iso as any);
    this.selection = new SelectionSystem(this);
    this.command = new CommandSystem(this);
    this.taskSys = new TaskSystem(this, this.command);
    this.infection = new InfectionSystem(this);
    this.build = new BuildModeSystem(this);
    this.raid = new RaidSystem(this);
    this.xp.onLevelUp = (lvl) => { this.recipes.syncUnlocked(); toast('Level ' + lvl + '!'); this.sfx('level'); for (const z of this.zombies) if (z.available()) this.oneShot(z, 'zombie_celebrate', 0.8); };

    this.cameras.main.setBackgroundColor('#241c33');
    this.floorG = this.add.graphics().setDepth(-100000);
    this.fxG = this.add.graphics().setDepth(900000);

    const data = this.saveSys.read();
    if (data) this.applyData(data); else this.newGame();
    this.refreshBlocked();
    this.drawRoom();
    this.recipes.syncUnlocked();
    this.syncRoster();

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onTap(p));
    this.bindCommands();
  }

  /* ------------------------------ world API ---------------------------- */
  tables() { return this.furniture.filter((f) => f.kind === 'table') as Table[]; }
  stations() { return this.furniture.filter((f) => f.kind === 'station') as Station[]; }
  counters() { return this.furniture.filter((f) => f.kind === 'counter') as Counter[]; }
  furnitureAt(col: number, row: number) { return this.furniture.find((f) => f.col === col && f.row === row); }
  appeal() { return (this.furniture.filter((f) => f.kind === 'decor') as Decor[]).reduce((a, d) => a + d.appeal, 0); }
  maxZombies() { return 4 + Math.floor(this.tables().length / 2) + Math.floor(useGame.getState().level / 2); }
  findReadyIndex(recipeId: string) { return this.readyFood.findIndex((p) => p.recipeId === recipeId); }
  round(t: { col: number; row: number }): Tile { return { col: Math.round(t.col), row: Math.round(t.row) }; }
  pathTo(ent: { col: number; row: number }, tile: Tile): Tile[] { return this.pf.find(this.round(ent), tile); }
  pickupTile(): Tile { const c = this.counters()[0]; if (c) return this.iso.approach(c.col, c.row); const s = this.stations()[0]; if (s) return this.iso.approach(s.col, s.row); return { col: 0, row: 1 }; }

  refreshBlocked() {
    this.iso.usableCols = this.iso.usableCols; // keep
    const blocks = this.furniture.filter((f) => f.kind === 'station' || f.kind === 'counter' || f.kind === 'decor').map((f) => ({ col: f.col, row: f.row }));
    this.iso.setBlocked(blocks);
    this.pf.setBlocked(blocks);
  }

  /* ------------------------------ setup -------------------------------- */
  newGame() {
    useGame.getState().patch({ money: CFG.startMoney, toxin: CFG.startToxin, flesh: CFG.startFlesh, level: 1, xp: 0, xpToNext: xpToNext(1), rating: 3, expansion: 0, prestige: 0, auto: true, mode: 'none' });
    this.iso.usableCols = CFG.startUsableCols; this.iso.usableRows = CFG.startUsableRows;
    this.entrance = { col: CFG.startUsableCols - 1, row: CFG.startUsableRows - 1 };
    this.furniture = []; this.zombies = []; this.customers = []; this.readyFood = []; this.auto = true;
    this.addFurniture('counter', 1, 0);
    this.addFurniture('stove', 0, 1);
    this.addFurniture('table', 3, 2);
    this.addFurniture('table', 5, 2);
    this.addFurniture('table', 4, 4);
    this.createZombie(0.7, 2.3); this.createZombie(1.5, 2.0);
  }

  createZombie(col: number, row: number, stats?: any): ZombieWorker {
    const z = new ZombieWorker(col, row, stats);
    z.homeCol = Math.max(0, Math.min(2, Math.round(col))); z.homeRow = Math.round(row);
    z.sprite = this.add.sprite(0, 0, 'zombie_idle', 0).setOrigin(0.5, 0.92).setScale(CFG.charScale);
    (z as any).anim = '';
    z.sprite.play('zombie_idle');
    this.zombies.push(z); this.syncRoster();
    return z;
  }
  setAnim(o: any, key: string) {
    if ((o as any).lock > 0) return;          // one-shot anims (infect/celebrate) hold
    if ((o as any).anim !== key) { (o as any).anim = key; o.sprite.play(key, true); }
  }
  oneShot(z: any, key: string, dur: number) { z.sprite.play(key); (z as any).anim = key; (z as any).lock = dur; }

  // Maps a zombie's task/state to its animation key (the visible state machine).
  zombieAnim(z: ZombieWorker): string {
    switch (z.state) {
      case 'cooking': return 'zombie_cook';
      case 'cleaning': return 'zombie_clean';
      case 'serving': return 'zombie_carry';
      case 'rest': return 'zombie_tired';
      case 'idle': return z.energy < CFG.tiredThreshold ? 'zombie_tired' : 'zombie_idle';
      default: return z.carry ? 'zombie_carry' : 'zombie_walk';   // toStation/toCounter/toTable/toDirty/walk
    }
  }
  custAnim(c: Customer): string {
    const s = c.skin;
    if (c.state === 'toTable') return 'cust' + s + '_walk';
    if (c.state === 'leaving') return 'cust' + s + '_leave';
    if (c.state === 'eating') return 'cust' + s + '_eat';
    if (c.state === 'sit') return c.patience < CFG.customerPatience * 0.3 ? 'cust' + s + '_angry' : 'cust' + s + '_sit';
    return 'cust' + s + '_idle';
  }

  addFurniture(itemId: string, col: number, row: number): Furniture {
    const def = shopById(itemId)!;
    let f: Furniture;
    if (def.kind === 'table') f = new Table(col, row);
    else if (def.kind === 'counter') f = new Counter(col, row);
    else if (def.kind === 'station') f = new Station(col, row, itemId, def.station!, this.recipes.defaultFor(def.station!));
    else f = new Decor(col, row, itemId, def.appeal || 0);
    const p = this.iso.toScreen(col + 0.5, row + 0.5);
    const scale = f.kind === 'station' ? 0.66 : f.kind === 'counter' ? 0.66 : f.kind === 'table' ? 0.62 : f.kind === 'chair' ? 0.6 : 0.62;
    f.sprite = this.add.sprite(p.x, p.y, def.texture).setOrigin(0.5, 0.84).setScale(scale);
    f.sprite.setDepth(this.iso.depth(col, row));
    this.furniture.push(f);
    this.refreshBlocked();
    return f;
  }
  removeFurniture(f: Furniture) { const i = this.furniture.indexOf(f); if (i >= 0) this.furniture.splice(i, 1); f.sprite?.destroy(); (f as any).coinSprite?.destroy(); this.refreshBlocked(); }

  /* ------------------------------ room art ----------------------------- */
  drawRoom() {
    const g = this.floorG; g.clear();
    const top = this.iso.toScreen(0, 0), rE = this.iso.toScreen(this.iso.cols, 0), lE = this.iso.toScreen(0, this.iso.rows);
    const wallH = 78;
    // walls (warm cream) with windows
    g.fillStyle(0xb9a9c9); g.beginPath(); g.moveTo(top.x, top.y); g.lineTo(rE.x, rE.y); g.lineTo(rE.x, rE.y - wallH); g.lineTo(top.x, top.y - wallH); g.closePath(); g.fillPath();
    g.fillStyle(0xa394b8); g.beginPath(); g.moveTo(top.x, top.y); g.lineTo(lE.x, lE.y); g.lineTo(lE.x, lE.y - wallH); g.lineTo(top.x, top.y - wallH); g.closePath(); g.fillPath();
    g.fillStyle(0x8fc7e8, 0.55);
    for (const [end, _s] of [[rE, 1], [lE, -1]] as [any, number][]) {
      for (let i = 0; i < 2; i++) {
        const t0 = 0.28 + i * 0.36, t1 = t0 + 0.18;
        const x0 = top.x + (end.x - top.x) * t0, y0 = top.y + (end.y - top.y) * t0;
        const x1 = top.x + (end.x - top.x) * t1, y1 = top.y + (end.y - top.y) * t1;
        const wy = wallH * 0.62, wh = wallH * 0.36;
        g.beginPath(); g.moveTo(x0, y0 - wy); g.lineTo(x1, y1 - wy); g.lineTo(x1, y1 - wy - wh); g.lineTo(x0, y0 - wy - wh); g.closePath(); g.fillPath();
      }
    }
    g.lineStyle(4, 0x6a5a7a); g.beginPath(); g.moveTo(rE.x, rE.y); g.lineTo(top.x, top.y); g.lineTo(lE.x, lE.y); g.strokePath();
    // white café floor tiles with grout
    for (let r = 0; r < this.iso.rows; r++) for (let c = 0; c < this.iso.cols; c++) {
      const a = this.iso.toScreen(c, r), b = this.iso.toScreen(c + 1, r), d = this.iso.toScreen(c + 1, r + 1), e = this.iso.toScreen(c, r + 1);
      const usable = this.iso.inUsable(c, r);
      const col = usable ? (((c + r) % 2 === 0) ? 0xf4f1ea : 0xdfe3e6) : 0x4a4356;
      g.fillStyle(col); g.lineStyle(1, 0xc7c2bb, usable ? 0.9 : 0.2);
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(d.x, d.y); g.lineTo(e.x, e.y); g.closePath(); g.fillPath(); g.strokePath();
    }
    // entrance mat / door
    const m = this.iso.toScreen(this.entrance.col + 0.5, this.entrance.row + 0.5);
    g.fillStyle(0x7b241c); g.fillEllipse(m.x, m.y, 46, 22);
  }

  /* ------------------------------ tapping ------------------------------ */
  onTap(p: Phaser.Input.Pointer) {
    const tile = this.round(this.iso.toTile(p.worldX, p.worldY));
    const st = useGame.getState();

    if (st.mode === 'build') { if (st.buildItem) this.build.tryPlace(tile.col, tile.row); else { const f = this.furnitureAt(tile.col, tile.row); if (f) this.build.sellAt(tile.col, tile.row); } return; }

    // close any open popups on a world tap
    if (st.stovePopup || st.customerPopup) { useGame.getState().patch({ stovePopup: null, customerPopup: null }); return; }

    const z = this.pickZombie(p);
    if (z) { this.selection.toggle(z); return; }

    const c = this.pickCustomer(p);
    if (c) {
      const sel = this.selection.selected;
      if (sel && (c.state === 'sit')) { this.command.serve(sel, c); this.selection.clear(); }
      else useGame.getState().patch({ customerPopup: c.id, customerOrder: c.order });
      return;
    }

    const f = this.furnitureAt(tile.col, tile.row);
    if (f) {
      if (f.kind === 'table') {
        const t = f as Table;
        if (t.coins > 0) { this.collectTable(t); return; }
        if (t.dirty && this.selection.selected) { this.command.clean(this.selection.selected, t); this.selection.clear(); return; }
        return;
      }
      if (f.kind === 'station') { useGame.getState().patch({ stovePopup: f.id, stovePopupType: (f as Station).station }); return; }
      return;
    }

    // empty tile
    if (this.selection.selected && this.iso.inUsable(tile.col, tile.row)) {
      if (tile.col === this.entrance.col && tile.row === this.entrance.row) this.command.rest(this.selection.selected);
      else this.command.move(this.selection.selected, tile);
    }
  }

  pickZombie(p: Phaser.Input.Pointer): ZombieWorker | null {
    let best: ZombieWorker | null = null, bd = 40;
    for (const z of this.zombies) { const s = this.iso.toScreen(z.col + 0.5, z.row + 0.5); const d = Phaser.Math.Distance.Between(p.worldX, p.worldY, s.x, s.y - 30); if (d < bd) { bd = d; best = z; } }
    return best;
  }
  pickCustomer(p: Phaser.Input.Pointer): Customer | null {
    let best: Customer | null = null, bd = 40;
    for (const c of this.customers) { if (c.state !== 'sit' && c.state !== 'eating') continue; const s = this.iso.toScreen(c.col + 0.5, c.row + 0.5); const d = Phaser.Math.Distance.Between(p.worldX, p.worldY, s.x, s.y - 30); if (d < bd) { bd = d; best = c; } }
    return best;
  }
  collectTable(t: Table) {
    this.economy.addMoney(t.coins);
    this.popup(t.col, t.row, '+' + t.coins, 0xffd24a);
    this.coinBurst(t.col, t.row);
    t.coins = 0; (t as any).coinSprite?.destroy(); (t as any).coinSprite = null;
    this.sfx('coin');
  }

  /* ------------------------------ commands ----------------------------- */
  bindCommands() {
    bus.on('command', (cmd: any) => {
      const g = useGame.getState();
      switch (cmd.type) {
        case 'toggleBuild': if (g.mode === 'build') this.build.exit(); else this.build.enter(); break;
        case 'buildItem': useGame.getState().patch({ buildItem: cmd.item }); break;
        case 'toggleAuto': this.auto = !this.auto; useGame.getState().patch({ auto: this.auto }); toast('Auto ' + (this.auto ? 'ON' : 'OFF')); break;
        case 'togglePause': useGame.getState().patch({ paused: !g.paused }); break;
        case 'toggleSound': useGame.getState().patch({ sound: !g.sound }); break;
        case 'save': this.doSave(); toast('Saved.'); break;
        case 'reset': if (confirm('Start a brand new diner? Save will be erased.')) { this.saveSys.clear(); this.scene.restart(); } break;
        case 'chooseRecipe': { const s = this.furniture.find((f) => f.id === cmd.stationId) as Station; if (s) { s.recipeId = cmd.recipeId; const sel = this.selection.selected; if (sel && sel.available()) { this.command.cook(sel, s, cmd.recipeId); this.selection.clear(); toast('Cooking ' + recipeById(cmd.recipeId)?.name); } else toast((recipeById(cmd.recipeId)?.name || 'Recipe') + ' set — Auto will cook it'); } useGame.getState().patch({ stovePopup: null }); break; }
        case 'infect': { const c = this.customers.find((cc) => cc.id === cmd.id); if (c) this.infection.infect(c); break; }
        case 'feedZombie': { const z = this.zombies.find((zz) => zz.id === cmd.id); if (z) this.feed(z); break; }
        case 'buyFlesh': if (this.economy.spendToxin(1)) { this.economy.addFlesh(CFG.fleshPerToxin); toast('+' + CFG.fleshPerToxin + ' flesh'); } else toast('Need 1 toxin.'); break;
        case 'buyToxin': this.economy.addToxin(CFG.toxinPerAdd); toast('+' + CFG.toxinPerAdd + ' toxin'); break;
        case 'expand': this.expand(); break;
        case 'franchise': this.franchise(); break;
        case 'raidStart': { const res = this.raid.run(cmd.nodeId, cmd.zombies); bus.emit('raidResult', res); break; }
      }
    });
  }
  feed(z: ZombieWorker) {
    if (!this.economy.spendFlesh(1)) { toast('No flesh! Raid or buy some.'); return; }
    z.energy = Math.min(z.maxEnergy, z.energy + CFG.fleshFeed);
    if (z.state === 'rest' && z.energy > z.maxEnergy * 0.3) z.state = 'idle';
    this.popup(z.col, z.row, '+energy', 0x7ac74f); this.syncRoster();
  }
  expand() {
    if (this.iso.usableCols >= this.iso.cols && this.iso.usableRows >= this.iso.rows) { toast('Diner at full size!'); return; }
    const e = useGame.getState().expansion;
    const cost = Math.round(400 * Math.pow(e + 1, 1.3)), tox = 5 * (e + 1);
    if (!this.economy.canAfford(cost) || this.economy.toxin < tox) { toast('Need ' + cost + ' money + ' + tox + ' toxin.'); return; }
    this.economy.spend(cost); this.economy.addToxin(-tox);
    this.iso.usableCols = Math.min(this.iso.cols, this.iso.usableCols + 1);
    this.iso.usableRows = Math.min(this.iso.rows, this.iso.usableRows + 1);
    this.entrance = { col: this.iso.usableCols - 1, row: this.iso.usableRows - 1 };
    useGame.getState().patch({ expansion: e + 1 }); this.drawRoom(); toast('Diner expanded!');
  }
  franchise() {
    if (useGame.getState().level < 10) { toast('Reach level 10 to franchise.'); return; }
    const pr = useGame.getState().prestige + 1;
    [...this.customers].forEach((c) => this.removeCustomer(c));
    this.zombies.forEach((z) => z.sprite?.destroy());
    this.furniture.forEach((f) => { f.sprite?.destroy(); (f as any).coinSprite?.destroy(); });
    this.bubbles.forEach((b) => b.destroy()); this.bubbles.clear();
    this.newGame();
    useGame.getState().patch({ prestige: pr });
    this.refreshBlocked(); this.drawRoom(); this.syncRoster();
    toast('Franchised! Prestige ' + pr);
  }

  /* ------------------------------ fx ----------------------------------- */
  popup(col: number, row: number, text: string, color: number) {
    const p = this.iso.toScreen(col + 0.5, row + 0.5);
    const t = this.add.text(p.x, p.y - 36, text, { fontFamily: 'Baloo 2, sans-serif', fontSize: '17px', color: '#' + color.toString(16).padStart(6, '0'), stroke: '#231a30', strokeThickness: 4 }).setOrigin(0.5).setDepth(1e6);
    this.tweens.add({ targets: t, y: t.y - 28, alpha: 0, duration: 950, onComplete: () => t.destroy() });
  }
  coinBurst(col: number, row: number) {
    const p = this.iso.toScreen(col + 0.5, row + 0.5);
    for (let i = 0; i < 6; i++) { const c = this.add.image(p.x, p.y - 24, 'coin').setDepth(1e6).setScale(0.7); this.tweens.add({ targets: c, x: p.x + (Math.random() - 0.5) * 48, y: p.y - 34 - Math.random() * 26, alpha: 0, duration: 700, onComplete: () => c.destroy() }); }
  }
  greenPuff(col: number, row: number) {
    const p = this.iso.toScreen(col + 0.5, row + 0.5);
    const s = this.add.sprite(p.x, p.y - 28, 'smoke', 0).setDepth(1e6).setScale(1.2);
    s.play('smoke'); s.once('animationcomplete', () => s.destroy());
    this.tweens.add({ targets: s, scale: 1.8, alpha: 0, duration: 700 });
  }
  sfx(kind: string) {
    if (!useGame.getState().sound) return;
    try {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext; if (!AC) return;
      (this as any)._ac = (this as any)._ac || new AC(); const ac = (this as any)._ac;
      const o = ac.createOscillator(), gn = ac.createGain();
      o.type = 'square'; o.frequency.value = kind === 'level' ? 660 : kind === 'coin' ? 880 : kind === 'build' ? 320 : 520;
      gn.gain.setValueAtTime(0.0001, ac.currentTime); gn.gain.exponentialRampToValueAtTime(0.07, ac.currentTime + 0.01); gn.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.15);
      o.connect(gn); gn.connect(ac.destination); o.start(); o.stop(ac.currentTime + 0.16);
    } catch {}
  }

  /* ------------------------------ customers ---------------------------- */
  menu(): string[] {
    const ids = new Set<string>();
    for (const s of this.stations()) { const r = recipeById(s.recipeId); if (r && this.recipes.isUnlocked(r.id)) ids.add(r.id); }
    if (!ids.size) this.recipes.unlocked().forEach((id) => ids.add(id));
    return [...ids];
  }
  freeTable() { return this.tables().find((t) => !t.occupiedBy && !t.dirty && t.coins === 0); }
  spawnCustomer() {
    if (this.customers.length >= CFG.maxCustomers) return;
    const table = this.freeTable(); if (!table) return;
    const menu = this.menu(); if (!menu.length) return;
    const order = menu[(Math.random() * menu.length) | 0];
    const vip = Math.random() < 0.08 + this.appeal() * 0.003;
    const c = new Customer(this.entrance.col, this.entrance.row, order, vip, (Math.random() * 3) | 0);
    table.occupiedBy = c; c.table = table;
    c.path = this.pathTo({ col: this.entrance.col, row: this.entrance.row }, { col: table.col, row: table.row });
    c.state = 'toTable';
    c.sprite = this.add.sprite(0, 0, 'cust' + c.skin + '_walk', 0).setOrigin(0.5, 0.92).setScale(CFG.charScale);
    (c as any).anim = '';
    this.customers.push(c);
  }
  removeCustomer(c: Customer) { c.sprite?.destroy(); const b = this.bubbles.get(c.id); if (b) { b.destroy(); this.bubbles.delete(c.id); } const i = this.customers.indexOf(c); if (i >= 0) this.customers.splice(i, 1); }

  updateCustomers(dt: number) {
    this.spawnT -= dt;
    if (this.spawnT <= 0) { let iv = CFG.spawnIntervalBase - this.rating.value * 0.25 - this.appeal() * 0.03; iv = Math.max(CFG.spawnIntervalMin, iv); this.spawnT = iv * (0.7 + Math.random() * 0.6); this.spawnCustomer(); }
    for (let i = this.customers.length - 1; i >= 0; i--) {
      const c = this.customers[i];
      if (c.state === 'toTable') { if (c.step(dt)) { c.state = 'sit'; c.facing = -1; } }
      else if (c.state === 'sit') { c.patience -= dt; if (c.patience <= 0) { this.popup(c.col, c.row, '😠', 0xe7553b); this.rating.drop(CFG.ratingDropAngry); this.leave(c, false); } }
      else if (c.state === 'eating') { c.eatTimer -= dt; if (c.eatTimer <= 0) this.pay(c); }
      else if (c.state === 'leaving') { if (c.step(dt)) this.removeCustomer(c); }
    }
  }
  pay(c: Customer) {
    const rec = recipeById(c.order);
    const price = c.reward?.price ?? (rec ? rec.price : 10);
    const xp = c.reward?.xp ?? (rec ? rec.xp : 3);
    this.xp.add(xp); this.rating.gain(CFG.ratingGainServe);
    if (c.vip && Math.random() < 0.3) { this.economy.addToxin(1); this.popup(c.col, c.row - 0.6, '+1 vial', 0xb56bd6); }
    const t = c.table as Table;
    this.leave(c, true);
    if (t) {
      if (this.auto) { this.economy.addMoney(price); this.popup(t.col, t.row, '+' + price, 0xffd24a); this.coinBurst(t.col, t.row); }
      else { t.coins += price; if (!(t as any).coinSprite) { const sp = this.iso.toScreen(t.col + 0.5, t.row + 0.5); (t as any).coinSprite = this.add.image(sp.x, sp.y - 26, 'coin').setDepth(this.iso.depth(t.col, t.row) + 50); } }
    }
  }
  leave(c: Customer, ate: boolean) {
    if (c.table) { c.table.occupiedBy = null; if (ate) c.table.dirty = true; c.table = null; }
    if (c.server) c.server = null;
    c.state = 'leaving';
    c.path = this.pathTo({ col: Math.round(c.col), row: Math.round(c.row) }, this.entrance);
  }

  /* ------------------------------ loop --------------------------------- */
  update(_t: number, delta: number) {
    const dt = Math.min(0.05, delta / 1000);
    if (!useGame.getState().paused) {
      this.raid.update(dt);
      this.updateCustomers(dt);
      this.taskSys.update(dt);
      this.autosaveT += dt; if (this.autosaveT > CFG.autosave) { this.autosaveT = 0; this.doSave(); }
      for (const z of this.zombies) if ((z as any).lock > 0) (z as any).lock -= dt;
      if ((this as any)._rt === undefined) (this as any)._rt = 0; (this as any)._rt += dt; if ((this as any)._rt > 0.5) { (this as any)._rt = 0; this.syncRoster(); }
      if ((this as any)._dt === undefined) (this as any)._dt = 0; (this as any)._dt += dt; if ((this as any)._dt > 0.15) { (this as any)._dt = 0; this.pushDebug(); }
    }
    this.render();
  }

  render() {
    const g = this.fxG; g.clear();
    // furniture depth + dirty texture
    for (const f of this.furniture) { if (f.kind === 'table') f.sprite.setTexture((f as Table).dirty ? 'table_dirty' : 'table_clean'); f.sprite?.setDepth(this.iso.depth(f.col, f.row)); }
    // characters — shadow + position + depth + STATE-DRIVEN animation
    for (const c of this.customers) {
      this.placeChar(c, g);
      this.setAnim(c, this.custAnim(c));
    }
    for (const z of this.zombies) {
      this.placeChar(z, g);
      this.setAnim(z, this.zombieAnim(z));
    }
    // selection ring (the command surface)
    const sel = this.selection.selected;
    if (sel) { const p = this.iso.toScreen(sel.col + 0.5, sel.row + 0.5); const r = 24 + Math.sin(this.time.now / 120) * 2; g.lineStyle(4, 0xffd24a); g.strokeEllipse(p.x, p.y, r * 1.6, r * 0.7); }
    // cooking steam + bars
    for (const s of this.stations()) {
      const p = this.iso.toScreen(s.col + 0.5, s.row + 0.5);
      if (s.cooking) {
        if (s.cookTotal > 0) this.bar(g, p.x, p.y - 74, 34, 1 - s.cookTimer / s.cookTotal, 0xffd24a);
        let st = this.steamFx.get(s.id);
        if (!st) { st = this.add.sprite(p.x, p.y - 64, 'steam', 0).setDepth(1e6).play('steam'); this.steamFx.set(s.id, st); }
        st.setPosition(p.x, p.y - 64);
      } else { const st = this.steamFx.get(s.id); if (st) { st.destroy(); this.steamFx.delete(s.id); } }
    }
    // flies over dirty tables
    for (const t of this.tables()) {
      const p = this.iso.toScreen(t.col + 0.5, t.row + 0.5);
      if (t.dirty) { let fl = this.flyFx.get(t.id); if (!fl) { fl = this.add.sprite(p.x, p.y - 30, 'fly', 0).setDepth(1e6).play('fly'); this.flyFx.set(t.id, fl); } fl.setPosition(p.x + Math.sin(this.time.now / 200) * 10, p.y - 30 + Math.cos(this.time.now / 160) * 6); }
      else { const fl = this.flyFx.get(t.id); if (fl) { fl.destroy(); this.flyFx.delete(t.id); } }
    }
    // customers: bubble + patience ring
    for (const c of this.customers) { const p = this.iso.toScreen(c.col + 0.5, c.row + 0.5); if (c.state === 'sit') this.ring(g, p.x + 18, p.y - 56, c.patience / (CFG.customerPatience * (c.vip ? 1.1 : 1))); this.bubble(c, p); }
    // zombies: energy bar + carried plate
    for (const z of this.zombies) { const p = this.iso.toScreen(z.col + 0.5, z.row + 0.5); if (z.busy()) this.bar(g, p.x, p.y - 80, 24, z.energy / z.maxEnergy, z.energy / z.maxEnergy > 0.3 ? 0x7ac74f : 0xe7553b); if (z.carry) { const rec = recipeById(z.carry.recipeId); g.fillStyle(0xfbfdfe); g.fillEllipse(p.x + z.facing * 13, p.y - 40, 14, 7); if (rec) { g.fillStyle(rec.color); g.fillEllipse(p.x + z.facing * 13, p.y - 42, 6, 4); } } }
  }
  placeChar(c: any, g: Phaser.GameObjects.Graphics) {
    if (!c.sprite) return;
    const p = this.iso.toScreen(c.col + 0.5, c.row + 0.5);
    g.fillStyle(0x000000, 0.22); g.fillEllipse(p.x, p.y + 2, 32, 13);
    c.sprite.setPosition(p.x, p.y); c.sprite.setDepth(this.iso.depth(c.col, c.row) + 5); c.sprite.setFlipX(c.facing < 0);
  }
  bar(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, f: number, color: number) { g.fillStyle(0x000000, 0.5); g.fillRect(x - w / 2, y, w, 5); g.fillStyle(color); g.fillRect(x - w / 2, y, w * Phaser.Math.Clamp(f, 0, 1), 5); }
  ring(g: Phaser.GameObjects.Graphics, x: number, y: number, f: number) { const col = f > 0.4 ? 0x7ac74f : f > 0.18 ? 0xffd24a : 0xe7553b; g.lineStyle(3, col); g.beginPath(); g.arc(x, y, 10, -Math.PI / 2, -Math.PI / 2 + Phaser.Math.Clamp(f, 0, 1) * Math.PI * 2, false); g.strokePath(); }
  bubble(c: Customer, p: { x: number; y: number }) {
    const show = c.state === 'sit'; let b = this.bubbles.get(c.id);
    if (show) { const rec = recipeById(c.order); if (!b) { b = this.add.text(0, 0, rec ? rec.emoji : '🍴', { fontSize: '20px' }).setOrigin(0.5).setDepth(1e6); this.bubbles.set(c.id, b); } b.setPosition(p.x + 18, p.y - 54); }
    else if (b) { b.destroy(); this.bubbles.delete(c.id); }
  }

  /* ------------------------------ roster + save ------------------------ */
  pushDebug() {
    const z = this.selection.selected as ZombieWorker | null;
    if (!z) { if (useGame.getState().debug) useGame.getState().patch({ debug: null }); return; }
    let target = '—';
    const t = z.task;
    if (t) {
      if (t.kind === 'cook') target = 'stove@' + t.station.col + ',' + t.station.row + ' (' + recipeById(t.recipeId!)?.name + ')';
      else if (t.kind === 'serve') target = 'cust wants ' + recipeById(t.customer.order)?.name;
      else if (t.kind === 'clean') target = 'table@' + t.table.col + ',' + t.table.row;
      else if (t.kind === 'move') target = 'tile ' + t.dest!.col + ',' + t.dest!.row;
      else if (t.kind === 'rest') target = 'home';
    }
    useGame.getState().patch({ debug: { name: z.name, state: z.state, cmd: t ? t.kind : 'none', target, anim: (z as any).anim || '—', energy: Math.round(z.energy), carry: z.carry ? recipeById(z.carry.recipeId)?.name : null } });
  }

  syncRoster() {
    useGame.getState().patch({
      zombieCount: this.zombies.length,
      zombies: this.zombies.map((z) => ({ id: z.id, name: z.name, level: z.level, speed: +z.statSpeed.toFixed(2), cook: +z.statCook.toFixed(2), serve: +z.statServe.toFixed(2), energy: Math.round(z.energy), maxEnergy: z.maxEnergy, state: z.state }))
    });
  }
  doSave() {
    const s = useGame.getState();
    this.saveSys.write({ v: 2, money: s.money, toxin: s.toxin, flesh: s.flesh, xp: s.xp, level: s.level, xpToNext: s.xpToNext, rating: s.rating, expansion: s.expansion, prestige: s.prestige, auto: this.auto, usableCols: this.iso.usableCols, usableRows: this.iso.usableRows, furniture: this.furniture.map((f) => ({ id: f.itemId, c: f.col, r: f.row, recipe: (f as any).recipeId })), zombies: this.zombies.map((z) => ({ name: z.name, level: z.level, xp: z.xp, energy: Math.round(z.energy), s: z.statSpeed, k: z.statCook, v: z.statServe, cl: z.statClean, chef: z.chef })) });
  }
  applyData(d: any) {
    useGame.getState().patch({ money: d.money, toxin: d.toxin, flesh: d.flesh, xp: d.xp, level: d.level, xpToNext: d.xpToNext ?? xpToNext(d.level || 1), rating: d.rating ?? 3, expansion: d.expansion ?? 0, prestige: d.prestige ?? 0, auto: d.auto !== false, mode: 'none' });
    this.iso.usableCols = d.usableCols ?? CFG.startUsableCols; this.iso.usableRows = d.usableRows ?? CFG.startUsableRows;
    this.auto = d.auto !== false;
    this.entrance = { col: this.iso.usableCols - 1, row: this.iso.usableRows - 1 };
    this.furniture = []; this.zombies = []; this.customers = []; this.readyFood = [];
    for (const f of d.furniture || []) { const fu = this.addFurniture(f.id, f.c, f.r); if (f.recipe && (fu as any).recipeId !== undefined) (fu as Station).recipeId = f.recipe; }
    for (const z of d.zombies || []) { const zz = this.createZombie(0.7, 2.3, { speed: z.s, cook: z.k, serve: z.v, clean: z.cl }); zz.name = z.name ?? zz.name; zz.level = z.level ?? 1; zz.xp = z.xp ?? 0; zz.energy = z.energy ?? zz.maxEnergy; zz.chef = !!z.chef; zz.sprite?.setTexture(zz.chef ? 'zombie_chef' : 'zombie'); }
    if (!this.zombies.length) { this.createZombie(0.7, 2.3); this.createZombie(1.5, 2.0); }
  }
}
