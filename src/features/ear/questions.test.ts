import { describe, expect, it } from 'vitest';
import { QUESTION_TYPES, generateQuestion, seededRng, type EarQuestion, type GenerateContext, type QuestionTypeId } from './questions';
import { accuracy, accuracyByLevel, weakItems } from './stats';
import { formatPitch } from '@/theory/pitch';
import type { EarTrainingRecord } from '@/storage/types';

const ctx = (seed: number): GenerateContext => ({ rng: seededRng(seed), fmt: (p) => formatPitch(p), romanStyle: 'japanese' });
const many = (type: QuestionTypeId, n = 200) => {
  const c = ctx(42);
  return Array.from({ length: n }, () => generateQuestion(type, c));
};
const semis = (q: EarQuestion) => {
  if (q.play.kind !== 'compare') throw new Error('compare ではない');
  return q.play.midis[1] - q.play.midis[0];
};
const rel = (midis: number[]) => midis.map((m) => m - midis[0]!);

describe('すべての問題の種類で、問題の形が正しい', () => {
  it.each(QUESTION_TYPES.map((t) => t.id))('%s', (type) => {
    for (const q of many(type)) {
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(q.answer).toBeLessThan(q.choices.length);
      expect(new Set(q.choices.map((c) => c.label)).size).toBe(q.choices.length);
      expect(q.play).toEqual(q.choices[q.answer]!.play);
      expect(q.explanation.length).toBeGreaterThan(10);
      expect(q.level).toBe(QUESTION_TYPES.find((t) => t.id === type)!.level);
    }
  });

  it.each(QUESTION_TYPES.map((t) => t.id))('%s：毎回ランダムに出題される（正解も音も偏らない）', (type) => {
    const qs = many(type, 60);
    expect(new Set(qs.map((q) => q.answer)).size).toBeGreaterThan(1);
    expect(new Set(qs.map((q) => JSON.stringify(q.play))).size).toBeGreaterThan(5);
  });

  it('同じ乱数の種からは同じ問題が作られる（テストで再現できる）', () => {
    expect(generateQuestion('triads', ctx(7))).toEqual(generateQuestion('triads', ctx(7)));
  });
});

describe('レベル1：音程の正解が理論どおり', () => {
  const expected: Record<string, number> = {
    '半音（短2度）': 1, '全音（長2度）': 2, 長3度: 4, 短3度: 3, 完全4度: 5, 完全5度: 7, オクターブ: 12,
    短2度: 1, 長2度: 2, 長6度: 9,
  };
  it.each(['half-whole', 'thirds', 'fifth-octave', 'intervals-mixed'] as const)('%s', (type) => {
    for (const q of many(type)) {
      expect(semis(q), q.choices[q.answer]!.label).toBe(expected[q.choices[q.answer]!.label]);
      // 選択肢の音もそれぞれ正しい
      for (const c of q.choices) {
        if (c.play.kind === 'compare') expect(c.play.midis[1] - c.play.midis[0]).toBe(expected[c.label]);
      }
    }
  });

  it('同じ音か違う音か', () => {
    for (const q of many('same-different')) {
      const d = Math.abs(semis(q));
      if (q.answer === 0) expect(d).toBe(0);
      else expect([1, 2]).toContain(d);
    }
  });
});

describe('レベル2：コードの構成音が理論どおり', () => {
  const shapes: Record<string, number[]> = {
    メジャー: [0, 4, 7],
    マイナー: [0, 3, 7],
    ディミニッシュ: [0, 3, 6],
    オーギュメント: [0, 4, 8],
    '7（セブンス）': [0, 4, 7, 10],
    'maj7（メジャーセブンス）': [0, 4, 7, 11],
    'm7（マイナーセブンス）': [0, 3, 7, 10],
    'm7(♭5)（ハーフディミニッシュ）': [0, 3, 6, 10],
  };
  it.each(['major-minor', 'triads', 'sevenths'] as const)('%s', (type) => {
    for (const q of many(type)) {
      if (q.play.kind !== 'chord') throw new Error();
      expect(rel(q.play.midis), q.choices[q.answer]!.label).toEqual(shapes[q.choices[q.answer]!.label]);
    }
  });
});

