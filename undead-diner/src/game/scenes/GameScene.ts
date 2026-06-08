import Phaser from 'phaser';
import { CFG } from '../config';
import { IsoGrid, Tile } from '../iso/IsoGrid';
import { PathfindingSystem } from '../systems/PathfindingSystem';
import { EconomySystem } from '../systems/EconomySystem';
import { XPLevelSystem, xpToNext } from '../systems/XPLevelSystem';
import { RatingSystem } from '../systems/RatingSystem';
import { RecipeSystem } from '../systems/RecipeSystem';
import { SaveSystem } from '../systems/SaveSystem';
import { FurnitureSystem } from '../systems/FurnitureSystem';
import { PlacementSystem } from '../systems/PlacementSystem';
import { CustomerManager } from '../systems/CustomerManager';
import { ZombieStaffManager } from '../systems/ZombieStaffManager';
import { TaskManager, Portion } from '../systems/TaskManager';
import { InfectionSystem } from '../systems/InfectionSystem';
import { RaidSystem } from '../systems/RaidSystem';
import { Furniture } from '../entities/Furniture';
import { Customer } from '../entities/Customer';
import { Zombie } from '../entities/Zombie';
import { recipeById, recipesForStation } from '../data/recipes';
import { shopById } from '../data/furniture';
import { useGame, toast } from '../store';
import { bus } from '../eventBus';

export const DESIGN_W = 920;
export const DESIGN_H = 620;

export default class GameScene extends Phaser.Scene {
  grid!: IsoGrid;
  pf!: PathfindingSystem;
  economy = new EconomySystem();
  xp = new XPLevelSystem();
  rating = new RatingSystem();
  recipes = new RecipeSystem();
  save = new SaveSystem();
  furnitureSystem!: FurnitureSystem;
  placement!: PlacementSystem;
  customersMgr!: CustomerManager;
  staff!: ZombieStaffManager;
  tasks!: TaskManager;
  infection!: InfectionSystem;
  raid!: RaidSystem;

  customers: Customer[] = [];
  zombies: Zombie[] = [];
  furniture: Furniture[] = [];
  readyFood: Portion[] = [];

  usableCols = CFG.startUsableCols;
  usableRows = CFG.startUsableRows;
  expansion = 0;
  auto = true;
  entrance: Tile = { col: CFG.startUsableCols - 1, row: CFG.startUsableRows - 1 };

  private gfx!: Phaser.GameObjects.Graphics;
  private floorGfx!: Phaser.GameObjects.Graphics;
  private bubbles = new Map<number, Phaser.GameObjects.Text>();
  private held: Furniture | null = null;
  private autosaveT = 0;

  constructor() { super('Game'); }

  create() {
    this.grid = new IsoGrid(DESIGN_W / 2, 96);
    this.pf = new PathfindingSystem(this.grid);
    this.furnitureSystem = new FurnitureSystem(this);
    this.placement = new PlacementSystem(this);
    this.customersMgr = new CustomerManager(this);
    this.staff = new ZombieStaffManager(this);
    this.tasks = new TaskManager(this);
    this.infection = new InfectionSystem(this);
    this.raid = new RaidSystem(this);
    this.xp.onLevelUp = (lvl) => { this.recipes.syncUnlocked(); toast('Level ' + lvl + '! New unlocks.'); this.sfx('level'); };

    this.floorGfx = this.add.graphics().setDepth(-10000);
    this.gfx = this.add.graphics().setDepth(900000);

    const data = this.save.read();
    if (data) this.applyData(data); else this.newGame();
    this.drawRoom();
    this.recipes.syncUnlocked();

    this.bindPointer();
    this.bindCommands();

    // reflect rating star etc immediately
    this.staff.syncRoster();
  }

