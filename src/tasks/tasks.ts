/**
 * 可复用的小任务：字母岛、修桥、复习宝箱都用它们。
 * 原则：不打红叉。选错时材料自己“反馈”——方块弹回去、读出它自己的声音，孩子自己调整。
 * 每个任务返回 Promise<boolean>：第一次就做对为 true（用于间隔复习记录）。
 */
import Phaser from 'phaser';
import { G } from '../core/Game';
import { wait } from '../core/AudioManager';
import { Question } from '../core/types';
import { COLORS, H, W, cheer, drawBlockRect, iconButton, sparkles, speakerButton, wiggle } from '../ui/ui';

type Img = Phaser.GameObjects.Image;

export interface TaskOpts {
  overlay?: boolean; // 盖一层半透明底板（在世界/修桥里弹出时用）
  bip?: Phaser.GameObjects.Sprite;
}

function makeRoot(scene: Phaser.Scene, overlay = false): Phaser.GameObjects.Container {
  // 弹窗要盖住世界里的所有东西（世界里按 y 坐标排深度，HUD 是 2000）
  const root = scene.add.container(0, 0).setDepth(overlay ? 3000 : 300);
  if (overlay) {
    const dim = scene.add.rectangle(W / 2, H / 2, W, H, 0x2b2d42, 0.45).setInteractive();
    const g = scene.add.graphics();
    drawBlockRect(g, 120, 90, W - 240, H - 150, COLORS.panel, 0xe8d9b5);
    root.add([dim, g]);
  }
  return root;
}

function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

/** 从已学字母里挑干扰项（不够时用本岛其他字母） */
export function distractors(target: string, n: number): string[] {
  const pool = G.islandLetters().map((l) => l.id).filter((id) => id !== target);
  const learned = pool.filter((id) => G.learnedLetters().includes(id));
  const pick = shuffle(learned).slice(0, n);
  for (const id of shuffle(pool)) if (pick.length < n && !pick.includes(id)) pick.push(id);
  return pick;
}

function positions(n: number, y: number, gap = 230): { x: number; y: number }[] {
  return Array.from({ length: n }, (_, i) => ({ x: W / 2 + (i - (n - 1) / 2) * gap, y }));
}

const great = () => G.audio.sequence(['prompt.great']);

/** 辨认：听声音，把字母找出来 */
export function findSound(scene: Phaser.Scene, target: string, opts: TaskOpts = {}): Promise<boolean> {
  const root = makeRoot(scene, opts.overlay);
  const ask = () => G.audio.sequence(['prompt.find_intro', `phoneme.${target}`]);
  root.add(speakerButton(scene, W / 2, 210, () => void ask(), 96));
  const choices = shuffle([target, ...distractors(target, 2)]);
  let first = true;
  let busy = false;
  return new Promise((resolve) => {
    positions(choices.length, 440).forEach((p, i) => {
      const id = choices[i];
      const img = scene.add.image(p.x, p.y, `lblock_${id}`).setScale(9).setInteractive({ useHandCursor: true });
      root.add(img);
      img.on('pointerdown', async () => {
        if (busy) return;
        busy = true;
        if (id === target) {
          G.audio.sfx('good');
          sparkles(scene, p.x, p.y);
          cheer(scene, opts.bip);
          scene.tweens.add({ targets: img, scale: 11, duration: 200, yoyo: true });
          await great();
          root.destroy();
          resolve(first);
        } else {
          first = false;
          G.audio.sfx('soft');
          wiggle(scene, img);
          await G.audio.sequence([`phoneme.${id}`, { pause: 300 }, 'prompt.try_again', `phoneme.${target}`]);
          busy = false;
        }
      });
    });
    void ask();
  });
}

