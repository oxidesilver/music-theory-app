// 教材の「鳴らす音の指定」を、実際の音（オクターブ付き）に変換する。計算は音楽理論エンジンが行う。
import { parseInterval, transposePitch } from '@/theory/interval';
import { midiOf, mod, parsePitch, semitoneOf, type Pitch } from '@/theory/pitch';
import { scalePitches } from '@/theory/scale';
import type { NoteSource } from './types';

export function resolveNotes(source: NoteSource): Pitch[] {
  if ('notes' in source) return source.notes.map(parsePitch);
  if ('interval' in source) {
    const from = parsePitch(source.from);
    return [from, transposePitch(from, parseInterval(source.interval))];
  }
  const tonic = parsePitch(source.tonic);
  let notes = scalePitches(tonic, source.scale);
  if (source.withOctave) notes = [...notes, { ...tonic, octave: tonic.octave + 1 }];
  if (source.descending) notes = [...notes].reverse();
  return notes;
}

/** 隣り合う音の間が「全」（全音）か「半」（半音）か。3半音以上は「全+半」のように表す */
export function stepLabel(a: Pitch, b: Pitch): string {
  const d = Math.abs(midiOf(b) - midiOf(a));
  if (d === 1) return '半';
  if (d === 2) return '全';
  if (d === 3) return '全+半';
  return `${d}半音`;
}

export function stepPattern(notes: Pitch[]): string {
  return notes
    .slice(1)
    .map((n, i) => stepLabel(notes[i]!, n))
    .map((s) => (s.length > 1 ? `(${s})` : s))
    .join('');
}

/** 黒鍵の音かどうか（教材の説明用） */
export function isBlack(p: Pitch): boolean {
  return [1, 3, 6, 8, 10].includes(mod(semitoneOf(p), 12));
}
