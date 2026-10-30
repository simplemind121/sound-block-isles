import { describe, expect, it } from 'vitest';
import { SAVE_KEY, SaveManager, defaultSave, migrate } from '../src/core/SaveManager';

class MemStorage {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
  key() { return null; }
  get length() { return this.m.size; }
}

describe('存档', () => {
  it('保存后重新加载，世界和进度都还在', () => {
    const st = new MemStorage() as unknown as Storage;
    const a = new SaveManager(st);
    a.data.world.blocks['3,4'] = 'lblock_s';
    a.data.world.items.push({ id: 'pin', word: 'pin', x: 5, y: 5 });
    a.setLetterStage('s', 3);
    a.recordReview('letter:s', false);
    a.addUsage(42, new Date(2026, 9, 30));
    a.flush();
    const b = new SaveManager(st);
    expect(b.data.world.blocks['3,4']).toBe('lblock_s');
    expect(b.data.world.items[0].word).toBe('pin');
    expect(b.data.letterStage.s).toBe(3);
    expect(b.data.review['letter:s'].wrong).toBe(1);
    expect(b.data.stats.errors['letter:s']).toBe(1);
    expect(b.data.usage['2026-10-30']).toBe(42);
  });

  it('阶段只升不降', () => {
    const a = new SaveManager(new MemStorage() as unknown as Storage);
    a.setLetterStage('a', 2);
    a.setLetterStage('a', 1);
    expect(a.data.letterStage.a).toBe(2);
  });

  it('旧存档缺字段时用默认值补齐；坏数据不崩溃', () => {
    const m = migrate({ heroName: '小方', world: { blocks: { '1,1': 'block_wood' } } });
    expect(m.heroName).toBe('小方');
    expect(m.world.blocks['1,1']).toBe('block_wood');
    expect(m.world.items).toEqual([]);
    expect(m.settings.sessionMinutes).toBe(15);
    const st = new MemStorage();
    st.setItem(SAVE_KEY, '{坏掉的 json');
    expect(new SaveManager(st as unknown as Storage).data).toEqual({ ...defaultSave(), createdAt: expect.any(Number) });
  });
});
