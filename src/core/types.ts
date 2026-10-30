export type Stroke =
  | { t: 'line'; p: [number, number, number, number]; join?: boolean }
  | { t: 'arc'; c: [number, number]; r: number; a: [number, number]; join?: boolean }
  | { t: 'dot'; c: [number, number]; join?: boolean };

export interface Letter {
  id: string;
  upper: string;
  lower: string;
  group: number;
  tts: { sound: string; name: string };
  picture: string;
  pictureWord: string;
  gesture: string;
  gestureZh: string;
  color: string;
  strokesLower: Stroke[];
  strokesUpper: Stroke[];
}

export interface Word {
  id: string;
  letters: string[];
  zh: string;
  item?: string;
  guided?: boolean;
}

export interface RhymePair {
  a: string;
  b: string;
  rhyme: boolean;
}

export interface QuestionOption {
  id: string;
  icon: string;
  zh: string;
}

export interface Question {
  id: string;
  where: 'world' | 'bridge';
  promptZh: string;
  options: QuestionOption[];
  reasons?: QuestionOption[];
  whyZh: string;
}

export interface Island {
  id: string;
  nameZh: string;
  weeks: string;
  status: 'open' | 'coming';
  letters?: string[];
  bridgePlanks?: number;
  offlineTaskZh?: string;
  questions?: Question[];
}

export interface Content {
  letters: Letter[];
  words: Word[];
  pictureWords: { id: string; zh: string }[];
  rhymes: RhymePair[];
  islands: Island[];
  prompts: Record<string, string | string[]>;
  promptLang: string;
}
