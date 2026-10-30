import Phaser from 'phaser';
import { G } from '../core/Game';
import { SessionTimer } from '../core/SessionTimer';
import { COLORS, H, W, iconButton } from '../ui/ui';

/** 常驻最上层：计时 + 温和的休息提醒（天慢慢变黄昏，比普打哈欠） */
export class UIScene extends Phaser.Scene {
  timer!: SessionTimer;
  private layer?: Phaser.GameObjects.Container;

  constructor() {
    super('UI');
  }

  create(): void {
    this.timer = new SessionTimer(
      () => G.data.settings.sessionMinutes,
      (sec) => G.save.addUsage(sec),
      () => this.showRest(),
    );
    this.timer.start();
    // 调试/验收用：URL 带 ?rest 立刻显示休息提醒
    if (location.search.includes('rest')) this.time.delayedCall(1500, () => this.showRest());
  }

  showRest(): void {
    if (this.layer) return;
    const c = this.add.container(0, 0).setDepth(10000);
    this.layer = c;
    const dusk = this.add.graphics();
    dusk.fillGradientStyle(0xff9f6e, 0xff9f6e, 0x5b3a8c, 0x5b3a8c, 1).fillRect(0, 0, W, H);
    dusk.setAlpha(0);
    const blocker = this.add.rectangle(W / 2, H / 2, W, H, 0, 0.001).setInteractive();
    c.add([blocker, dusk]);
    this.tweens.add({ targets: dusk, alpha: 0.92, duration: 2500 });
    const sun = this.add.circle(W / 2, 260, 80, 0xffd23f);
    c.add(sun);
    this.tweens.add({ targets: sun, y: 420, alpha: 0.3, duration: 4000 });
    const bip = this.add.sprite(W / 2, 380, 'bip_sleep').setScale(10);
    c.add(bip);
    this.tweens.add({ targets: bip, scaleY: 10.6, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    void G.audio.sequence(['prompt.rest']);

    const rest = iconButton(this, W / 2 - 140, 600, 'i_moon', () => this.sleep(), { size: 140, color: COLORS.purple, dark: COLORS.purpleDark });
    const more = iconButton(this, W / 2 + 160, 610, 'i_play', () => this.close(), { size: 90, color: 0xd9e2ec, dark: 0x9aa5b1 });
    more.setAlpha(0.6);
    c.add([rest, more]);
  }

  private sleep(): void {
    const c = this.layer!;
    c.removeAll(true);
    const night = this.add.rectangle(W / 2, H / 2, W, H, 0x1b1d3a).setInteractive();
    c.add(night);
    for (let i = 0; i < 40; i++) {
      const s = this.add.image(Math.random() * W, Math.random() * H * 0.7, 'sparkle').setScale(2 + Math.random() * 2).setAlpha(0.6);
      this.tweens.add({ targets: s, alpha: 0.1, duration: 800 + Math.random() * 1500, yoyo: true, repeat: -1 });
      c.add(s);
    }
    c.add(this.add.image(W - 200, 140, 'i_moon').setScale(10));
    const bip = this.add.sprite(W / 2, 470, 'bip_sleep').setScale(10);
    c.add(bip);
    const z = this.add.text(W / 2 + 90, 330, 'z z z', { fontSize: '48px', color: '#ffffff', fontStyle: 'bold' });
    c.add(z);
    this.tweens.add({ targets: z, y: 290, alpha: 0.3, duration: 1500, yoyo: true, repeat: -1 });
    void G.audio.sequence(['prompt.rest_sleep']);
    G.save.flush();
    // 休息好之后（或者大人点），右下角出现小小的继续按钮
    this.time.delayedCall(8000, () => {
      if (!this.layer) return;
      const wake = iconButton(this, W - 80, H - 80, 'i_play', () => this.close(), { size: 70, color: 0x616e7c, dark: 0x2b2d42 });
      wake.setAlpha(0.5);
      c.add(wake);
    });
    this.timer.restart();
  }

  private close(): void {
    G.audio.stop();
    this.layer?.destroy();
    this.layer = undefined;
  }
}
