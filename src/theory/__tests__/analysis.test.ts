import { describe, expect, it } from 'vitest';
import { analyzeChord, analyzeProgression } from '../analysis';
import { makeKey } from '../key';
import { formatChordSymbol, parseChordSymbol } from '../chord';

const C = makeKey('C', 'major');
const analyze = (key = C, chord: string, style: 'japanese' | 'english' = 'japanese') =>
  analyzeChord(key, parseChordSymbol(chord), { style });

describe('ダイアトニックかどうか', () => {
  it('C メジャーの C・Am・F・G7 はすべてダイアトニック', () => {
    for (const c of ['C', 'Am', 'F', 'G7', 'Dm7', 'Bm7b5', 'Csus4', 'Fadd9']) {
      expect(analyze(C, c).category, c).toBe('diatonic');
    }
  });

  it('綴りが違っても同じ高さならキーの綴りに直して判定する（D メジャーで G♭m → F#m）', () => {
    const r = analyze(makeKey('D', 'major'), 'Gbm');
    expect(r.category).toBe('diatonic');
    expect(formatChordSymbol(r.chord)).toBe('F#m');
    expect(r.roman).toBe('Ⅲm');
  });
});

describe('セカンダリードミナント', () => {
  it.each([
    ['D7', 'Ⅴ7/Ⅴ', 'V7/V'],
    ['E7', 'Ⅴ7/Ⅵm', 'V7/vi'],
    ['A7', 'Ⅴ7/Ⅱm', 'V7/ii'],
    ['B7', 'Ⅴ7/Ⅲm', 'V7/iii'],
    ['C7', 'Ⅴ7/Ⅳ', 'V7/IV'],
    ['D', 'Ⅴ/Ⅴ', 'V/V'],
  ])('キー C で %s は %s（%s）', (chord, ja, en) => {
    const r = analyze(C, chord);
    expect(r.category).toBe('secondary-dominant');
    expect(r.secondaryOf?.label).toBe(ja);
    expect(analyze(C, chord, 'english').secondaryOf?.label).toBe(en);
    expect(r.functions).toEqual(['D']);
  });

  it('Ⅶdim を目的地にするものは対象外（キー C で F#7 はセカンダリードミナントとしない）', () => {
    expect(analyze(C, 'F#7').category).not.toBe('secondary-dominant');
  });
});

describe('同主調からの借用（モーダルインターチェンジ）', () => {
  it('キー C で Fm はサブドミナントマイナー', () => {
    const r = analyze(C, 'Fm');
    expect(r.category).toBe('borrowed');
    expect(r.subdominantMinor).toBe(true);
  });
  it.each([
    ['Bb', true],
    ['Ab', true],
    ['Eb', false],
    ['Abmaj7', true],
  ])('キー C で %s は借用コード（サブドミナントマイナー：%s）', (chord, sdm) => {
    const r = analyze(C, chord);
    expect(r.category).toBe('borrowed');
    expect(r.subdominantMinor).toBe(sdm);
  });
});

describe('マイナーキー', () => {
  it('指示書の例：F#m → D → E → C#', () => {
    const key = makeKey('F#', 'minor');
    const result = analyzeProgression(key, ['F#m', 'D', 'E', 'C#'].map(parseChordSymbol), { style: 'english' });
    expect(result.chords.map((c) => c.roman)).toEqual(['i', 'VI', 'VII', 'V']);
    expect(result.chords.map((c) => c.category)).toEqual(['diatonic', 'diatonic', 'diatonic', 'harmonic-minor']);
    expect(result.chords[3]!.functions).toEqual(['D']);
  });

  it('A マイナーで E7・G#dim7 はハーモニックマイナー由来', () => {
    const key = makeKey('A', 'minor');
    expect(analyze(key, 'E7').category).toBe('harmonic-minor');
    expect(analyze(key, 'G#dim7').category).toBe('harmonic-minor');
    expect(analyze(key, 'G#dim7').functions).toEqual(['D']);
    expect(analyze(key, 'Em7').category).toBe('diatonic');
    expect(analyze(key, 'D').category).toBe('melodic-minor');
  });
});

describe('その他のノンダイアトニック', () => {
  it('キー C で D♭（ナポリの和音）はノンダイアトニック', () => {
    expect(analyze(C, 'Db').category).toBe('non-diatonic');
  });
});

describe('進行の中の「解決」', () => {
  it('G7 → C はドミナントモーション', () => {
    const r = analyzeProgression(C, ['C', 'Am', 'Dm7', 'G7', 'C'].map(parseChordSymbol));
    expect(r.resolutions).toHaveLength(1);
    expect(r.resolutions[0]).toMatchObject({ index: 3, kind: 'dominant' });
  });

  it('D7 → G はセカンダリードミナントの解決、G7 → C はドミナントモーション', () => {
    const r = analyzeProgression(C, ['C', 'D7', 'G7', 'C'].map(parseChordSymbol));
    expect(r.resolutions.map((x) => [x.index, x.kind])).toEqual([
      [1, 'secondary-dominant'],
      [2, 'dominant'],
    ]);
  });

  it('マイナーキーの Ⅴ → Ⅰm も解決', () => {
    const r = analyzeProgression(makeKey('F#', 'minor'), ['C#', 'F#m'].map(parseChordSymbol));
    expect(r.resolutions[0]?.kind).toBe('dominant');
  });
});
