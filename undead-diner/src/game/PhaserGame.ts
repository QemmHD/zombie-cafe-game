import Phaser from 'phaser';
import BootScene from './scenes/BootScene';
import GameScene from './scenes/GameScene';
import HUDScene from './scenes/HUDScene';
import { CFG } from './config';

export function createGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#241c33',
    width: CFG.designW,
    height: CFG.designH,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { antialias: true, pixelArt: false, roundPixels: false },
    scene: [BootScene, GameScene, HUDScene]
  });
}