  /* ------------------------------ setup -------------------------------- */
  newGame() {
    useGame.getState().patch({
      money: CFG.startMoney, toxin: CFG.startToxin, flesh: CFG.startFlesh,
      level: 1, xp: 0, xpToNext: xpToNext(1), rating: 3, expansion: 0, prestige: 0, auto: true
    });
    this.usableCols = CFG.startUsableCols; this.usableRows = CFG.startUsableRows; this.expansion = 0;
    this.entrance = { col: this.usableCols - 1, row: this.usableRows - 1 };
    this.furniture = []; this.customers = []; this.zombies = []; this.readyFood = [];
    this.auto = true;

    this.furnitureSystem.add('counter', 1, 0);
    this.furnitureSystem.add('stove', 0, 1);
    this.furnitureSystem.add('table', 3, 2);
    this.furnitureSystem.add('table', 5, 2);
    this.furnitureSystem.add('table', 4, 4);
    // cosmetic chairs beside tables
    for (const [c, r] of [[3, 3], [5, 3], [4, 5], [2, 2], [6, 2], [3, 4]] as [number, number][]) this.addChairSprite(c, r);
    this.staff.create(0.6, 2.4); this.staff.create(1.4, 2.0);
  }

  /* ----------------------------- room art ------------------------------ */
  drawRoom() {
    const g = this.floorGfx; g.clear();
    const C = CFG;
    const top = this.grid.toScreen(0, 0);
    const rE = this.grid.toScreen(this.grid.cols, 0);
    const lE = this.grid.toScreen(0, this.grid.rows);
    const wallH = 70;
    // walls
    g.fillStyle(0x473a4a); g.lineStyle(3, 0x2a2230);
    g.beginPath(); g.moveTo(top.x, top.y); g.lineTo(rE.x, rE.y); g.lineTo(rE.x, rE.y - wallH); g.lineTo(top.x, top.y - wallH); g.closePath(); g.fillPath();
    g.fillStyle(0x3b3140);
    g.beginPath(); g.moveTo(top.x, top.y); g.lineTo(lE.x, lE.y); g.lineTo(lE.x, lE.y - wallH); g.lineTo(top.x, top.y - wallH); g.closePath(); g.fillPath();
    // windows
    g.fillStyle(0x8fb3d6, 0.4);
    for (const [end, sign] of [[rE, 1], [lE, -1]] as [any, number][]) {
      for (let i = 0; i < 2; i++) {
        const t0 = 0.3 + i * 0.34, t1 = t0 + 0.16;
        const x0 = top.x + (end.x - top.x) * t0, y0 = top.y + (end.y - top.y) * t0;
        const x1 = top.x + (end.x - top.x) * t1, y1 = top.y + (end.y - top.y) * t1;
        const wy = wallH * 0.6, wh = wallH * 0.34;
        g.beginPath(); g.moveTo(x0, y0 - wy); g.lineTo(x1, y1 - wy); g.lineTo(x1, y1 - wy - wh); g.lineTo(x0, y0 - wy - wh); g.closePath(); g.fillPath();
      }
    }
    // floor tiles
    for (let r = 0; r < C.gridRows; r++) for (let c = 0; c < C.gridCols; c++) {
      const a = this.grid.toScreen(c, r), b = this.grid.toScreen(c + 1, r), d = this.grid.toScreen(c + 1, r + 1), e = this.grid.toScreen(c, r + 1);
      const usable = c < this.usableCols && r < this.usableRows;
      const col = usable ? (((c + r) % 2 === 0) ? 0x5a4636 : 0x4b3a2d) : 0x251e18;
      g.fillStyle(col); g.lineStyle(1, 0x00000022);
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(d.x, d.y); g.lineTo(e.x, e.y); g.closePath(); g.fillPath();
    }
    // entrance mat
    const m = this.grid.toScreen(this.entrance.col + 0.5, this.entrance.row + 0.5);
    g.fillStyle(0x7b241c); g.fillEllipse(m.x, m.y, 40, 20);
  }

  /* ----------------------------- sprites ------------------------------- */
  spawnFurnitureSprite(f: Furniture) {
    const p = this.grid.toScreen(f.col + 0.5, f.row + 0.5);
    const s = this.add.sprite(p.x, p.y, f.texture).setOrigin(0.5, 0.85);
    s.setDepth(this.grid.depth(f.col, f.row));
    f.sprite = s;
  }
  addChairSprite(col: number, row: number) {
    const p = this.grid.toScreen(col + 0.5, row + 0.5);
    const s = this.add.image(p.x, p.y, 'chair').setOrigin(0.5, 0.8).setDepth(this.grid.depth(col, row) - 1);
  }
  spawnCustomerSprite(c: Customer) {
    const p = this.grid.toScreen(c.col + 0.5, c.row + 0.5);
    c.sprite = this.add.sprite(p.x, p.y, 'customer' + (c.skin % 6)).setOrigin(0.5, 0.9);
  }
  removeCustomerSprite(c: Customer) {
    c.sprite?.destroy();
    const b = this.bubbles.get(c.id); if (b) { b.destroy(); this.bubbles.delete(c.id); }
  }
  spawnZombieSprite(z: Zombie) {
    const p = this.grid.toScreen(z.col + 0.5, z.row + 0.5);
    z.sprite = this.add.sprite(p.x, p.y, z.chef ? 'zombie_chef' : 'zombie').setOrigin(0.5, 0.9);
  }

