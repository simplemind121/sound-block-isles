import Phaser from 'phaser';
import { G } from '../core/Game';
import { BLOCKS } from '../art/sprites';
import { COLORS, H, W, cheer, goTo, iconButton, IconButton, makeBip, sparkles } from '../ui/ui';
import { askQuestion, runReviewTask } from '../tasks/tasks';
import { openParentPanel } from '../parent/ParentPanel';

export const TILE = 48;
export const COLS = 26;
export const ROWS = 11;
const OX = (W - COLS * TILE) / 2;
const OY = 92;
export const BRIDGE_ROW = 5;
export const BRIDGE_COL0 = 16;

type Terrain = 'water' | 'grass' | 'sand' | 'fog' | 'bridge';

export function terrainAt(c: number, r: number): Terrain {
  if (r === BRIDGE_ROW && c >= BRIDGE_COL0 && c < BRIDGE_COL0 + 6) return 'bridge';
  const home = c >= 1 && c <= 15 && r >= 1 && r <= 9 && !((c === 1 || c === 15) && (r === 1 || r === 9));
  if (home) return c === 1 || c === 15 || r === 1 || r === 9 ? 'sand' : 'grass';
  if (c >= 22 && c <= 24 && r >= 2 && r <= 8) return 'fog';
  return 'water';
}

interface Landmark {
  id: string;
  tex: string;
  col: number;
  row: number;
  scene?: string;
  prompt: string;
}

const LANDMARKS: Landmark[] = [
  { id: 'letters', tex: 'hut_letters', col: 4, row: 3, scene: 'LetterIsland', prompt: 'prompt.letter_island' },
  { id: 'workshop', tex: 'hut_workshop', col: 10, row: 3, scene: 'Workshop', prompt: 'prompt.workshop' },
  { id: 'rhyme', tex: 'hut_stage', col: 4, row: 7, scene: 'Rhyme', prompt: 'prompt.rhyme_stage' },
  { id: 'bridge', tex: 'sign', col: 14, row: 4, scene: 'Bridge', prompt: 'prompt.bridge' },
];
const QUESTION_TILE = { col: 9, row: 7 };
const TREES = [[2, 2], [13, 2], [2, 5], [14, 8], [7, 9]];
const CHEST_TILE = { col: 12, row: 7 };

const key = (c: number, r: number) => `${c},${r}`;
const tileXY = (c: number, r: number) => ({ x: OX + c * TILE + TILE / 2, y: OY + r * TILE + TILE / 2 });

export class WorldScene extends Phaser.Scene {
  private bip!: Phaser.GameObjects.Sprite;
  private tool = 'hand';
  private toolButtons: { id: string; btn: IconButton }[] = [];
  private blockImgs = new Map<string, Phaser.GameObjects.Image>();
  private itemImgs = new Map<string, Phaser.GameObjects.Image>();
  private reserved = new Set<string>();
  private busy = false;
  private chest?: Phaser.GameObjects.Image;
  private walking?: Phaser.Tweens.Tween;

  constructor() {
    super('World');
  }

