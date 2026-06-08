import { useGame } from '../store';
import type { ZombieWorker } from '../objects/ZombieWorker';

/** Tracks the currently-selected zombie (the main control surface). */
export class SelectionSystem {
  world: any;
  selected: ZombieWorker | null = null;
  constructor(world: any) { this.world = world; }

  select(z: ZombieWorker | null) {
    this.selected = z;
    useGame.getState().patch({ selectedZombieId: z ? z.id : null });
    if (z) this.world.sfx?.('select');
  }
  clear() { this.select(null); }
  toggle(z: ZombieWorker) { if (this.selected === z) this.clear(); else this.select(z); }
}
