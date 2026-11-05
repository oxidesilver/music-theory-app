// ローマ数字：キーの主音から何番目の音がルートかで、コードを数字で表す。
// 日本式：Ⅵm・Ⅳ△7・Ⅱm7(♭5)（数字は常に大文字＋コードの種類）
// 英米式：vi・IVmaj7・iiø7（マイナー系は小文字）

import { CHORD_QUALITIES, type ChordQualityId, type ChordSpec } from './chord';
import { intervalBetweenPitchClasses, intervalSemitones } from './interval';
import { keyScale, type MusicalKey } from './key';
import { formatAccidental, letterIndex, mod, semitoneOf, type PitchClass } from './pitch';
import { scaleNotes } from './scale';

export type RomanStyle = 'japanese' | 'english';
/** 基準にするスケール：key = キーのスケール（マイナーキーはナチュラルマイナー）、major = 同じ主音のメジャースケール */
export type RomanReference = 'key' | 'major';

const UPPER_ASCII = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
const UPPER_JA = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ', 'Ⅶ'];

/** 英米式で小文字にする（マイナー系の）コード */
const LOWER_QUALITIES = new Set<ChordQualityId>(['m', 'dim', 'm6', 'm7', 'mMaj7', 'dim7', 'm7b5', 'm9']);

/** 英米式の後ろに付ける記号 */
const ENGLISH_SUFFIX: Record<ChordQualityId, string> = {
  maj: '',
  m: '',
  dim: '°',
  aug: '+',
  sus2: 'sus2',
  sus4: 'sus4',
  '6': '6',
  m6: '6',
  '7': '7',
  maj7: 'maj7',
  m7: '7',
  mMaj7: 'maj7',
  dim7: '°7',
  m7b5: 'ø7',
  augMaj7: '+maj7',
  '7sus4': '7sus4',
  add9: 'add9',
  '9': '9',
  maj9: 'maj9',
  m9: '9',
  '11': '11',
  '13': '13',
};

function referenceScale(key: MusicalKey, reference: RomanReference): PitchClass[] {
  return reference === 'major' ? scaleNotes(key.tonic, 'major') : keyScale(key);
}

export interface DegreeInfo {
  /** 1〜7 */
  degree: number;
  /** 基準スケールの音から何半音ずれているか（-1 = ♭、+1 = #） */
  accidental: number;
}

/** 音がキーの何番目の音か（例：C メジャーで B♭ → 7度・♭） */
export function degreeOf(key: MusicalKey, note: PitchClass, reference: RomanReference = 'key'): DegreeInfo {
  const degree = mod(letterIndex(note.letter) - letterIndex(key.tonic.letter), 7) + 1;
  const scaleNote = referenceScale(key, reference)[degree - 1]!;
  let accidental = mod(semitoneOf(note) - semitoneOf(scaleNote), 12);
  if (accidental > 6) accidental -= 12;
  return { degree, accidental };
}

function numeral(degree: number, style: RomanStyle, lower: boolean): string {
  if (style === 'japanese') return UPPER_JA[degree - 1]!;
  const n = UPPER_ASCII[degree - 1]!;
  return lower ? n.toLowerCase() : n;
}

/** 度数の部分だけ（例：♭Ⅶ） */
export function formatDegree(info: DegreeInfo, style: RomanStyle, lower = false): string {
  return formatAccidental(info.accidental, 'unicode') + numeral(info.degree, style, lower);
}

/** コードをローマ数字にする（例：キー F#マイナーで C# → 英米式 "V"、日本式 "Ⅴ"） */
export function romanNumeral(
  key: MusicalKey,
  chord: ChordSpec,
  opts: { style?: RomanStyle; reference?: RomanReference } = {},
): string {
  const style = opts.style ?? 'japanese';
  const reference = opts.reference ?? 'key';
  const info = degreeOf(key, chord.root, reference);
  let text: string;
  if (style === 'japanese') {
    text = formatDegree(info, style) + CHORD_QUALITIES[chord.quality].symbols.japanese;
  } else {
    text = formatDegree(info, style, LOWER_QUALITIES.has(chord.quality)) + ENGLISH_SUFFIX[chord.quality];
  }
  if (chord.bass) text += '/' + formatDegree(degreeOf(key, chord.bass, reference), style);
  return text;
}

