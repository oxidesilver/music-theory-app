import { useEffect, useMemo, useRef, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { SoundHint } from '@/components/ui/SoundHint';
import { NAV_ITEMS } from '@/app/navigation';
import { audio } from '@/audio/engine';
import { useSettings } from '@/stores/settingsStore';
import { formatPitch, type Pitch } from '@/theory/pitch';
import { RichText } from '@/features/learn/RichText';
import {
  LEVEL_INFO,
  QUESTION_TYPES,
  generateQuestion,
  type EarQuestion,
  type PlaySpec,
  type QuestionTypeId,
} from './questions';
import { accuracyByLevel, accuracyByType, useEarRecords, weakItems } from './stats';

export const SESSION_LENGTH = 10;

/** 出題モード：種類を1つ選ぶか、レベルの中からランダム */
type Mode = { kind: 'type'; type: QuestionTypeId } | { kind: 'level'; level: 1 | 2 | 3 };

export function playSpec(spec: PlaySpec) {
  if (spec.kind === 'compare') return audio.compare(spec.midis[0], spec.midis[1]);
  if (spec.kind === 'chord') return audio.chord(spec.midis, { duration: 1.8 });
  return audio.playSequence(spec.events, spec.bpm);
}

function modeTitle(mode: Mode) {
  return mode.kind === 'type' ? QUESTION_TYPES.find((t) => t.id === mode.type)!.title : `${LEVEL_INFO[mode.level].title}（ミックス）`;
}

export function EarTrainingPage() {
  const [mode, setMode] = useState<Mode | null>(null);
  const { records, load, loaded } = useEarRecords();
  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);
  useEffect(() => () => audio.stop(), []);

  if (mode) return <Session mode={mode} onExit={() => setMode(null)} />;

  const byType = accuracyByType(records);
  const byLevel = accuracyByLevel(records);
  const weak = weakItems(records);

  return (
    <>
      <PageHeader
        icon={NAV_ITEMS.ear.icon}
        title={NAV_ITEMS.ear.label}
        description={`音を聴いて答える練習です。1回 ${SESSION_LENGTH} 問、問題は毎回ランダムに出ます。答えたあとは、選択肢の音を聴き比べて違いを確かめられます。`}
      />
      <div className="space-y-4">
        {([1, 2, 3] as const).map((level) => (
          <Card key={level}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-bold">{LEVEL_INFO[level].title}</h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                正答率：{byLevel[level].rate === null ? '—' : `${byLevel[level].rate}%（${byLevel[level].total}問）`}
              </span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">{LEVEL_INFO[level].description}</p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {QUESTION_TYPES.filter((t) => t.level === level).map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setMode({ kind: 'type', type: t.id })}
                    className="flex h-full w-full flex-col rounded-xl border border-slate-200 p-3 text-left hover:border-brand-400 dark:border-slate-700"
                  >
                    <span className="font-semibold">{t.title}</span>
                    <span className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{t.description}</span>
                    <span className="mt-1 text-xs text-brand-600 dark:text-brand-400">
                      {byType[t.id].rate === null ? 'まだ挑戦していません' : `正答率 ${byType[t.id].rate}%（${byType[t.id].total}問）`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setMode({ kind: 'level', level })}
              className="mt-3 min-h-10 rounded-lg px-3 text-sm font-semibold text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10"
            >
              🔀 このレベルの問題をミックスで出題
            </button>
          </Card>
        ))}

        {weak.length > 0 && (
          <Card>
            <h2 className="font-bold">苦手な問題</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {weak.map((w) => (
                <li key={`${w.questionType}|${w.asked}`}>
                  {QUESTION_TYPES.find((t) => t.id === w.questionType)?.title}：正解が「{w.asked}」のとき（正答率 {w.rate}%・{w.total}問）
                </li>
              ))}
            </ul>
          </Card>
        )}
        <SoundHint />
      </div>
    </>
  );
}

