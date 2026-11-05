import { useEffect } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { NAV_ITEMS } from '@/app/navigation';
import { ALL_LESSONS, CHAPTERS, findLesson } from '@/content/lessons/curriculum';
import { quizStatsByQuestion, useProgress } from '@/stores/progressStore';

export function ProgressPage() {
  const { progress, quizResults, load, loaded } = useProgress();
  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  const completed = ALL_LESSONS.filter((l) => progress[l.id]?.status === 'completed').length;
  const correct = quizResults.filter((r) => r.correct).length;
  const rate = quizResults.length ? Math.round((correct / quizResults.length) * 100) : null;

  // 苦手な問題：2回以上解いて正答率が低いもの、または一度でも間違えて正解していないもの
  const weak = quizStatsByQuestion(quizResults)
    .filter((s) => s.correct < s.total)
    .map((s) => ({ ...s, rate: s.correct / s.total }))
    .sort((a, b) => a.rate - b.rate || b.total - a.total)
    .slice(0, 8);

  const recent = [...quizResults].sort((a, b) => b.answeredAt.localeCompare(a.answeredAt)).slice(0, 10);

  return (
    <>
      <PageHeader icon={NAV_ITEMS.progress.icon} title={NAV_ITEMS.progress.label} description="学習の進み具合とクイズの成績です。記録はこの端末に保存されています。" />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs text-slate-500 dark:text-slate-400">完了したレッスン</p>
          <p className="mt-1 text-2xl font-bold">
            {completed}
            <span className="text-sm font-normal text-slate-500"> / {ALL_LESSONS.length}</span>
          </p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500 dark:text-slate-400">クイズの正答率</p>
          <p className="mt-1 text-2xl font-bold">{rate === null ? '—' : `${rate}%`}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500 dark:text-slate-400">解いた問題の数</p>
          <p className="mt-1 text-2xl font-bold">{quizResults.length}</p>
        </Card>
      </div>

      <Card className="mt-4">
        <h2 className="font-bold">章ごとの進み具合</h2>
        <ul className="mt-3 space-y-3">
          {CHAPTERS.filter((c) => c.lessons.length > 0).map((ch) => {
            const done = ch.lessons.filter((l) => progress[l.id]?.status === 'completed').length;
            return (
              <li key={ch.id}>
                <div className="flex justify-between text-sm">
                  <span>
                    第{ch.number}章 {ch.title}
                  </span>
                  <span className="text-slate-500">
                    {done} / {ch.lessons.length}
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" aria-hidden="true">
                  <div className="h-full bg-brand-500" style={{ width: `${(done / ch.lessons.length) * 100}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card className="mt-4">
        <h2 className="font-bold">苦手な問題</h2>
        {weak.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">間違えた問題はまだありません。</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
            {weak.map((w) => {
              const found = findLesson(w.lessonId);
              const q = found?.lesson.quiz.find((x) => x.id === w.questionId);
              return (
                <li key={`${w.lessonId}/${w.questionId}`} className="py-2 text-sm">
                  <Link to={`/learn/${w.lessonId}`} className="hover:text-brand-600 dark:hover:text-brand-400">
                    <span className="font-medium">{q?.prompt ?? w.questionId}</span>
                    <span className="ml-2 text-xs text-slate-500">
                      （{found?.lesson.title} ／ 正解 {w.correct}/{w.total}）
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="mt-4">
        <h2 className="font-bold">最近の解答</h2>
        {recent.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">まだ記録がありません。</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {recent.map((r) => {
              const found = findLesson(r.lessonId);
              const q = found?.lesson.quiz.find((x) => x.id === r.questionId);
              return (
                <li key={r.id} className="flex gap-2">
                  <span aria-label={r.correct ? '正解' : '不正解'}>{r.correct ? '⭕' : '❌'}</span>
                  <span className="flex-1">{q?.prompt ?? r.questionId}</span>
                  <span className="text-xs text-slate-400">{new Date(r.answeredAt).toLocaleDateString('ja-JP')}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">耳トレーニングの成績は Phase 6 でここに追加されます。</p>
    </>
  );
}
