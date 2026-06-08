import { Character } from './Character';
import { CFG } from '../config';

const NAMES = ['Mort', 'Greta', 'Vlad', 'Lurch', 'Patches', 'Gus', 'Igor', 'Hazel',
  'Stitch', 'Gnash', 'Drool', 'Festus', 'Bones', 'Maul', 'Cleo', 'Rot'];

export type ZState =
  | 'idle' | 'walk' | 'toStation' | 'cooking' | 'toCounter' | 'carry'
  | 'toTable' | 'serving' | 'toDirty' | 'cleaning' | 'rest' | 'raiding';

export interface ZTask {
  kind: 'cook' | 'serve' | 'clean' | 'move' | 'rest';
  station?: any; table?: any; customer?: any; recipeId?: string;
  portion?: { recipeId: string; price: number; xp: number; color: number };
  dest?: { col: number; row: number };
}

export class ZombieWorker extends Character {
  kind = 'zombie';
  name = NAMES[(Math.random() * NAMES.length) | 0];
  level = 1; xp = 0;
  statSpeed: number; statCook: number; statServe: number; statClean: number;
  energy = CFG.zombieMaxEnergy; maxEnergy = CFG.zombieMaxEnergy;
  state: ZState = 'idle';
  task: ZTask | null = null;
  carry: { recipeId: string; price: number; xp: number; color: number } | null = null;
  timer = 0;
  homeCol: number; homeRow: number;
  chef: boolean;

  constructor(col: number, row: number, stats?: any) {
    super(col, row);
    this.homeCol = col; this.homeRow = row;
    this.statSpeed = stats?.speed ?? 0.85 + Math.random() * 0.6;
    this.statCook = stats?.cook ?? 0.85 + Math.random() * 0.6;
    this.statServe = stats?.serve ?? 0.85 + Math.random() * 0.6;
    this.statClean = stats?.clean ?? 0.85 + Math.random() * 0.6;
    this.chef = Math.random() < 0.5;
    this.speedTiles = CFG.zombieSpeed * this.statSpeed;
  }
  get spd(): number { return CFG.zombieSpeed * this.statSpeed * (this.energy < CFG.tiredThreshold ? 0.55 : 1); }
  available(): boolean { return (this.state === 'idle' || this.state === 'rest') && this.energy > 5; }
  busy(): boolean { return !(this.state === 'idle' || this.state === 'rest'); }
}
