import type { Tile } from '../iso/IsoGrid';
import type { Movable } from './move';
import { CFG } from '../config';

let nextId = 1;

const NAMES = ['Mort', 'Greta', 'Vlad', 'Lurch', 'Patches', 'Gus', 'Igor', 'Hazel',
  'Stitch', 'Gnash', 'Drool', 'Festus', 'Bones', 'Maul', 'Cleo', 'Rot'];

export type ZombieState =
  | 'idle' | 'toStation' | 'cooking' | 'toCounter' | 'carry'
  | 'toTable' | 'serve' | 'toDirty' | 'clean' | 'rest' | 'raiding';

export interface ZTask {
  kind: 'cook' | 'serve' | 'clean';
  station?: any;
  table?: any;
  recipeId?: string;
  portion?: { recipeId: string; price: number; xp: number };
}

export class Zombie implements Movable {
  id: number;
  name: string;
  col: number;
  row: number;
  path: Tile[] = [];
  facing = 1;

  level = 1;
  xp = 0;
  // random stats (1..2 multipliers)
  statSpeed: number;
  statCook: number;
  statServe: number;
  energy = CFG.zombieMaxEnergy;
  maxEnergy = CFG.zombieMaxEnergy;

  state: ZombieState = 'idle';
  task: ZTask | null = null;
  carry: { recipeId: string; price: number; xp: number } | null = null;
  cookTimer = 0;
  homeCol: number;
  homeRow: number;
  chef: boolean;     // taller chef-hat variant
  sprite: any;

  constructor(col: number, row: number, stats?: { speed?: number; cook?: number; serve?: number }) {
    this.id = nextId++;
    this.name = NAMES[(Math.random() * NAMES.length) | 0];
    this.col = col; this.row = row;
    this.homeCol = col; this.homeRow = row;
    this.statSpeed = stats?.speed ?? 0.85 + Math.random() * 0.6;
    this.statCook = stats?.cook ?? 0.85 + Math.random() * 0.6;
    this.statServe = stats?.serve ?? 0.85 + Math.random() * 0.6;
    this.chef = Math.random() < 0.5;
  }

  get speedTiles(): number {
    const tired = this.energy < CFG.tiredThreshold ? 0.55 : 1;
    return CFG.zombieSpeed * this.statSpeed * tired;
  }

  available(): boolean {
    return (this.state === 'idle' || this.state === 'rest') && this.energy > 5;
  }
}