/** ローマ数字の並び（コード進行）を一括で変換する */
export function romanNumerals(
  key: MusicalKey,
  chords: ChordSpec[],
  opts: { style?: RomanStyle; reference?: RomanReference } = {},
): string[] {
  return chords.map((c) => romanNumeral(key, c, opts));
}

const JA_NUMERALS = new Map(UPPER_JA.map((n, i) => [n, i + 1]));
const ASCII_NUMERALS = new Map(UPPER_ASCII.map((n, i) => [n, i + 1]));

function parseAccidentalPrefix(text: string): { accidental: number; rest: string } {
  let accidental = 0;
  let i = 0;
  for (; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === '♭' || ch === 'b') accidental -= 1;
    else if (ch === '♯' || ch === '#') accidental += 1;
    else break;
  }
  return { accidental, rest: text.slice(i) };
}

function rootFromDegree(key: MusicalKey, degree: number, accidental: number, reference: RomanReference): PitchClass {
  const base = referenceScale(key, reference)[degree - 1]!;
  return { letter: base.letter, accidental: base.accidental + accidental };
}

/**
 * ローマ数字からコードを作る（例：キー C メジャーで "Ⅵm" → Am、"♭VII" → B♭）。
 * 定番進行をどのキーにも当てはめるために使う。
 */
export function chordFromRoman(
  key: MusicalKey,
  text: string,
  opts: { reference?: RomanReference } = {},
): ChordSpec {
  const reference = opts.reference ?? 'key';
  const [main, bassText] = text.trim().split('/');
  const { accidental, rest } = parseAccidentalPrefix(main!);

  let degree: number | undefined;
  let quality: ChordQualityId | undefined;

  const ja = /^([ⅠⅡⅢⅣⅤⅥⅦ])(.*)$/u.exec(rest);
  if (ja) {
    degree = JA_NUMERALS.get(ja[1]!);
    const suffix = ja[2]!;
    quality = (Object.keys(CHORD_QUALITIES) as ChordQualityId[]).find(
      (id) => CHORD_QUALITIES[id].symbols.japanese === suffix || CHORD_QUALITIES[id].aliases.includes(suffix),
    );
  } else {
    const en = /^(VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i)(.*)$/.exec(rest);
    if (en) {
      const lower = en[1] === en[1]!.toLowerCase();
      degree = ASCII_NUMERALS.get(en[1]!.toUpperCase());
      const suffix = en[2]!;
      quality = (Object.keys(ENGLISH_SUFFIX) as ChordQualityId[]).find(
        (id) => ENGLISH_SUFFIX[id] === suffix && LOWER_QUALITIES.has(id) === lower,
      );
      if (!quality && suffix === 'ø') quality = 'm7b5';
    }
  }
  if (!degree || !quality) throw new Error(`ローマ数字として読めません：「${text}」`);

  const chord: ChordSpec = { root: rootFromDegree(key, degree, accidental, reference), quality };
  if (bassText) {
    const b = parseAccidentalPrefix(bassText);
    const bd = JA_NUMERALS.get(b.rest) ?? ASCII_NUMERALS.get(b.rest.toUpperCase());
    if (!bd) throw new Error(`ベースの度数が読めません：「${bassText}」`);
    chord.bass = rootFromDegree(key, bd, b.accidental, reference);
  }
  return chord;
}

/** 2つの音の度数の差（コード進行の「ルートの動き」の説明用。例：Ⅴ→Ⅰ は完全4度上） */
export function rootMotion(from: PitchClass, to: PitchClass) {
  const iv = intervalBetweenPitchClasses(from, to);
  return { interval: iv, semitones: intervalSemitones(iv) };
}
