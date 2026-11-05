import { create } from 'zustand';
import { db } from '@/storage/db';
import type { EarTrainingRecord } from '@/storage/types';
import { QUESTION_TYPES, type QuestionTypeId } from './questions';

// 耳トレーニングの記録（IndexedDB）と集計

interface EarState {
  loaded: boolean;
  records: EarTrainingRecord[];
  load: () => Promise<void>;
  add: (r: Omit<EarTrainingRecord, 'id' | 'answeredAt'>) => Promise<void>;
}

export const useEarRecords = create<EarState>()((set) => ({
  loaded: false,
  records: [],
  load: async () => {
    try {
      set({ loaded: true, records: await db.earTraining.toArray() });
    } catch {
      set({ loaded: true });
    }
  },
  add: async (r) => {
    const record: EarTrainingRecord = { ...r, answeredAt: new Date().toISOString() };
    const id = await db.earTraining.add(record);
    set((s) => ({ records: [...s.records, { ...record, id }] }));
  },
}));

export interface Accuracy {
  correct: number;
  total: number;
  /** 0〜100（解いていなければ null） */
  rate: number | null;
}

export function accuracy(records: EarTrainingRecord[]): Accuracy {
  const correct = records.filter((r) => r.correct).length;
  return { correct, total: records.length, rate: records.length ? Math.round((correct / records.length) * 100) : null };
}

export function accuracyByType(records: EarTrainingRecord[]): Record<QuestionTypeId, Accuracy> {
  return Object.fromEntries(
    QUESTION_TYPES.map((t) => [t.id, accuracy(records.filter((r) => r.questionType === t.id))]),
  ) as Record<QuestionTypeId, Accuracy>;
}

export function accuracyByLevel(records: EarTrainingRecord[]): Record<1 | 2 | 3, Accuracy> {
  return {
    1: accuracy(records.filter((r) => r.level === 1)),
    2: accuracy(records.filter((r) => r.level === 2)),
    3: accuracy(records.filter((r) => r.level === 3)),
  };
}

/**
 * 苦手な問題：同じ問題の種類の中で、正解が「〇〇」のときによく間違えるもの。
 * 3回以上出題されたもののうち、正答率の低い順。
 */
export function weakItems(records: EarTrainingRecord[], limit = 5) {
  const map = new Map<string, { questionType: string; asked: string; correct: number; total: number }>();
  for (const r of records) {
    const key = `${r.questionType}|${r.asked}`;
    const s = map.get(key) ?? { questionType: r.questionType, asked: r.asked, correct: 0, total: 0 };
    s.total += 1;
    if (r.correct) s.correct += 1;
    map.set(key, s);
  }
  return [...map.values()]
    .filter((s) => s.total >= 3 && s.correct < s.total)
    .map((s) => ({ ...s, rate: Math.round((s.correct / s.total) * 100) }))
    .sort((a, b) => a.rate - b.rate || b.total - a.total)
    .slice(0, limit);
}
