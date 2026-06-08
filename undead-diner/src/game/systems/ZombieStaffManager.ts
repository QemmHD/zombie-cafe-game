import { Zombie } from '../entities/Zombie';
import { useGame } from '../store';
import { CFG } from '../config';

/** Owns the zombie roster: creation, energy regen / resting, feeding, and
 *  pushing roster info up to the React HUD. */
export class ZombieStaffManager {
  world: any;
  constructor(world: any) { this.world = world; }

  create(col: number, row: number, stats?: any): Zombie {
    const z = new Zombie(col, row, stats);
    this.world.zombies.push(z);
    this.world.spawnZombieSprite(z);
    this.syncRoster();
    return z;
  }

  maxZombies(): number {
    const lvl = useGame.getState().level;
    return 4 + Math.floor(this.world.furnitureSystem.tables().length / 2) + Math.floor(lvl / 2);
  }

  feed(z: Zombie): boolean {
    if (!this.world.economy.spendFlesh(1)) { useGame.getState().setToast('No flesh! Raid or buy some.'); return false; }
    z.energy = Math.min(z.maxEnergy, z.energy + CFG.fleshFeed);
    if (z.state === 'rest' && z.energy > z.maxEnergy * 0.3) z.state = 'idle';
    this.world.popup(z.col, z.row - 0.4, '+energy', 0x7ac74f);
    this.syncRoster();
    return true;
  }

  update(dt: number) {
    for (const z of this.world.zombies as Zombie[]) {
      if (z.state === 'rest') {
        z.energy = Math.min(z.maxEnergy, z.energy + CFG.energyRegen * dt);
        if (z.energy >= z.maxEnergy * 0.55) z.state = 'idle';
      } else if (z.state === 'idle') {
        z.energy = Math.min(z.maxEnergy, z.energy + CFG.energyRegen * 0.25 * dt);
      }
      if (z.energy <= 0) { z.energy = 0; z.state = 'rest'; z.task = null; z.carry = null; }
    }
    if (this.world._rosterTimer === undefined) this.world._rosterTimer = 0;
    this.world._rosterTimer += dt;
    if (this.world._rosterTimer > 0.5) { this.world._rosterTimer = 0; this.syncRoster(); }
  }

  syncRoster() {
    const zs = (this.world.zombies as Zombie[]).map((z) => ({
      id: z.id, name: z.name, level: z.level,
      speed: +z.statSpeed.toFixed(2), cook: +z.statCook.toFixed(2), serve: +z.statServe.toFixed(2),
      energy: Math.round(z.energy), maxEnergy: z.maxEnergy, state: z.state
    }));
    useGame.getState().patch({ zombies: zs, zombieCount: zs.length });
  }
}
