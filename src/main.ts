import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './config';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { CafeScene } from './scenes/CafeScene';
import { HudScene } from './scenes/HudScene';
import { Save } from './core/SaveManager'; // initialises the Save singleton + offline earnings on load

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#48641a', // grass base — never expose gray canvas if a pan outruns the tiles
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: { antialias: true, pixelArt: false },
  scene: [BootScene, PreloadScene, CafeScene, HudScene],
});

// Exposed for headless verification harnesses (Playwright probes scene state).
declare global {
  interface Window {
    __game?: Phaser.Game;
    __save?: typeof Save;
  }
}
// DEV builds and explicit ?qa runs only — production consoles get nothing.
if (import.meta.env.DEV || new URLSearchParams(location.search).has('qa')) {
  window.__game = game;
  window.__save = Save;
}
