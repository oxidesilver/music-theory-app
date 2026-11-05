import { useState } from 'react';
import type { QuizQuestion } from '@/content/lessons/types';
import { RichText } from './RichText';
import { playDemo } from './DemoPlayer';

interface QuizProps {
  questions: QuizQuestion[];
  onAnswer: (q: QuizQuestion, correct: boolean) => void;
  onFinish: (score: number) => void;
}

/** 理解度確認クイズ：1問ずつ回答 → 正誤と解説 → 次の問題 */
export function Quiz({ questions, onAnswer, onFinish }: QuizProps) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const q = questions[index];
  if (!q) return null;

  if (finished) {
    return (
      <div className="rounded-xl bg-emerald-50 p-5 text-center dark:bg-emerald-500/10">
        <p className="text-3xl">🎉</p>
        <p className="mt-2 text-lg font-bold">
          {questions.length}問中 {score}問 正解！
        </p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">このレッスンは完了です。間違えた問題は、もう一度説明を読み直してみましょう。</p>
        <button
          type="button"
          onClick={() => {
            setIndex(0);
            setSelected(null);
            setScore(0);
            setFinished(false);
          }}
          className="mt-4 min-h-11 rounded-xl px-4 text-sm font-semibold text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10"
        >
          もう一度クイズに挑戦する
        </button>
      </div>
    );
  }

  const answered = selected !== null;
  const correct = selected === q.answer;

  const choose = (i: number) => {
    if (answered) return;
    setSelected(i);
    const ok = i === q.answer;
    if (ok) setScore((s) => s + 1);
    onAnswer(q, ok);
  };

  const next = () => {
    if (index + 1 >= questions.length) {
      setFinished(true);
      onFinish(score);
    } else {
      setIndex(index + 1);
      setSelected(null);
    }
  };

  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
        問題 {index + 1} / {questions.length}
      </p>
      <p className="mt-1 font-semibold">
        <RichText text={q.prompt} />
      </p>
      {q.listen && (
        <button
          type="button"
          onClick={() => void playDemo(q.listen!)}
          className="mt-2 min-h-10 rounded-lg border border-brand-500 px-3 text-sm font-semibold text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10"
        >
          ▶ {q.listen.title}
        </button>
      )}
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {q.choices.map((c, i) => {
          const isAnswer = i === q.answer;
          const isSelected = i === selected;
          const style = !answered
            ? 'border-slate-200 hover:border-brand-400 dark:border-slate-700'
            : isAnswer
              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10'
              : isSelected
                ? 'border-rose-500 bg-rose-50 dark:bg-rose-500/10'
                : 'border-slate-200 opacity-60 dark:border-slate-700';
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => choose(i)}
                disabled={answered}
                className={`flex min-h-12 w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm ${style}`}
              >
                {answered && isAnswer && <span aria-hidden="true">✅</span>}
                {answered && isSelected && !isAnswer && <span aria-hidden="true">❌</span>}
                <RichText text={c} />
              </button>
            </li>
          );
        })}
      </ul>
      {answered && (
        <div role="status" className={`mt-3 rounded-xl p-3 text-sm ${correct ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-rose-50 dark:bg-rose-500/10'}`}>
          <p className="font-bold">{correct ? '正解！' : '不正解'}</p>
          <p className="mt-1 leading-relaxed">
            <RichText text={q.explanation} />
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={next}
              className="min-h-11 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
            >
              {index + 1 >= questions.length ? '結果を見る' : '次の問題へ'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
