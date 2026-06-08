import type { FurnKind } from '../data/furniture';
import type { StationType } from '../config';

let nextId = 1;

export class Furniture {
  id: number;
  itemId: string;
  kind: FurnKind;
  texture: string;
  col: number;
  row: number;
  sprite: any;          // Phaser sprite, set by scene
  appeal: number;

  // table
  occupiedBy: any = null;
  dirty = false;

  // station
  station?: StationType;
  recipeId?: string;
  cooking = false;
  cookTimer = 0;
  cookTotal = 0;
  claimedBy: any = null; // zombie currently cooking here

  constructor(itemId: string, kind: FurnKind, texture: string, col: number, row: number) {
    this.id = nextId++;
    this.itemId = itemId;
    this.kind = kind;
    this.texture = texture;
    this.col = col;
    this.row = row;
    this.appeal = 0;
  }
}
