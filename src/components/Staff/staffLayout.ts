// 五線譜の位置計算（画面から分離。テスト可能）
// 音は「文字＋オクターブ」で五線上の位置が決まる（C♯ と D♭ は別の位置に書かれる）。

import { keySignature, type MusicalKey } from '@/theory/key';
import { letterIndex, midiOf, type Letter, type Pitch, type PitchClass } from '@/theory/pitch';

export type Clef = 'treble' | 'bass';

/** 線と線の間隔の半分（音1つ分の高さ） */
export const HALF_SPACE = 5;
/** 五線の一番上の線の y 座標 */
export const STAFF_TOP = 40;
export const STAFF_BOTTOM = STAFF_TOP + HALF_SPACE * 8;

/** 音の「段」（C0 = 0、D0 = 1 … 文字ごとに1つ上がる） */
export function diatonicStep(p: { letter: Letter; octave: number }): number {
  return p.octave * 7 + letterIndex(p.letter);
}

/** 各音部記号で、一番下の線の音 */
const BOTTOM_LINE: Record<Clef, { letter: Letter; octave: number }> = {
  treble: { letter: 'E', octave: 4 },
  bass: { letter: 'G', octave: 2 },
};

/** 一番下の線から何段上か（0 = 一番下の線、8 = 一番上の線） */
export function staffPosition(p: { letter: Letter; octave: number }, clef: Clef): number {
  return diatonicStep(p) - diatonicStep(BOTTOM_LINE[clef]);
}

export function yOf(position: number): number {
  return STAFF_BOTTOM - position * HALF_SPACE;
}

/** 加線（五線の外の音に引く短い線）の位置 */
export function ledgerPositions(position: number): number[] {
  const out: number[] = [];
  for (let p = -2; p >= position; p -= 2) out.push(p);
  for (let p = 10; p <= position; p += 2) out.push(p);
  return out;
}

/** 音の範囲から、ト音記号とヘ音記号のどちらで書くかを選ぶ */
export function chooseClef(pitches: Pitch[]): Clef {
  if (pitches.length === 0) return 'treble';
  const midis = pitches.map(midiOf);
  const avg = midis.reduce((a, b) => a + b, 0) / midis.length;
  return avg < 57 ? 'bass' : 'treble';
}

/** 調号の ♯・♭ を書く位置（ト音記号の標準的な位置。ヘ音記号は2段下＝1オクターブ下の位置に1段ずれる） */
const SHARP_POSITIONS_TREBLE: [Letter, number][] = [['F', 5], ['C', 5], ['G', 5], ['D', 5], ['A', 4], ['E', 5], ['B', 4]];
const FLAT_POSITIONS_TREBLE: [Letter, number][] = [['B', 4], ['E', 5], ['A', 4], ['D', 5], ['G', 4], ['C', 5], ['F', 4]];

export interface KeySignatureMark {
  accidental: 1 | -1;
  position: number;
}

export function keySignatureMarks(key: MusicalKey | undefined, clef: Clef): KeySignatureMark[] {
  if (!key) return [];
  const sig = keySignature(key);
  if (sig.theoretical || sig.count === 0) return [];
  const table = sig.count > 0 ? SHARP_POSITIONS_TREBLE : FLAT_POSITIONS_TREBLE;
  const octaveShift = clef === 'bass' ? -2 : 0;
  return table.slice(0, Math.abs(sig.count)).map(([letter, octave]) => ({
    accidental: sig.count > 0 ? 1 : -1,
    position: staffPosition({ letter, octave: octave + octaveShift }, clef),
  }));
}

/** 調号を考えたときの、その文字の「当たり前の変化記号」（例：D メジャーなら F と C は ♯） */
export function keyAccidentalFor(letter: Letter, key: MusicalKey | undefined): number {
  if (!key) return 0;
  const sig = keySignature(key);
  if (sig.theoretical) return 0;
  return sig.accidentals.find((a) => a.letter === letter)?.accidental ?? 0;
}

/**
 * 音符の前に書く記号。調号で決まっている変化と同じなら書かない。
 * 調号と違うときは、♯・♭、元に戻すときは ♮（ナチュラル）を書く。
 * ※ この簡易表示では、同じ小節の中での記号の持ち越しは考えず、音符ごとに判断する。
 */
export function accidentalSymbol(p: PitchClass, key: MusicalKey | undefined): string {
  const expected = keyAccidentalFor(p.letter, key);
  if (p.accidental === expected) return '';
  switch (p.accidental) {
    case 0:
      return '♮';
    case 1:
      return '♯';
    case -1:
      return '♭';
    case 2:
      return 'x';
    case -2:
      return '♭♭';
    default:
      return '';
  }
}

/** 和音の中で、となり合う段（2度）の音符は左右にずらして重ならないようにする */
export function chordOffsets(positions: number[]): number[] {
  const order = positions.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p);
  const offsets = new Array<number>(positions.length).fill(0);
  for (let k = 1; k < order.length; k++) {
    const prev = order[k - 1]!;
    const cur = order[k]!;
    if (cur.p - prev.p === 1 && offsets[prev.i] === 0) offsets[cur.i] = 1;
  }
  return offsets;
}
