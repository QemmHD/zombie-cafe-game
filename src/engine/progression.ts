// Cafe XP progression — pure math, no Phaser (engine rule).
//
// Researched (spec 94 gap 10): the original levels the cafe on XP earned from
// cooking (1/3 of a dish's XP when the pot starts) and serving (the remaining
// 2/3 spread across its servings), plus furniture purchases. The exact curve
// is only partially documented (L1≈100 … L5≈2400 … L10≈4575), so we fit a
// smooth power curve through that scale; one constant to retune later.

/** XP required to go from `level` to `level + 1`. */
export function xpToNext(level: number): number {
  return Math.round(95 * Math.pow(level, 1.55));
}

/** XP a single completed cook grants up front (the researched 1/3 split). */
export function cookStartXP(dishXP: number): number {
  return dishXP / 3;
}

/** XP granted per serving delivered (the remaining 2/3, split evenly). */
export function perServingXP(dishXP: number, servings: number): number {
  return servings > 0 ? (dishXP * 2) / 3 / servings : 0;
}

export interface LevelUpResult {
  levels: number; // how many levels were gained (usually 0 or 1)
  xp: number; // remaining XP into the current level
  level: number; // the new level
}

/** Apply earned XP, consuming level thresholds. */
export function applyXP(level: number, xp: number, earned: number, cap = 99): LevelUpResult {
  let l = level;
  let x = xp + earned;
  let ups = 0;
  while (l < cap && x >= xpToNext(l)) {
    x -= xpToNext(l);
    l++;
    ups++;
  }
  return { levels: ups, xp: x, level: l };
}
