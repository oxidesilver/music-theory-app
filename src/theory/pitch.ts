// 音名とMIDIノート番号（設計書 5章）
// 音は「文字（C〜B）＋変化記号（#/♭の数）＋オクターブ」で表す。
// 半音の数だけでは C# と D♭ を区別できないため、文字を必ず保持する。

import type { Letter, Pitch, PitchClass } from '@/types/music';

export type { Letter, Pitch, PitchClass };

export const LETTERS: readonly Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

/** 変化記号なしの音が C から何半音上か */
export const NATURAL_SEMITONES: Readonly<Record<Letter, number>> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

/** 音名とドレミの対応（固定ド） */
export const SOLFEGE: Readonly<Record<Letter, string>> = {
  C: 'ド',
  D: 'レ',
  E: 'ミ',
  F: 'ファ',
  G: 'ソ',
  A: 'ラ',
  B: 'シ',
};

/** 日本音名（ハニホヘトイロ） */
export const JAPANESE_LETTER: Readonly<Record<Letter, string>> = {
  C: 'ハ',
  D: 'ニ',
  E: 'ホ',
  F: 'ヘ',
  G: 'ト',
  A: 'イ',
  B: 'ロ',
};

/** 負の数にも対応した余り（-1 mod 12 = 11） */
export function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

export function letterIndex(letter: Letter): number {
  return LETTERS.indexOf(letter);
}

export function letterAt(index: number): Letter {
  return LETTERS[mod(index, 7)] as Letter;
}

export function pc(letter: Letter, accidental = 0): PitchClass {
  return { letter, accidental };
}

export function pitch(letter: Letter, accidental: number, octave: number): Pitch {
  return { letter, accidental, octave };
}

const ACCIDENTAL_VALUES: Record<string, number> = {
  '#': 1,
  '♯': 1,
  x: 2,
  '𝄪': 2,
  b: -1,
  '♭': -1,
  '𝄫': -2,
};

function parseAccidentals(text: string): number {
  let total = 0;
  for (const ch of text) {
    const v = ACCIDENTAL_VALUES[ch];
    if (v === undefined) throw new Error(`変化記号として読めない文字です：「${ch}」`);
    total += v;
  }
  return total;
}

