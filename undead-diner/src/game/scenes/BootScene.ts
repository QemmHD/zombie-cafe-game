import Phaser from 'phaser';

const OUT = 0x1c1326; // dark cartoon outline

/** Generates every sprite texture procedurally so the game runs with zero
 *  external art — big-head characters, checkered tables, grimy machines, etc.
 *  (Original placeholder art; swap textures later for hand-drawn ones.) */
export default class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  create() {
    this.makeFurniture();
    this.makeCharacters();
    this.makeBits();
    this.scene.start('Game');
    this.scene.launch('UI');
  }

  private g() { return this.add.graphics(); }
  private save(g: Phaser.GameObjects.Graphics, key: string, w: number, h: number) {
    g.generateTexture(key, w, h); g.destroy();
  }

  // iso box: top diamond + left/right faces, anchored so the bottom point sits at (cx, by)
  private isoBox(g: Phaser.GameObjects.Graphics, cx: number, by: number, hw: number, hh: number, height: number, top: number, left: number, right: number) {
    const ty = by - height;
    // left face
    g.fillStyle(left); g.lineStyle(3, OUT);
    g.beginPath(); g.moveTo(cx - hw, ty); g.lineTo(cx, ty + hh); g.lineTo(cx, by); g.lineTo(cx - hw, by - hh); g.closePath(); g.fillPath(); g.strokePath();
    // right face
    g.fillStyle(right);
    g.beginPath(); g.moveTo(cx + hw, ty); g.lineTo(cx, ty + hh); g.lineTo(cx, by); g.lineTo(cx + hw, by - hh); g.closePath(); g.fillPath(); g.strokePath();
    // top
    g.fillStyle(top);
    g.beginPath(); g.moveTo(cx, ty - hh); g.lineTo(cx + hw, ty); g.lineTo(cx, ty + hh); g.lineTo(cx - hw, ty); g.closePath(); g.fillPath(); g.strokePath();
  }

  private makeFurniture() {
    // table (clean) — checkered red cloth top
    for (const dirty of [false, true]) {
      const g = this.g();
      const W = 76, H = 64, cx = 38, by = 54;
      // legs
      g.lineStyle(3, OUT); g.fillStyle(0xcdd2d6);
      g.fillRect(cx - 16, by - 6, 4, 14); g.fillRect(cx + 12, by - 6, 4, 14);
      // cloth top diamond
      const hw = 28, hh = 14, ty = by - 14;
      g.fillStyle(0xd23b2e); g.lineStyle(3, OUT);
      g.beginPath(); g.moveTo(cx, ty - hh); g.lineTo(cx + hw, ty); g.lineTo(cx, ty + hh); g.lineTo(cx - hw, ty); g.closePath(); g.fillPath(); g.strokePath();
      // white gingham
      g.lineStyle(2, 0xffffff, 0.5);
      for (let i = -2; i <= 2; i++) {
        g.beginPath(); g.moveTo(cx - hw + i * 8, ty + i * 4 - hh); g.lineTo(cx + hw + i * 8, ty + i * 4 + hh); g.strokePath();
        g.beginPath(); g.moveTo(cx + i * 8 - hw, ty + i * -4 + hh); g.lineTo(cx + i * 8 + hw, ty + i * -4 - hh); g.strokePath();
      }
      // plate
      g.fillStyle(0xf5f6f7); g.lineStyle(2, 0xcdd2d6);
      g.fillEllipse(cx, ty, 18, 10); g.strokeEllipse(cx, ty, 18, 10);
      if (dirty) { g.fillStyle(0x8a7a3a); g.fillEllipse(cx - 4, ty, 5, 3); g.fillStyle(0x6a5a2a); g.fillEllipse(cx + 5, ty + 1, 4, 2); }
      this.save(g, dirty ? 'table_dirty' : 'table', W, H);
    }

    // counter
    {
      const g = this.g(); const cx = 38, by = 56;
      this.isoBox(g, cx, by, 30, 15, 26, 0xd9c9a6, 0x9a8456, 0xb89e6e);
      g.fillStyle(0xf5f6f7); g.lineStyle(2, 0xcdd2d6);
      g.fillEllipse(cx - 10, by - 30, 12, 7); g.fillEllipse(cx + 10, by - 28, 12, 7);
      this.save(g, 'counter', 76, 64);
    }

    // stations
    const stations: [string, number, number, number, number][] = [
      ['stove', 0x9aa4ad, 0x6c757d, 0x828c95, 0xe67e22],
      ['grill', 0x6d5145, 0x3e2723, 0x4e342e, 0xc0392b],
      ['oven', 0xc98a3a, 0x7e4a16, 0x9c5e22, 0xf1c40f]
    ];
    for (const [key, top, left, right, burner] of stations) {
      const g = this.g(); const cx = 38, by = 60;
      this.isoBox(g, cx, by, 30, 15, 34, top, left, right);
      g.fillStyle(burner); g.lineStyle(2, OUT);
      g.fillEllipse(cx - 9, by - 36, 9, 5); g.fillEllipse(cx + 9, by - 34, 9, 5);
      this.save(g, key, 76, 72);
    }

    // chair
    {
      const g = this.g(); const cx = 20, by = 34;
      this.isoBox(g, cx, by, 12, 6, 10, 0x8a5a2b, 0x5b3a1c, 0x6e4720);
      g.fillStyle(0x6e4720); g.lineStyle(2, OUT); g.fillRect(cx - 12, by - 26, 4, 18);
      this.save(g, 'chair', 40, 44);
    }

    // plant
    {
      const g = this.g(); const cx = 24, by = 50;
      this.isoBox(g, cx, by, 12, 6, 12, 0x7a5230, 0x4f3320, 0x5e3f27);
      g.fillStyle(0x2e8b3d); g.lineStyle(3, OUT);
      g.fillCircle(cx, by - 22, 14); g.strokeCircle(cx, by - 22, 14);
      g.fillStyle(0x3fae53); g.fillCircle(cx - 5, by - 28, 7);
      g.fillStyle(0xc0392b); g.fillCircle(cx + 4, by - 24, 3);
      this.save(g, 'plant', 48, 60);
    }
    // lamp
    {
      const g = this.g(); const cx = 18, by = 58;
      g.lineStyle(4, 0x2a2230); g.beginPath(); g.moveTo(cx, by); g.lineTo(cx, by - 34); g.strokePath();
      g.fillStyle(0xffd24a); g.lineStyle(3, OUT);
      g.fillTriangle(cx - 14, by - 34, cx + 14, by - 34, cx, by - 54); g.strokeTriangle(cx - 14, by - 34, cx + 14, by - 34, cx, by - 54);
      this.save(g, 'lamp', 40, 64);
    }
  }

  private bigHead(g: Phaser.GameObjects.Graphics, cx: number, by: number, opt: { skin: number; shirt: number; hair: number; zombie?: boolean; chef?: boolean }) {
    g.lineStyle(3, OUT);
    // legs
    g.fillStyle(0x2c3e50); g.fillRect(cx - 8, by - 16, 7, 16); g.fillRect(cx + 1, by - 16, 7, 16);
    // body
    g.fillStyle(opt.shirt); g.fillRoundedRect(cx - 12, by - 34, 24, 22, 6); g.strokeRoundedRect(cx - 12, by - 34, 24, 22, 6);
    // arms
    g.fillStyle(opt.shirt); g.fillRoundedRect(cx - 17, by - 32, 6, 16, 3); g.fillRoundedRect(cx + 11, by - 32, 6, 16, 3);
    // big head
    g.fillStyle(opt.skin); g.fillCircle(cx, by - 46, 16); g.strokeCircle(cx, by - 46, 16);
    // hair
    g.fillStyle(opt.hair); g.lineStyle(3, OUT);
    g.beginPath(); g.arc(cx, by - 50, 16, Math.PI, 0, false); g.closePath(); g.fillPath();
    // eyes
    if (opt.zombie) {
      g.fillStyle(0xffffff); g.fillCircle(cx - 6, by - 47, 4); g.fillCircle(cx + 6, by - 47, 4);
      g.fillStyle(0xc0392b); g.fillCircle(cx - 6, by - 47, 2); g.fillCircle(cx + 6, by - 47, 2);
      // stitched mouth
      g.lineStyle(2, OUT); g.beginPath(); g.moveTo(cx - 7, by - 38); g.lineTo(cx + 7, by - 38); g.strokePath();
      for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(cx + i * 3, by - 41); g.lineTo(cx + i * 3, by - 35); g.strokePath(); }
    } else {
      g.fillStyle(0x1c1326); g.fillCircle(cx - 6, by - 47, 2.5); g.fillCircle(cx + 6, by - 47, 2.5);
      g.lineStyle(2, 0x9a4a3a); g.beginPath(); g.arc(cx, by - 41, 5, 0.15 * Math.PI, 0.85 * Math.PI, false); g.strokePath();
    }
    if (opt.chef) { g.fillStyle(0xffffff); g.lineStyle(3, OUT); g.fillRoundedRect(cx - 12, by - 70, 24, 12, 4); g.strokeRoundedRect(cx - 12, by - 70, 24, 12, 4); g.fillCircle(cx - 7, by - 70, 6); g.fillCircle(cx + 7, by - 70, 6); g.fillCircle(cx, by - 73, 7); }
  }

  private makeCharacters() {
    // zombies (worker + chef)
    for (const chef of [false, true]) {
      const g = this.g();
      this.bigHead(g, 24, 78, { skin: 0x7ac74f, shirt: 0x4a6b8a, hair: 0x365a2a, zombie: true, chef });
      this.save(g, chef ? 'zombie_chef' : 'zombie', 48, 84);
    }
    // customers — varied palettes
    const skins = [0xf1c27d, 0xe0ac69, 0xc68642, 0xffdbac, 0xd9a066, 0xffe0bd];
    const shirts = [0xe74c3c, 0x3498db, 0xf1c40f, 0x1abc9c, 0xe67e22, 0x9b59b6];
    const hairs = [0x3a2a1a, 0x1a1a1a, 0x6a4a2a, 0xb5651d, 0x222222, 0xd4a017];
    for (let i = 0; i < 6; i++) {
      const g = this.g();
      this.bigHead(g, 24, 78, { skin: skins[i], shirt: shirts[i], hair: hairs[i] });
      this.save(g, 'customer' + i, 48, 84);
    }
  }

  private makeBits() {
    // plate w/ food (tinted in scene)
    { const g = this.g(); g.fillStyle(0xf5f6f7); g.lineStyle(2, 0xcdd2d6); g.fillEllipse(16, 10, 26, 14); g.strokeEllipse(16, 10, 26, 14); g.fillStyle(0xffffff); g.fillEllipse(16, 9, 12, 7); this.save(g, 'plate', 32, 22); }
    // thought bubble
    { const g = this.g(); g.fillStyle(0xffffff); g.lineStyle(3, OUT); g.fillCircle(22, 18, 16); g.strokeCircle(22, 18, 16); g.fillCircle(8, 32, 5); g.fillCircle(2, 40, 3); this.save(g, 'bubble', 44, 46); }
    // green puff
    { const g = this.g(); g.fillStyle(0x7ac74f, 0.9); g.fillCircle(24, 24, 22); g.fillStyle(0x9be86a, 0.9); g.fillCircle(16, 18, 12); g.fillCircle(32, 20, 10); this.save(g, 'puff', 48, 48); }
    // soft round shadow
    { const g = this.g(); g.fillStyle(0x000000, 0.25); g.fillEllipse(20, 8, 36, 14); this.save(g, 'shadow', 40, 16); }
  }
}
