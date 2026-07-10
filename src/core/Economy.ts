import { EventBus } from './EventBus';
import { Save } from './SaveManager';

// Two-currency economy mirroring the original: Coins (soft) + Brains (premium).
export const Economy = {
  get coins(): number {
    return Save.data.coins;
  },
  get brains(): number {
    return Save.data.brains;
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

  addBrains(amount: number): void {
    if (amount === 0) return;
    Save.data.brains = Math.max(0, Save.data.brains + amount);
    EventBus.publish('brains-changed', Save.data.brains);
  },

  spendBrains(amount: number): boolean {
    if (Save.data.brains < amount) return false;
    Save.data.brains -= amount;
    EventBus.publish('brains-changed', Save.data.brains);
    return true;
  },
};
