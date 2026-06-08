import { Character } from './Character';
import { CFG } from '../config';

export type CState = 'enter' | 'toTable' | 'sit' | 'eating' | 'leaving';

export class Customer extends Character {
  kind = 'customer';
  state: CState = 'enter';
  table: any = null;
  order: string;
  patience: number;
  eatTimer = 0;
  vip: boolean;
  skin: number;
  server: any = null;         // zombie en route to serve
  reward: { price: number; xp: number } | null = null;
  bubble: any = null;

  constructor(col: number, row: number, order: string, vip: boolean, skin: number) {
    super(col, row);
    this.order = order;
    this.vip = vip;
    this.skin = skin;
    this.speedTiles = CFG.customerSpeed;
    this.patience = CFG.customerPatience * (vip ? 1.1 : 1);
  }
}
