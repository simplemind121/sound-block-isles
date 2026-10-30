import Phaser from 'phaser';
import { G } from '../core/Game';
import { COLORS, H, W, cheer, drawBlockRect, goTo, homeButton, iconButton, makeBip, skyBackground, sparkles, talk } from '../ui/ui';
import { blendAnim, buildWord } from '../tasks/tasks';
import { addWorldItem } from './WorldScene';

/**
 * 拼读工坊
 *  - 自由拼（先“写”后读）：孩子用字母方块随意拼，按锤子后逐个读音再连读；是真词就变出物品放进世界。
 *  - 帮鸭鸭拼：看图听词，把字母放进轨道；放错的方块放不进去。
 */
export class WorkshopScene extends Phaser.Scene {
  private bip!: Phaser.GameObjects.Sprite;
  private layer!: Phaser.GameObjects.Container;

  constructor() {
    super('Workshop');
  }

  create(): void {
    this.cameras.main.fadeIn(250, 255, 246, 224);
    skyBackground(this, 0xffd9a0, 0xfff1d6);
    const floor = this.add.graphics();
    floor.fillStyle(0xc68b59, 1).fillRect(0, 600, W, 120);
    floor.fillStyle(0x8d5a3b, 1).fillRect(0, 600, W, 8);
    homeButton(this);
    this.bip = makeBip(this, 130, 300, 6).setDepth(200);
    this.layer = this.add.container(0, 0);
    this.events.once('shutdown', () => G.audio.stop());
    if (G.learnedLetters().length < 3) return this.locked();
    this.menu();
  }

  private locked(): void {
    const p = G.audio.sequence(['prompt.workshop_locked']);
    talk(this, this.bip, p);
    const btn = iconButton(this, W / 2, H / 2, 'hut_letters', () => goTo(this, 'LetterIsland'), { size: 200, color: 0xffffff, dark: 0xd9e2ec });
    this.tweens.add({ targets: btn, scale: 1.06, duration: 500, yoyo: true, repeat: -1 });
    G.islandLetters().forEach((l, i) => {
      this.add.image(W / 2 - 250 + i * 100, 560, `lblock_${l.id}`).setScale(4).setAlpha(G.letterMastered(l.id) ? 1 : 0.3);
    });
  }

  private menu(): void {
    this.layer.removeAll(true);
    const free = iconButton(this, W / 2 - 180, 360, 'i_blocks', () => this.freeMode(), { size: 220, color: COLORS.btn, dark: COLORS.btnDark });
    const help = iconButton(this, W / 2 + 180, 360, 'duck', () => void this.helpMode(), { size: 220, color: COLORS.blue, dark: COLORS.blueDark });
    this.layer.add([free, help]);
    const p = G.audio.sequence(['prompt.workshop_intro']);
    talk(this, this.bip, p);
  }

  // ---------- 自由拼 ----------

