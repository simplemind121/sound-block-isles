import Phaser from 'phaser';
import { G } from './core/Game';
import { H, W } from './ui/ui';
import { BootScene } from './scenes/BootScene';
import { WorldScene } from './scenes/WorldScene';
import { LetterIslandScene } from './scenes/LetterIslandScene';
import { WorkshopScene } from './scenes/WorkshopScene';
import { RhymeScene } from './scenes/RhymeScene';
import { BridgeScene } from './scenes/BridgeScene';
import { UIScene } from './scenes/UIScene';

async function loadArtOverrides(): Promise<Record<string, string>> {
  try {
    const res = await fetch('art/manifest.json', { cache: 'no-cache' });
    return res.ok ? ((await res.json()).files ?? {}) : {};
  } catch {
    return {};
  }
}

async function start(): Promise<void> {
  const [, art] = await Promise.all([G.init(), loadArtOverrides()]);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: W,
    height: H,
    backgroundColor: '#5fb3e8',
    pixelArt: true,
    // 声音全部由 AudioManager 负责，不让 Phaser 再建一个 AudioContext
    audio: { noAudio: true },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { activePointers: 2 },
    callbacks: { preBoot: (g) => g.registry.set('artOverrides', art) },
    scene: [BootScene, WorldScene, LetterIslandScene, WorkshopScene, RhymeScene, BridgeScene, UIScene],
  });
  // iOS 只把 touchend / click 当作可以解锁声音的手势，Phaser 用的是 pointerdown，所以这里再补一层
  for (const ev of ['touchend', 'click', 'keydown']) document.addEventListener(ev, () => G.audio.unlock(), { capture: true, passive: true });
  // 离开页面前保存
  window.addEventListener('pagehide', () => G.save.flush());
  document.addEventListener('visibilitychange', () => document.hidden && G.save.flush());
  (window as unknown as { __sbi: unknown }).__sbi = { G, game };
}

start().catch((e) => {
  console.error(e);
  const boot = document.getElementById('boot');
  if (boot) boot.textContent = '加载失败，请刷新页面';
});
