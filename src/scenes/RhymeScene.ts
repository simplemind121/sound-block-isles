import Phaser from 'phaser';
import { G } from '../core/Game';
import { COLORS, H, W, homeButton, iconButton, makeBip, skyBackground, talk } from '../ui/ui';
import { rhymeTask } from '../tasks/tasks';

/** 押韵小舞台：听两个词，判断押不押韵。每轮 6 题，押韵和不押韵各一半。 */
export class RhymeScene extends Phaser.Scene {
  private bip!: Phaser.GameObjects.Sprite;

  constructor() {
    super('Rhyme');
  }

  create(): void {
    this.cameras.main.fadeIn(250, 255, 246, 224);
    skyBackground(this, 0xd7c4f2, 0xf3ecff);
    const stage = this.add.graphics();
    stage.fillStyle(0x7b52ae, 1).fillRect(0, 610, W, 110);
    stage.fillStyle(0xb48ae0, 1).fillRect(0, 610, W, 12);
    homeButton(this);
    this.bip = makeBip(this, 140, 520, 6).setDepth(200);
    this.add.image(W - 140, 540, 'duck').setScale(6).setFlipX(true);
    this.events.once('shutdown', () => G.audio.stop());
    void this.round();
  }

  private pickPairs(n: number) {
    const yes = Phaser.Utils.Array.Shuffle(G.content.rhymes.filter((p) => p.rhyme)).slice(0, n / 2);
    const no = Phaser.Utils.Array.Shuffle(G.content.rhymes.filter((p) => !p.rhyme)).slice(0, n / 2);
    return Phaser.Utils.Array.Shuffle([...yes, ...no]);
  }

  private async round(): Promise<void> {
    const alive = () => this.scene.isActive();
    const p = G.audio.sequence(['prompt.rhyme_intro']);
    talk(this, this.bip, p);
    await p;
    const pairs = this.pickPairs(6);
    const marks: Phaser.GameObjects.Image[] = [];
    pairs.forEach((_, i) => marks.push(this.add.image(W / 2 - 150 + i * 60, 60, 'star').setScale(4).setAlpha(0.25)));
    for (let i = 0; i < pairs.length; i++) {
      if (!alive()) return;
      const ok = await rhymeTask(this, pairs[i], { bip: this.bip });
      if (!alive()) return;
      ok ? G.data.stats.rhymeCorrect++ : G.data.stats.rhymeWrong++;
      if (!ok) G.data.stats.errors[`rhyme:${pairs[i].a}-${pairs[i].b}`] = (G.data.stats.errors[`rhyme:${pairs[i].a}-${pairs[i].b}`] ?? 0) + 1;
      G.save.save();
      marks[i].setAlpha(1);
      this.tweens.add({ targets: marks[i], scale: 6, duration: 150, yoyo: true });
    }
    G.data.stars += 1;
    G.save.save();
    await G.audio.sequence(['prompt.great']);
    if (!alive()) return;
    const again: Phaser.GameObjects.Container = iconButton(this, W / 2, H / 2, 'i_next', () => {
      again.destroy();
      marks.forEach((m) => m.destroy());
      void this.round();
    }, { size: 150, color: COLORS.green, dark: COLORS.greenDark });
  }
}