/** 大小写配对：大字母找到它的小字母 */
export function caseMatch(scene: Phaser.Scene, target: string, opts: TaskOpts = {}): Promise<boolean> {
  const root = makeRoot(scene, opts.overlay);
  const big = scene.add.image(W / 2, 230, `ublock_${target}`).setScale(9);
  root.add(big);
  const ask = () => G.audio.sequence(['prompt.case_intro', `phoneme.${target}`]);
  root.add(speakerButton(scene, W / 2 + 150, 230, () => void ask(), 80));
  const choices = shuffle([target, ...distractors(target, 2)]);
  let first = true;
  let busy = false;
  return new Promise((resolve) => {
    positions(choices.length, 490).forEach((p, i) => {
      const id = choices[i];
      const img = scene.add.image(p.x, p.y, `lblock_${id}`).setScale(8).setInteractive({ useHandCursor: true });
      root.add(img);
      img.on('pointerdown', async () => {
        if (busy) return;
        busy = true;
        if (id === target) {
          G.audio.sfx('good');
          scene.tweens.add({ targets: img, x: W / 2 + 80, y: 230, duration: 350, ease: 'Back.out' });
          scene.tweens.add({ targets: big, x: W / 2 - 80, duration: 350, ease: 'Back.out' });
          sparkles(scene, W / 2, 230);
          cheer(scene, opts.bip);
          await G.audio.sequence([`letter.${target}`, `phoneme.${target}`, 'prompt.great']);
          root.destroy();
          resolve(first);
        } else {
          first = false;
          G.audio.sfx('soft');
          wiggle(scene, img);
          await G.audio.sequence([`phoneme.${id}`, 'prompt.try_again']);
          busy = false;
        }
      });
    });
    void ask();
  });
}

/** 回忆：把字母方块拖到对的声音（喇叭）上 */
export function recallSound(scene: Phaser.Scene, target: string, opts: TaskOpts = {}): Promise<boolean> {
  const root = makeRoot(scene, opts.overlay);
  const choices = shuffle([target, ...distractors(target, 2)]);
  const spots = positions(3, 260, 260);
  const speakers = choices.map((id, i) => {
    const b = speakerButton(scene, spots[i].x, spots[i].y, () => void G.audio.play(`phoneme.${id}`), 120);
    root.add(b);
    return b;
  });
  const home = { x: W / 2, y: 520 };
  const block = scene.add.image(home.x, home.y, `lblock_${target}`).setScale(8).setInteractive({ draggable: true, useHandCursor: true });
  root.add(block);
  scene.tweens.add({ targets: block, scale: 8.5, duration: 600, yoyo: true, repeat: -1 });
  let first = true;
  void G.audio.sequence(['prompt.recall_intro']);
  return new Promise((resolve) => {
    block.on('drag', (_p: Phaser.Input.Pointer, x: number, y: number) => block.setPosition(x, y));
    block.on('dragend', async () => {
      const i = speakers.findIndex((s) => Phaser.Math.Distance.Between(s.x, s.y, block.x, block.y) < 110);
      if (i < 0) {
        scene.tweens.add({ targets: block, x: home.x, y: home.y, duration: 250, ease: 'Back.out' });
        return;
      }
      if (choices[i] === target) {
        block.disableInteractive();
        scene.tweens.killTweensOf(block);
        scene.tweens.add({ targets: block, x: speakers[i].x, y: speakers[i].y, scale: 7, duration: 200 });
        G.audio.sfx('good');
        sparkles(scene, speakers[i].x, speakers[i].y);
        cheer(scene, opts.bip);
        await G.audio.sequence([`phoneme.${target}`, 'prompt.great']);
        root.destroy();
        resolve(first);
      } else {
        first = false;
        G.audio.sfx('soft');
        wiggle(scene, speakers[i]);
        scene.tweens.add({ targets: block, x: home.x, y: home.y, duration: 300, ease: 'Back.out' });
        await G.audio.sequence([`phoneme.${choices[i]}`, { pause: 200 }, 'prompt.try_again']);
      }
    });
  });
}

/** 拼读动画：方块依次跳起读音，然后靠拢连读 */
export async function blendAnim(scene: Phaser.Scene, blocks: Img[], letters: string[], wordId?: string): Promise<void> {
  for (let i = 0; i < blocks.length; i++) {
    if (!scene.scene.isActive()) return;
    scene.tweens.add({ targets: blocks[i], y: blocks[i].y - 30, duration: 150, yoyo: true });
    await G.audio.sequence([`phoneme.${letters[i]}`]);
    await wait(120);
  }
  if (!wordId || !scene.scene.isActive()) return;
  const cx = blocks.reduce((s, b) => s + b.x, 0) / blocks.length;
  const w = blocks[0].displayWidth;
  blocks.forEach((b, i) => scene.tweens.add({ targets: b, x: cx + (i - (blocks.length - 1) / 2) * w, duration: 300, ease: 'Quad.out' }));
  await wait(320);
  await G.audio.sequence([`word.${wordId}`, { pause: 250 }, `word.${wordId}`]);
}

