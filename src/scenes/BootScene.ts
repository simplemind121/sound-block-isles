import Phaser from 'phaser';
import { G } from '../core/Game';
import { buildTextures } from '../art/ArtFactory';
import { COLORS, W, iconButton, makeBip, skyBackground } from '../ui/ui';

/** 生成贴图，再显示开始画面（需要孩子点一下，浏览器才允许播放声音） */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    buildTextures(this, G.content.letters);
    // public/art/manifest.json 里登记的图片会覆盖同名的代码绘制贴图
    const overrides = (this.registry.get('artOverrides') ?? {}) as Record<string, string>;
    for (const [key, file] of Object.entries(overrides)) {
      if (this.textures.exists(key)) this.textures.remove(key);
      this.load.image(key, 'art/' + file);
    }
  }

  create(): void {
    document.getElementById('boot')?.remove();
    skyBackground(this);
    const g = this.add.graphics();
    g.fillStyle(0x8fd694, 1).fillRect(0, 560, W, 160);
    g.fillStyle(0x48a35a, 1).fillRect(0, 560, W, 10);
    for (let i = 0; i < 9; i++) this.add.image(140 + i * 125, 520, i % 2 ? 'block_wood' : `lblock_${G.content.letters[i % 6].id}`).setScale(5);
    makeBip(this, W / 2, 300, 12);
    const play = iconButton(this, W / 2, 620, 'i_play', () => {
      G.audio.unlock();
      this.scene.launch('UI');
      this.scene.start('World');
    }, { size: 150, color: COLORS.green, dark: COLORS.greenDark, iconScale: 9 });
    this.tweens.add({ targets: play, scale: 1.08, duration: 500, yoyo: true, repeat: -1 });
    (window as unknown as { __sbiReady: boolean }).__sbiReady = true;
  }
}
