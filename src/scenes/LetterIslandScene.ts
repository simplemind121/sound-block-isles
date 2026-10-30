import Phaser from 'phaser';
import { G } from '../core/Game';
import { wait } from '../core/AudioManager';
import { COLORS, H, W, cheer, homeButton, iconButton, makeBip, skyBackground, sparkles, speakerButton, talk } from '../ui/ui';
import { caseMatch, findSound, recallSound } from '../tasks/tasks';
import { traceLetter } from '../tasks/trace';
import { playGesture } from '../tasks/gestures';

/**
 * 字母岛：每个字母按蒙特梭利三阶段走一遍
 *   命名（听音 + 手势 + 配图）→ 描红 → 辨认（找出来、大小写配对）→ 回忆（拖到对的声音）
 * 学会后解锁这个字母的方块，比普的声音盒亮起一格。
 */
export class LetterIslandScene extends Phaser.Scene {
  private bip!: Phaser.GameObjects.Sprite;
  private layer!: Phaser.GameObjects.Container;
  private progress!: Phaser.GameObjects.Container;

  constructor() {
    super('LetterIsland');
  }

  create(): void {
    this.cameras.main.fadeIn(250, 255, 246, 224);
    skyBackground(this);
    const sand = this.add.graphics();
    sand.fillStyle(0xf2d49b, 1).fillRect(0, 560, W, 160);
    sand.fillStyle(0x5fb3e8, 1).fillRect(0, 660, W, 60);
    homeButton(this);
    this.bip = makeBip(this, 170, 470, 8).setDepth(200);
    this.layer = this.add.container(0, 0);
    this.progress = this.add.container(0, 0).setDepth(400);
    this.events.once('shutdown', () => G.audio.stop());
    this.showStones();
  }

  private clear(): void {
    this.layer.removeAll(true);
    this.progress.removeAll(true);
  }

