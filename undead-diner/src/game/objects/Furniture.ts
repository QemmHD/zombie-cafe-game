import { IsoObject } from './IsoObject';
import type { StationType } from '../config';

/** Furniture objects. Kept in one module but as distinct classes per the
 *  architecture (Table, Chair, Station, Counter). */

export class Table extends IsoObject {
  kind = 'table';
  itemId = 'table';
  occupiedBy: any = null;
  dirty = false;
  coins = 0;          // uncollected payment sitting on the table
}

export class Chair extends IsoObject {
  kind = 'chair';
  itemId = 'chair';
}

export class Counter extends IsoObject {
  kind = 'counter';
  itemId = 'counter';
}

export class Station extends IsoObject {
  kind = 'station';
  itemId: string;
  station: StationType;
  recipeId: string;
  cooking = false;
  cookTimer = 0;
  cookTotal = 0;
  claimedBy: any = null;
  constructor(col: number, row: number, itemId: string, station: StationType, recipeId: string) {
    super(col, row);
    this.itemId = itemId; this.station = station; this.recipeId = recipeId;
  }
}

export class Decor extends IsoObject {
  kind = 'decor';
  itemId: string;
  appeal: number;
  constructor(col: number, row: number, itemId: string, appeal: number) {
    super(col, row); this.itemId = itemId; this.appeal = appeal;
  }
}
