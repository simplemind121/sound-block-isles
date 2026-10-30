import { describe, expect, it } from 'vitest';
import { BOX_INTERVALS, DAY, RETRY_DELAY, isRetained, newItem, pickDue, record } from '../src/core/ReviewScheduler';

describe('间隔复习', () => {
  const t0 = 1_700_000_000_000;

  it('答对升盒子、间隔变长', () => {
    let it1 = newItem(t0);
    it1 = record(it1, true, t0);
    expect(it1.box).toBe(2);
    expect(it1.due).toBe(t0 + BOX_INTERVALS[2]);
    it1 = record(it1, true, t0);
    expect(it1.box).toBe(3);
    expect(it1.due).toBe(t0 + 2 * DAY);
    expect(isRetained(it1)).toBe(true);
  });

  it('答错回到 1 号盒子，并很快再出现', () => {
    let it1 = { ...newItem(t0), box: 4 };
    it1 = record(it1, false, t0);
    expect(it1.box).toBe(1);
    expect(it1.due).toBe(t0 + RETRY_DELAY);
    expect(it1.wrong).toBe(1);
  });

  it('盒子不超过 5', () => {
    let it1 = newItem(t0);
    for (let i = 0; i < 10; i++) it1 = record(it1, true, t0);
    expect(it1.box).toBe(5);
  });

  it('优先复习低盒子、到期的内容', () => {
    const q = {
      'letter:s': { ...newItem(t0), box: 3, due: t0 - 10 },
      'letter:a': { ...newItem(t0), box: 1, due: t0 - 5 },
      'letter:t': { ...newItem(t0), box: 1, due: t0 + DAY },
    };
    expect(pickDue(q, t0, 5)).toEqual(['letter:a', 'letter:s']);
    expect(pickDue(q, t0, 5, (id) => id !== 'letter:a')).toEqual(['letter:s']);
  });
});
