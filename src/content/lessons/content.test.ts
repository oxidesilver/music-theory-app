// 教材データの検査：形が正しいか、書かれている音楽理論の事実が理論エンジンの計算と一致するか
import { describe, expect, it } from 'vitest';
import { ALL_LESSONS, CHAPTERS } from './curriculum';
import { resolveNotes, stepPattern } from './resolve';
import type { Demo, Diagram, Lesson } from './types';
import { formatInterval, intervalBetween, intervalSemitones, invertInterval, parseInterval } from '@/theory/interval';
import { formatPitchClass, parsePitch, parsePitchClass } from '@/theory/pitch';
import { scaleNotes } from '@/theory/scale';

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
  it('第1〜3章に合計18レッスンがある', () => {
    expect(CHAPTERS.slice(0, 3).map((c) => c.lessons.length)).toEqual([5, 6, 7]);
    expect(ALL_LESSONS).toHaveLength(18);
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
});
