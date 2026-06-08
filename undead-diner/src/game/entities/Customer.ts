import type { Tile } from '../iso/IsoGrid';
import type { Movable } from './move';
import { CFG } from '../config';

let nextId = 1;

export type CustomerState = 'enter' | 'toTable' | 'sit' | 'eating' | 'leaving';

export class Customer implements Movable {
  id: number;
  col: number;
  row: number;
  path: Tile[] = [];
  facing = -1;
  speedTiles = CFG.customerSpeed;

  state: CustomerState = 'enter';
  table: any = null;
  order: string;
  patience: number;
  eatTimer = 0;
  served = false;
  vip: boolean;
  skin: number;       // sprite variant
  sprite: any;        // Phaser container
  bubble: any;        // thought bubble

  constructor(col: number, row: number, order: string, vip: boolean, skin: number) {
    this.id = nextId++;
    this.col = col; this.row = row;
    this.order = order;
    this.vip = vip;
    this.skin = skin;
    this.patience = CFG.customerPatience * (vip ? 1.1 : 1);
  }
}