  create(): void {
    this.busy = false;
    this.tool = 'hand';
    this.toolButtons = [];
    this.blockImgs.clear();
    this.itemImgs.clear();
    this.reserved.clear();
    this.cameras.main.fadeIn(250, 255, 246, 224);
    this.add.rectangle(W / 2, H / 2, W, H, COLORS.sky);
    this.drawTerrain();
    this.drawLandmarks();
    this.drawBridge();
    this.drawPlaced();

    const h = G.data.world.hero;
    const p = tileXY(h.col, h.row);
    this.bip = makeBip(this, p.x, p.y - 8, 3).setDepth(p.y + 1);
    this.drawHud();
    this.drawToolbar();
    this.refreshChest();

    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length || this.busy) return;
      const c = Math.floor((ptr.x - OX) / TILE);
      const r = Math.floor((ptr.y - OY) / TILE);
      if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return;
      G.audio.unlock();
      this.onTile(c, r);
    });

    const first = !G.data.introSeen;
    G.data.introSeen = true;
    G.save.save();
    this.time.delayedCall(300, () => {
      void G.audio.sequence(first ? ['prompt.welcome_first', { pause: 300 }, 'prompt.world_hint'] : ['prompt.welcome_back']);
    });
  }

  // ---------- 绘制 ----------

  private drawTerrain(): void {
    const water: Phaser.GameObjects.Image[] = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const t = terrainAt(c, r);
        const { x, y } = tileXY(c, r);
        const tex = t === 'grass' ? `tile_grass${(c * 7 + r * 3) % 3}` : t === 'sand' ? 'tile_sand' : t === 'fog' ? 'tile_fog' : 'tile_water0';
        const img = this.add.image(x, y, tex).setScale(TILE / 16);
        if (t === 'water' || t === 'bridge') water.push(img);
      }
    let f = 0;
    this.time.addEvent({ delay: 700, loop: true, callback: () => { f ^= 1; water.forEach((w) => w.setTexture(`tile_water${f}`)); } });
    // 装饰
    for (const [c, r] of TREES) {
      const { x, y } = tileXY(c, r);
      this.add.image(x, y - 16, 'tree').setScale(3).setDepth(y);
      this.reserved.add(key(c, r));
    }
    for (const [c, r] of [[6, 5], [8, 2], [12, 6], [3, 5]]) {
      const { x, y } = tileXY(c, r);
      this.add.image(x, y, 'flower').setScale(3).setDepth(y - 30);
    }
    // 对面的“即将开放”岛
    const fx = tileXY(23, 5);
    const lock = this.add.image(fx.x, fx.y, 'lock').setScale(5).setDepth(fx.y).setInteractive({ useHandCursor: true });
    this.tweens.add({ targets: lock, y: fx.y - 8, duration: 800, yoyo: true, repeat: -1 });
    lock.on('pointerdown', () => void G.audio.play('prompt.coming_soon'));
    this.add.image(fx.x, fx.y - 100, 'pig').setScale(3).setAlpha(0.35);
  }

  private drawLandmarks(): void {
    for (const lm of LANDMARKS) {
      const { x, y } = tileXY(lm.col, lm.row);
      const img = this.add.image(x, y, lm.tex).setScale(lm.tex === 'sign' ? 4 : 4).setOrigin(0.5, 0.75).setDepth(y).setInteractive({ useHandCursor: true });
      if (lm.id === 'bridge') this.add.image(x, y - 34, 'i_hammer').setScale(3).setDepth(y + 1);
      for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 0; dr++) this.reserved.add(key(lm.col + dc, lm.row + dr));
      img.on('pointerdown', () => this.visit(lm));
    }
    this.markRecommended();
    // 问题石
    const q = tileXY(QUESTION_TILE.col, QUESTION_TILE.row);
    this.reserved.add(key(QUESTION_TILE.col, QUESTION_TILE.row));
    const stone = this.add.image(q.x, q.y, 'rock').setScale(6).setDepth(q.y).setInteractive({ useHandCursor: true });
    const mark = this.add.text(q.x, q.y - 50, '?', { fontSize: '42px', fontStyle: 'bold', color: '#ffd23f', stroke: '#2b2d42', strokeThickness: 6 }).setOrigin(0.5).setDepth(q.y + 1);
    this.tweens.add({ targets: mark, y: q.y - 60, duration: 600, yoyo: true, repeat: -1 });
    stone.on('pointerdown', () => this.walkTo(QUESTION_TILE.col, QUESTION_TILE.row + 1, () => void this.homeQuestion()));
  }

  /** 推荐方向：头顶跳动的星星（只是建议，孩子可以去任何地方） */
  private markRecommended(): void {
    const learned = G.learnedLetters().length;
    const rec = learned < 3 ? 'letters' : !G.data.stats.explored.includes('workshop') ? 'workshop' : !G.data.stats.explored.includes('rhyme') ? 'rhyme' : G.data.bridge.planks < 6 ? 'bridge' : 'letters';
    const lm = LANDMARKS.find((l) => l.id === rec)!;
    const { x, y } = tileXY(lm.col, lm.row);
    const star = this.add.image(x, y - 120, 'star').setScale(4).setDepth(1000);
    this.tweens.add({ targets: star, y: y - 135, duration: 500, yoyo: true, repeat: -1 });
  }

  private drawBridge(): void {
    const n = G.data.bridge.planks;
    const tex = G.data.bridge.material === 'stone' ? 'block_stone' : 'block_wood';
    for (let i = 0; i < n; i++) {
      const { x, y } = tileXY(BRIDGE_COL0 + i, BRIDGE_ROW);
      this.add.image(x, y, tex).setScale(TILE / 16);
    }
  }

  private drawPlaced(): void {
    for (const [k, b] of Object.entries(G.data.world.blocks)) {
      const [c, r] = k.split(',').map(Number);
      this.placeBlockImg(c, r, b);
    }
    for (const it of G.data.world.items) this.placeItemImg(it.x, it.y, it.id, it.word);
  }

  private placeBlockImg(c: number, r: number, tex: string): void {
    const { x, y } = tileXY(c, r);
    this.blockImgs.get(key(c, r))?.destroy();
    const img = this.add.image(x, y, tex).setScale(TILE / 16).setDepth(y - 24);
    this.blockImgs.set(key(c, r), img);
  }

  private placeItemImg(c: number, r: number, tex: string, word: string): void {
    const { x, y } = tileXY(c, r);
    const img = this.add.image(x, y - 4, this.textures.exists(tex) ? tex : 'sign').setScale(3.4).setDepth(y).setInteractive({ useHandCursor: true });
    img.on('pointerdown', () => {
      if (this.tool === 'broom') return this.erase(c, r);
      this.tweens.add({ targets: img, y: y - 20, duration: 150, yoyo: true });
      void G.audio.play(`word.${word}`);
    });
    if (!this.textures.exists(tex) || tex === 'sign') {
      const t = this.add.text(x, y - 14, word, { fontFamily: 'monospace', fontSize: '13px', color: '#2b2d42', fontStyle: 'bold' }).setOrigin(0.5).setDepth(y + 1);
      img.once(Phaser.GameObjects.Events.DESTROY, () => t.destroy());
    }
    this.itemImgs.set(key(c, r), img);
  }

  private drawHud(): void {
    const g = this.add.graphics().setDepth(2000);
    g.fillStyle(0x2b2d42, 0.25).fillRect(0, 0, W, 80);
    this.add.image(40, 40, 'star').setScale(4).setDepth(2001);
    const stars = this.add.text(72, 40, String(G.data.stars), { fontFamily: 'monospace', fontSize: '34px', color: '#ffffff', fontStyle: 'bold', stroke: '#2b2d42', strokeThickness: 6 }).setOrigin(0, 0.5).setDepth(2001);
    this.events.on('stars', () => stars.setText(String(G.data.stars)));
    this.events.once('shutdown', () => this.events.off('stars'));
    // 比普的声音盒：学会的字母亮起来
    G.islandLetters().forEach((l, i) => {
      const learned = G.letterMastered(l.id);
      this.add.image(W / 2 - 150 + i * 60, 40, `lblock_${l.id}`).setScale(3).setDepth(2001).setAlpha(learned ? 1 : 0.25);
    });
    // 家长入口（小、靠角落，孩子不容易误触；进入还有算术题）
    iconButton(this, W - 44, 40, 'i_gear', () => openParentPanel(), { size: 56, color: 0xd9e2ec, dark: 0x9aa5b1 }).setDepth(2001).setAlpha(0.7);
  }

  private drawToolbar(): void {
    const g = this.add.graphics().setDepth(2000);
    g.fillStyle(0x2b2d42, 0.35).fillRect(0, H - 104, W, 104);
    const tools: { id: string; icon: string }[] = [
      { id: 'hand', icon: 'i_hand' },
      { id: 'broom', icon: 'i_broom' },
      ...G.data.unlockedBlocks.filter((b) => this.textures.exists(b)).map((b) => ({ id: b, icon: b })),
    ];
    const size = 78;
    const gap = 92;
    const x0 = W / 2 - ((tools.length - 1) * gap) / 2;
    tools.forEach((t, i) => {
      const isBlock = t.id in BLOCKS || t.id.startsWith('lblock_');
      const btn = iconButton(this, x0 + i * gap, H - 52, t.icon, () => this.selectTool(t.id), {
        size,
        color: 0xffffff,
        dark: 0xd9e2ec,
        iconScale: isBlock ? 3 : 4,
      }).setDepth(2001) as IconButton;
      this.toolButtons.push({ id: t.id, btn });
    });
    this.selectTool('hand', true);
  }

  private selectTool(id: string, silent = false): void {
    this.tool = id;
    for (const t of this.toolButtons) {
      t.btn.setScale(t.id === id ? 1.12 : 1);
      t.btn.y = t.id === id ? H - 60 : H - 52;
    }
    if (silent) return;
    if (id === 'broom') void G.audio.play('prompt.erase_hint');
    else if (id !== 'hand') {
      const letter = id.startsWith('lblock_') ? id.slice(7) : null;
      void G.audio.sequence(letter ? [`phoneme.${letter}`] : ['prompt.build_hint']);
    }
  }

  private refreshChest(): void {
    this.chest?.destroy();
    this.chest = undefined;
    if (G.learnedLetters().length === 0 || G.dueReviews(1).length === 0) return;
    const { x, y } = tileXY(CHEST_TILE.col, CHEST_TILE.row);
    this.reserved.add(key(CHEST_TILE.col, CHEST_TILE.row));
    this.chest = this.add.image(x, y, 'chest').setScale(4).setDepth(y).setInteractive({ useHandCursor: true });
    this.tweens.add({ targets: this.chest, angle: { from: -5, to: 5 }, duration: 300, yoyo: true, repeat: -1, repeatDelay: 1200 });
    this.chest.on('pointerdown', () => this.walkTo(CHEST_TILE.col - 1, CHEST_TILE.row, () => void this.openChest()));
  }

  // ---------- 交互 ----------

  private onTile(c: number, r: number): void {
    const t = terrainAt(c, r);
    const k = key(c, r);
    if (this.tool === 'hand') {
      const b = G.data.world.blocks[k];
      if (b?.startsWith('lblock_')) void G.audio.play(`phoneme.${b.slice(7)}`);
      if (t === 'fog') return void G.audio.play('prompt.coming_soon');
      if (t === 'bridge' && c - BRIDGE_COL0 >= G.data.bridge.planks) return;
      if (t === 'water') return;
      return this.walkTo(c, r);
    }
    if (this.tool === 'broom') return this.erase(c, r);
    if ((t !== 'grass' && t !== 'sand') || this.reserved.has(k) || this.itemImgs.has(k)) {
      G.audio.sfx('soft');
      return;
    }
    G.data.world.blocks[k] = this.tool;
    G.save.save();
    this.placeBlockImg(c, r, this.tool);
    G.audio.sfx('place');
    const img = this.blockImgs.get(k)!;
    this.tweens.add({ targets: img, scale: { from: 0, to: TILE / 16 }, duration: 160, ease: 'Back.out' });
    if (this.tool.startsWith('lblock_')) void G.audio.play(`phoneme.${this.tool.slice(7)}`);
  }

  private erase(c: number, r: number): void {
    const k = key(c, r);
    if (G.data.world.blocks[k]) {
      delete G.data.world.blocks[k];
      this.blockImgs.get(k)?.destroy();
      this.blockImgs.delete(k);
    } else if (this.itemImgs.has(k)) {
      G.data.world.items = G.data.world.items.filter((it) => key(it.x, it.y) !== k);
      this.itemImgs.get(k)?.destroy();
      this.itemImgs.delete(k);
    } else return;
    G.audio.sfx('pop');
    sparkles(this, tileXY(c, r).x, tileXY(c, r).y, 6, 40);
    G.save.save();
  }

  private walkTo(c: number, r: number, then?: () => void): void {
    const from = G.data.world.hero;
    const { x, y } = tileXY(c, r);
    const dist = Math.hypot(c - from.col, r - from.row);
    this.walking?.stop();
    this.tweens.killTweensOf(this.bip);
    this.bip.setFlipX(c < from.col);
    G.data.world.hero = { col: c, row: r };
    G.save.save();
    this.walking = this.tweens.add({
      targets: this.bip,
      x,
      y: y - 8,
      duration: Math.max(150, dist * 140),
      onUpdate: () => this.bip.setDepth(this.bip.y + 9),
      onComplete: () => {
        this.tweens.add({ targets: this.bip, y: y - 11, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        then?.();
      },
    });
    // 小跳步
    this.tweens.add({ targets: this.bip, scaleY: 2.7, duration: 120, yoyo: true, repeat: Math.max(0, Math.round(dist) - 1) });
    G.audio.sfx('step');
  }

  private visit(lm: Landmark): void {
    if (this.busy) return;
    G.audio.unlock();
    if (this.tool !== 'hand') this.selectTool('hand', true);
    this.walkTo(lm.col, lm.row + 1, async () => {
      this.busy = true;
      if (G.save.explore(lm.id)) {
        // 第一次来到新地方：奖励好奇心
        G.data.stars += 1;
        this.events.emit('stars');
        sparkles(this, this.bip.x, this.bip.y - 40, 10, 80);
        cheer(this, this.bip);
        G.audio.sfx('good');
      }
      await G.audio.sequence([lm.prompt]);
      if (lm.scene) goTo(this, lm.scene);
    });
  }

  private async homeQuestion(): Promise<void> {
    const q = G.homeIsland.questions?.find((x) => x.where === 'world');
    if (!q || this.busy) return;
    this.busy = true;
    await askQuestion(this, q, { overlay: true, bip: this.bip });
    this.events.emit('stars');
    this.busy = false;
  }

  private async openChest(): Promise<void> {
    if (this.busy || !this.chest) return;
    this.busy = true;
    await G.audio.sequence(['prompt.chest_intro']);
    for (let i = 0; i < 3; i++) {
      if (!this.scene.isActive()) return;
      await runReviewTask(this, { overlay: true, bip: this.bip });
    }
    this.chest?.setTexture('chest_open');
    G.audio.sfx('unlock');
    sparkles(this, this.chest!.x, this.chest!.y, 14, 120);
    G.data.stars += 1;
    G.save.save();
    this.events.emit('stars');
    await G.audio.sequence(['prompt.chest_done']);
    this.time.delayedCall(800, () => this.refreshChest());
    this.busy = false;
  }
}

/** 拼出的新物品放在比普附近的空地上 */
export function addWorldItem(itemTex: string, word: string): void {
  const h = G.data.world.hero;
  const taken = new Set([...Object.keys(G.data.world.blocks), ...G.data.world.items.map((i) => key(i.x, i.y))]);
  const reserved = new Set<string>();
  for (const lm of LANDMARKS) for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 0; dr++) reserved.add(key(lm.col + dc, lm.row + dr));
  reserved.add(key(QUESTION_TILE.col, QUESTION_TILE.row));
  reserved.add(key(CHEST_TILE.col, CHEST_TILE.row));
  for (const [c, r] of TREES) reserved.add(key(c, r));
  for (let rad = 1; rad < 12; rad++)
    for (let dr = -rad; dr <= rad; dr++)
      for (let dc = -rad; dc <= rad; dc++) {
        const c = h.col + dc;
        const r = h.row + dr;
        const k = key(c, r);
        if (terrainAt(c, r) !== 'grass' || taken.has(k) || reserved.has(k) || (c === h.col && r === h.row)) continue;
        G.data.world.items.push({ id: itemTex, word, x: c, y: r });
        G.save.save();
        return;
      }
}