/** 帮忙拼词：看图（和听词），把字母方块拖进轨道。放错的方块放不进去。 */
export function buildWord(scene: Phaser.Scene, wordId: string, opts: TaskOpts & { onBuilt?: () => void } = {}): Promise<boolean> {
  const word = G.word(wordId)!;
  const root = makeRoot(scene, opts.overlay);
  const duck = scene.add.image(W / 2 - 230, 200, 'duck').setScale(7).setFlipX(false);
  const bubble = scene.add.graphics();
  drawBlockRect(bubble, W / 2 - 110, 120, 170, 160, 0xffffff, 0xd9e2ec);
  const pic = scene.add.image(W / 2 - 25, 200, word.item ?? 'sign').setScale(10);
  root.add([duck, bubble, pic]);
  scene.tweens.add({ targets: duck, angle: { from: -4, to: 4 }, duration: 500, yoyo: true, repeat: -1 });
  const ask = () => G.audio.sequence(['prompt.duck_wants', `word.${wordId}`]);
  root.add(speakerButton(scene, W / 2 + 150, 200, () => void ask(), 90));

  const n = word.letters.length;
  const slotY = 380;
  const slots = positions(n, slotY, 140).map((p) => {
    const g = scene.add.graphics();
    g.fillStyle(0x2b2d42, 0.18).fillRect(p.x - 60, p.y - 60, 120, 120);
    g.lineStyle(4, 0x2b2d42, 0.5).strokeRect(p.x - 60, p.y - 60, 120, 120);
    root.add(g);
    return { ...p, g, filled: null as Img | null };
  });

  const trayLetters = shuffle(Array.from(new Set([...word.letters, ...G.learnedLetters()])));
  const tray = positions(trayLetters.length, 585, 140);
  let first = true;
  return new Promise((resolve) => {
    const finish = async () => {
      const blocks = slots.map((s) => s.filled!) as Img[];
      await blendAnim(scene, blocks, word.letters, wordId);
      G.audio.sfx('unlock');
      sparkles(scene, W / 2, slotY, 16, 200);
      cheer(scene, opts.bip);
      opts.onBuilt?.();
      await great();
      root.destroy();
      resolve(first);
    };
    trayLetters.forEach((id, i) => {
      const home = tray[i];
      const b = scene.add.image(home.x, home.y, `lblock_${id}`).setScale(7).setInteractive({ draggable: true, useHandCursor: true });
      root.add(b);
      b.on('pointerdown', () => G.audio.play(`phoneme.${id}`));
      b.on('drag', (_p: Phaser.Input.Pointer, x: number, y: number) => b.setPosition(x, y));
      b.on('dragend', async () => {
        const empty = slots.map((s, k) => ({ s, k })).filter(({ s }) => !s.filled);
        const near = empty.find(({ s }) => Phaser.Math.Distance.Between(s.x, s.y, b.x, b.y) < 90);
        scene.tweens.add({ targets: b, x: home.x, y: home.y, duration: 250, ease: 'Back.out' });
        if (!near) return;
        if (word.letters[near.k] === id) {
          G.audio.sfx('place');
          near.s.filled = scene.add.image(near.s.x, near.s.y, `lblock_${id}`).setScale(7.4);
          root.add(near.s.filled);
          if (slots.every((s) => s.filled)) {
            root.each((o: Phaser.GameObjects.GameObject) => o.disableInteractive?.());
            void finish();
          }
        } else {
          // 放不进去：轨道抖一抖，提示该放的音
          first = false;
          G.audio.sfx('soft');
          scene.tweens.add({ targets: near.s.g, alpha: 0.3, duration: 90, yoyo: true, repeat: 2 });
          const next = slots.findIndex((s) => !s.filled);
          await G.audio.sequence([`phoneme.${id}`, { pause: 250 }, 'prompt.try_again', `phoneme.${word.letters[next]}`]);
        }
      });
    });
    void ask();
  });
}

