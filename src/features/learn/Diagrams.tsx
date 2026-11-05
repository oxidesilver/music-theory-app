import { useState } from 'react';
import { PianoKeyboard, type KeyMark } from '@/components/PianoKeyboard/PianoKeyboard';
import { ChoiceButton } from '@/components/ui/ChoiceButton';
import { audio } from '@/audio/engine';
import { useSettings } from '@/stores/settingsStore';
import { intervalNameJa, intervalSemitones, parseInterval, transposePitch } from '@/theory/interval';
import {
  LETTERS,
  JAPANESE_LETTER,
  SOLFEGE,
  formatPitch,
  formatPitchClass,
  midiOf,
  parsePitch,
  parsePitchClass,
  pitchFromMidi,
} from '@/theory/pitch';
import { SCALES, scalePitches, type ScaleId } from '@/theory/scale';
import { resolveNotes, stepLabel } from '@/content/lessons/resolve';
import type { Diagram } from '@/content/lessons/types';
import { keyboardRange } from './DemoPlayer';

function useFmt() {
  const octaveConvention = useSettings((s) => s.octaveConvention);
  return (m: number) => formatPitch(pitchFromMidi(m), { octaveConvention, style: 'unicode' });
}

function NoteNamesTable() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[20rem] text-center text-sm">
        <tbody>
          <tr className="border-b border-slate-200 dark:border-slate-800">
            <th className="py-2 pr-2 text-left text-xs font-normal text-slate-500">音名</th>
            {LETTERS.map((l) => (
              <td key={l} className="py-2 text-lg font-bold">{l}</td>
            ))}
          </tr>
          <tr className="border-b border-slate-200 dark:border-slate-800">
            <th className="py-2 pr-2 text-left text-xs font-normal text-slate-500">ドレミ</th>
            {LETTERS.map((l) => (
              <td key={l} className="py-2">{SOLFEGE[l]}</td>
            ))}
          </tr>
          <tr>
            <th className="py-2 pr-2 text-left text-xs font-normal text-slate-500">日本音名</th>
            {LETTERS.map((l) => (
              <td key={l} className="py-2 text-slate-600 dark:text-slate-400">{JAPANESE_LETTER[l]}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function KeyboardMap() {
  const fmt = useFmt();
  const marks: Record<number, KeyMark> = {};
  for (let m = 48; m <= 83; m++) {
    const pc = pitchFromMidi(m);
    if (pc.accidental === 0) marks[m] = { kind: m % 12 === 0 ? 'root' : 'scale', label: pc.letter };
  }
  return (
    <div>
      <PianoKeyboard from={48} to={83} marks={marks} cLabel={fmt} keyName={fmt} ariaLabel="白鍵の音名" />
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">赤い鍵盤が C（ド）。2つ並んだ黒鍵のすぐ左にあります。</p>
    </div>
  );
}

function StepsDiagram({ diagram }: { diagram: Extract<Diagram, { kind: 'steps' }> }) {
  const octaveConvention = useSettings((s) => s.octaveConvention);
  const notes = resolveNotes(diagram.source);
  return (
    <div>
      {diagram.title && <p className="mb-2 text-sm font-semibold">{diagram.title}</p>}
      <div className="flex flex-wrap items-center gap-y-3" aria-label={diagram.title ?? '音の並び'}>
        {notes.map((p, i) => (
          <div key={i} className="flex items-center">
            <button
              type="button"
              onClick={() => void audio.play(midiOf(p), { duration: 0.8 })}
              className="flex h-12 min-w-12 flex-col items-center justify-center rounded-xl bg-brand-50 px-2 font-bold text-brand-700 hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-300"
              title={formatPitch(p, { octaveConvention })}
            >
              {formatPitchClass(p, 'unicode')}
              <span className="text-[10px] font-normal text-slate-500">{i + 1}</span>
            </button>
            {i < notes.length - 1 && (
              <span
                className={`mx-1 rounded px-1.5 py-0.5 text-xs font-semibold ${
                  stepLabel(p, notes[i + 1]!) === '半'
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'
                    : stepLabel(p, notes[i + 1]!) === '全'
                      ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
                }`}
              >
                {stepLabel(p, notes[i + 1]!)}
              </span>
            )}
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">全 = 全音（半音2つ分）、半 = 半音。音名を押すと音が鳴ります。</p>
    </div>
  );
}

function IntervalTable({ diagram }: { diagram: Extract<Diagram, { kind: 'interval-table' }> }) {
  const octaveConvention = useSettings((s) => s.octaveConvention);
  const from = parsePitch(diagram.from);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[22rem] text-sm">
        <thead className="text-left text-xs text-slate-500 dark:text-slate-400">
          <tr>
            <th className="py-1 font-normal">音程</th>
            <th className="py-1 font-normal">半音の数</th>
            <th className="py-1 font-normal">例</th>
            <th className="py-1 font-normal" />
          </tr>
        </thead>
        <tbody>
          {diagram.intervals.map((text) => {
            const iv = parseInterval(text);
            const to = transposePitch(from, iv);
            return (
              <tr key={text} className="border-t border-slate-100 dark:border-slate-800">
                <td className="py-2 font-semibold">{intervalNameJa(iv)}</td>
                <td className="py-2">{intervalSemitones(iv)}</td>
                <td className="py-2">
                  {formatPitch(from, { octaveConvention, style: 'unicode' })} → {formatPitch(to, { octaveConvention, style: 'unicode' })}
                </td>
                <td className="py-2 text-right">
                  <button
                    type="button"
                    onClick={() => void audio.compare(midiOf(from), midiOf(to))}
                    className="min-h-9 rounded-lg px-3 text-xs font-semibold text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10"
                    aria-label={`${intervalNameJa(iv)}を聴く`}
                  >
                    ▶ 聴く
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const EXPLORER_TONICS = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'F#', 'Bb', 'Eb'];

function ScaleExplorer({ diagram }: { diagram: Extract<Diagram, { kind: 'scale-explorer' }> }) {
  const fmt = useFmt();
  const [tonic, setTonic] = useState('C');
  const [scale, setScale] = useState<ScaleId>(diagram.scales[0]!);
  const t = parsePitchClass(tonic);
  const notes = [...scalePitches({ ...t, octave: 4 }, scale), { ...t, octave: 5 }];
  const midis = notes.map(midiOf);
  const [from, to] = keyboardRange(midis);
  const marks: Record<number, KeyMark> = {};
  notes.forEach((p, i) => (marks[midis[i]!] = { kind: i === 0 || i === notes.length - 1 ? 'root' : 'scale', label: formatPitchClass(p, 'unicode') }));

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1 text-xs text-slate-500">主音</p>
        <div className="flex flex-wrap gap-1.5">
          {EXPLORER_TONICS.map((x) => (
            <ChoiceButton key={x} selected={tonic === x} onClick={() => setTonic(x)}>
              {formatPitchClass(parsePitchClass(x), 'unicode')}
            </ChoiceButton>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-1 text-xs text-slate-500">スケール</p>
        <div className="flex flex-wrap gap-1.5">
          {diagram.scales.map((id) => (
            <ChoiceButton key={id} selected={scale === id} onClick={() => setScale(id)}>
              {SCALES[id].nameJa}
            </ChoiceButton>
          ))}
        </div>
      </div>
      <p className="text-sm">
        <span className="font-semibold">
          {formatPitchClass(t, 'unicode')} {SCALES[scale].nameJa}
        </span>
        ：{notes.slice(0, -1).map((p) => formatPitchClass(p, 'unicode')).join(' ')}
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400">{SCALES[scale].summary}</p>
      <PianoKeyboard from={from} to={to} marks={marks} cLabel={fmt} keyName={fmt} ariaLabel="スケールの鍵盤" />
      <button
        type="button"
        onClick={() => void audio.playSequence(midis.map((m, i) => ({ midis: [m], startBeat: i, durationBeats: 1 })), 150)}
        className="min-h-11 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
      >
        ▶ 順番に鳴らす
      </button>
    </div>
  );
}

export function DiagramView({ diagram }: { diagram: Diagram }) {
  switch (diagram.kind) {
    case 'note-names':
      return <NoteNamesTable />;
    case 'keyboard-map':
      return <KeyboardMap />;
    case 'steps':
      return <StepsDiagram diagram={diagram} />;
    case 'interval-table':
      return <IntervalTable diagram={diagram} />;
    case 'scale-explorer':
      return <ScaleExplorer diagram={diagram} />;
  }
}
