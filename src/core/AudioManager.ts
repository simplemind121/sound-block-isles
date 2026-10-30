/**
 * 统一的音频模块：所有声音都按 ID 播放。
 *   phoneme.s  字母音      letter.s  字母名
 *   word.pin   单词        prompt.x  中文引导语
 * 先找 public/audio/manifest.json 里登记的录音；找不到（或加载失败）才退回浏览器语音（Web Speech API）。
 */

interface Fallback {
  text: string | string[];
  lang: string;
  rate: number;
  pitch?: number;
}

export type SeqItem = string | { id: string } | { pause: number } | { text: string; lang?: string };

export class AudioManager {
  private files: Record<string, string | string[]> = {};
  /** 改了主角名字后，含“比普”的录音不再适用，改用浏览器语音 */
  private skipFiles = new Set<string>();
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private source: AudioBufferSourceNode | null = null;
  private utterances: SpeechSynthesisUtterance[] = [];
  private fallbacks: Record<string, Fallback> = {};
  private cache = new Map<string, HTMLAudioElement>();
  private current: HTMLAudioElement | null = null;
  private generation = 0;
  private voices: SpeechSynthesisVoice[] = [];
  private ctx: AudioContext | null = null;
  private unlocked = false;
  muted = false;

  constructor(private baseUrl = 'audio/') {
    const synth = this.synth;
    if (synth) {
      const load = () => (this.voices = synth.getVoices());
      load();
      synth.addEventListener?.('voiceschanged', load);
    }
  }

  private get synth(): SpeechSynthesis | undefined {
    return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : undefined;
  }

  async loadManifest(): Promise<void> {
    try {
      const res = await fetch(this.baseUrl + 'manifest.json', { cache: 'no-cache' });
      if (res.ok) this.files = (await res.json()).files ?? {};
    } catch {
      this.files = {};
    }
  }

  register(id: string, fb: Fallback): void {
    this.fallbacks[id] = fb;
  }

  has(id: string): boolean {
    return id in this.files || id in this.fallbacks;
  }

  hasRecording(id: string): boolean {
    return id in this.files && !this.skipFiles.has(id);
  }

  get recordingCount(): number {
    return Object.keys(this.files).length;
  }

  setSkipFiles(ids: Iterable<string>): void {
    this.skipFiles = new Set(ids);
  }

  /** 是否有可用的浏览器语音（没有录音时用） */
  get speechAvailable(): boolean {
    return !!this.synth && (this.voices.length > 0 || (this.synth.getVoices?.().length ?? 0) > 0);
  }

  /** 第一次点击屏幕时调用：iOS/Safari 要求声音由用户手势触发 */
  unlock(): void {
    if (this.unlocked) {
      if (this.ctx && this.ctx.state !== 'running') void this.ctx.resume();
      return;
    }
    this.unlocked = true;
    try {
      // iOS 16.4+：按“媒体播放”处理，静音开关打开时也有声音
      const nav = navigator as unknown as { audioSession?: { type: string } };
      if (nav.audioSession) nav.audioSession.type = 'playback';
    } catch {
      /* 不支持就算了 */
    }
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      // 播放一小段静音，iOS 才算真正解锁
      const b = this.ctx.createBuffer(1, 1, 22050);
      const src = this.ctx.createBufferSource();
      src.buffer = b;
      src.connect(this.ctx.destination);
      src.start(0);
      void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
    const synth = this.synth;
    if (synth && !this.recordingCount) {
      const u = new SpeechSynthesisUtterance('.');
      u.volume = 0.01;
      synth.speak(u);
    }
    this.preloadAll();
  }

  /** 后台预先解码全部录音（总共一两 MB），之后播放没有延迟 */
  private preloadAll(): void {
    const urls = Object.values(this.files).flat();
    let i = 0;
    const next = (): void => {
      const url = urls[i++];
      if (!url) return;
      void this.buffer(this.baseUrl + url).then(next);
    };
    for (let k = 0; k < 4; k++) next();
  }

  private buffer(url: string): Promise<AudioBuffer | null> {
    let p = this.buffers.get(url);
    if (!p) {
      const ctx = this.ctx!;
      p = fetch(url)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
        .then((data) => new Promise<AudioBuffer>((res, rej) => {
          // 旧版 Safari 只支持回调写法
          const ret = ctx.decodeAudioData(data, res, rej) as unknown as Promise<AudioBuffer> | undefined;
          ret?.catch?.(rej);
        }))
        .catch(() => null);
      this.buffers.set(url, p);
    }
    return p;
  }

  /** 停止正在播放的一切（切换场景时调用） */
  stop(): void {
    this.generation++;
    const synth = this.synth;
    // 只有正在说话时才 cancel：有些手机浏览器 cancel 之后紧跟的 speak 会被吞掉
    if (synth && (synth.speaking || synth.pending)) {
      synth.cancel();
      this.cancelledAt = performance.now();
    }
    if (this.source) {
      try {
        this.source.onended = null;
        this.source.stop();
      } catch {
        /* 已经停了 */
      }
      this.source = null;
    }
    if (this.current) {
      this.current.pause();
      this.current = null;
    }
  }

  private cancelledAt = 0;

  /** 播放一个 ID，返回播放结束的 Promise */
  play(id: string): Promise<void> {
    this.stop();
    return this.playOne(id, this.generation);
  }

