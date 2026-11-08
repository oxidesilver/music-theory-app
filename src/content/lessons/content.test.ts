// 教材データの検査：形が正しいか、書かれている音楽理論の事実が理論エンジンの計算と一致するか
import { describe, expect, it } from 'vitest';
import { ALL_LESSONS, CHAPTERS } from './curriculum';
import { resolveNotes, resolveProgression, stepPattern } from './resolve';
import type { Demo, Diagram, Lesson } from './types';
import { formatInterval, intervalBetween, intervalSemitones, invertInterval, parseInterval } from '@/theory/interval';
import { formatPitchClass, parsePitch, parsePitchClass } from '@/theory/pitch';
import { scaleNotes } from '@/theory/scale';
import { CHORD_QUALITIES, chordPitches, chordTones, formatChordSymbol, parseChordSymbol } from '@/theory/chord';
import { diatonicChords } from '@/theory/diatonic';
import { keyName, keySignature, makeKey, parallelKey, relativeKey } from '@/theory/key';
import { romanNumeral, chordFromRoman } from '@/theory/roman';
import { formatPitch, midiOf } from '@/theory/pitch';

const allDemos = (l: Lesson): Demo[] => [...(l.demos ?? []), ...l.quiz.flatMap((q) => (q.listen ? [q.listen] : []))];
const allText = (l: Lesson): string[] => [
  l.title,
  l.goal,
  ...l.explanation,
  ...l.examples,
  ...l.dtm,
  ...l.quiz.flatMap((q) => [q.prompt, q.explanation, ...q.choices]),
  ...(l.demos ?? []).flatMap((d) => [d.title, d.description ?? '']),
];

