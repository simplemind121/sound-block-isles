/**
 * 简化版间隔复习（Leitner 盒子）。
 * 答对：升一个盒子，间隔变长；答错：回到 1 号盒子，并在本次游戏里很快再出现。
 * 全部是纯函数，方便测试；now 用毫秒时间戳。
 */

export const DAY = 24 * 60 * 60 * 1000;
/** 盒子 1–5 对应的复习间隔 */
export const BOX_INTERVALS = [0, 0, 1 * DAY, 2 * DAY, 4 * DAY, 7 * DAY];
export const MAX_BOX = 5;
/** 答错后多久再出现（本次游戏内） */
export const RETRY_DELAY = 60 * 1000;

export interface ReviewItem {
  box: number;
  due: number;
  correct: number;
  wrong: number;
  lastSeen: number;
}

export function newItem(now: number): ReviewItem {
  return { box: 1, due: now, correct: 0, wrong: 0, lastSeen: 0 };
}

export function record(item: ReviewItem, correct: boolean, now: number): ReviewItem {
  if (correct) {
    const box = Math.min(MAX_BOX, item.box + 1);
    return { ...item, box, due: now + BOX_INTERVALS[box], correct: item.correct + 1, lastSeen: now };
  }
  return { ...item, box: 1, due: now + RETRY_DELAY, wrong: item.wrong + 1, lastSeen: now };
}

export function isDue(item: ReviewItem, now: number): boolean {
  return item.due <= now;
}

/**
 * 从队列里挑出最该复习的 n 个：先按到期时间，再按盒子（越低越优先），再按错误多少。
 */
export function pickDue(queue: Record<string, ReviewItem>, now: number, n: number, filter?: (id: string) => boolean): string[] {
  return Object.entries(queue)
    .filter(([id, it]) => isDue(it, now) && (!filter || filter(id)))
    .sort(([, a], [, b]) => a.box - b.box || a.due - b.due || b.wrong - a.wrong)
    .slice(0, n)
    .map(([id]) => id);
}

/** 盒子 ≥ 3 视为“记住了” */
export function isRetained(item: ReviewItem | undefined): boolean {
  return !!item && item.box >= 3;
}
