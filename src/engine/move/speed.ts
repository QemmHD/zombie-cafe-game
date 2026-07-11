// The speed canon (spec 01 §6.3) — the ONE stat->velocity module in the repo.
// Every consumer (service loop, raids, customers) imports from here; local
// speed formulas elsewhere are review-blocking defects.

import { clamp } from '../types';

/**
 * Zombie staff shamble. speedStat is the derived Speed stat (1-12) from the
 * infection/staff spec's StaffStats (that spec owns the derivation; this module
 * owns stat -> tiles/sec). Default stat before StaffStats lands: 7.
 */
export function zombieTilesPerSec(speedStat: number): number {
  return clamp(0.45 + 0.09 * speedStat, 0.5, 1.55); // 0.54 @1 … 1.53 @12
}

export const DEFAULT_SPEED_STAT = 7; // ≈1.08 t/s — a 7x8 room crossing takes ~9s

export const CUSTOMER_SPEED = 2.0; // humans stride; zombies shuffle — the contrast is the point
export const CUSTOMER_ANGRY_SPEED = 2.6;
export const RAIDER_FLEE_SPEED = 2.2; // consumed by the Raids spec