function Session({ mode, onExit }: { mode: Mode; onExit: () => void }) {
  const octaveConvention = useSettings((s) => s.octaveConvention);
  const romanStyle = useSettings((s) => s.romanStyle);
  const addRecord = useEarRecords((s) => s.add);
  const fmt = (p: Pitch) => formatPitch(p, { octaveConvention, style: 'unicode' });
  const ctx = useMemo(() => ({ rng: Math.random, fmt, romanStyle }), [octaveConvention, romanStyle]); // eslint-disable-line react-hooks/exhaustive-deps

  const makeQuestion = () => {
    const type = mode.kind === 'type' ? mode.type : QUESTION_TYPES.filter((t) => t.level === mode.level)[Math.floor(Math.random() * QUESTION_TYPES.filter((t) => t.level === mode.level).length)]!.id;
    return generateQuestion(type, ctx);
  };

  const [question, setQuestion] = useState<EarQuestion>(() => makeQuestion());
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const missed = useRef<string[]>([]);

  const answered = selected !== null;

  const choose = (i: number) => {
    if (answered) return;
    setSelected(i);
    const correct = i === question.answer;
    if (correct) setScore((s) => s + 1);
    else missed.current.push(question.choices[question.answer]!.label);
    void addRecord({
      level: question.level,
      questionType: question.type,
      asked: question.choices[question.answer]!.label,
      answered: question.choices[i]!.label,
      correct,
    });
  };

  const next = () => {
    audio.stop();
    if (index + 1 >= SESSION_LENGTH) {
      setFinished(true);
      return;
    }
    const q = makeQuestion();
    setQuestion(q);
    setIndex(index + 1);
    setSelected(null);
    void playSpec(q.play); // 「次へ」を押した操作の中で鳴らす（スマホ対策）
  };

  const restart = () => {
    const q = makeQuestion();
    setQuestion(q);
    setIndex(0);
    setSelected(null);
    setScore(0);
    setFinished(false);
    missed.current = [];
    void playSpec(q.play);
  };

  if (finished) {
    return (
      <>
        <PageHeader icon={NAV_ITEMS.ear.icon} title={modeTitle(mode)} />
        <Card className="text-center">
          <p className="text-3xl">{score >= 8 ? '🎉' : score >= 5 ? '👍' : '💪'}</p>
          <p className="mt-2 text-xl font-bold">
            {SESSION_LENGTH}問中 {score}問 正解！
          </p>
          {missed.current.length > 0 && (
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">間違えた問題の正解：{[...new Set(missed.current)].join('・')}</p>
          )}
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button type="button" onClick={restart} className="min-h-11 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
              もう一度挑戦する
            </button>
            <button type="button" onClick={onExit} className="min-h-11 rounded-xl px-4 text-sm hover:bg-slate-100 dark:hover:bg-slate-800">
              問題の種類を選び直す
            </button>
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader icon={NAV_ITEMS.ear.icon} title={modeTitle(mode)} />
      <Card>
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>
            問題 {index + 1} / {SESSION_LENGTH}
          </span>
          <span>正解 {score}</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" aria-hidden="true">
          <div className="h-full bg-brand-500" style={{ width: `${(index / SESSION_LENGTH) * 100}%` }} />
        </div>

        <p className="mt-4 text-lg font-bold">{question.prompt}</p>
        <button
          type="button"
          onClick={() => {
            setStarted(true);
            void playSpec(question.play);
          }}
          className="mt-3 min-h-12 w-full rounded-xl bg-brand-600 px-4 text-base font-semibold text-white hover:bg-brand-700 sm:w-auto"
        >
          {started ? '🔁 もう一度聴く' : '▶ 音を聴く'}
        </button>

        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {question.choices.map((c, i) => {
            const isAnswer = i === question.answer;
            const isSelected = i === selected;
            const style = !answered
              ? 'border-slate-200 hover:border-brand-400 dark:border-slate-700'
              : isAnswer
                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10'
                : isSelected
                  ? 'border-rose-500 bg-rose-50 dark:bg-rose-500/10'
                  : 'border-slate-200 opacity-60 dark:border-slate-700';
            return (
              <li key={c.label}>
                <button
                  type="button"
                  disabled={answered || !started}
                  onClick={() => choose(i)}
                  className={`flex min-h-12 w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm disabled:cursor-default ${style} ${!started ? 'opacity-50' : ''}`}
                >
                  {answered && isAnswer && <span aria-hidden="true">✅</span>}
                  {answered && isSelected && !isAnswer && <span aria-hidden="true">❌</span>}
                  {c.label}
                </button>
              </li>
            );
          })}
        </ul>
        {!started && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">まず「▶ 音を聴く」を押してください。</p>}

        {answered && (
          <div role="status" className={`mt-4 rounded-xl p-3 text-sm ${selected === question.answer ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-rose-50 dark:bg-rose-500/10'}`}>
            <p className="font-bold">{selected === question.answer ? '正解！' : '不正解'}</p>
            <p className="mt-1 leading-relaxed">
              <RichText text={question.explanation} />
            </p>
            {selected !== question.answer && (
              <p className="mt-1 text-slate-600 dark:text-slate-300">
                あなたの答え「{question.choices[selected]!.label}」と、正解「{question.choices[question.answer]!.label}」を聴き比べてみましょう。
              </p>
            )}
            <p className="mt-3 text-xs font-semibold">選択肢の音を聴き比べる</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {question.choices.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => void playSpec(c.play)}
                  className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs hover:border-brand-400 dark:border-slate-600 dark:bg-slate-900"
                >
                  ▶ {c.label}
                </button>
              ))}
            </div>
            <button type="button" onClick={next} className="mt-3 min-h-11 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
              {index + 1 >= SESSION_LENGTH ? '結果を見る' : '次の問題へ'}
            </button>
          </div>
        )}
      </Card>
      <div className="mt-4 flex justify-between">
        <button type="button" onClick={onExit} className="min-h-11 rounded-xl px-4 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
          ← やめる
        </button>
        <SoundHint />
      </div>
    </>
  );
}
