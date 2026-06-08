import Phaser from 'phaser';
import BootScene, {} from './scenes/BootScene';
import GameScene, { DESIGN_W, DESIGN_H } from './scenes/GameScene';
import UIScene from './scenes/UIScene';

export function createGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#1a1426',
    width: DESIGN_W,
    height: DESIGN_H,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    render: { antialias: true, pixelArt: false, roundPixels: false },
    scene: [BootScene, GameScene, UIScene]
  });
}
