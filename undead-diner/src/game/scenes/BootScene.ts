import Phaser from 'phaser';

const S = 'assets/sprites/';
const CHAR = { frameWidth: 64, frameHeight: 64 };
const ZSTATES: [string, number, number][] = [
  ['idle', 4, 4], ['walk', 8, 12], ['carry', 6, 10], ['cook', 6, 9],
  ['clean', 6, 9], ['infect', 6, 12], ['celebrate', 4, 10], ['tired', 4, 3]
];
const CSTATES: [string, number, number][] = [
  ['idle', 4, 4], ['walk', 8, 11], ['sit', 4, 3], ['eat', 6, 7], ['angry', 6, 10], ['leave', 8, 11]
];
export const CUST_PALETTES = 3;

/** Loads the state-based sprite sheets and registers every Phaser animation
 *  key (zombie_<state>, cust<p>_<state>). 64x64 frames, feet anchored. */
export default class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    for (const [st] of ZSTATES) this.load.spritesheet('zombie_' + st, S + 'zombie_' + st + '.png', CHAR);
    for (let p = 0; p < CUST_PALETTES; p++) for (const [st] of CSTATES) this.load.spritesheet(`cust${p}_${st}`, S + `cust${p}_${st}.png`, CHAR);
    this.load.spritesheet('smoke', S + 'infection_smoke.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('steam', S + 'steam.png', { frameWidth: 40, frameHeight: 64 });
    this.load.spritesheet('fly', S + 'fly.png', { frameWidth: 24, frameHeight: 24 });
    ['table_clean', 'table_dirty', 'stove', 'grill', 'oven', 'counter', 'chair', 'plant', 'lamp',
     'coin', 'plate_food', 'stain', 'slime', 'crack'].forEach((k) => this.load.image(k, S + k + '.png'));
    this.load.on('loaderror', (f: any) => console.warn('asset missing', f?.key));
  }

  create() {
    const mk = (key: string, sheet: string, n: number, rate: number, repeat = -1) =>
      this.anims.create({ key, frames: this.anims.generateFrameNumbers(sheet, { start: 0, end: n - 1 }), frameRate: rate, repeat });
    for (const [st, n, r] of ZSTATES) mk('zombie_' + st, 'zombie_' + st, n, r, st === 'celebrate' || st === 'infect' ? 0 : -1);
    for (let p = 0; p < CUST_PALETTES; p++) for (const [st, n, r] of CSTATES) mk(`cust${p}_${st}`, `cust${p}_${st}`, n, r);
    mk('smoke', 'smoke', 4, 12, 0); mk('steam', 'steam', 4, 8); mk('fly', 'fly', 2, 10);
    this.scene.start('Game'); this.scene.launch('HUD');
  }
}
