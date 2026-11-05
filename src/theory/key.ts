// キー（調）。主音とメジャー／マイナーの組で表す。

import { transpose } from './interval';
import {
  formatPitchClass,
  japaneseName,
  parsePitchClass,
  pitchClassFromSemitone,
  semitoneOf,
  type AccidentalStyle,
  type Pitch,
  type PitchClass,
} from './pitch';
import { scaleNotes, type ScaleId } from './scale';
import type { KeyMode, MusicalKey } from '@/types/music';

export type { KeyMode, MusicalKey };

export function makeKey(tonic: string | PitchClass, mode: KeyMode): MusicalKey {
  return { tonic: typeof tonic === 'string' ? parsePitchClass(tonic) : tonic, mode };
}

/** キーの基本スケール（メジャー／ナチュラルマイナー） */
export function keyScaleId(key: MusicalKey): ScaleId {
  return key.mode === 'major' ? 'major' : 'naturalMinor';
}

export function keyScale(key: MusicalKey): PitchClass[] {
  return scaleNotes(key.tonic, keyScaleId(key));
}

/** 平行調（調号が同じで、主音が違うキー）。C メジャー ⇔ A マイナー */
export function relativeKey(key: MusicalKey): MusicalKey {
  return key.mode === 'major'
    ? { tonic: transpose(key.tonic, 'M6'), mode: 'minor' }
    : { tonic: transpose(key.tonic, 'm3'), mode: 'major' };
}

/** 同主調（主音が同じで、メジャー／マイナーが逆のキー）。C メジャー ⇔ C マイナー */
export function parallelKey(key: MusicalKey): MusicalKey {
  return { tonic: { ...key.tonic }, mode: key.mode === 'major' ? 'minor' : 'major' };
}

const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'] as const;
const FLAT_ORDER = ['B', 'E', 'A', 'D', 'G', 'C', 'F'] as const;

export interface KeySignature {
  /** + なら # の数、- なら ♭ の数 */
  count: number;
  /** 調号に並ぶ音（例：D メジャー → F#, C#） */
  accidentals: PitchClass[];
  /** 調号が7個を超える理論上のキー（例：G# メジャー） */
  theoretical: boolean;
}

/** 調号（楽譜の最初に書く # や ♭） */
export function keySignature(key: MusicalKey): KeySignature {
  const major = key.mode === 'major' ? key : relativeKey(key);
  const count = scaleNotes(major.tonic, 'major').reduce((sum, n) => sum + n.accidental, 0);
  const n = Math.min(Math.abs(count), 7);
  const accidentals =
    count > 0
      ? SHARP_ORDER.slice(0, n).map((letter) => ({ letter, accidental: 1 }))
      : FLAT_ORDER.slice(0, n).map((letter) => ({ letter, accidental: -1 }));
  return { count, accidentals, theoretical: Math.abs(count) > 7 };
}

/** 表示名（例：F#マイナー） */
export function keyName(key: MusicalKey, style: AccidentalStyle = 'ascii'): string {
  return formatPitchClass(key.tonic, style) + (key.mode === 'major' ? 'メジャー' : 'マイナー');
}

/** 日本語の調名（例：嬰ヘ短調、変ロ長調） */
export function keyNameJa(key: MusicalKey): string {
  return japaneseName(key.tonic) + (key.mode === 'major' ? '長調' : '短調');
}

/** キー選択に並べる実用的なキー（調号7個まで） */
export const COMMON_MAJOR_TONICS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'];
export const COMMON_MINOR_TONICS = ['A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#', 'D', 'G', 'C', 'F', 'Bb', 'Eb', 'Ab'];

export function commonKeys(mode: KeyMode): MusicalKey[] {
  return (mode === 'major' ? COMMON_MAJOR_TONICS : COMMON_MINOR_TONICS).map((t) => makeKey(t, mode));
}

/**
 * キーに合わせて、鍵盤の音（MIDI番号）に音名を付ける。
 * - キーのスケールに含まれる音はスケールどおりに綴る（F#マイナーなら F# / C# など）
 * - 含まれない音は、# 系のキーなら #、♭ 系のキーなら ♭ で綴る
 */
export function spellInKey(midi: number, key: MusicalKey): Pitch {
  const s = ((midi % 12) + 12) % 12;
  const inScale = keyScale(key).find((n) => semitoneOf(n) === s);
  const spelled = inScale ?? pitchClassFromSemitone(s, keySignature(key).count < 0 ? 'flat' : 'sharp');
  // 文字のオクターブを求める（例：B#3 は MIDI 60 だがオクターブは 3）
  const naturalOctave = Math.floor(midi / 12) - 1;
  const raw = semitoneOf({ letter: spelled.letter, accidental: 0 }) + spelled.accidental;
  const octave = raw >= 12 ? naturalOctave - 1 : raw < 0 ? naturalOctave + 1 : naturalOctave;
  return { ...spelled, octave };
}