  /* --------------------------- world helpers --------------------------- */
  round(t: { col: number; row: number }): Tile { return { col: Math.round(t.col), row: Math.round(t.row) }; }
  pathTo(ent: { col: number; row: number }, tile: Tile): Tile[] { return this.pf.find(this.round(ent), tile); }
  approachTile(f: Furniture): Tile {
    for (const [dc, dr] of [[0, 1], [1, 0], [0, -1], [-1, 0]] as [number, number][]) {
      const c = f.col + dc, r = f.row + dr;
      if (c >= 0 && r >= 0 && c < this.usableCols && r < this.usableRows && !this.pf.isBlocked(c, r)) return { col: c, row: r };
    }
    return { col: f.col, row: f.row };
  }
  pickupTile(): Tile {
    const co = this.furnitureSystem.counters()[0];
    if (co) return this.approachTile(co);
    const st = this.furnitureSystem.stations()[0];
    if (st) return this.approachTile(st);
    return { col: 0, row: 1 };
  }
  appeal() { return this.furnitureSystem.appeal(); }

  popup(col: number, row: number, text: string, color: number) {
    const p = this.grid.toScreen(col + 0.5, row + 0.5);
    const t = this.add.text(p.x, p.y - 30, text, { fontFamily: 'Baloo 2, sans-serif', fontSize: '16px', color: '#' + color.toString(16).padStart(6, '0'), stroke: '#1c1326', strokeThickness: 4 }).setOrigin(0.5).setDepth(1e6);
    this.tweens.add({ targets: t, y: t.y - 26, alpha: 0, duration: 900, onComplete: () => t.destroy() });
  }
  coinBurst(col: number, row: number) {
    const p = this.grid.toScreen(col + 0.5, row + 0.5);
    for (let i = 0; i < 5; i++) {
      const c = this.add.circle(p.x, p.y - 20, 4, 0xffd24a).setStrokeStyle(1, 0x8a6020).setDepth(1e6);
      this.tweens.add({ targets: c, x: p.x + (Math.random() - 0.5) * 40, y: p.y - 30 - Math.random() * 24, alpha: 0, duration: 700, onComplete: () => c.destroy() });
    }
  }
  greenPuff(col: number, row: number) {
    const p = this.grid.toScreen(col + 0.5, row + 0.5);
    const s = this.add.sprite(p.x, p.y - 20, 'puff').setDepth(1e6).setScale(0.3);
    this.tweens.add({ targets: s, scale: 1.6, alpha: 0, duration: 600, onComplete: () => s.destroy() });
  }

  /* ------------------------------ economy hooks ------------------------ */
  expand() {
    if (this.usableCols >= this.grid.cols && this.usableRows >= this.grid.rows) { toast('Diner is at full size!'); return; }
    const cost = Math.round(400 * Math.pow(this.expansion + 1, 1.3));
    const toxinCost = 5 * (this.expansion + 1);
    if (!this.economy.canAfford(cost) || this.economy.toxin < toxinCost) { toast('Need ' + cost + ' money + ' + toxinCost + ' toxin.'); return; }
    this.economy.spend(cost); this.economy.addToxin(-toxinCost);
    this.expansion++;
    this.usableCols = Math.min(this.grid.cols, this.usableCols + 1);
    this.usableRows = Math.min(this.grid.rows, this.usableRows + 1);
    this.entrance = { col: this.usableCols - 1, row: this.usableRows - 1 };
    useGame.getState().patch({ expansion: this.expansion });
    this.drawRoom();
    toast('Diner expanded!');
  }
  franchise() {
    if (useGame.getState().level < 10) { toast('Reach level 10 to franchise.'); return; }
    const pr = useGame.getState().prestige + 1;
    this.customers.forEach((c) => this.removeCustomerSprite(c));
    this.zombies.forEach((z) => z.sprite?.destroy());
    this.furniture.forEach((f) => f.sprite?.destroy());
    this.newGame();
    useGame.getState().patch({ prestige: pr });
    this.drawRoom();
    toast('Franchised! Prestige ' + pr + '.');
  }