  private freeMode(): void {
    this.layer.removeAll(true);
    void G.audio.sequence(['prompt.workshop_free']);
    const back = iconButton(this, W - 70, 66, 'i_blocks', () => this.menu(), { size: 84, color: COLORS.btn, dark: COLORS.btnDark });
    this.layer.add(back);

    const slotN = 4;
    const slotY = 330;
    const rail = this.add.graphics();
    drawBlockRect(rail, W / 2 - 330, slotY - 80, 660, 160, 0x9aa5b1, 0x616e7c);
    this.layer.add(rail);
    const slots = Array.from({ length: slotN }, (_, i) => ({ x: W / 2 - 225 + i * 150, y: slotY, img: null as Phaser.GameObjects.Image | null, id: '' }));
    for (const s of slots) this.layer.add(this.add.rectangle(s.x, s.y, 120, 120, 0x2b2d42, 0.2).setStrokeStyle(4, 0x2b2d42, 0.4));

    const setSlot = (s: (typeof slots)[number], id: string) => {
      s.img?.destroy();
      s.id = id;
      s.img = this.add.image(s.x, s.y, `lblock_${id}`).setScale(7.4).setInteractive({ useHandCursor: true });
      this.layer.add(s.img);
      this.tweens.add({ targets: s.img, scale: { from: 9, to: 7.4 }, duration: 150 });
      s.img.on('pointerdown', () => {
        // 点一下轨道上的方块：拿走它
        G.audio.sfx('pop');
        s.img?.destroy();
        s.img = null;
        s.id = '';
      });
    };

    const learned = G.learnedLetters();
    learned.forEach((id, i) => {
      const home = { x: W / 2 + (i - (learned.length - 1) / 2) * 130, y: 520 };
      const b = this.add.image(home.x, home.y, `lblock_${id}`).setScale(7).setInteractive({ draggable: true, useHandCursor: true });
      this.layer.add(b);
      b.on('pointerdown', () => void G.audio.play(`phoneme.${id}`));
      b.on('drag', (_p: Phaser.Input.Pointer, x: number, y: number) => b.setPosition(x, y));
      b.on('dragend', () => {
        const near = slots.find((s) => Phaser.Math.Distance.Between(s.x, s.y, b.x, b.y) < 85);
        b.setPosition(home.x, home.y);
        if (near) {
          G.audio.sfx('place');
          setSlot(near, id);
        }
      });
    });

    let busy = false;
    const hammer = iconButton(this, W / 2 + 430, slotY, 'i_hammer', async () => {
      const filled = slots.filter((s) => s.img);
      if (busy || filled.length === 0) return;
      busy = true;
      const letters = filled.map((s) => s.id);
      await blendAnim(this, filled.map((s) => s.img!), letters);
      const word = G.findWordByLetters(letters);
      if (!this.scene.isActive()) return;
      if (word) {
        await G.audio.sequence([{ pause: 150 }, `word.${word.id}`, { pause: 200 }, `word.${word.id}`]);
        this.reward(word.id, word.item);
      } else {
        await G.audio.sequence(['prompt.unknown_word']);
      }
      busy = false;
    }, { size: 120, color: COLORS.btn, dark: COLORS.btnDark, iconScale: 9 });
    this.layer.add(hammer);
  }

  private reward(wordId: string, item?: string): void {
    const isNew = !G.data.wordsBuilt[wordId];
    G.data.wordsBuilt[wordId] = (G.data.wordsBuilt[wordId] ?? 0) + 1;
    G.save.ensureReview(`word:${wordId}`);
    addWorldItem(item ?? 'sign', wordId);
    if (isNew) G.data.stars += 1;
    G.save.save();
    const pop = this.add.image(W / 2, 180, item ?? 'sign').setScale(0).setDepth(500);
    if (!item) this.add.text(W / 2, 150, wordId, { fontFamily: 'monospace', fontSize: '40px', color: '#2b2d42', fontStyle: 'bold' }).setOrigin(0.5).setDepth(501);
    this.tweens.add({ targets: pop, scale: 10, duration: 500, ease: 'Back.out' });
    G.audio.sfx('unlock');
    sparkles(this, W / 2, 180, 14, 180);
    cheer(this, this.bip);
    void G.audio.sequence(['prompt.new_item']);
    this.time.delayedCall(2600, () => pop.active && this.tweens.add({ targets: pop, alpha: 0, y: 100, duration: 400, onComplete: () => pop.destroy() }));
  }

  // ---------- 帮鸭鸭拼 ----------

  private pickHelpWord(): string | undefined {
    const words = G.buildableWords(true);
    const dueWord = G.dueReviews(5).find((id) => id.startsWith('word:') && words.some((w) => `word:${w.id}` === id));
    if (dueWord) return dueWord.slice(5);
    const fresh = words.filter((w) => !G.data.wordsBuilt[w.id]);
    const pool = fresh.length ? fresh : words;
    return pool[Math.floor(Math.random() * pool.length)]?.id;
  }

  private async helpMode(): Promise<void> {
    this.layer.removeAll(true);
    const id = this.pickHelpWord();
    if (!id) {
      // 学会的字母还拼不出带图的词：先自由拼
      await G.audio.sequence(['prompt.need_letters']);
      return this.menu();
    }
    await G.audio.sequence(['prompt.workshop_help']);
    if (!this.scene.isActive()) return;
    const word = G.word(id)!;
    const ok = await buildWord(this, id, { bip: this.bip, onBuilt: () => this.reward(id, word.item) });
    if (!this.scene.isActive()) return;
    G.save.recordReview(`word:${id}`, ok);
    const again = iconButton(this, W / 2 + 120, 420, 'i_next', () => void this.helpMode(), { size: 130, color: COLORS.green, dark: COLORS.greenDark });
    const menu = iconButton(this, W / 2 - 120, 420, 'i_blocks', () => this.menu(), { size: 130, color: COLORS.btn, dark: COLORS.btnDark });
    this.layer.add([again, menu]);
  }
}
