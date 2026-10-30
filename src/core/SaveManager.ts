import { newItem, record, ReviewItem } from './ReviewScheduler';

export const SAVE_KEY = 'sbi.save';
export const SAVE_VERSION = 1;

export interface PlacedItem {
  id: string; // 物品贴图名
  word: string;
  x: number;
  y: number;
}

export interface ChoiceRecord {
  q: string;
  option: string;
  reason?: string;
  ts: number;
}

export interface SaveData {
  version: number;
  createdAt: number;
  heroName: string;
  introSeen: boolean;
  world: {
    blocks: Record<string, string>; // "col,row" -> 方块贴图名
    items: PlacedItem[];
    hero: { col: number; row: number };
  };
  /** 字母三阶段：0 未学，1 命名（听过并描过），2 辨认，3 回忆 → 掌握 */
  letterStage: Record<string, number>;
  /** 拼出过的单词（任意模式），值为次数 */
  wordsBuilt: Record<string, number>;
  unlockedBlocks: string[];
  review: Record<string, ReviewItem>; // "letter:s" / "word:pin"
  stats: {
    rhymeCorrect: number;
    rhymeWrong: number;
    errors: Record<string, number>;
    explored: string[]; // 去过的地方，用来奖励探索
  };
  bridge: { planks: number; material: string | null; crossed: boolean };
  choices: ChoiceRecord[];
  usage: Record<string, number>; // "2026-10-30" -> 秒
  stars: number;
  settings: { sessionMinutes: number };
}

export function defaultSave(now = Date.now()): SaveData {
  return {
    version: SAVE_VERSION,
    createdAt: now,
    heroName: '比普',
    introSeen: false,
    world: { blocks: {}, items: [], hero: { col: 6, row: 6 } },
    letterStage: {},
    wordsBuilt: {},
    unlockedBlocks: ['block_grass', 'block_wood', 'block_stone'],
    review: {},
    stats: { rhymeCorrect: 0, rhymeWrong: 0, errors: {}, explored: [] },
    bridge: { planks: 0, material: null, crossed: false },
    choices: [],
    usage: {},
    stars: 0,
    settings: { sessionMinutes: 15 },
  };
}

/** 合并旧存档，缺的字段用默认值补上（以后加字段时不会丢进度） */
export function migrate(raw: unknown): SaveData {
  const base = defaultSave();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<SaveData>;
  return {
    ...base,
    ...r,
    version: SAVE_VERSION,
    world: { ...base.world, ...(r.world ?? {}) },
    stats: { ...base.stats, ...(r.stats ?? {}) },
    bridge: { ...base.bridge, ...(r.bridge ?? {}) },
    settings: { ...base.settings, ...(r.settings ?? {}) },
    unlockedBlocks: Array.from(new Set([...base.unlockedBlocks, ...(r.unlockedBlocks ?? [])])),
  };
}

export function todayKey(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export class SaveManager {
  data: SaveData;
  private timer: number | undefined;

  constructor(private storage: Storage | undefined = safeStorage()) {
    this.data = this.load();
  }

  load(): SaveData {
    try {
      const txt = this.storage?.getItem(SAVE_KEY);
      return txt ? migrate(JSON.parse(txt)) : defaultSave();
    } catch {
      return defaultSave();
    }
  }

  /** 立即写入 */
  flush(): void {
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    try {
      this.storage?.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch {
      /* 存储满或被禁用时静默失败，游戏照常进行 */
    }
  }

  /** 合并短时间内的多次修改，0.5 秒后写入 */
  save(): void {
    if (this.timer !== undefined) return;
    this.timer = setTimeout(() => this.flush(), 500) as unknown as number;
  }

  reset(): void {
    this.data = defaultSave();
    this.flush();
  }

  // ---- 学习记录 ----

  recordReview(id: string, correct: boolean, now = Date.now()): void {
    const item = this.data.review[id] ?? newItem(now);
    this.data.review[id] = record(item, correct, now);
    if (!correct) this.data.stats.errors[id] = (this.data.stats.errors[id] ?? 0) + 1;
    this.save();
  }

  ensureReview(id: string, now = Date.now()): void {
    if (!this.data.review[id]) {
      this.data.review[id] = newItem(now);
      this.save();
    }
  }

  setLetterStage(id: string, stage: number): void {
    if ((this.data.letterStage[id] ?? 0) < stage) {
      this.data.letterStage[id] = stage;
      this.save();
    }
  }

  addUsage(seconds: number, d = new Date()): void {
    const k = todayKey(d);
    this.data.usage[k] = (this.data.usage[k] ?? 0) + seconds;
    this.save();
  }

  explore(place: string): boolean {
    if (this.data.stats.explored.includes(place)) return false;
    this.data.stats.explored.push(place);
    this.save();
    return true;
  }
}

function safeStorage(): Storage | undefined {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : undefined;
  } catch {
    return undefined;
  }
}
