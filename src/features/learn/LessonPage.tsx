import { useEffect, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { Card } from '@/components/ui/Card';
import { SoundHint } from '@/components/ui/SoundHint';
import { findLesson, nextLesson } from '@/content/lessons/curriculum';
import { useProgress } from '@/stores/progressStore';
import { NotFoundPage } from '@/features/NotFoundPage';
import { RichText } from './RichText';
import { DemoPlayer } from './DemoPlayer';
import { DiagramView } from './Diagrams';
import { Quiz } from './Quiz';

function Section({ step, title, children }: { step: number; title: string; children: ReactNode }) {
  return (
    <Card>
      <h2 className="flex items-center gap-2 font-bold">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-sm text-white">{step}</span>
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </Card>
  );
}

export function LessonPage() {
  const { lessonId = '' } = useParams();
  const found = findLesson(lessonId);
  const progress = useProgress((s) => s.progress[lessonId]);
  const { markStarted, markCompleted, saveQuizResult, load, loaded } = useProgress();

  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  useEffect(() => {
    if (found && loaded) void markStarted(lessonId);
  }, [lessonId, loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!found) return <NotFoundPage />;
  const { lesson, chapter, index } = found;
  const next = nextLesson(lesson.id);
  let step = 0;

  return (
    <>
      <nav className="mb-3 text-xs text-slate-500 dark:text-slate-400">
        <Link to="/learn" className="hover:underline">
          音楽理論を学ぶ
        </Link>
        {' › '}第{chapter.number}章 {chapter.title}
      </nav>
      <header className="mb-6">
        <p className="text-sm font-semibold text-brand-600 dark:text-brand-400">
          第{chapter.number}章 レッスン{index + 1}
          {progress?.status === 'completed' && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">✓ 完了</span>}
        </p>
        <h1 className="mt-1 text-2xl font-bold md:text-3xl">{lesson.title}</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">🎯 {lesson.goal}</p>
      </header>

      <div className="space-y-4">
        <Section step={++step} title="理論の説明">
          <div className="space-y-3 text-[15px] leading-relaxed">
            {lesson.explanation.map((p, i) => (
              <p key={i}>
                <RichText text={p} />
              </p>
            ))}
          </div>
          {lesson.terms && lesson.terms.length > 0 && (
            <div className="mt-4 space-y-2">
              {lesson.terms.map((t) => (
                <div key={t.term} className="rounded-xl bg-amber-50 p-3 text-sm dark:bg-amber-500/10">
                  <p className="font-bold">📘 用語：{t.term}</p>
                  <p className="mt-1">{t.plain}</p>
                  {t.formal && <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">（専門的には）{t.formal}</p>}
                </div>
              ))}
            </div>
          )}
        </Section>

        {lesson.diagrams && lesson.diagrams.length > 0 && (
          <Section step={++step} title="図解">
            <div className="space-y-5">
              {lesson.diagrams.map((d, i) => (
                <DiagramView key={i} diagram={d} />
              ))}
            </div>
          </Section>
        )}

        {lesson.demos && lesson.demos.length > 0 && (
          <Section step={++step} title="鍵盤と音で確かめる">
            <div className="space-y-3">
              {lesson.demos.map((d, i) => (
                <DemoPlayer key={i} demo={d} />
              ))}
              <SoundHint />
            </div>
          </Section>
        )}

        <Section step={++step} title="使用例">
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed">
            {lesson.examples.map((e, i) => (
              <li key={i}>
                <RichText text={e} />
              </li>
            ))}
          </ul>
        </Section>

        <Section step={++step} title="DTM（FL Studio）での活用">
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed">
            {lesson.dtm.map((e, i) => (
              <li key={i}>
                <RichText text={e} />
              </li>
            ))}
          </ul>
        </Section>

        <Section step={++step} title="理解度確認クイズ">
          <Quiz
            key={lesson.id}
            questions={lesson.quiz}
            onAnswer={(q, correct) => void saveQuizResult({ lessonId: lesson.id, questionId: q.id, correct })}
            onFinish={() => void markCompleted(lesson.id)}
          />
        </Section>

        <div className="flex flex-wrap justify-between gap-2 pt-2">
          <Link to="/learn" className="min-h-11 rounded-xl px-4 py-3 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
            ← レッスン一覧へ
          </Link>
          {next && (
            <Link
              to={`/learn/${next.id}`}
              className="min-h-11 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700"
            >
              次のレッスン：{next.title} →
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