/** 押韵：听两个词，点“一样”或“不一样” */
export function rhymeTask(scene: Phaser.Scene, pair: { a: string; b: string; rhyme: boolean }, opts: TaskOpts = {}): Promise<boolean> {
  const root = makeRoot(scene, opts.overlay);
  const sa = speakerButton(scene, W / 2 - 130, 250, () => void G.audio.play(`word.${pair.a}`), 120);
  const sb = speakerButton(scene, W / 2 + 130, 250, () => void G.audio.play(`word.${pair.b}`), 120);
  root.add([sa, sb]);
  const listen = async () => {
    scene.tweens.add({ targets: sa, scale: 1.15, duration: 150, yoyo: true });
    await G.audio.sequence([`word.${pair.a}`]);
    await wait(250);
    scene.tweens.add({ targets: sb, scale: 1.15, duration: 150, yoyo: true });
    await G.audio.sequence([`word.${pair.b}`]);
  };
  let busy = false;
  return new Promise((resolve) => {
    const choose = async (saysRhyme: boolean, btn: Phaser.GameObjects.Container) => {
      if (busy) return;
      busy = true;
      const ok = saysRhyme === pair.rhyme;
      if (ok) {
        G.audio.sfx('good');
        sparkles(scene, btn.x, btn.y);
        cheer(scene, opts.bip);
        await G.audio.sequence(['prompt.great', `word.${pair.a}`, `word.${pair.b}`, pair.rhyme ? 'prompt.rhyme_yes' : 'prompt.rhyme_no']);
      } else {
        G.audio.sfx('soft');
        wiggle(scene, btn);
        await G.audio.sequence(['prompt.listen_again', `word.${pair.a}`, { pause: 250 }, `word.${pair.b}`, pair.rhyme ? 'prompt.rhyme_yes' : 'prompt.rhyme_no']);
      }
      root.destroy();
      resolve(ok);
    };
    const same: Phaser.GameObjects.Container = iconButton(scene, W / 2 - 170, 500, 'i_same', () => void choose(true, same), { size: 170, color: COLORS.green, dark: COLORS.greenDark });
    const diff: Phaser.GameObjects.Container = iconButton(scene, W / 2 + 170, 500, 'i_diff', () => void choose(false, diff), { size: 170, color: COLORS.purple, dark: COLORS.purpleDark });
    root.add([same, diff]);
    void listen();
  });
}

/** 开放式“为什么”问题：每个选项都是好答案，只记录孩子的选择 */
export function askQuestion(scene: Phaser.Scene, q: Question, opts: TaskOpts = {}): Promise<{ option: string; reason?: string }> {
  const root = makeRoot(scene, opts.overlay ?? true);
  const pickFrom = (list: Question['options'], promptId: string): Promise<string> =>
    new Promise((resolve) => {
      const buttons: Phaser.GameObjects.Container[] = [];
      positions(list.length, 400, 260).forEach((p, i) => {
        const o = list[i];
        const btn = iconButton(scene, p.x, p.y, o.icon, async () => {
          buttons.forEach((b) => b.disableInteractive());
          G.audio.sfx('good');
          sparkles(scene, p.x, p.y);
          cheer(scene, opts.bip);
          await G.audio.sequence([`opt.${q.id}.${o.id}`, 'prompt.good_idea']);
          buttons.forEach((b) => b.destroy());
          resolve(o.id);
        }, { size: 180, color: 0xffffff, dark: 0xd9e2ec });
        buttons.push(btn);
        root.add(btn);
      });
      void G.audio.sequence([promptId]);
    });
  const replay = speakerButton(scene, W / 2, 200, () => void G.audio.play(`q.${q.id}`), 90);
  root.add(replay);
  return (async () => {
    const option = await pickFrom(q.options, `q.${q.id}`);
    let reason: string | undefined;
    if (q.reasons) {
      replay.removeAllListeners('pointerdown');
      replay.on('pointerdown', () => void G.audio.play(`q.${q.id}.why`));
      reason = await pickFrom(q.reasons, `q.${q.id}.why`);
    } else {
      await G.audio.sequence([`q.${q.id}.why`]);
    }
    G.data.choices.push({ q: q.id, option, reason, ts: Date.now() });
    G.data.stars += 1;
    G.save.save();
    root.destroy();
    return { option, reason };
  })();
}

/**
 * 从复习队列里挑一个任务来做（修桥和宝箱用）。
 * 优先到期的复习内容；没有到期的就从已学内容里随机选。
 */
export async function runReviewTask(scene: Phaser.Scene, opts: TaskOpts): Promise<boolean> {
  const due = G.dueReviews(1)[0];
  let id = due;
  if (!id) {
    const pool = [...G.learnedLetters().map((l) => `letter:${l}`), ...G.buildableWords(true).map((w) => `word:${w.id}`)];
    id = pool[Math.floor(Math.random() * pool.length)];
  }
  if (!id) {
    const pair = G.content.rhymes[Math.floor(Math.random() * G.content.rhymes.length)];
    const ok = await rhymeTask(scene, pair, opts);
    ok ? G.data.stats.rhymeCorrect++ : G.data.stats.rhymeWrong++;
    G.save.save();
    return ok;
  }
  const [kind, key] = id.split(':');
  let ok: boolean;
  if (kind === 'word') ok = await buildWord(scene, key, opts);
  else ok = await (Math.random() < 0.5 ? findSound : recallSound)(scene, key, opts);
  G.save.recordReview(id, ok);
  return ok;
}
