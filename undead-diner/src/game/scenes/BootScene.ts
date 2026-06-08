import Phaser from 'phaser';

const OUT = 0x231a30; // thick cartoon outline

/** Procedurally generates chunky, thick-outlined cartoon textures (big heads,
 *  checkered tables, grimy machines, coins). Original placeholder art. */
export default class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  create() {
    this.furniture();
    this.characters();
    this.bits();
    this.scene.start('Game');
    this.scene.launch('HUD');
  }

  private g() { return this.add.graphics(); }
  private save(g: Phaser.GameObjects.Graphics, key: string, w: number, h: number) { g.generateTexture(key, w, h); g.destroy(); }

  private isoBox(g: Phaser.GameObjects.Graphics, cx: number, by: number, hw: number, hh: number, height: number, top: number, left: number, right: number) {
    const ty = by - height;
    g.lineStyle(3, OUT);
    g.fillStyle(left);
    g.beginPath(); g.moveTo(cx - hw, ty); g.lineTo(cx, ty + hh); g.lineTo(cx, by); g.lineTo(cx - hw, by - hh); g.closePath(); g.fillPath(); g.strokePath();
    g.fillStyle(right);
    g.beginPath(); g.moveTo(cx + hw, ty); g.lineTo(cx, ty + hh); g.lineTo(cx, by); g.lineTo(cx + hw, by - hh); g.closePath(); g.fillPath(); g.strokePath();
    g.fillStyle(top);
    g.beginPath(); g.moveTo(cx, ty - hh); g.lineTo(cx + hw, ty); g.lineTo(cx, ty + hh); g.lineTo(cx - hw, ty); g.closePath(); g.fillPath(); g.strokePath();
  }

  private furniture() {
    for (const dirty of [false, true]) {
      const g = this.g(); const W = 104, H = 88, cx = 52, by = 74;
      g.lineStyle(4, OUT); g.fillStyle(0xe7ecef);
      g.fillRect(cx - 22, by - 8, 6, 18); g.fillRect(cx + 16, by - 8, 6, 18);
      const hw = 40, hh = 20, ty = by - 20;
      g.fillStyle(0xd23b2e); g.lineStyle(4, OUT);
      g.beginPath(); g.moveTo(cx, ty - hh); g.lineTo(cx + hw, ty); g.lineTo(cx, ty + hh); g.lineTo(cx - hw, ty); g.closePath(); g.fillPath(); g.strokePath();
      g.lineStyle(3, 0xffffff, 0.55);
      for (let i = -2; i <= 2; i++) {
        g.beginPath(); g.moveTo(cx - hw + i * 12, ty + i * 6 - hh); g.lineTo(cx + hw + i * 12, ty + i * 6 + hh); g.strokePath();
        g.beginPath(); g.moveTo(cx + i * 12 - hw, ty - i * 6 + hh); g.lineTo(cx + i * 12 + hw, ty - i * 6 - hh); g.strokePath();
      }
      g.fillStyle(0xfbfdfe); g.lineStyle(3, 0xcdd2d6);
      g.fillEllipse(cx, ty, 26, 14); g.strokeEllipse(cx, ty, 26, 14);
      if (dirty) { g.fillStyle(0x8a7a3a); g.fillEllipse(cx - 6, ty, 7, 4); g.fillStyle(0x6a5a2a); g.fillEllipse(cx + 7, ty + 1, 6, 3); }
      this.save(g, dirty ? 'table_dirty' : 'table', W, H);
    }

    { const g = this.g(); const cx = 52, by = 78; this.isoBox(g, cx, by, 42, 21, 36, 0xe5d8b8, 0x9a8456, 0xc4ab78);
      g.fillStyle(0xfbfdfe); g.lineStyle(3, 0xcdd2d6); g.fillEllipse(cx - 14, by - 40, 16, 9); g.fillEllipse(cx + 14, by - 38, 16, 9);
      this.save(g, 'counter', 104, 92); }

    const stations: [string, number, number, number, number][] = [
      ['stove', 0x9aa4ad, 0x6c757d, 0x828c95, 0xe67e22],
      ['grill', 0x6d5145, 0x3e2723, 0x4e342e, 0xc0392b],
      ['oven', 0xc98a3a, 0x7e4a16, 0x9c5e22, 0xf1c40f]
    ];
    for (const [key, top, left, right, burner] of stations) {
      const g = this.g(); const cx = 52, by = 84; this.isoBox(g, cx, by, 42, 21, 48, top, left, right);
      g.fillStyle(burner); g.lineStyle(3, OUT); g.fillEllipse(cx - 12, by - 50, 12, 7); g.fillEllipse(cx + 12, by - 48, 12, 7);
      g.fillStyle(0x000000, 0.18); g.fillEllipse(cx - 20, by - 22, 8, 4); // grime
      this.save(g, key, 104, 100);
    }

    { const g = this.g(); const cx = 26, by = 44; this.isoBox(g, cx, by, 16, 8, 12, 0x9c6b3a, 0x5b3a1c, 0x7a4f26);
      g.fillStyle(0x7a4f26); g.lineStyle(3, OUT); g.fillRect(cx - 16, by - 34, 6, 24); this.save(g, 'chair', 52, 56); }

    { const g = this.g(); const cx = 30, by = 60; this.isoBox(g, cx, by, 14, 7, 14, 0x7a5230, 0x4f3320, 0x5e3f27);
      g.fillStyle(0x2e8b3d); g.lineStyle(4, OUT); g.fillCircle(cx, by - 28, 18); g.strokeCircle(cx, by - 28, 18);
      g.fillStyle(0x3fae53); g.fillCircle(cx - 6, by - 36, 9); g.fillStyle(0xc0392b); g.fillCircle(cx + 5, by - 30, 4); this.save(g, 'plant', 60, 78); }
    { const g = this.g(); const cx = 22, by = 70; g.lineStyle(5, 0x2a2230); g.beginPath(); g.moveTo(cx, by); g.lineTo(cx, by - 42); g.strokePath();
      g.fillStyle(0xffd24a); g.lineStyle(4, OUT); g.fillTriangle(cx - 18, by - 42, cx + 18, by - 42, cx, by - 66); g.strokeTriangle(cx - 18, by - 42, cx + 18, by - 42, cx, by - 66); this.save(g, 'lamp', 48, 76); }
  }

  private bigHead(g: Phaser.GameObjects.Graphics, cx: number, by: number, o: { skin: number; shirt: number; hair: number; zombie?: boolean; chef?: boolean }) {
    g.lineStyle(4, OUT);
    g.fillStyle(0x2c3e50); g.fillRect(cx - 11, by - 22, 9, 22); g.fillRect(cx + 2, by - 22, 9, 22);
    g.fillStyle(o.shirt); g.fillRoundedRect(cx - 17, by - 48, 34, 30, 9); g.strokeRoundedRect(cx - 17, by - 48, 34, 30, 9);
    g.fillStyle(o.shirt); g.fillRoundedRect(cx - 24, by - 46, 9, 24, 4); g.fillRoundedRect(cx + 15, by - 46, 9, 24, 4);
    g.fillStyle(o.skin); g.fillCircle(cx, by - 66, 24); g.strokeCircle(cx, by - 66, 24);
    g.fillStyle(o.hair); g.lineStyle(4, OUT); g.beginPath(); g.arc(cx, by - 72, 24, Math.PI, 0, false); g.closePath(); g.fillPath();
    if (o.zombie) {
      g.fillStyle(0xffffff); g.fillCircle(cx - 9, by - 67, 6); g.fillCircle(cx + 9, by - 67, 6);
      g.fillStyle(0xc0392b); g.fillCircle(cx - 9, by - 67, 3); g.fillCircle(cx + 9, by - 67, 3);
      g.lineStyle(3, OUT); g.beginPath(); g.moveTo(cx - 10, by - 54); g.lineTo(cx + 10, by - 54); g.strokePath();
      for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(cx + i * 5, by - 58); g.lineTo(cx + i * 5, by - 50); g.strokePath(); }
    } else {
      g.fillStyle(0x231a30); g.fillCircle(cx - 9, by - 67, 3.5); g.fillCircle(cx + 9, by - 67, 3.5);
      g.lineStyle(3, 0x9a4a3a); g.beginPath(); g.arc(cx, by - 58, 7, 0.15 * Math.PI, 0.85 * Math.PI, false); g.strokePath();
    }
    if (o.chef) { g.fillStyle(0xffffff); g.lineStyle(4, OUT); g.fillRoundedRect(cx - 18, by - 98, 36, 16, 5); g.strokeRoundedRect(cx - 18, by - 98, 36, 16, 5); g.fillCircle(cx - 10, by - 98, 9); g.fillCircle(cx + 10, by - 98, 9); g.fillCircle(cx, by - 104, 10); }
  }

  private characters() {
    for (const chef of [false, true]) {
      const g = this.g(); this.bigHead(g, 46, 116, { skin: 0x7ac74f, shirt: 0x4a6b8a, hair: 0x365a2a, zombie: true, chef });
      this.save(g, chef ? 'zombie_chef' : 'zombie', 92, 122);
    }
    const skins = [0xf1c27d, 0xe0ac69, 0xc68642, 0xffdbac, 0xd9a066, 0xffe0bd];
    const shirts = [0xe74c3c, 0x3498db, 0xf1c40f, 0x1abc9c, 0xe67e22, 0x9b59b6];
    const hairs = [0x3a2a1a, 0x1a1a1a, 0x6a4a2a, 0xb5651d, 0x222222, 0xd4a017];
    for (let i = 0; i < 6; i++) {
      const g = this.g(); this.bigHead(g, 46, 116, { skin: skins[i], shirt: shirts[i], hair: hairs[i] });
      this.save(g, 'customer' + i, 92, 122);
    }
  }

  private bits() {
    { const g = this.g(); g.fillStyle(0xffd24a); g.lineStyle(3, 0x8a6020); g.fillCircle(14, 14, 12); g.strokeCircle(14, 14, 12); g.fillStyle(0xffe79a); g.fillCircle(11, 11, 4); this.save(g, 'coin', 28, 28); }
    { const g = this.g(); g.fillStyle(0xffffff); g.lineStyle(4, OUT); g.fillCircle(26, 22, 20); g.strokeCircle(26, 22, 20); g.fillCircle(10, 40, 6); g.fillCircle(3, 50, 4); this.save(g, 'bubble', 52, 56); }
    { const g = this.g(); g.fillStyle(0x7ac74f, 0.9); g.fillCircle(30, 30, 28); g.fillStyle(0x9be86a, 0.9); g.fillCircle(20, 22, 15); g.fillCircle(40, 24, 13); this.save(g, 'puff', 60, 60); }
  }
}
