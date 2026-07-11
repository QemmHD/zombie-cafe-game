import { EventBus } from './EventBus';
import { Save } from './SaveManager';

// Two-currency economy matching the original: Coins (soft) + Toxin (the green
// serum premium currency — earned only, never bought; canon §8).
export const Economy = {
  get coins(): number {
    return Save.data.coins;
  },
  get toxin(): number {
    return Save.data.toxin;
  },

  addCoins(amount: number): void {
    if (amount === 0) return;
    Save.data.coins = Math.max(0, Save.data.coins + amount);
    EventBus.publish('coins-changed', Save.data.coins);
  },

  spendCoins(amount: number): boolean {
    if (Save.data.coins < amount) return false;
    Save.data.coins -= amount;
    EventBus.publish('coins-changed', Save.data.coins);
    return true;
  },

  addToxin(amount: number): void {
    if (amount === 0) return;
    Save.data.toxin = Math.max(0, Save.data.toxin + amount);
    EventBus.publish('toxin-changed', Save.data.toxin);
  },

  spendToxin(amount: number): boolean {
    if (Save.data.toxin < amount) return false;
    Save.data.toxin -= amount;
    EventBus.publish('toxin-changed', Save.data.toxin);
    return true;
  },
};
