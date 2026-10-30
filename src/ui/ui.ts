import Phaser from 'phaser';
import { G } from '../core/Game';

export const W = 1280;
export const H = 720;

export const COLORS = {
  sky: 0x5fb3e8,
  panel: 0xfff6e0,
  panelEdge: 0x2b2d42,
  btn: 0xffd23f,
  btnDark: 0xd9a400,
  green: 0x7bd389,
  greenDark: 0x48a35a,
  blue: 0x4ea8de,
  blueDark: 0x1d4e89,
  pink: 0xf78fb3,
  pinkDark: 0xd66a91,
  purple: 0xb48ae0,
  purpleDark: 0x7b52ae,
};

export const FONT = '"PingFang SC","Microsoft YaHei","Noto Sans SC",system-ui,sans-serif';

/** 方块风格的底板（带亮边暗边） */
export function blockRect(scene: Phaser.Scene, x: number, y: number, w: number, h: number, color: number, dark: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  drawBlockRect(g, x, y, w, h, color, dark);
  return g;
}

export function drawBlockRect(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, color: number, dark: number): void {
  const e = 6;
  g.fillStyle(0x2b2d42, 1).fillRect(x - 4, y - 4, w + 8, h + 8);
  g.fillStyle(dark, 1).fillRect(x, y, w, h);
  g.fillStyle(color, 1).fillRect(x, y, w - e, h - e);
  g.fillStyle(0xffffff, 0.35).fillRect(x, y, w - e, e);
}

export interface IconButton extends Phaser.GameObjects.Container {
  setEnabled(v: boolean): void;
}

/** 大图标按钮：不依赖文字，按下有弹跳和音效 */
export function iconButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  icon: string,
  onTap: () => void,
  opts: { size?: number; color?: number; dark?: number; iconScale?: number; silent?: boolean } = {},
): IconButton {
  const size = opts.size ?? 100;
  const c = scene.add.container(x, y) as IconButton;
  const g = scene.add.graphics();
  drawBlockRect(g, -size / 2, -size / 2, size, size, opts.color ?? COLORS.btn, opts.dark ?? COLORS.btnDark);
  const img = scene.add.image(-3, -3, icon);
  const tex = scene.textures.get(icon).getSourceImage();
  img.setScale(opts.iconScale ?? Math.floor((size * 0.6) / Math.max(tex.width, tex.height)));
  c.add([g, img]);
  c.setSize(size + 8, size + 8);
  c.setInteractive({ useHandCursor: true });
  let enabled = true;
  c.setEnabled = (v: boolean) => {
    enabled = v;
    c.setAlpha(v ? 1 : 0.4);
  };
  c.on('pointerdown', () => {
    if (!enabled) return;
    G.audio.unlock();
    if (!opts.silent) G.audio.sfx('tap');
    scene.tweens.add({ targets: c, scale: 0.88, duration: 70, yoyo: true });
    onTap();
  });
  return c;
}

/** 左上角回家按钮 */
export function homeButton(scene: Phaser.Scene, onTap?: () => void): IconButton {
  return iconButton(scene, 70, 66, 'i_home', onTap ?? (() => goTo(scene, 'World')), { size: 84, color: COLORS.green, dark: COLORS.greenDark }).setDepth(500) as IconButton;
}

export function speakerButton(scene: Phaser.Scene, x: number, y: number, onTap: () => void, size = 84): IconButton {
  return iconButton(scene, x, y, 'i_speaker', onTap, { size, color: COLORS.blue, dark: COLORS.blueDark, silent: true });
}

export function goTo(scene: Phaser.Scene, key: string, data?: object): void {
  G.audio.stop();
  scene.cameras.main.fadeOut(220, 255, 246, 224);
  scene.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => scene.scene.start(key, data));
}

/** 天空背景 + 飘动的云 */
export function skyBackground(scene: Phaser.Scene, top = 0x8fd0f5, bottom = 0xd9f1ff): void {
  const g = scene.add.graphics();
  g.fillGradientStyle(top, top, bottom, bottom, 1).fillRect(0, 0, W, H);
  for (let i = 0; i < 3; i++) {
    const cl = scene.add.image(200 + i * 420, 70 + (i % 2) * 50, 'cloud').setScale(6).setAlpha(0.9);
    scene.tweens.add({ targets: cl, x: cl.x + 60, duration: 6000 + i * 1500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }
}

/** 比普：会眨眼、会上下浮动 */
export function makeBip(scene: Phaser.Scene, x: number, y: number, scale = 6): Phaser.GameObjects.Sprite {
  const s = scene.add.sprite(x, y, 'bip').setScale(scale);
  scene.tweens.add({ targets: s, y: y - scale, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  const blink = scene.time.addEvent({
    delay: 2600,
    loop: true,
    callback: () => {
      if (s.texture.key !== 'bip') return;
      s.setTexture('bip_blink');
      scene.time.delayedCall(140, () => s.active && s.texture.key === 'bip_blink' && s.setTexture('bip'));
    },
  });
  s.once(Phaser.GameObjects.Events.DESTROY, () => blink.remove());
  return s;
}

export function cheer(scene: Phaser.Scene, bip: Phaser.GameObjects.Sprite | undefined, ms = 1200): void {
  if (!bip) return;
  bip.setTexture('bip_happy');
  scene.tweens.add({ targets: bip, angle: { from: -8, to: 8 }, duration: 120, yoyo: true, repeat: 3, onComplete: () => bip.setAngle(0) });
  scene.time.delayedCall(ms, () => bip.active && bip.setTexture('bip'));
}

export function sparkles(scene: Phaser.Scene, x: number, y: number, n = 10, spread = 120): void {
  for (let i = 0; i < n; i++) {
    const s = scene.add.image(x, y, i % 3 ? 'sparkle' : 'star').setScale(i % 3 ? 5 : 3).setDepth(9000);
    const a = (Math.PI * 2 * i) / n;
    scene.tweens.add({
      targets: s,
      x: x + Math.cos(a) * spread * (0.6 + Math.random() * 0.6),
      y: y + Math.sin(a) * spread * (0.6 + Math.random() * 0.6),
      alpha: 0,
      angle: 180,
      duration: 700 + Math.random() * 300,
      onComplete: () => s.destroy(),
    });
  }
}

export function wiggle(scene: Phaser.Scene, target: Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject): void {
  const x = (target as unknown as { x: number }).x;
  scene.tweens.add({ targets: target, x: x + 10, duration: 50, yoyo: true, repeat: 3, onComplete: () => ((target as unknown as { x: number }).x = x) });
}

/** 屏幕上的小字说明只给大人看（孩子靠语音和图标），所以字号小、颜色浅 */
export function hintText(scene: Phaser.Scene, x: number, y: number, text: string): Phaser.GameObjects.Text {
  return scene.add.text(x, y, text, { fontFamily: FONT, fontSize: '20px', color: '#2b2d42' }).setOrigin(0.5).setAlpha(0.55);
}

/** 让比普说话时轻轻点头 */
export function talk(scene: Phaser.Scene, bip: Phaser.GameObjects.Sprite | undefined, p: Promise<unknown>): void {
  if (!bip) return;
  const tw = scene.tweens.add({ targets: bip, scaleY: bip.scaleY * 1.06, duration: 140, yoyo: true, repeat: -1 });
  const sy = bip.scaleY;
  void p.finally(() => {
    tw.stop();
    if (bip.active) bip.scaleY = sy;
  });
}
