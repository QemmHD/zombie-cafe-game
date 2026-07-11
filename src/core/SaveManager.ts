import type { ZombieInstance } from '../data/types';
import { getZombie, DISHES } from '../data/content';

const SAVE_KEY = 'zombiecafe.save.v1';
const SAVE_VERSION = 3;

export interface SaveData {
  version: number;
  coins: number;
  toxin: number;
  cafeLevel: number;
  playerXP: number;
  rating: number; // star rating 1..5 — service quality gates customer traffic
  zombies: ZombieInstance[];
  // Idle bookkeeping
  lastSaveUtc: number;      // ms epoch
  idleCoinsPerSec: number;  // snapshot of production rate at last save
}

export function freshSave(): SaveData {
  return {
    version: SAVE_VERSION,
    coins: 500,
    toxin: 10,
    cafeLevel: 1,
    playerXP: 0,
    rating: 3,
    zombies: [
      { zombieId: 'zombie_rotten', level: 1, xp: 0, assignment: 'kitchen', energy: 100 },
      { zombieId: 'zombie_chef', level: 1, xp: 0, assignment: 'idle', energy: 100 },
    ],
    lastSaveUtc: Date.now(),
    idleCoinsPerSec: 0,
  };
}

export interface OfflineReport {
  seconds: number;
  coins: number;
}

// Max time we pay out idle earnings for (original game capped idle accrual).
const OFFLINE_CAP_SECONDS = 8 * 3600;

export class SaveManager {
  data: SaveData;
  lastOffline: OfflineReport | null = null;

  constructor() {
    this.data = this.load();
    this.lastOffline = this.applyOfflineEarnings();
  }

  private load(): SaveData {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return freshSave();
      const parsed = JSON.parse(raw) as SaveData;
      if (parsed.version !== SAVE_VERSION) return this.migrate(parsed);
      return { ...freshSave(), ...parsed };
    } catch {
      return freshSave();
    }
  }

  private migrate(old: Partial<SaveData> & { brains?: number }): SaveData {
    // v1 -> v2: the "Brains" currency never existed in the original (canon §8);
    // it becomes Toxin at min(brains, 99).
    const merged = { ...freshSave(), ...old, version: SAVE_VERSION };
    if (old.brains !== undefined && old.toxin === undefined) {
      merged.toxin = Math.min(old.brains, 99);
    }
    delete (merged as { brains?: number }).brains;
    // v2 -> v3: zombies gain energy; the cafe gains a star rating.
    merged.rating = typeof old.rating === 'number' ? old.rating : 3;
    merged.zombies = (merged.zombies ?? []).map((z) => ({ ...z, energy: z.energy ?? 100 }));
    return merged;
  }

  // The core idle loop the Unity build never implemented: on load, pay out
  // production that "happened" while the tab was closed, based on the kitchen
  // roster's earning rate captured at last save.
  private applyOfflineEarnings(): OfflineReport | null {
    const now = Date.now();
    const elapsed = Math.max(0, Math.floor((now - this.data.lastSaveUtc) / 1000));
    const capped = Math.min(elapsed, OFFLINE_CAP_SECONDS);
    const rate = this.data.idleCoinsPerSec || this.computeIdleRate();
    const coins = Math.floor(capped * rate);
    this.data.lastSaveUtc = now;
    if (coins <= 0 || capped < 5) return null;
    this.data.coins += coins;
    return { seconds: capped, coins };
  }

  // Idle rate = each kitchen zombie steadily grinding out the best dish it can
  // cook, expressed as coins/second. This is the snapshot used for offline pay.
  computeIdleRate(): number {
    const kitchen = this.data.zombies.filter((z) => z.assignment === 'kitchen');
    const best = DISHES.filter((d) => d.cafeLevelRequired <= this.data.cafeLevel).sort(
      (a, b) => b.coinReward / b.cookTimeSeconds - a.coinReward / a.cookTimeSeconds,
    )[0];
    if (!best || kitchen.length === 0) return 0;
    let rate = 0;
    for (const inst of kitchen) {
      const z = getZombie(inst.zombieId);
      const speedMult = z ? z.cookSpeedMult : 1;
      const effectiveCook = best.cookTimeSeconds * speedMult;
      rate += best.coinReward / effectiveCook;
    }
    return rate;
  }

  snapshotRate(): void {
    this.data.idleCoinsPerSec = this.computeIdleRate();
  }

  save(): void {
    this.snapshotRate();
    this.data.lastSaveUtc = Date.now();
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch {
      /* storage full / private mode — ignore, session stays in memory */
    }
  }

  wipe(): void {
    localStorage.removeItem(SAVE_KEY);
    this.data = freshSave();
  }
}

export const Save = new SaveManager();
