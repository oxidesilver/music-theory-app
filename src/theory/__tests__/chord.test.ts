import { describe, expect, it } from 'vitest';
import {
  CHORD_QUALITIES,
  CHORD_QUALITY_IDS,
  chordIntervalsFromTones,
  chordPitches,
  chordTones,
  formatChordSymbol,
  identifyChord,
  parseChordSymbol,
  type ChordQualityId,
} from '../chord';
import { simpleNumber } from '../interval';
import { parsePitch, parsePitchClass } from '../pitch';
import { COMMON_MAJOR_TONICS, COMMON_MINOR_TONICS } from '../key';
import { chordNames, names, pitchNames } from './helpers';

const tones = (root: string, q: ChordQualityId, voicing: 'full' | 'common' = 'full') =>
  names(chordTones(parsePitchClass(root), q, voicing));

describe('指示書で指定された17種類＋追加のコード（ルート C）', () => {
  it.each([
    ['maj', 'C E G'],
    ['m', 'C Eb G'],
    ['dim', 'C Eb Gb'],
    ['aug', 'C E G#'],
    ['sus2', 'C D G'],
    ['sus4', 'C F G'],
    ['6', 'C E G A'],
    ['m6', 'C Eb G A'],
    ['7', 'C E G Bb'],
    ['maj7', 'C E G B'],
    ['m7', 'C Eb G Bb'],
    ['mMaj7', 'C Eb G B'],
    ['dim7', 'C Eb Gb Bbb'],
    ['m7b5', 'C Eb Gb Bb'],
    ['augMaj7', 'C E G# B'],
    ['7sus4', 'C F G Bb'],
    ['add9', 'C E G D'],
    ['9', 'C E G Bb D'],
    ['maj9', 'C E G B D'],
    ['m9', 'C Eb G Bb D'],
    ['11', 'C E G Bb D F'],
    ['13', 'C E G Bb D F A'],
  ] as const)('C%s：%s', (q, expected) => {
    expect(tones('C', q)).toBe(expected);
  });

  it('11th・13th の「よく弾かれる形」（音の省略）', () => {
    expect(tones('C', '11', 'common')).toBe('C G Bb D F');
    expect(tones('C', '13', 'common')).toBe('C E G Bb D A');
    expect(CHORD_QUALITIES['11'].voicingNote).toBeTruthy();
  });
});

describe('いろいろなルートのコード（綴りの正確さ）', () => {
  it.each([
    ['F#', 'm7', 'F# A C# E'], // 指示書の例
    ['F#', 'm', 'F# A C#'],
    ['D', 'maj', 'D F# A'],
    ['E', 'maj', 'E G# B'],
    ['C#', 'maj', 'C# E# G#'],
    ['Bb', 'maj7', 'Bb D F A'],
    ['Eb', 'm7b5', 'Eb Gb Bbb Db'],
    ['G', 'dim7', 'G Bb Db Fb'],
    ['Ab', 'aug', 'Ab C E'],
    ['B', '7', 'B D# F# A'],
    ['C#', 'dim', 'C# E G'],
    ['Db', 'maj7', 'Db F Ab C'],
    ['E', '9', 'E G# B D F#'],
    ['G#', 'dim7', 'G# B D F'],
    ['F', 'mMaj7', 'F Ab C E'],
    ['A', 'sus4', 'A D E'],
    ['D#', 'm', 'D# F# A#'],
  ] as const)('%s%s：%s', (root, q, expected) => {
    expect(tones(root, q)).toBe(expected);
  });

  it('全30キーの主音 × 全コードで、構成音の音程が定義どおりになる', () => {
    const roots = [...new Set([...COMMON_MAJOR_TONICS, ...COMMON_MINOR_TONICS])];
    for (const r of roots) {
      for (const id of CHORD_QUALITY_IDS) {
        const actual = chordIntervalsFromTones(chordTones(parsePitchClass(r), id));
        const expected = CHORD_QUALITIES[id].intervals.map((iv) => `${iv.quality}${simpleNumber(iv.number)}`);
        expect(actual, `${r}${id}`).toEqual(expected);
      }
    }
  });
});

