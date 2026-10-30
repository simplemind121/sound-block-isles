import Phaser from 'phaser';
import { G } from '../core/Game';
import { wait } from '../core/AudioManager';
import { H, W, cheer, homeButton, makeBip, skyBackground, sparkles, talk } from '../ui/ui';
import { askQuestion, runReviewTask } from '../tasks/tasks';

/**
 * 冒险主线：修桥去下一座岛。每块桥板 = 一个小任务（优先出到期的复习内容）。
 * 开工前先问开放式问题：“木头还是石头？为什么？”——选哪个都好，只记录下来。
 */
export class BridgeScene extends Phaser.Scene {
  private bip!: Phaser.GameObjects.Sprite;
  private planks: Phaser.GameObjects.Image[] = [];
  private spots: Phaser.GameObjects.Rectangle[] = [];
  private busy = false;
  private readonly total = G.homeIsland?.bridgePlanks ?? 6;
  private readonly x0 = 330;
  private readonly pw = 104;
  private readonly by = 430;

  constructor() {
    super('Bridge');
  }

  create(): void {
    this.planks = [];
    this.spots = [];
    this.busy = false;
    this.cameras.main.fadeIn(250, 255, 246, 224);
    skyBackground(this);
    const g = this.add.graphics();
    g.fillStyle(0x5fb3e8, 1).fillRect(0, 470, W, 250);
    g.fillStyle(0x8fd0f5, 1).fillRect(0, 470, W, 10);
    // 两岸
    g.fillStyle(0x8d5a3b, 1).fillRect(0, 420, this.x0 - 20, 300);
    g.fillStyle(0x7bd389, 1).fillRect(0, 405, this.x0 - 20, 24);
    const right = this.x0 + this.total * this.pw + 20;
    g.fillStyle(0xd9e2ec, 1).fillRect(right, 420, W - right, 300);
    g.fillStyle(0xffffff, 1).fillRect(right, 405, W - right, 24);
    const lock = this.add.image(right + 110, 330, 'lock').setScale(7);
    this.tweens.add({ targets: lock, y: 315, duration: 800, yoyo: true, repeat: -1 });
    this.add.image(right + 110, 200, 'pig').setScale(6).setAlpha(0.4);
    lock.setInteractive({ useHandCursor: true }).on('pointerdown', () => void G.audio.play('prompt.coming_soon'));

    homeButton(this);
    this.bip = makeBip(this, 180, 350, 6).setDepth(200);

    for (let i = 0; i < this.total; i++) {
      const x = this.x0 + i * this.pw + this.pw / 2;
      if (i < G.data.bridge.planks) this.addPlank(i, false);
      else {
        const spot = this.add.rectangle(x, this.by, this.pw - 8, 50, 0xffffff, 0.25).setStrokeStyle(4, 0xffffff, 0.8).setInteractive({ useHandCursor: true });
        spot.on('pointerdown', () => void this.build());
        this.spots[i] = spot;
      }
    }
    this.glowNext();
    this.events.once('shutdown', () => G.audio.stop());
    void this.start();
  }

  private texture(): string {
    return G.data.bridge.material === 'stone' ? 'block_stone' : 'block_wood';
  }

  private addPlank(i: number, animate: boolean): void {
    const x = this.x0 + i * this.pw + this.pw / 2;
    const p = this.add.image(x, this.by, this.texture()).setDisplaySize(this.pw, 56);
    this.planks[i] = p;
    if (animate) this.tweens.add({ targets: p, y: { from: this.by - 200, to: this.by }, duration: 400, ease: 'Bounce.out' });
  }

  private glowNext(): void {
    const i = G.data.bridge.planks;
    this.spots.forEach((s) => s && this.tweens.killTweensOf(s));
    const s = this.spots[i];
    if (s) this.tweens.add({ targets: s, alpha: 0.4, duration: 400, yoyo: true, repeat: -1 });
  }

  private async start(): Promise<void> {
    if (G.data.bridge.planks >= this.total) return void this.cross();
    const p = G.audio.sequence(['prompt.bridge_intro']);
    talk(this, this.bip, p);
    await p;
    if (!G.data.bridge.material && this.scene.isActive()) {
      this.busy = true;
      const q = G.homeIsland.questions?.find((x) => x.where === 'bridge');
      if (q) {
        const ans = await askQuestion(this, q, { overlay: true, bip: this.bip });
        G.data.bridge.material = ans.option;
        G.save.save();
      }
      this.busy = false;
    }
  }

  private async build(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    G.audio.unlock();
    await runReviewTask(this, { overlay: true, bip: this.bip });
    if (!this.scene.isActive()) return;
    const i = G.data.bridge.planks;
    this.spots[i]?.destroy();
    this.addPlank(i, true);
    G.data.bridge.planks = i + 1;
    G.data.stars += 1;
    G.save.save();
    G.audio.sfx('place');
    sparkles(this, this.x0 + i * this.pw + this.pw / 2, this.by, 8, 80);
    cheer(this, this.bip);
    this.glowNext();
    this.busy = false;
    if (G.data.bridge.planks >= this.total) {
      await wait(500);
      void this.cross();
    }
  }

  private async cross(): Promise<void> {
    this.busy = true;
    await G.audio.sequence(['prompt.bridge_done']);
    if (!this.scene.isActive()) return;
    this.tweens.killTweensOf(this.bip);
    const right = this.x0 + this.total * this.pw + 60;
    this.tweens.add({ targets: this.bip, x: right, y: 350, duration: 2200 });
    this.tweens.add({ targets: this.bip, scaleY: 5.4, duration: 150, yoyo: true, repeat: 7 });
    await wait(2300);
    if (!this.scene.isActive()) return;
    if (!G.data.bridge.crossed) {
      G.data.bridge.crossed = true;
      G.data.stars += 3;
      G.save.save();
      sparkles(this, W - 150, H / 2, 20, 250);
      G.audio.sfx('unlock');
    }
    await G.audio.sequence(['prompt.coming_soon']);
  }
}
