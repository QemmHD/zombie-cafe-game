import { Zombie } from '../entities/Zombie';
import { RAID_NODES } from '../data/furniture';
import { recipeById, RECIPES } from '../data/recipes';
import { useGame } from '../store';
import { CFG } from '../config';

export interface RaidResult {
  node: string;
  victory: boolean;
  money: number;
  flesh: number;
  toxin: number;
  recipe?: string;
  sent: number;
}

/** Sends zombies to raid a rival diner. Resolved as a quick power-vs-difficulty
 *  roll; rewards money/flesh/toxin and sometimes a stolen recipe. */
export class RaidSystem {
  world: any;
  cooldown = 0;
  constructor(world: any) { this.world = world; }

  update(dt: number) { if (this.cooldown > 0) this.cooldown -= dt; }

  available(): Zombie[] {
    return (this.world.zombies as Zombie[]).filter((z) => z.available());
  }

  run(nodeId: string, count: number): RaidResult | null {
    const node = RAID_NODES.find((n) => n.id === nodeId);
    if (!node) return null;
    if (this.cooldown > 0) { useGame.getState().setToast('Raid on cooldown.'); return null; }
    if (useGame.getState().level < node.minLevel) { useGame.getState().setToast('Level too low for this target.'); return null; }
    const squad = this.available().slice(0, Math.max(1, count));
    if (squad.length === 0) { useGame.getState().setToast('No rested zombies to send.'); return null; }

    // power vs difficulty
    let power = 0;
    for (const z of squad) { power += (z.statCook + z.statServe + z.statSpeed) / 3 * (z.energy / z.maxEnergy + 0.4); z.energy = Math.max(0, z.energy - 25); }
    const target = node.difficulty * 1.6;
    const victory = power >= target;
    const frac = Math.min(1, power / target);

    const money = Math.round((victory ? 90 : 30) * node.difficulty * (0.6 + frac));
    const flesh = Math.round((victory ? 3 : 1) * node.difficulty * frac) + (victory ? 1 : 0);
    const toxin = (victory && Math.random() < 0.5) ? node.difficulty : 0;

    this.world.economy.addMoney(money);
    this.world.economy.addFlesh(flesh);
    if (toxin) this.world.economy.addToxin(toxin);

    // chance to steal a recipe the player hasn't unlocked
    let recipe: string | undefined;
    if (victory && Math.random() < 0.4) {
      const locked = RECIPES.filter((r) => !this.world.recipes.isUnlocked(r.id));
      if (locked.length) {
        const r = locked[(Math.random() * locked.length) | 0];
        recipe = r.id;
        // grant XP toward unlocking it
        this.world.xp.add(useGame.getState().xpToNext);
      }
    }

    this.cooldown = CFG.raidCooldown;
    this.world.staff.syncRoster();
    return { node: node.name, victory, money, flesh, toxin, recipe: recipe ? recipeById(recipe)?.name : undefined, sent: squad.length };
  }
}