/** "F#"・"Bb"・"E♭"・"C##" などを読み取る */
export function parsePitchClass(text: string): PitchClass {
  const m = /^([A-Ga-g])([#♯b♭x𝄪𝄫]*)$/u.exec(text.trim());
  if (!m) throw new Error(`音名として読めません：「${text}」`);
  return { letter: m[1]!.toUpperCase() as Letter, accidental: parseAccidentals(m[2]!) };
}

/** "F#4"・"Bb3" などを読み取る（オクターブは国際式：中央のド = C4） */
export function parsePitch(text: string): Pitch {
  const m = /^([A-Ga-g][#♯b♭x𝄪𝄫]*)(-?\d+)$/u.exec(text.trim());
  if (!m) throw new Error(`音として読めません：「${text}」`);
  return { ...parsePitchClass(m[1]!), octave: Number(m[2]) };
}

/** C を 0 とした半音の位置（0〜11） */
export function semitoneOf(p: PitchClass): number {
  return mod(NATURAL_SEMITONES[p.letter] + p.accidental, 12);
}

/** MIDI ノート番号（C4 = 60, A4 = 69） */
export function midiOf(p: Pitch): number {
  return (p.octave + 1) * 12 + NATURAL_SEMITONES[p.letter] + p.accidental;
}

export type AccidentalStyle = 'ascii' | 'unicode';

export function formatAccidental(accidental: number, style: AccidentalStyle = 'ascii'): string {
  if (accidental === 0) return '';
  if (style === 'ascii') return accidental > 0 ? '#'.repeat(accidental) : 'b'.repeat(-accidental);
  if (accidental === 2) return '𝄪';
  if (accidental === -2) return '𝄫';
  return accidental > 0 ? '♯'.repeat(accidental) : '♭'.repeat(-accidental);
}

export function formatPitchClass(p: PitchClass, style: AccidentalStyle = 'ascii'): string {
  return p.letter + formatAccidental(p.accidental, style);
}

export type OctaveConvention = 'standard' | 'fl';

/**
 * 表示用の音名。FL Studio 式では中央のドを C5 と表示する（内部データは C4 のまま）。
 * B#3 のように、文字のオクターブと実際の高さがずれる場合も文字のオクターブで表示する。
 */
export function formatPitch(
  p: Pitch,
  opts: { octaveConvention?: OctaveConvention; style?: AccidentalStyle } = {},
): string {
  const offset = opts.octaveConvention === 'fl' ? 1 : 0;
  return formatPitchClass(p, opts.style) + String(p.octave + offset);
}

/** 綴りまで同じか（C# と D♭ は false） */
export function samePitchClass(a: PitchClass, b: PitchClass): boolean {
  return a.letter === b.letter && a.accidental === b.accidental;
}

/** 鍵盤上で同じ音か（C# と D♭ は true） */
export function isEnharmonic(a: PitchClass, b: PitchClass): boolean {
  return semitoneOf(a) === semitoneOf(b);
}

export function toPitchClass(p: Pitch): PitchClass {
  return { letter: p.letter, accidental: p.accidental };
}

const SHARP_SPELLINGS: readonly PitchClass[] = [
  pc('C'), pc('C', 1), pc('D'), pc('D', 1), pc('E'), pc('F'),
  pc('F', 1), pc('G'), pc('G', 1), pc('A'), pc('A', 1), pc('B'),
];
const FLAT_SPELLINGS: readonly PitchClass[] = [
  pc('C'), pc('D', -1), pc('D'), pc('E', -1), pc('E'), pc('F'),
  pc('G', -1), pc('G'), pc('A', -1), pc('A'), pc('B', -1), pc('B'),
];

/** 半音の位置から、# 寄り／♭ 寄りの一般的な綴りを返す */
export function pitchClassFromSemitone(semitone: number, prefer: 'sharp' | 'flat' = 'sharp'): PitchClass {
  const table = prefer === 'sharp' ? SHARP_SPELLINGS : FLAT_SPELLINGS;
  return { ...table[mod(semitone, 12)]! };
}

/** MIDI ノート番号から音を作る（綴りは # 寄り／♭ 寄りを選ぶ） */
export function pitchFromMidi(midi: number, prefer: 'sharp' | 'flat' = 'sharp'): Pitch {
  const p = pitchClassFromSemitone(midi, prefer);
  return { ...p, octave: Math.floor(midi / 12) - 1 };
}

/** 同じ高さのまま、指定した文字で綴り直す（例：C#4 → D♭4）。変化記号が ±2 を超える場合はエラー */
export function respell(p: Pitch, letter: Letter): Pitch {
  const target = midiOf(p);
  for (const octave of [p.octave - 1, p.octave, p.octave + 1]) {
    const accidental = target - ((octave + 1) * 12 + NATURAL_SEMITONES[letter]);
    if (Math.abs(accidental) <= 2) return { letter, accidental, octave };
  }
  throw new Error(`${formatPitch(p)} を ${letter} で綴ることはできません`);
}

/** 音名の読み方（例：F# → 「ファ#」、B♭ → 「シ♭」） */
export function solfegeName(p: PitchClass): string {
  return SOLFEGE[p.letter] + formatAccidental(p.accidental, 'unicode');
}

/** 日本音名（例：F# → 嬰ヘ、B♭ → 変ロ） */
export function japaneseName(p: PitchClass): string {
  const prefix: Record<number, string> = { 2: '重嬰', 1: '嬰', 0: '', [-1]: '変', [-2]: '重変' };
  const pre = prefix[p.accidental];
  if (pre === undefined) throw new Error('変化記号が多すぎます');
  return pre + JAPANESE_LETTER[p.letter];
}

/** 白鍵か黒鍵か */
export function isBlackKey(midiOrSemitone: number): boolean {
  return [1, 3, 6, 8, 10].includes(mod(midiOrSemitone, 12));
}
