// 音程（2つの音の距離）の計算。
// 音程は「度数（文字がいくつ離れているか）」と「種類（完全・長・短・増・減）」の組で表す。
// 例：C→E は「長3度（M3）」、C→F♭ は鍵盤上は同じ距離でも「減4度（d4）」。

import {
  letterAt,
  letterIndex,
  midiOf,
  mod,
  NATURAL_SEMITONES,
  semitoneOf,
  type Pitch,
  type PitchClass,
} from './pitch';

export type IntervalQuality = 'P' | 'M' | 'm' | 'A' | 'd' | 'AA' | 'dd';

export interface Interval {
  /** 度数（1 = 同じ文字、3 = 3度、9 = 9度 …） */
  number: number;
  quality: IntervalQuality;
}

/** 1〜7度の、長・完全音程の半音数 */
const BASE_SEMITONES = [0, 2, 4, 5, 7, 9, 11] as const;

const PERFECT_OFFSETS: Partial<Record<IntervalQuality, number>> = { dd: -2, d: -1, P: 0, A: 1, AA: 2 };
const MAJOR_OFFSETS: Partial<Record<IntervalQuality, number>> = { dd: -3, d: -2, m: -1, M: 0, A: 1, AA: 2 };

/** 9度 → 2度、11度 → 4度 のように 1〜7 に直す */
export function simpleNumber(n: number): number {
  return mod(n - 1, 7) + 1;
}

/** 1・4・5度（とその複音程 8・11・12度…）は「完全」系の音程 */
export function isPerfectClass(n: number): boolean {
  const s = simpleNumber(n);
  return s === 1 || s === 4 || s === 5;
}

function baseSemitones(n: number): number {
  return BASE_SEMITONES[simpleNumber(n) - 1]! + 12 * Math.floor((n - 1) / 7);
}

/** 音程の半音数（例：m3 → 3、P5 → 7、M9 → 14） */
export function intervalSemitones(iv: Interval): number {
  if (!Number.isInteger(iv.number) || iv.number < 1) throw new Error(`度数が不正です：${iv.number}`);
  const table = isPerfectClass(iv.number) ? PERFECT_OFFSETS : MAJOR_OFFSETS;
  const offset = table[iv.quality];
  if (offset === undefined) throw new Error(`${iv.number}度に「${iv.quality}」は使えません`);
  return baseSemitones(iv.number) + offset;
}

/** "m3"・"P5"・"M9"・"A4"・"d7" を読み取る */
export function parseInterval(text: string): Interval {
  const m = /^(AA|dd|P|M|m|A|d)(\d+)$/.exec(text.trim());
  if (!m) throw new Error(`音程として読めません：「${text}」`);
  const iv: Interval = { quality: m[1] as IntervalQuality, number: Number(m[2]) };
  intervalSemitones(iv); // 組み合わせが正しいか確認
  return iv;
}

export function formatInterval(iv: Interval): string {
  return `${iv.quality}${iv.number}`;
}

/** 度数と半音数から音程を作る（例：3度・3半音 → 短3度） */
export function intervalFrom(number: number, semitones: number): Interval {
  const diff = semitones - baseSemitones(number);
  const table = isPerfectClass(number) ? PERFECT_OFFSETS : MAJOR_OFFSETS;
  const quality = (Object.keys(table) as IntervalQuality[]).find((q) => table[q] === diff);
  if (!quality) throw new Error(`${number}度・${semitones}半音の音程は扱えません`);
  return { number, quality };
}

/** 音を音程の分だけ上（direction = -1 なら下）に移す。綴りを正しく保つ */
export function transposePitch(p: Pitch, iv: Interval, direction: 1 | -1 = 1): Pitch {
  const steps = (iv.number - 1) * direction;
  const li = letterIndex(p.letter) + steps;
  const letter = letterAt(li);
  const octave = p.octave + Math.floor(li / 7);
  const targetMidi = midiOf(p) + intervalSemitones(iv) * direction;
  const naturalMidi = (octave + 1) * 12 + NATURAL_SEMITONES[letter];
  return { letter, accidental: targetMidi - naturalMidi, octave };
}

/** オクターブなしの音名を音程の分だけ移す */
export function transposePitchClass(p: PitchClass, iv: Interval, direction: 1 | -1 = 1): PitchClass {
  const { letter, accidental } = transposePitch({ ...p, octave: 4 }, iv, direction);
  return { letter, accidental };
}

/** 文字列の音程で移す（例：transpose(F#, 'm3') → A） */
export function transpose(p: PitchClass, interval: string, direction: 1 | -1 = 1): PitchClass {
  return transposePitchClass(p, parseInterval(interval), direction);
}

/** 2つの音の音程（低い方から高い方へ。複音程にも対応） */
export function intervalBetween(a: Pitch, b: Pitch): Interval {
  let low = a;
  let high = b;
  const pos = (p: Pitch) => letterIndex(p.letter) + 7 * p.octave;
  if (pos(b) < pos(a)) {
    low = b;
    high = a;
  }
  const steps = pos(high) - pos(low);
  return intervalFrom(steps + 1, midiOf(high) - midiOf(low));
}

/** オクターブなしの2音について、a から上に b までの音程（1〜7度の範囲） */
export function intervalBetweenPitchClasses(a: PitchClass, b: PitchClass): Interval {
  const steps = mod(letterIndex(b.letter) - letterIndex(a.letter), 7);
  const base = BASE_SEMITONES[steps]!;
  let semis = mod(semitoneOf(b) - semitoneOf(a), 12);
  // 例：C → C♭（減1度）のように、12 を超える／0 を下回る場合を補正する
  while (semis - base > 6) semis -= 12;
  while (semis - base < -6) semis += 12;
  return intervalFrom(steps + 1, semis);
}

const QUALITY_JA: Record<IntervalQuality, string> = {
  P: '完全',
  M: '長',
  m: '短',
  A: '増',
  d: '減',
  AA: '重増',
  dd: '重減',
};

/** 日本語の音程名（例：長3度、完全8度（オクターブ）） */
export function intervalNameJa(iv: Interval): string {
  const name = `${QUALITY_JA[iv.quality]}${iv.number}度`;
  if (iv.quality === 'P' && iv.number === 1) return `${name}（同じ音）`;
  if (iv.quality === 'P' && iv.number === 8) return `${name}（オクターブ）`;
  return name;
}

/** 音程を転回する（例：長3度 ⇔ 短6度）。単音程のみ */
export function invertInterval(iv: Interval): Interval {
  if (iv.number > 8) throw new Error('転回できるのは8度以内の音程です');
  const inverseQuality: Record<IntervalQuality, IntervalQuality> = {
    P: 'P', M: 'm', m: 'M', A: 'd', d: 'A', AA: 'dd', dd: 'AA',
  };
  return { number: 9 - iv.number, quality: inverseQuality[iv.quality] };
}
