import type { Tile } from '../iso/IsoWorld';

let nextId = 1;

/** Base for anything that lives on the iso grid and owns a Phaser sprite. */
export class IsoObject {
  id = nextId++;
  col: number;
  row: number;
  sprite: any = null;          // Phaser sprite/container
  kind = 'object';

  constructor(col: number, row: number) { this.col = col; this.row = row; }

  tile(): Tile { return { col: Math.round(this.col), row: Math.round(this.row) }; }
}
