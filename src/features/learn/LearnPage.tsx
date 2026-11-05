import { useEffect } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { NAV_ITEMS } from '@/app/navigation';
import { ALL_LESSONS, CHAPTERS } from '@/content/lessons/curriculum';
import { useProgress } from '@/stores/progressStore';
import type { LessonProgress } from '@/storage/types';

export function statusIcon(p: LessonProgress | undefined) {
  if (p?.status === 'completed') return { icon: '✅', label: '完了' };
  if (p?.status === 'in-progress') return { icon: '📖', label: '学習中' };
  return { icon: '⚪', label: '未着手' };
}

/** 次に学ぶレッスン（完了していない最初のレッスン） */
export function useNextLesson() {
  const progress = useProgress((s) => s.progress);
  return ALL_LESSONS.find((l) => progress[l.id]?.status !== 'completed') ?? null;
}

export function LearnPage() {
  const { progress, load, loaded } = useProgress();
  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);
  const next = useNextLesson();
  const completed = ALL_LESSONS.filter((l) => progress[l.id]?.status === 'completed').length;

  return (
    <>
      <PageHeader
        icon={NAV_ITEMS.learn.icon}
        title={NAV_ITEMS.learn.label}
        description="完全初心者向けに、基礎から順番に学べます。各レッスンは「説明 → 図解 → 鍵盤と音 → 使用例 → DTMでの活用 → クイズ」の流れです。"
      />

      <Card className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">これまでの学習</p>
            <p className="text-lg font-bold">
              {completed} / {ALL_LESSONS.length} レッスン完了
            </p>
          </div>
          {next && (
            <Link
              to={`/learn/${next.id}`}
              className="min-h-11 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700"
            >
              {completed === 0 ? '最初のレッスンから始める' : '続きから学ぶ'}：{next.title} →
            </Link>
          )}
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" aria-hidden="true">
          <div className="h-full bg-brand-500 transition-all" style={{ width: `${(completed / ALL_LESSONS.length) * 100}%` }} />
        </div>
      </Card>

      <div className="space-y-4">
        {CHAPTERS.map((ch) => {
          const done = ch.lessons.filter((l) => progress[l.id]?.status === 'completed').length;
          return (
            <Card key={ch.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-bold">
                  第{ch.number}章　{ch.title}
                </h2>
                {ch.lessons.length > 0 ? (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {done} / {ch.lessons.length} 完了
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">準備中</span>
                )}
              </div>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{ch.description}</p>
              {ch.lessons.length > 0 ? (
                <ol className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
                  {ch.lessons.map((l, i) => {
                    const s = statusIcon(progress[l.id]);
                    return (
                      <li key={l.id}>
                        <Link to={`/learn/${l.id}`} className="flex min-h-12 items-center gap-3 py-2 hover:text-brand-600 dark:hover:text-brand-400">
                          <span aria-label={s.label} title={s.label}>
                            {s.icon}
                          </span>
                          <span className="text-xs text-slate-400">{i + 1}</span>
                          <span className="flex-1 text-sm font-medium">{l.title}</span>
                          <span aria-hidden="true" className="text-slate-400">
                            ›
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">予定している内容：{ch.plannedTopics.join('・')}</p>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}
