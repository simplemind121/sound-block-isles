// 冒烟测试：打开构建后的页面，检查 3 秒内进入游戏、无报错、刷新后进度还在。
// 用法：npm run build && npm run smoke   （需要本机装有 Playwright + Chromium）
import { createRequire } from 'node:module';
import { preview } from 'vite';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const shots = process.env.SHOTS || '';
const server = await preview({ preview: { port: 4179, host: '127.0.0.1' } });
const url = 'http://127.0.0.1:4179/';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

const t0 = Date.now();
await page.goto(url);
await page.waitForFunction(() => window.__sbiReady === true, null, { timeout: 3000 });
const loadMs = Date.now() - t0;
if (shots) await page.screenshot({ path: `${shots}/0-title.png` });

// 点开始
await page.mouse.click(640, 620);
await page.waitForTimeout(800);
if (shots) await page.screenshot({ path: `${shots}/1-world.png` });

// 在世界里放一个方块，然后刷新
await page.evaluate(() => {
  const { G } = window.__sbi;
  G.data.world.blocks['6,6'] = 'block_wood';
  G.save.setLetterStage('s', 3);
  G.save.flush();
});
await page.reload();
await page.waitForFunction(() => window.__sbiReady === true, null, { timeout: 3000 });
const kept = await page.evaluate(() => {
  const { G } = window.__sbi;
  return G.data.world.blocks['6,6'] === 'block_wood' && G.data.letterStage.s === 3;
});
await browser.close();
await new Promise((r) => server.httpServer.close(r));

console.log(`进入游戏用时 ${loadMs}ms；刷新后进度保留：${kept}；报错 ${errors.length} 个`);
errors.forEach((e) => console.log('  ✗', e));
if (loadMs > 3000 || !kept || errors.length) process.exit(1);
