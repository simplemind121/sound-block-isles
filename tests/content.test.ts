import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { SPRITES } from '../src/art/sprites';
import { PALETTE } from '../src/art/palette';

const json = (f: string) => JSON.parse(readFileSync(new URL(`../public/data/${f}`, import.meta.url), 'utf8'));

describe('内容数据', () => {
  const letters = json('letters.json').letters;
  const words = json('words.json').words;
  const islands = json('islands.json').islands;

  it('第一组字母是 s a t i p n，且都有笔画和配图', () => {
    expect(islands[0].letters).toEqual(['s', 'a', 't', 'i', 'p', 'n']);
    for (const l of letters) {
      expect(l.strokesLower.length).toBeGreaterThan(0);
      expect(l.strokesUpper.length).toBeGreaterThan(0);
      expect(SPRITES[l.picture]).toBeDefined();
    }
  });

  it('单词只用到已有的字母；有物品的词都有贴图', () => {
    const ids = new Set(letters.map((l: { id: string }) => l.id));
    for (const w of words) {
      expect(w.letters.join('')).toBe(w.id);
      for (const ch of w.letters) expect(ids.has(ch)).toBe(true);
      if (w.item) expect(SPRITES[w.item]).toBeDefined();
    }
  });

  it('问题选项的图标都存在', () => {
    for (const q of islands.flatMap((i: { questions?: unknown[] }) => i.questions ?? []) as { options: { icon: string }[]; reasons?: { icon: string }[] }[]) {
      for (const o of [...q.options, ...(q.reasons ?? [])]) expect(SPRITES[o.icon] ?? (o.icon.startsWith('block_') ? 1 : undefined)).toBeDefined();
    }
  });

  it('像素画只用调色板里的颜色', () => {
    for (const [name, rows] of Object.entries(SPRITES))
      for (const r of rows) for (const ch of r) if (ch !== '.') expect(PALETTE[ch], `${name}: ${ch}`).toBeDefined();
  });
});
