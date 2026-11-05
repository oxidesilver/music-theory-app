import { useEffect } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { NAV_ITEMS } from '@/app/navigation';
import { ALL_LESSONS, CHAPTERS, findLesson } from '@/content/lessons/curriculum';
import { quizStatsByQuestion, useProgress } from '@/stores/progressStore';
import { accuracyByLevel, accuracyByType, useEarRecords, weakItems } from '@/features/ear/stats';
import { LEVEL_INFO, QUESTION_TYPES } from '@/features/ear/questions';

export function ProgressPage() {
  const { progress, quizResults, load, loaded } = useProgress();
  const ear = useEarRecords();
  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);
  useEffect(() => {
    if (!ear.loaded) void ear.load();
  }, [ear.loaded]); // eslint-disable-line react-hooks/exhaustive-deps
  const earRecords = ear.records;
  const earByLevel = accuracyByLevel(earRecords);
  const earByType = accuracyByType(earRecords);
  const earWeak = weakItems(earRecords);

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
      <PageHeader icon={NAV_ITEMS.progress.icon} title={NAV_ITEMS.progress.label} description="学習の進み具合、クイズと耳トレーニングの成績です。記録はこの端末に保存されています。" />

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
      <Card className="mt-4">
        <h2 className="font-bold">耳トレーニング</h2>
        {earRecords.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            まだ記録がありません。<Link to="/ear" className="font-semibold text-brand-600 dark:text-brand-400">耳トレーニング</Link>に挑戦してみましょう。
          </p>
        ) : (
          <>
            <ul className="mt-2 grid gap-2 sm:grid-cols-3">
              {([1, 2, 3] as const).map((lv) => (
                <li key={lv} className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
                  <p className="text-xs text-slate-500 dark:text-slate-400">{LEVEL_INFO[lv].title}</p>
                  <p className="text-lg font-bold">{earByLevel[lv].rate === null ? '—' : `${earByLevel[lv].rate}%`}</p>
                  <p className="text-xs text-slate-500">{earByLevel[lv].total}問</p>
                </li>
              ))}
            </ul>
            <table className="mt-3 w-full text-sm">
              <tbody>
                {QUESTION_TYPES.filter((t) => earByType[t.id].total > 0).map((t) => (
                  <tr key={t.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="py-1.5">{t.title}</td>
                    <td className="py-1.5 text-right">{earByType[t.id].rate}%</td>
                    <td className="py-1.5 text-right text-xs text-slate-500">{earByType[t.id].total}問</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {earWeak.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-semibold">苦手な問題</p>
                <ul className="mt-1 space-y-1 text-sm">
                  {earWeak.map((w) => (
                    <li key={`${w.questionType}|${w.asked}`}>
                      {QUESTION_TYPES.find((t) => t.id === w.questionType)?.title}：正解が「{w.asked}」のとき（{w.rate}%）
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </Card>
    </>
  );
}
