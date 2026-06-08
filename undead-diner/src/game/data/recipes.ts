import type { StationType } from '../config';

export interface Recipe {
  id: string;
  name: string;
  station: StationType;
  cookTime: number;   // seconds
  servings: number;
  price: number;      // per serving
  xp: number;         // per serving sold
  cost: number;       // ingredient cost to start a batch
  unlockLevel: number;
  color: number;      // plate food colour
  emoji: string;      // shown in order bubbles
}

export const RECIPES: Recipe[] = [
  { id: 'coffin_coffee', name: 'Coffin Coffee',  station: 'stove', cookTime: 7,  servings: 3, price: 18,  xp: 4,  cost: 12,  unlockLevel: 1, color: 0x6f4e37, emoji: '☕' },
  { id: 'grave_grits',   name: 'Grave Grits',    station: 'stove', cookTime: 10, servings: 3, price: 24,  xp: 5,  cost: 20,  unlockLevel: 1, color: 0xd8c187, emoji: '🥣' },
  { id: 'finger_fries',  name: 'Finger Fries',   station: 'grill', cookTime: 12, servings: 4, price: 30,  xp: 6,  cost: 34,  unlockLevel: 2, color: 0xe0a93b, emoji: '🍟' },
  { id: 'brain_burger',  name: 'Brain Burger',   station: 'grill', cookTime: 18, servings: 4, price: 58,  xp: 10, cost: 80,  unlockLevel: 3, color: 0xb5651d, emoji: '🍔' },
  { id: 'rot_pizza',     name: 'Rotten Pizza',   station: 'oven',  cookTime: 26, servings: 5, price: 110, xp: 16, cost: 200, unlockLevel: 4, color: 0xd23b2e, emoji: '🍕' },
  { id: 'tomb_cake',     name: 'Tombstone Cake', station: 'oven',  cookTime: 34, servings: 6, price: 200, xp: 28, cost: 420, unlockLevel: 6, color: 0x9b59b6, emoji: '🍰' }
];

export const recipeById = (id: string) => RECIPES.find((r) => r.id === id);
export const recipesForStation = (s: StationType) => RECIPES.filter((r) => r.station === s);
