import Phaser from 'phaser';
import { Hud } from '../ui/Hud';

// The HUD renders in its own scene so the cafe camera can zoom/pan the world
// without scaling UI. Communication happens over the EventBus only.
export class HudScene extends Phaser.Scene {
  constructor() {
    super('Hud');
  }

  create(): void {
    new Hud(this);
  }
}