  /** 依次播放，新的 sequence/play/stop 会打断旧的 */
  async sequence(items: SeqItem[]): Promise<boolean> {
    this.stop();
    const gen = this.generation;
    for (const it of items) {
      if (gen !== this.generation) return false;
      if (typeof it === 'string') await this.playOne(it, gen);
      else if ('id' in it) await this.playOne(it.id, gen);
      else if ('pause' in it) await wait(it.pause);
      else await this.speak(it.text, it.lang ?? 'zh-CN', 0.95, gen);
    }
    return gen === this.generation;
  }

  private async playOne(id: string, gen: number): Promise<void> {
    if (this.muted || gen !== this.generation) return;
    const entry = this.skipFiles.has(id) ? undefined : this.files[id];
    const file = Array.isArray(entry) ? entry[Math.floor(Math.random() * entry.length)] : entry;
    if (file) {
      const ok = this.ctx ? await this.playBuffer(this.baseUrl + file, gen) : await this.playFile(this.baseUrl + file, gen);
      if (ok || gen !== this.generation) return;
    }
    const fb = this.fallbacks[id];
    if (!fb) {
      console.warn('[audio] 未知的音频 ID：', id);
      return;
    }
    const text = Array.isArray(fb.text) ? fb.text[Math.floor(Math.random() * fb.text.length)] : fb.text;
    await this.speak(text, fb.lang, fb.rate, gen, fb.pitch);
  }

  /** 用 Web Audio 播放（手势解锁一次后，之后任何时候都能播） */
  private async playBuffer(url: string, gen: number): Promise<boolean> {
    const ctx = this.ctx!;
    if (ctx.state !== 'running') await ctx.resume().catch(() => undefined);
    const buf = await this.buffer(url);
    if (!buf) return false;
    if (gen !== this.generation) return true;
    return new Promise((resolve) => {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      this.source = src;
      const guard = setTimeout(() => resolve(true), buf.duration * 1000 + 800);
      src.onended = () => {
        clearTimeout(guard);
        if (this.source === src) this.source = null;
        resolve(true);
      };
      src.start(0);
    });
  }

  private playFile(url: string, gen: number): Promise<boolean> {
    return new Promise((resolve) => {
      let el = this.cache.get(url);
      if (!el) {
        el = new Audio(url);
        el.preload = 'auto';
        this.cache.set(url, el);
      }
      const audio = el;
      audio.currentTime = 0;
      this.current = audio;
      const done = (ok: boolean) => {
        audio.onended = audio.onerror = null;
        resolve(ok);
      };
      audio.onended = () => done(true);
      audio.onerror = () => done(false);
      audio.play().catch(() => done(gen !== this.generation));
    });
  }

  private pickVoice(lang: string): SpeechSynthesisVoice | undefined {
    const l = lang.toLowerCase().replace('_', '-');
    const short = l.split('-')[0];
    const list = this.voices.length ? this.voices : (this.synth?.getVoices() ?? []);
    const exact = list.filter((v) => v.lang.toLowerCase().replace('_', '-') === l);
    const pool = exact.length ? exact : list.filter((v) => v.lang.toLowerCase().startsWith(short));
    // 优先本地语音（离线可用、延迟低）
    return pool.find((v) => v.localService) ?? pool[0];
  }

  private async speak(text: string, lang: string, rate: number, gen: number, pitch = 1.05): Promise<void> {
    const synth = this.synth;
    if (!synth || gen !== this.generation) return wait(300);
    const since = performance.now() - this.cancelledAt;
    if (since < 120) await wait(120 - since);
    if (gen !== this.generation) return;
    if (synth.paused) synth.resume();
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      u.rate = rate;
      u.pitch = pitch;
      const v = this.pickVoice(lang);
      if (v) u.voice = v;
      // 部分浏览器不触发 onend，用估计时长兜底
      const perChar = lang.startsWith('zh') ? 260 : 110;
      const guard = setTimeout(() => resolve(), 1500 + (text.length * perChar) / rate);
      u.onend = u.onerror = () => {
        clearTimeout(guard);
        this.utterances = this.utterances.filter((x) => x !== u);
        resolve();
      };
      // 保留引用：部分安卓浏览器会把还没说完的 utterance 回收掉
      this.utterances.push(u);
      synth.speak(u);
    });
  }

  // ---- 合成的小音效（不需要任何素材文件）----

  sfx(kind: 'tap' | 'good' | 'soft' | 'unlock' | 'pop' | 'place' | 'step'): void {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;
    if (ctx.state !== 'running') void ctx.resume();
    const notes: Record<string, [number, number, OscillatorType][]> = {
      tap: [[660, 0.06, 'square']],
      pop: [[880, 0.05, 'square'], [1320, 0.05, 'square']],
      place: [[220, 0.07, 'square'], [330, 0.05, 'square']],
      step: [[180, 0.03, 'triangle']],
      good: [[523, 0.09, 'square'], [659, 0.09, 'square'], [784, 0.16, 'square']],
      soft: [[392, 0.12, 'triangle'], [349, 0.16, 'triangle']],
      unlock: [[523, 0.08, 'square'], [659, 0.08, 'square'], [784, 0.08, 'square'], [1047, 0.25, 'square']],
    };
    let t = ctx.currentTime;
    for (const [freq, dur, type] of notes[kind]) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.08, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + dur + 0.02);
      t += dur * 0.9;
    }
  }
}

export function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
