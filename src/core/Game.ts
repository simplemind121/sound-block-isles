import { AudioManager } from './AudioManager';
import { pickDue, isRetained } from './ReviewScheduler';
import { SaveManager } from './SaveManager';
import { Content, Island, Letter, Word } from './types';

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`加载失败：${url}`);
  return res.json() as Promise<T>;
}

export async function loadContent(base = 'data/'): Promise<Content> {
  const [l, w, r, i, p] = await Promise.all([
    getJson<{ letters: Letter[] }>(base + 'letters.json'),
    getJson<{ words: Word[]; pictureWords: { id: string; zh: string }[] }>(base + 'words.json'),
    getJson<{ pairs: Content['rhymes'] }>(base + 'rhymes.json'),
    getJson<{ islands: Island[] }>(base + 'islands.json'),
    getJson<{ lang: string; prompts: Content['prompts'] }>(base + 'prompts.json'),
  ]);
  return {
    letters: l.letters,
    words: w.words,
    pictureWords: w.pictureWords,
    rhymes: r.pairs,
    islands: i.islands,
    prompts: p.prompts,
    promptLang: p.lang,
  };
}

/** 全局游戏状态：内容数据 + 存档 + 音频，供所有场景使用 */
class GameState {
  content!: Content;
  save!: SaveManager;
  audio!: AudioManager;

  async init(): Promise<void> {
    this.audio = new AudioManager('audio/');
    this.save = new SaveManager();
    const [content] = await Promise.all([loadContent(), this.audio.loadManifest()]);
    this.content = content;
    this.registerVoices();
  }

  registerVoices(): void {
    const a = this.audio;
    for (const l of this.content.letters) {
      a.register(`phoneme.${l.id}`, { text: l.tts.sound, lang: 'en-US', rate: 0.6 });
      a.register(`letter.${l.id}`, { text: l.tts.name, lang: 'en-US', rate: 0.8 });
    }
    const words = new Set<string>([
      ...this.content.words.map((w) => w.id),
      ...this.content.pictureWords.map((w) => w.id),
      ...this.content.rhymes.flatMap((r) => [r.a, r.b]),
    ]);
    for (const w of words) a.register(`word.${w}`, { text: w, lang: 'en-US', rate: 0.75 });
    for (const [k, v] of Object.entries(this.content.prompts)) {
      if (k.startsWith('_')) continue;
      const name = this.save.data.heroName || '比普';
      const text = Array.isArray(v) ? v.map((t) => t.replace(/比普/g, name)) : v.replace(/比普/g, name);
      a.register(`prompt.${k}`, { text, lang: this.content.promptLang, rate: 1.0, pitch: 1.2 });
    }
    // 主题岛里的开放式问题：q.<问题>、q.<问题>.why、opt.<问题>.<选项>
    const zh = (text: string) => ({ text, lang: this.content.promptLang, rate: 1.0, pitch: 1.2 });
    for (const isl of this.content.islands) {
      for (const q of isl.questions ?? []) {
        a.register(`q.${q.id}`, zh(q.promptZh));
        a.register(`q.${q.id}.why`, zh(q.whyZh));
        for (const o of [...q.options, ...(q.reasons ?? [])]) a.register(`opt.${q.id}.${o.id}`, zh(o.zh));
      }
    }
  }

  get data() {
    return this.save.data;
  }

  letter(id: string): Letter {
    const l = this.content.letters.find((x) => x.id === id);
    if (!l) throw new Error('未知字母 ' + id);
    return l;
  }

  word(id: string): Word | undefined {
    return this.content.words.find((w) => w.id === id);
  }

  get homeIsland(): Island {
    return this.content.islands[0];
  }

  /** 本岛按教学顺序排列的字母 */
  islandLetters(): Letter[] {
    return (this.homeIsland.letters ?? []).map((id) => this.letter(id));
  }

  letterStage(id: string): number {
    return this.data.letterStage[id] ?? 0;
  }

  /** 走完三阶段（命名→辨认→回忆）就算学会，可以拿去拼词 */
  learnedLetters(): string[] {
    return this.islandLetters().filter((l) => this.letterStage(l.id) >= 3).map((l) => l.id);
  }

  /** 推荐学的下一个字母（孩子也可以自己选别的） */
  nextLetter(): string | undefined {
    return this.islandLetters().find((l) => this.letterStage(l.id) < 3)?.id;
  }

  /** 字母都学过的单词 */
  buildableWords(guidedOnly = false): Word[] {
    const known = new Set(this.learnedLetters());
    return this.content.words.filter((w) => (!guidedOnly || w.guided) && w.letters.every((l) => known.has(l)));
  }

  wordMastered(id: string): boolean {
    return isRetained(this.data.review[`word:${id}`]);
  }

  letterMastered(id: string): boolean {
    return this.letterStage(id) >= 3;
  }

  /** 到期的复习内容（letter:x / word:y） */
  dueReviews(n: number, now = Date.now()): string[] {
    const known = new Set(this.learnedLetters());
    return pickDue(this.data.review, now, n, (id) => {
      const [kind, key] = id.split(':');
      if (kind === 'letter') return known.has(key);
      if (kind === 'word') return !!this.word(key) && this.word(key)!.letters.every((l) => known.has(l));
      return false;
    });
  }

  findWordByLetters(letters: string[]): Word | undefined {
    const s = letters.join('');
    return this.content.words.find((w) => w.letters.join('') === s);
  }
}

export const G = new GameState();
