import { useGame } from '../store';

export function xpToNext(level: number): number {
  return Math.floor(100 * Math.pow(level, 1.4));
}

export class XPLevelSystem {
  onLevelUp: ((level: number) => void) | null = null;

  add(n: number) {
    const s = useGame.getState();
    let xp = s.xp + n;
    let level = s.level;
    let need = s.xpToNext;
    while (xp >= need) {
      xp -= need;
      level++;
      need = xpToNext(level);
      this.onLevelUp?.(level);
    }
    useGame.getState().patch({ xp, level, xpToNext: need });
  }
}
