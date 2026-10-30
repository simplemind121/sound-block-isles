/**
 * 砂纸字母：用手指描字母，同时听读音；描对了，方块一格一格亮起来。
 * 很宽容：手指离路径 45 像素以内都算，抬手后可以接着描。
 */
import Phaser from 'phaser';
import { G } from '../core/Game';
import { sampleStroke } from '../core/strokes';
import { W, cheer, sparkles } from '../ui/ui';
import { GLYPH_N, TRACE_FIT, fitMap } from '../art/ArtFactory';

export function traceLetter(scene: Phaser.Scene, letterId: string, bip?: Phaser.GameObjects.Sprite, cx = W / 2 + 60, cy = 380): Promise<void> {
  const letter = G.letter(letterId);
  const S = 400;
  const x0 = cx - S / 2;
  const y0 = cy - S / 2;
  const root = scene.add.container(0, 0).setDepth(300);
  const guide = scene.add.image(x0, y0, `tglyphg_${letterId}`).setOrigin(0).setScale(S / GLYPH_N);
  root.add(guide);
  const color = Phaser.Display.Color.HexStringToColor(letter.color).color;
  const toGrid = fitMap(letter.strokesLower, TRACE_FIT);
  const k = S / GLYPH_N;
  const strokes = letter.strokesLower.map((s) =>
    sampleStroke(s, 0.02).map((p) => {
      const [gx, gy] = toGrid(p.x, p.y);
      return { x: x0 + gx * k, y: y0 + gy * k };
    }),
  );
  const lit = scene.add.graphics();
  const trail = scene.add.graphics();
  root.add([lit, trail]);
  const startDot = scene.add.circle(0, 0, 22, 0x48a35a).setStrokeStyle(5, 0xffffff);
  const ghost = scene.add.circle(0, 0, 14, 0xffd23f).setStrokeStyle(4, 0x2b2d42).setAlpha(0);
  root.add([startDot, ghost]);
  const tol = 45;
  const cell = k * 3.2;
  let si = 0;
  let pi = 0;
  let down = false;
  let last: { x: number; y: number } | null = null;

  const demo = () => {
    const pts = strokes[si];
    if (!pts) return;
    startDot.setPosition(pts[0].x, pts[0].y);
    scene.tweens.add({ targets: startDot, scale: 1.25, duration: 400, yoyo: true, repeat: 1 });
    if (pts.length < 2) return;
    ghost.setPosition(pts[0].x, pts[0].y).setAlpha(1);
    scene.tweens.addCounter({
      from: 0,
      to: pts.length - 1,
      duration: pts.length * 45,
      onUpdate: (tw) => {
        const p = pts[Math.floor(tw.getValue() ?? 0)];
        ghost.setPosition(p.x, p.y);
      },
      onComplete: () => ghost.setAlpha(0),
    });
  };

  return new Promise((resolve) => {
    const light = (p: { x: number; y: number }) => {
      lit.fillStyle(0x2b2d42, 0.6).fillRect(p.x - cell / 2 + 4, p.y - cell / 2 + 4, cell, cell);
      lit.fillStyle(color, 1).fillRect(p.x - cell / 2, p.y - cell / 2, cell, cell);
      lit.fillStyle(0xffffff, 0.45).fillRect(p.x - cell / 2, p.y - cell / 2, cell, cell / 4);
    };
    const done = async () => {
      scene.input.off('pointerdown', onDown);
      scene.input.off('pointermove', onMove);
      scene.input.off('pointerup', onUp);
      startDot.destroy();
      trail.clear();
      lit.clear();
      guide.setTexture(`tglyph_${letterId}`);
      scene.tweens.add({ targets: guide, alpha: { from: 0.3, to: 1 }, duration: 150, yoyo: true, repeat: 2 });
      G.audio.sfx('good');
      sparkles(scene, cx, cy, 14, 220);
      cheer(scene, bip);
      await G.audio.sequence([`phoneme.${letterId}`, 'prompt.trace_good', `phoneme.${letterId}`]);
      root.destroy();
      resolve();
    };
    const advance = (x: number, y: number) => {
      const pts = strokes[si];
      // 允许跳过一两个点，避免手指稍快就卡住
      for (let look = 0; look < 3 && pi + look < pts.length; look++) {
        const p = pts[pi + look];
        if (Phaser.Math.Distance.Between(x, y, p.x, p.y) < tol) {
          for (let k = pi; k <= pi + look; k++) light(pts[k]);
          pi += look + 1;
          break;
        }
      }
      if (pi >= pts.length) {
        G.audio.sfx('pop');
        void G.audio.play(`phoneme.${letterId}`);
        si++;
        pi = 0;
        if (si >= strokes.length) void done();
        else demo();
      }
    };
    const onDown = (p: Phaser.Input.Pointer) => {
      down = true;
      last = { x: p.x, y: p.y };
      advance(p.x, p.y);
    };
    const onMove = (p: Phaser.Input.Pointer) => {
      if (!down || si >= strokes.length) return;
      if (last) {
        trail.lineStyle(10, 0xffffff, 0.5).lineBetween(last.x, last.y, p.x, p.y);
      }
      last = { x: p.x, y: p.y };
      advance(p.x, p.y);
    };
    const onUp = () => {
      down = false;
      last = null;
      scene.time.delayedCall(300, () => trail.active && trail.clear());
    };
    scene.input.on('pointerdown', onDown);
    scene.input.on('pointermove', onMove);
    scene.input.on('pointerup', onUp);
    root.once(Phaser.GameObjects.Events.DESTROY, () => {
      scene.input.off('pointerdown', onDown);
      scene.input.off('pointermove', onMove);
      scene.input.off('pointerup', onUp);
    });
    void G.audio.sequence(['prompt.trace_intro', `phoneme.${letterId}`]).then(demo);
    demo();
  });
}
