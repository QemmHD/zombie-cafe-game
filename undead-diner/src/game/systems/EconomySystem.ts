import { useGame } from '../store';

export class EconomySystem {
  get money() { return useGame.getState().money; }
  get toxin() { return useGame.getState().toxin; }
  get flesh() { return useGame.getState().flesh; }

  addMoney(n: number) { useGame.getState().patch({ money: Math.max(0, Math.round(this.money + n)) }); }
  addToxin(n: number) { useGame.getState().patch({ toxin: Math.max(0, this.toxin + n) }); }
  addFlesh(n: number) { useGame.getState().patch({ flesh: Math.max(0, this.flesh + n) }); }

  canAfford(n: number) { return this.money >= n; }
  spend(n: number) { if (!this.canAfford(n)) return false; this.addMoney(-n); return true; }
  spendToxin(n: number) { if (this.toxin < n) return false; this.addToxin(-n); return true; }
  spendFlesh(n: number) { if (this.flesh < n) return false; this.addFlesh(-n); return true; }
}
