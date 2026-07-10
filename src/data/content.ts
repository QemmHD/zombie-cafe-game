import type { Dish, Zombie, Furniture } from './types';
import dishesJson from './dishes.json';
import zombiesJson from './zombies.json';
import furnitureJson from './furniture.json';

// Static content catalogs, ported 1:1 from the Unity build.
export const DISHES: Dish[] = dishesJson as Dish[];
export const ZOMBIES: Zombie[] = zombiesJson as Zombie[];
export const FURNITURE: Furniture[] = furnitureJson as Furniture[];

const dishById = new Map(DISHES.map((d) => [d.dishId, d]));
const zombieById = new Map(ZOMBIES.map((z) => [z.zombieId, z]));

export const getDish = (id: string): Dish | undefined => dishById.get(id);
export const getZombie = (id: string): Zombie | undefined => zombieById.get(id);

// Dishes available to cook at a given cafe level, cheapest cook first.
export const dishesForLevel = (level: number): Dish[] =>
  DISHES.filter((d) => d.cafeLevelRequired <= level).sort(
    (a, b) => a.cookTimeSeconds - b.cookTimeSeconds,
  );

// Common-tier zombies that starter customers can turn into.
export const commonZombies = (): Zombie[] => ZOMBIES.filter((z) => z.rarity === 0);

export const randomCommonZombie = (): Zombie => {
  const pool = commonZombies();
  return pool[Math.floor(Math.random() * pool.length)];
};