  /** 六块字母石：孩子自己选，推荐的那块会跳 */
  private showStones(): void {
    this.clear();
    const letters = G.islandLetters();
    const next = G.nextLetter();
    letters.forEach((l, i) => {
      const x = 360 + i * 145;
      const y = 330;
      const img = this.add.image(x, y, `lblock_${l.id}`).setScale(7).setInteractive({ useHandCursor: true });
      const stage = G.letterStage(l.id);
      if (stage < 3) img.setAlpha(0.75);
      this.layer.add(img);
      for (let d = 0; d < 3; d++) {
        const dot = this.add.rectangle(x - 30 + d * 30, y + 85, 20, 20, d < stage ? 0xffd23f : 0xffffff, d < stage ? 1 : 0.5).setStrokeStyle(3, 0x2b2d42);
        this.layer.add(dot);
      }
      if (l.id === next) this.tweens.add({ targets: img, y: y - 18, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      img.on('pointerdown', () => {
        G.audio.unlock();
        G.audio.sfx('tap');
        void this.lesson(l.id);
      });
    });
    const p = G.audio.sequence(['prompt.letter_island_intro']);
    talk(this, this.bip, p);
  }

  private setProgress(step: number): void {
    this.progress.removeAll(true);
    for (let i = 0; i < 5; i++) {
      this.progress.add(this.add.rectangle(W / 2 - 100 + i * 50, 50, 34, 34, i < step ? 0x7bd389 : 0xffffff, i < step ? 1 : 0.6).setStrokeStyle(4, 0x2b2d42));
    }
  }

  private waitNext(): Promise<void> {
    return new Promise((resolve) => {
      const btn = iconButton(this, W - 110, H - 110, 'i_next', () => {
        btn.destroy();
        resolve();
      }, { size: 120, color: COLORS.green, dark: COLORS.greenDark });
      this.layer.add(btn);
      this.tweens.add({ targets: btn, scale: 1.08, duration: 500, yoyo: true, repeat: -1 });
    });
  }

  private async lesson(id: string): Promise<void> {
    this.clear();
    const l = G.letter(id);
    const alive = () => this.scene.isActive();

    // 1. 命名：这是 /s/，就像 snake
    this.setProgress(0);
    const upper = this.add.image(470, 300, `glyphU_${id}`).setScale(8.5);
    const lower = this.add.image(700, 300, `glyph_${id}`).setScale(8.5);
    const pic = this.add.image(1010, 300, l.picture).setScale(14);
    this.layer.add([upper, lower, pic]);
    const intro = async () => {
      const p = G.audio.sequence(['prompt.this_sound_is', `phoneme.${id}`, { pause: 300 }, `phoneme.${id}`, { pause: 300 }, 'prompt.like_in', `word.${l.pictureWord}`, { pause: 200 }, `phoneme.${id}`]);
      talk(this, this.bip, p);
      await p;
      if (!alive()) return;
      const p2 = G.audio.sequence(['prompt.do_gesture']);
      await p2;
      if (!alive()) return;
      const g = playGesture(this, l.gesture, this.bip);
      for (let k = 0; k < 3; k++) {
        await G.audio.sequence([`phoneme.${id}`]);
        await wait(250);
      }
      await g;
    };
    pic.setInteractive({ useHandCursor: true }).on('pointerdown', () => void G.audio.sequence([`word.${l.pictureWord}`, `phoneme.${id}`]));
    upper.setInteractive({ useHandCursor: true }).on('pointerdown', () => void G.audio.play(`phoneme.${id}`));
    lower.setInteractive({ useHandCursor: true }).on('pointerdown', () => void G.audio.play(`phoneme.${id}`));
    this.layer.add(speakerButton(this, 700, 520, () => void intro(), 96));
    await intro();
    if (!alive()) return;
    await this.waitNext();
    if (!alive()) return;
    this.clear();

    // 2. 描红（砂纸字母）
    this.setProgress(1);
    await traceLetter(this, id, this.bip);
    if (!alive()) return;
    G.save.setLetterStage(id, 1);

    // 3. 辨认：听音找字母（第一次没找对就再来一轮）
    this.setProgress(2);
    let ok = await findSound(this, id, { bip: this.bip });
    if (!ok && alive()) ok = await findSound(this, id, { bip: this.bip });
    if (!alive()) return;

    // 4. 辨认：大小写配对
    this.setProgress(3);
    const caseOk = await caseMatch(this, id, { bip: this.bip });
    if (!alive()) return;
    if (ok || caseOk) G.save.setLetterStage(id, 2);

    // 5. 回忆：这是什么声音？
    this.setProgress(4);
    const recallOk = await recallSound(this, id, { bip: this.bip });
    if (!alive()) return;
    this.setProgress(5);
    G.save.ensureReview(`letter:${id}`);
    G.save.recordReview(`letter:${id}`, recallOk && ok);
    if (!caseOk) G.data.stats.errors[`case:${id}`] = (G.data.stats.errors[`case:${id}`] ?? 0) + 1;

    const wasMastered = G.letterMastered(id);
    if (recallOk && G.letterStage(id) >= 2) G.save.setLetterStage(id, 3);
    if (!wasMastered && G.letterMastered(id)) await this.unlock(id);
    else {
      G.data.stars += 1;
      G.save.save();
      await G.audio.sequence(['prompt.great']);
    }
    if (alive()) this.showStones();
  }

  private async unlock(id: string): Promise<void> {
    const blockKey = `lblock_${id}`;
    if (!G.data.unlockedBlocks.includes(blockKey)) G.data.unlockedBlocks.push(blockKey);
    G.data.stars += 2;
    G.save.flush();
    const b = this.add.image(W / 2, 330, blockKey).setScale(0).setDepth(500);
    this.layer.add(b);
    this.tweens.add({ targets: b, scale: 12, angle: 360, duration: 700, ease: 'Back.out' });
    G.audio.sfx('unlock');
    sparkles(this, W / 2, 330, 20, 280);
    cheer(this, this.bip, 2500);
    const p = G.audio.sequence(['prompt.unlock_block', `phoneme.${id}`]);
    talk(this, this.bip, p);
    await p;
    await wait(400);
  }
}
