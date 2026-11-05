import { create } from 'zustand';
import { db } from '@/storage/db';
import type { LessonProgress, QuizResult } from '@/storage/types';

// 学習進捗とクイズ結果（IndexedDB に保存し、画面用にここにも持っておく）

interface ProgressState {
  loaded: boolean;
  progress: Record<string, LessonProgress>;
  quizResults: QuizResult[];
  load: () => Promise<void>;
  markStarted: (lessonId: string) => Promise<void>;
  markCompleted: (lessonId: string) => Promise<void>;
  saveQuizResult: (r: Omit<QuizResult, 'id' | 'answeredAt'>) => Promise<void>;
}

export const useProgress = create<ProgressState>()((set, get) => ({
  loaded: false,
  progress: {},
  quizResults: [],

  load: async () => {
    try {
      const [list, quizResults] = await Promise.all([db.lessonProgress.toArray(), db.quizResults.toArray()]);
      set({ loaded: true, progress: Object.fromEntries(list.map((p) => [p.lessonId, p])), quizResults });
    } catch {
      set({ loaded: true });
    }
  },

  markStarted: async (lessonId) => {
    const current = get().progress[lessonId];
    if (current) return; // 完了済み・学習中ならそのまま
    const p: LessonProgress = { lessonId, status: 'in-progress', updatedAt: new Date().toISOString() };
    await db.lessonProgress.put(p);
    set((s) => ({ progress: { ...s.progress, [lessonId]: p } }));
  },

  markCompleted: async (lessonId) => {
    const now = new Date().toISOString();
    const prev = get().progress[lessonId];
    const p: LessonProgress = { lessonId, status: 'completed', updatedAt: now, completedAt: prev?.completedAt ?? now };
    await db.lessonProgress.put(p);
    set((s) => ({ progress: { ...s.progress, [lessonId]: p } }));
  },

  saveQuizResult: async (r) => {
    const result: QuizResult = { ...r, answeredAt: new Date().toISOString() };
    const id = await db.quizResults.add(result);
    set((s) => ({ quizResults: [...s.quizResults, { ...result, id }] }));
  },
}));

/** 問題ごとの成績（苦手な問題を探すため） */
export function quizStatsByQuestion(results: QuizResult[]) {
  const map = new Map<string, { lessonId: string; questionId: string; correct: number; total: number }>();
  for (const r of results) {
    const key = `${r.lessonId}/${r.questionId}`;
    const s = map.get(key) ?? { lessonId: r.lessonId, questionId: r.questionId, correct: 0, total: 0 };
    s.total += 1;
    if (r.correct) s.correct += 1;
    map.set(key, s);
  }
  return [...map.values()];
}