describe('レベル3：コード進行', () => {
  const firstChord = (q: EarQuestion) => {
    if (q.play.kind !== 'sequence') throw new Error();
    return rel(q.play.events.find((e) => e.instrument !== 'bass')!.midis);
  };
  const chordEvents = (q: EarQuestion) => {
    if (q.play.kind !== 'sequence') throw new Error();
    return q.play.events.filter((e) => e.instrument === 'bass');
  };

  it('明るい進行は最初がメジャーコード、暗い進行はマイナーコード（主役のコード）', () => {
    for (const q of many('bright-dark')) {
      // 明るい進行の候補には Ⅳ から始まるものがあるため、3度が長いか短いかで確認する
      const third = firstChord(q)[1];
      if (q.answer === 1) expect(third).toBe(3);
      else expect(third).toBe(4);
    }
  });

  it('「解決して終わる」進行は最後が Ⅴ7 → Ⅰ（ベースが完全5度下＝完全4度上へ）、「緊張感が残る」進行は Ⅴ で終わる', () => {
    const pc = (m: number) => ((m % 12) + 12) % 12;
    for (const q of many('resolution')) {
      // 解説文の先頭に、鳴らした進行のローマ数字が書かれている（例：「Ⅱm – Ⅴ7 – Ⅰ – Ⅰ：…」）
      const romans = q.explanation.split('：')[0]!.split(' – ');
      const bass = chordEvents(q).map((e) => e.midis[0]!);
      const last = bass[bass.length - 1]!;
      if (q.answer === 0) {
        // 最後は Ⅰ。その直前のどこかに Ⅴ7 があり、Ⅴ7 → Ⅰ でベースが完全4度上（＝完全5度下）に動く
        expect(romans[romans.length - 1]).toBe('Ⅰ');
        const v = romans.lastIndexOf('Ⅴ7');
        expect(v).toBeGreaterThanOrEqual(0);
        expect(pc(bass[v + 1]! - bass[v]!)).toBe(5);
      } else {
        // 最後は Ⅴ（またはⅤ7）で、主役の Ⅰ のベースから完全5度上（7半音）
        expect(romans[romans.length - 1]).toMatch(/^Ⅴ7?$/);
        const tonic = bass[romans.indexOf('Ⅰ')]!;
        expect(pc(last - tonic)).toBe(7);
      }
    }
  });

  it('コード進行の聴き分けは、3つの違う進行から選ぶ', () => {
    for (const q of many('progression-identify')) {
      expect(q.choices).toHaveLength(3);
      expect(q.choices[0]!.label).toMatch(/Ⅰ|Ⅳ|Ⅵm/);
    }
  });
});

describe('成績の集計', () => {
  const rec = (questionType: string, asked: string, correct: boolean, level: 1 | 2 | 3 = 1): EarTrainingRecord => ({
    level, questionType, asked, answered: correct ? asked : 'x', correct, answeredAt: '2026-11-05T00:00:00Z',
  });

  it('正答率', () => {
    expect(accuracy([rec('thirds', '長3度', true), rec('thirds', '短3度', false)])).toEqual({ correct: 1, total: 2, rate: 50 });
    expect(accuracy([]).rate).toBeNull();
    expect(accuracyByLevel([rec('triads', 'メジャー', true, 2)])[2].rate).toBe(100);
  });

  it('苦手な問題：3回以上出て、正答率が低いもの', () => {
    const records = [
      ...[true, false, false].map((c) => rec('thirds', '短3度', c)),
      ...[true, true, false].map((c) => rec('thirds', '長3度', c)),
      ...[false, false].map((c) => rec('triads', 'オーギュメント', c, 2)), // 2回なので対象外
    ];
    expect(weakItems(records).map((w) => [w.asked, w.rate])).toEqual([
      ['短3度', 33],
      ['長3度', 67],
    ]);
  });
});