describe('教材データの形', () => {
  it('第1〜6章に合計39レッスンがある', () => {
    expect(CHAPTERS.slice(0, 6).map((c) => c.lessons.length)).toEqual([5, 6, 7, 7, 8, 6]);
    expect(ALL_LESSONS).toHaveLength(39);
  });

  it('レッスン ID は重複しない', () => {
    const ids = ALL_LESSONS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(ALL_LESSONS.map((l) => [l.id, l] as const))('%s：必須項目とクイズの形が正しい', (_, lesson) => {
    expect(lesson.explanation.length).toBeGreaterThan(0);
    expect(lesson.examples.length).toBeGreaterThan(0);
    expect(lesson.dtm.length).toBeGreaterThan(0);
    expect(lesson.quiz.length).toBeGreaterThanOrEqual(3);
    const qids = lesson.quiz.map((q) => q.id);
    expect(new Set(qids).size).toBe(qids.length);
    for (const q of lesson.quiz) {
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(q.answer).toBeLessThan(q.choices.length);
      expect(new Set(q.choices).size, q.prompt).toBe(q.choices.length);
      expect(q.explanation.length).toBeGreaterThan(0);
    }
  });

  it.each(ALL_LESSONS.map((l) => [l.id, l] as const))('%s：鳴らす音の指定がすべて正しく計算できる', (_, lesson) => {
    for (const d of allDemos(lesson)) {
      if (d.mode === 'progression') expect(resolveProgression(d.source).every((c) => c.length >= 3)).toBe(true);
      const notes = resolveNotes(d.source);
      expect(notes.length).toBeGreaterThan(0);
      if (d.mode === 'compare') expect(notes).toHaveLength(2);
    }
  });

  it.each(ALL_LESSONS.map((l) => [l.id, l] as const))('%s：文章中の {{音名}} がすべて読める', (_, lesson) => {
    for (const text of allText(lesson)) {
      for (const m of text.matchAll(/\{\{([^}]+)\}\}/g)) expect(() => parsePitch(m[1]!)).not.toThrow();
    }
  });
});

describe('図解の正しさ（理論エンジンで計算した結果と一致するか）', () => {
  const diagrams: [string, Diagram][] = ALL_LESSONS.flatMap((l) => (l.diagrams ?? []).map((d) => [l.id, d] as [string, Diagram]));

  it.each(diagrams.filter(([, d]) => d.kind === 'steps'))('%s：全音・半音の並び', (_, d) => {
    if (d.kind !== 'steps') return;
    expect(stepPattern(resolveNotes(d.source))).toBe(d.expectPattern);
  });

  it('新しい図解（調号・コードの組み立て・ダイアトニック表）の指定が正しい', () => {
    for (const [id, d] of diagrams) {
      if (d.kind === 'chord-builder') {
        for (const q of d.qualities) expect(CHORD_QUALITIES[q], id).toBeTruthy();
        if (d.root) expect(() => parsePitchClass(d.root!)).not.toThrow();
      }
      if (d.kind === 'diatonic-table') expect(diatonicChords(makeKey(d.tonic ?? 'C', d.mode), { scale: d.scale })).toHaveLength(7);
    }
  });

  it('音程の表に使う音程はすべて有効', () => {
    for (const [, d] of diagrams) if (d.kind === 'interval-table') for (const iv of d.intervals) expect(() => parseInterval(iv)).not.toThrow();
  });
});

describe('教材に書いた事実の確認', () => {
  const iv = (a: string, b: string) => formatInterval(intervalBetween(parsePitch(a), parsePitch(b)));
  const notes = (tonic: string, id: Parameters<typeof scaleNotes>[1]) => scaleNotes(parsePitchClass(tonic), id).map((p) => formatPitchClass(p, 'unicode')).join(' ');

  it('第2章の音程', () => {
    expect(iv('C4', 'G4')).toBe('P5');
    expect(iv('D4', 'F4')).toBe('m3');
    expect(iv('C4', 'Eb4')).toBe('m3');
    expect(iv('E4', 'F4')).toBe('m2');
    expect(iv('G4', 'A4')).toBe('M2');
    expect(iv('D4', 'F#4')).toBe('M3');
    expect(iv('A3', 'C4')).toBe('m3');
    expect(iv('F4', 'B4')).toBe('A4');
    expect(iv('B3', 'F4')).toBe('d5');
    expect(iv('C4', 'A4')).toBe('M6');
    expect(iv('C4', 'Bb4')).toBe('m7');
    expect(intervalSemitones(parseInterval('M7'))).toBe(11);
    expect(formatInterval(invertInterval(parseInterval('M3')))).toBe('m6');
  });

  it('第3章のスケールの構成音', () => {
    expect(notes('G', 'major')).toBe('G A B C D E F♯');
    expect(notes('D', 'major')).toBe('D E F♯ G A B C♯');
    expect(notes('C', 'naturalMinor')).toBe('C D E♭ F G A♭ B♭');
    expect(notes('F#', 'naturalMinor')).toBe('F♯ G♯ A B C♯ D E');
    expect(notes('E', 'harmonicMinor').split(' ')[6]).toBe('D♯');
    expect(notes('A', 'melodicMinor')).toBe('A B C D E F♯ G♯');
    expect(notes('C', 'majorPentatonic')).toBe('C D E G A');
    expect(notes('A', 'minorPentatonic')).toBe('A C D E G');
    expect(notes('A', 'blues')).toBe('A C D E♭ E G');
    expect(notes('C', 'majorBlues')).toBe('C D E♭ E G A');
    // 黒鍵5つ（F♯ G♯ A♯ C♯ D♯）は F♯ メジャーペンタトニック
    expect(notes('F#', 'majorPentatonic')).toBe('F♯ G♯ A♯ C♯ D♯');
  });

  const tones = (s: string) => chordTones(parseChordSymbol(s).root, parseChordSymbol(s).quality).map((p) => formatPitchClass(p, 'unicode')).join(' ');
  const chords = (tonic: string, mode: 'major' | 'minor', opts = {}) => diatonicChords(makeKey(tonic, mode), opts).map((c) => formatChordSymbol(c, { accidentals: 'unicode' })).join(' ');

  it('第4章のキー（調号・平行調・同主調）', () => {
    expect(notes('G', 'major')).toContain('F♯');
    expect(notes('F', 'major')).toContain('B♭');
    expect(notes('E', 'naturalMinor')).toBe('E F♯ G A B C D');
    expect(keySignature(makeKey('D', 'major')).accidentals.map((p) => formatPitchClass(p))).toEqual(['F#', 'C#']);
    expect(keySignature(makeKey('Eb', 'major')).count).toBe(-3);
    expect(keySignature(makeKey('Bb', 'major')).count).toBe(-2);
    expect(keySignature(makeKey('C', 'major')).count).toBe(0);
    expect(keyName(relativeKey(makeKey('C', 'major')))).toBe('Aマイナー');
    expect(keyName(relativeKey(makeKey('G', 'major')))).toBe('Eマイナー');
    expect(keyName(relativeKey(makeKey('D', 'minor')))).toBe('Fメジャー');
    expect(keyName(parallelKey(makeKey('C', 'major')))).toBe('Cマイナー');
    // キー C の「C D E」をキー G に移調すると「G A B」
    expect(['C4', 'D4', 'E4'].map((n) => formatPitch(parsePitch(n))).length).toBe(3);
    expect(['C4', 'D4', 'E4'].map((n) => midiOf(parsePitch(n)) + 7)).toEqual(['G4', 'A4', 'B4'].map((n) => midiOf(parsePitch(n))));
    // G・C・D・Em は G メジャーのダイアトニックコード
    expect(chords('G', 'major')).toContain('Em');
    for (const c of ['G', 'C', 'D', 'Em']) expect(chords('G', 'major').split(' ')).toContain(c);
  });

  it('第5章のコードの構成音', () => {
    expect(tones('C')).toBe('C E G');
    expect(tones('D')).toBe('D F♯ A');
    expect(tones('E')).toBe('E G♯ B');
    expect(tones('Cm')).toBe('C E♭ G');
    expect(tones('F#m')).toBe('F♯ A C♯');
    expect(tones('Bdim')).toBe('B D F');
    expect(tones('Caug')).toBe('C E G♯');
    expect(tones('Csus4')).toBe('C F G');
    expect(tones('Gsus2')).toBe('G A D');
    const p = (s: string, inversion: number) => chordPitches({ ...parseChordSymbol(s).root, octave: 4 }, parseChordSymbol(s).quality, { inversion }).map((x) => formatPitchClass(x)).join(' ');
    expect(p('C', 1)).toBe('E G C');
    expect(p('C', 2)).toBe('G C E');
    // Caug と Eaug は同じ鍵盤の組み合わせ
    const semis = (s: string) => chordTones(parseChordSymbol(s).root, parseChordSymbol(s).quality).map((x) => midiOf({ ...x, octave: 4 }) % 12).sort((a, b) => a - b);
    expect(semis('Caug')).toEqual(semis('Eaug'));
  });

  it('第6章のダイアトニックコードとローマ数字', () => {
    expect(chords('C', 'major')).toBe('C Dm Em F G Am Bdim');
    expect(chords('G', 'major')).toBe('G Am Bm C D Em F♯dim');
    expect(chords('C', 'major', { sevenths: true })).toBe('Cmaj7 Dm7 Em7 Fmaj7 G7 Am7 Bm7b5');
    expect(chords('A', 'minor')).toBe('Am Bdim C Dm Em F G');
    expect(chords('A', 'minor', { scale: 'harmonicMinor' }).split(' ')[4]).toBe('E');
    const C = makeKey('C', 'major');
    expect(romanNumeral(C, parseChordSymbol('Am'))).toBe('Ⅵm');
    expect(romanNumeral(C, parseChordSymbol('Bb'))).toBe('♭Ⅶ');
    expect(formatChordSymbol(chordFromRoman(makeKey('G', 'major'), 'Ⅳ'))).toBe('C');
    expect(formatChordSymbol(chordFromRoman(C, 'vi'))).toBe('Am');
    // 代理：C と Am は2音共通、G7 と Bdim はトライトーン（B・F）を共有
    const common = (a: string, b: string) => tones(a).split(' ').filter((x) => tones(b).split(' ').includes(x)).length;
    expect(common('C', 'Am')).toBe(2);
    expect(common('F', 'Dm')).toBe(2);
    expect(tones('G7').split(' ')).toEqual(expect.arrayContaining(['B', 'F']));
    expect(tones('Bdim').split(' ')).toEqual(expect.arrayContaining(['B', 'F']));
  });
});