describe('鍵盤で弾く音（オクターブ付き）と転回形', () => {
  it('C メジャーの基本形と転回形', () => {
    const c4 = parsePitch('C4');
    expect(pitchNames(chordPitches(c4, 'maj'))).toBe('C4 E4 G4');
    expect(pitchNames(chordPitches(c4, 'maj', { inversion: 1 }))).toBe('E4 G4 C5');
    expect(pitchNames(chordPitches(c4, 'maj', { inversion: 2 }))).toBe('G4 C5 E5');
  });

  it('セブンスコードの第3転回形', () => {
    expect(pitchNames(chordPitches(parsePitch('C4'), 'maj7', { inversion: 3 }))).toBe('B4 C5 E5 G5');
    expect(pitchNames(chordPitches(parsePitch('F#3'), 'm7', { inversion: 1 }))).toBe('A3 C#4 E4 F#4');
  });

  it('9th は1オクターブ上に置かれる', () => {
    expect(pitchNames(chordPitches(parsePitch('C4'), '9'))).toBe('C4 E4 G4 Bb4 D5');
  });

  it('分数コード（ベース音を一番下に追加）', () => {
    expect(pitchNames(chordPitches(parsePitch('C4'), 'maj', { bass: parsePitchClass('E') }))).toBe('E3 C4 E4 G4');
    expect(pitchNames(chordPitches(parsePitch('A3'), 'm7', { bass: parsePitchClass('G') }))).toBe('G3 A3 C4 E4 G4');
  });

  it('範囲外の転回形はエラー', () => {
    expect(() => chordPitches(parsePitch('C4'), 'maj', { inversion: 3 })).toThrow();
  });
});

describe('コード名の読み取り', () => {
  it.each([
    ['F#m7', 'F#m7'],
    ['Bbmaj7', 'Bbmaj7'],
    ['B♭maj7', 'Bbmaj7'],
    ['C△7', 'Cmaj7'],
    ['CM7', 'Cmaj7'],
    ['CΔ7', 'Cmaj7'],
    ['Cm7(b5)', 'Cm7b5'],
    ['Cm7-5', 'Cm7b5'],
    ['Cø', 'Cm7b5'],
    ['C°7', 'Cdim7'],
    ['Csus', 'Csus4'],
    ['C+', 'Caug'],
    ['C', 'C'],
    ['Cmaj', 'C'],
    ['Cm(maj7)', 'Cm(maj7)'],
    ['CmM7', 'Cm(maj7)'],
    ['Ebm', 'Ebm'],
    ['C/E', 'C/E'],
    ['Am7/G', 'Am7/G'],
    ['F#m7(b5)', 'F#m7b5'],
    ['G7sus4', 'G7sus4'],
    ['Dadd9', 'Dadd9'],
  ])('「%s」→ %s', (input, expected) => {
    expect(formatChordSymbol(parseChordSymbol(input))).toBe(expected);
  });

  it('読めないコード名はエラー', () => {
    expect(() => parseChordSymbol('H7')).toThrow();
    expect(() => parseChordSymbol('Cxyz')).toThrow();
    expect(() => parseChordSymbol('')).toThrow();
  });

  it('全コード × 全ルートで「表示 → 読み取り」が元に戻る（日本式・英米式とも）', () => {
    const roots = [...new Set([...COMMON_MAJOR_TONICS, ...COMMON_MINOR_TONICS])];
    for (const r of roots) {
      for (const quality of CHORD_QUALITY_IDS) {
        const chord = { root: parsePitchClass(r), quality };
        for (const style of ['english', 'japanese'] as const) {
          for (const accidentals of ['ascii', 'unicode'] as const) {
            const text = formatChordSymbol(chord, { style, accidentals });
            expect(parseChordSymbol(text), text).toEqual(chord);
          }
        }
      }
    }
  });
});

describe('コード名の表示', () => {
  it('日本式と英米式', () => {
    const c = (s: string) => parseChordSymbol(s);
    expect(formatChordSymbol(c('Cmaj7'), { style: 'japanese' })).toBe('C△7');
    expect(formatChordSymbol(c('Cmaj7'), { style: 'english' })).toBe('Cmaj7');
    expect(formatChordSymbol(c('Bbm7b5'), { style: 'japanese', accidentals: 'unicode' })).toBe('B♭m7(♭5)');
    expect(formatChordSymbol(c('AmM7'), { style: 'japanese' })).toBe('Am△7');
  });
});

describe('鳴っている音からコード名を探す', () => {
  const find = (s: string) => chordNames(identifyChord(s.split(' ').map(parsePitchClass)));

  it('基本形', () => {
    expect(find('C E G').split(' ')[0]).toBe('C');
    expect(find('F# A C# E').split(' ')[0]).toBe('F#m7');
    expect(find('G B D F').split(' ')[0]).toBe('G7');
  });

  it('転回形（一番下の音がルートでない）は分数コードになる', () => {
    expect(find('E G C').split(' ')[0]).toBe('C/E');
    expect(find('G C E').split(' ')[0]).toBe('C/G');
  });

  it('同じ音の組み合わせで複数の解釈がある場合は、すべて候補に出す', () => {
    const result = find('A C E G').split(' ');
    expect(result[0]).toBe('Am7');
    expect(result).toContain('C6/A');
  });

  it('当てはまらない音の組み合わせは空', () => {
    expect(identifyChord([parsePitchClass('C'), parsePitchClass('C#'), parsePitchClass('D')])).toEqual([]);
  });
});
