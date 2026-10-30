/**
 * 每个字母的原创手势动画（由比普表演，孩子跟着做）。
 * 动作名来自 letters.json 的 gesture 字段；新增字母时在这里加一个动作即可，没有的用默认动作。
 */
import Phaser from 'phaser';
import { G } from '../core/Game';
import { wait } from '../core/AudioManager';

type Bip = Phaser.GameObjects.Sprite;

const ACTIONS: Record<string, (s: Phaser.Scene, bip: Bip) => Promise<void>> = {
  async snake(s, bip) {
    const snake = s.add.image(bip.x - 160, bip.y + 40, 'snake').setScale(6).setDepth(bip.depth + 1);
    s.tweens.add({ targets: bip, angle: { from: -14, to: 14 }, duration: 260, yoyo: true, repeat: 4 });
    s.tweens.addCounter({
      from: 0, to: 1, duration: 2200,
      onUpdate: (t) => {
        const v = t.getValue() ?? 0;
        snake.setPosition(bip.x - 160 + v * 320, bip.y + 40 + Math.sin(v * Math.PI * 4) * 40);
      },
    });
    await wait(2300);
    snake.destroy();
    bip.setAngle(0);
  },
  async ant(s, bip) {
    const ants = [0, 1, 2].map((i) => s.add.image(bip.x - 40 + i * 30, bip.y + 90 + i * 25, 'ant').setScale(3).setDepth(bip.depth + 1));
    ants.forEach((a, i) => s.tweens.add({ targets: a, y: bip.y - 60, x: a.x + 30, duration: 1500, delay: i * 250 }));
    s.tweens.add({ targets: bip, scaleX: bip.scaleX * 1.05, duration: 150, yoyo: true, repeat: 5 });
    await wait(2300);
    ants.forEach((a) => a.destroy());
  },
  async top(s, bip) {
    const top = s.add.image(bip.x + 140, bip.y + 50, 'top').setScale(6).setDepth(bip.depth + 1);
    s.tweens.add({ targets: top, angle: 720, duration: 2000 });
    const sx = bip.scaleX;
    s.tweens.add({ targets: bip, scaleX: { from: sx, to: -sx }, duration: 200, yoyo: true, repeat: 4, onComplete: () => bip.setScale(sx, bip.scaleY) });
    await wait(2200);
    top.destroy();
  },
  async shiver(s, bip) {
    const x = bip.x;
    bip.setTint(0xbfe6ff);
    s.tweens.add({ targets: bip, x: x + 6, duration: 40, yoyo: true, repeat: 24, onComplete: () => bip.setX(x) });
    const flakes = Array.from({ length: 8 }, (_, i) => {
      const f = s.add.image(bip.x - 150 + i * 40, bip.y - 200, 'sparkle').setScale(4).setDepth(bip.depth + 1);
      s.tweens.add({ targets: f, y: bip.y + 120, duration: 1800 + i * 60, alpha: 0 });
      return f;
    });
    await wait(2200);
    bip.clearTint();
    flakes.forEach((f) => f.destroy());
  },
  async pop(s, bip) {
    for (let i = 0; i < 3; i++) {
      const b = s.add.circle(bip.x + 30, bip.y - 10, 12, 0xffffff, 0.6).setStrokeStyle(3, 0x4ea8de).setDepth(bip.depth + 1);
      s.tweens.add({ targets: bip, scaleX: bip.scaleX * 1.1, scaleY: bip.scaleY * 0.95, duration: 150, yoyo: true });
      s.tweens.add({ targets: b, x: b.x + 80 + i * 40, y: b.y - 90 - i * 20, scale: 2.5, duration: 550 });
      await wait(600);
      G.audio.sfx('pop');
      s.tweens.add({ targets: b, scale: 4, alpha: 0, duration: 120, onComplete: () => b.destroy() });
      await wait(120);
    }
  },
  async nose(s, bip) {
    const waves = [0, 1, 2].map((i) => {
      const t = s.add.text(bip.x + 70 + i * 26, bip.y - 30, ')', { fontSize: '44px', color: '#1d4e89', fontStyle: 'bold' }).setDepth(bip.depth + 1).setAlpha(0);
      s.tweens.add({ targets: t, alpha: 1, x: t.x + 10, duration: 400, delay: i * 200, yoyo: true, repeat: 2 });
      return t;
    });
    s.tweens.add({ targets: bip, angle: { from: -3, to: 3 }, duration: 90, yoyo: true, repeat: 10, onComplete: () => bip.setAngle(0) });
    await wait(2300);
    waves.forEach((w) => w.destroy());
  },
};

export async function playGesture(scene: Phaser.Scene, gesture: string, bip: Bip): Promise<void> {
  const sx = Math.abs(bip.scaleX);
  const sy = bip.scaleY;
  const act = ACTIONS[gesture];
  if (act) await act(scene, bip);
  else {
    scene.tweens.add({ targets: bip, y: bip.y - 40, duration: 250, yoyo: true, repeat: 2 });
    await wait(1500);
  }
  // 动作结束：比普回到原来的样子
  if (!bip.active) return;
  scene.tweens.getTweensOf(bip).forEach((t) => {
    const props = t.data.map((d) => (d as Phaser.Tweens.TweenData).key);
    if (props.some((k) => k === 'angle' || k === 'scaleX' || k === 'x')) t.stop();
  });
  bip.setAngle(0).setScale(sx, sy).clearTint();
}