  /* ------------------------------ pointer ------------------------------ */
  bindPointer() {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const t = this.round(this.grid.toTile(pointer.worldX, pointer.worldY));
      const mode = useGame.getState().mode;
      if (mode.startsWith('build:')) { this.placement.tryPlace(t.col, t.row); return; }
      if (mode === 'infect') { const c = this.pickCustomer(pointer); if (c) this.infection.infect(c); return; }
      if (mode === 'edit') { this.handleEdit(t); return; }
      // default: tap zombie to feed, tap station to cycle its recipe
      const z = this.pickZombie(pointer);
      if (z) { if (z.energy < z.maxEnergy) this.staff.feed(z); return; }
      const f = this.furnitureSystem.at(t.col, t.row);
      if (f && f.kind === 'station') this.cycleRecipe(f);
    });
  }
  handleEdit(t: Tile) {
    if (this.held) {
      if (this.placement.canPlace(t.col, t.row)) {
        this.held.col = t.col; this.held.row = t.row;
        const p = this.grid.toScreen(t.col + 0.5, t.row + 0.5);
        this.held.sprite.setPosition(p.x, p.y).setDepth(this.grid.depth(t.col, t.row));
        this.furnitureSystem.refreshBlocked();
        this.held = null;
      } else toast('Can’t move there.');
    } else {
      const f = this.furnitureSystem.at(t.col, t.row);
      if (f) { this.held = f; toast('Moving ' + f.itemId + ' — tap a tile (or Edit again to sell).'); }
    }
  }
  cycleRecipe(f: Furniture) {
    const list = recipesForStation(f.station!).filter((r) => this.recipes.isUnlocked(r.id));
    if (list.length === 0) { toast('No recipes unlocked for this station.'); return; }
    const idx = list.findIndex((r) => r.id === f.recipeId);
    f.recipeId = list[(idx + 1) % list.length].id;
    toast(f.station + ' now cooks ' + recipeById(f.recipeId)!.name);
  }
  pickCustomer(pointer: Phaser.Input.Pointer): Customer | null {
    let best: Customer | null = null, bd = 36;
    for (const c of this.customers) {
      if (c.state !== 'sit' && c.state !== 'eating') continue;
      const p = this.grid.toScreen(c.col + 0.5, c.row + 0.5);
      const d = Phaser.Math.Distance.Between(pointer.worldX, pointer.worldY, p.x, p.y - 18);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
  pickZombie(pointer: Phaser.Input.Pointer): Zombie | null {
    let best: Zombie | null = null, bd = 34;
    for (const z of this.zombies) {
      const p = this.grid.toScreen(z.col + 0.5, z.row + 0.5);
      const d = Phaser.Math.Distance.Between(pointer.worldX, pointer.worldY, p.x, p.y - 18);
      if (d < bd) { bd = d; best = z; }
    }
    return best;
  }

  /* ----------------------------- commands ------------------------------ */
  bindCommands() {
    bus.on('command', (cmd: any) => {
      switch (cmd.type) {
        case 'build': useGame.getState().patch({ mode: 'build:' + cmd.item, panel: null }); break;
        case 'infectMode': useGame.getState().patch({ mode: useGame.getState().mode === 'infect' ? 'none' : 'infect' }); break;
        case 'editMode': useGame.getState().patch({ mode: useGame.getState().mode === 'edit' ? 'none' : 'edit' }); this.held = null; break;
        case 'cancelMode': useGame.getState().patch({ mode: 'none' }); this.held = null; break;
        case 'expand': this.expand(); break;
        case 'franchise': this.franchise(); break;
        case 'buyFlesh': if (this.economy.spendToxin(1)) { this.economy.addFlesh(CFG.fleshPerToxin); toast('+' + CFG.fleshPerToxin + ' flesh'); } else toast('Need 1 toxin.'); break;
        case 'buyToxin': this.economy.addToxin(CFG.toxinPerAdd); toast('+' + CFG.toxinPerAdd + ' toxin'); break;
        case 'setRecipe': { const st = this.furniture.find((f) => f.id === cmd.stoveId); if (st) { st.recipeId = cmd.recipeId; toast('Recipe set.'); } break; }
        case 'feedZombie': { const z = this.zombies.find((zz) => zz.id === cmd.id); if (z) this.staff.feed(z); break; }
        case 'toggleAuto': this.auto = !this.auto; useGame.getState().patch({ auto: this.auto }); toast('Auto ' + (this.auto ? 'on' : 'off')); break;
        case 'togglePause': { const p = !useGame.getState().paused; useGame.getState().patch({ paused: p }); break; }
        case 'toggleSound': { const s = !useGame.getState().sound; useGame.getState().patch({ sound: s }); break; }
        case 'save': this.doSave(); toast('Saved.'); break;
        case 'reset': if (confirm('Start a brand new diner? Your save will be erased.')) { this.save.clear(); this.scene.restart(); } break;
        case 'raidStart': { const res = this.raid.run(cmd.nodeId, cmd.zombies); bus.emit('raidResult', res); break; }
      }
    });
  }

  /* ------------------------------ update ------------------------------- */
  update(_time: number, delta: number) {
    const dt = Math.min(0.05, delta / 1000);
    const st = useGame.getState();
    if (!st.paused) {
      this.raid.update(dt);
      this.customersMgr.update(dt);
      this.tasks.update(dt);
      this.staff.update(dt);
      this.autosaveT += dt;
      if (this.autosaveT > CFG.autosave) { this.autosaveT = 0; this.doSave(); }
    }
    this.syncSprites();
  }

  syncSprites() {
    // furniture
    for (const f of this.furniture) {
      if (!f.sprite) continue;
      if (f.kind === 'table') f.sprite.setTexture(f.dirty ? 'table_dirty' : 'table');
      f.sprite.setDepth(this.grid.depth(f.col, f.row));
    }
    // dynamic layer
    const g = this.gfx; g.clear();

    // characters
    for (const c of this.customers) this.placeChar(c.sprite, c.col, c.row, c.facing, g);
    for (const z of this.zombies) this.placeChar(z.sprite, z.col, z.row, z.facing, g);

    // station cook bars + table food + bubbles + carried plates + energy bars
    for (const f of this.furniture) {
      if (f.kind === 'station' && f.cooking && f.cookTotal > 0) {
        const p = this.grid.toScreen(f.col + 0.5, f.row + 0.5);
        this.bar(g, p.x, p.y - 52, 30, 1 - f.cookTimer / f.cookTotal, 0xffd24a);
      }
    }
    for (const c of this.customers) {
      const p = this.grid.toScreen(c.col + 0.5, c.row + 0.5);
      if (c.state === 'sit') this.patienceRing(g, p.x + 16, p.y - 44, c.patience / (CFG.customerPatience * (c.vip ? 1.1 : 1)));
      this.updateBubble(c, p);
    }
    for (const z of this.zombies) {
      const p = this.grid.toScreen(z.col + 0.5, z.row + 0.5);
      if (z.state !== 'idle' && z.state !== 'rest') this.bar(g, p.x, p.y - 56, 22, z.energy / z.maxEnergy, z.energy / z.maxEnergy > 0.3 ? 0x7ac74f : 0xe7553b);
      if (z.carry) { const rec = recipeById(z.carry.recipeId); g.fillStyle(0xf5f6f7); g.fillEllipse(p.x + z.facing * 10, p.y - 26, 12, 7); if (rec) { g.fillStyle(rec.color); g.fillEllipse(p.x + z.facing * 10, p.y - 28, 6, 4); } }
    }
  }

  placeChar(sprite: any, col: number, row: number, facing: number, g: Phaser.GameObjects.Graphics) {
    if (!sprite) return;
    const p = this.grid.toScreen(col + 0.5, row + 0.5);
    g.fillStyle(0x000000, 0.22); g.fillEllipse(p.x, p.y + 2, 26, 10);
    sprite.setPosition(p.x, p.y);
    sprite.setDepth(this.grid.depth(col, row) + 5);
    sprite.setFlipX(facing < 0);
  }
  bar(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, f: number, color: number) {
    g.fillStyle(0x000000, 0.5); g.fillRect(x - w / 2, y, w, 4);
    g.fillStyle(color); g.fillRect(x - w / 2, y, w * Phaser.Math.Clamp(f, 0, 1), 4);
  }
  patienceRing(g: Phaser.GameObjects.Graphics, x: number, y: number, f: number) {
    const col = f > 0.4 ? 0x7ac74f : f > 0.18 ? 0xffd24a : 0xe7553b;
    g.lineStyle(3, col); g.beginPath(); g.arc(x, y, 9, -Math.PI / 2, -Math.PI / 2 + Phaser.Math.Clamp(f, 0, 1) * Math.PI * 2, false); g.strokePath();
  }
  updateBubble(c: Customer, p: { x: number; y: number }) {
    const show = c.state === 'sit';
    let b = this.bubbles.get(c.id);
    if (show) {
      const rec = recipeById(c.order);
      if (!b) { b = this.add.text(0, 0, rec ? rec.emoji : '🍴', { fontSize: '18px' }).setOrigin(0.5).setDepth(1e6); this.bubbles.set(c.id, b); }
      b.setPosition(p.x + 16, p.y - 46);
    } else if (b) { b.destroy(); this.bubbles.delete(c.id); }
  }

  /* ------------------------------ sound ------------------------------- */
  private ac: any = null;
  sfx(kind: string) {
    if (!useGame.getState().sound) return;
    try {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext; if (!AC) return;
      this.ac = this.ac || new AC();
      const o = this.ac.createOscillator(), gn = this.ac.createGain();
      const f0 = kind === 'level' ? 660 : kind === 'build' ? 320 : 520;
      o.type = 'square'; o.frequency.value = f0;
      gn.gain.setValueAtTime(0.0001, this.ac.currentTime);
      gn.gain.exponentialRampToValueAtTime(0.08, this.ac.currentTime + 0.01);
      gn.gain.exponentialRampToValueAtTime(0.0001, this.ac.currentTime + 0.16);
      o.connect(gn); gn.connect(this.ac.destination); o.start(); o.stop(this.ac.currentTime + 0.18);
    } catch {}
  }

  /* ------------------------------ save -------------------------------- */
  doSave() {
    const s = useGame.getState();
    this.save.write({
      v: 1, money: s.money, toxin: s.toxin, flesh: s.flesh, xp: s.xp, level: s.level, xpToNext: s.xpToNext,
      rating: s.rating, expansion: this.expansion, prestige: s.prestige, auto: this.auto,
      usableCols: this.usableCols, usableRows: this.usableRows,
      furniture: this.furniture.map((f) => ({ id: f.itemId, c: f.col, r: f.row, recipe: f.recipeId })),
      zombies: this.zombies.map((z) => ({ name: z.name, level: z.level, xp: z.xp, energy: Math.round(z.energy), s: z.statSpeed, k: z.statCook, v: z.statServe, chef: z.chef }))
    });
  }
  applyData(d: any) {
    useGame.getState().patch({
      money: d.money, toxin: d.toxin, flesh: d.flesh, xp: d.xp, level: d.level, xpToNext: d.xpToNext ?? xpToNext(d.level || 1),
      rating: d.rating ?? 3, expansion: d.expansion ?? 0, prestige: d.prestige ?? 0, auto: d.auto !== false
    });
    this.usableCols = d.usableCols ?? CFG.startUsableCols;
    this.usableRows = d.usableRows ?? CFG.startUsableRows;
    this.expansion = d.expansion ?? 0;
    this.auto = d.auto !== false;
    this.entrance = { col: this.usableCols - 1, row: this.usableRows - 1 };
    this.furniture = []; this.customers = []; this.zombies = []; this.readyFood = [];
    for (const f of d.furniture || []) { const fu = this.furnitureSystem.add(f.id, f.c, f.r); if (fu && f.recipe) fu.recipeId = f.recipe; }
    for (const z of d.zombies || []) {
      const zz = this.staff.create(0.6, 2.4, { speed: z.s, cook: z.k, serve: z.v });
      zz.name = z.name ?? zz.name; zz.level = z.level ?? 1; zz.xp = z.xp ?? 0; zz.energy = z.energy ?? zz.maxEnergy; zz.chef = !!z.chef;
      zz.sprite?.setTexture(zz.chef ? 'zombie_chef' : 'zombie');
    }
    if (this.zombies.length === 0) { this.staff.create(0.6, 2.4); this.staff.create(1.4, 2.0); }
  }
}
