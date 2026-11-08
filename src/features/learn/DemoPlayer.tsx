import { PianoKeyboard, type KeyMark } from '@/components/PianoKeyboard/PianoKeyboard';
import { audio } from '@/audio/engine';
import { useSettings } from '@/stores/settingsStore';
import { formatPitch, formatPitchClass, midiOf, pitchFromMidi, type Pitch } from '@/theory/pitch';
import { formatChordSymbol, parseChordSymbol } from '@/theory/chord';
import { resolveNotes, resolveProgression } from '@/content/lessons/resolve';
import type { Demo } from '@/content/lessons/types';
import { RichText } from './RichText';
import { Staff } from '@/components/Staff/Staff';

/** コード進行を鳴らす速さ（BPM）と、1つのコードの長さ（拍） */
const PROGRESSION_BPM = 96;
const BEATS_PER_CHORD = 2;

/** 音を鳴らす（教材の指定どおりの鳴らし方で） */
export function playDemo(demo: Demo, notes: Pitch[] = resolveNotes(demo.source)) {
  if (demo.mode === 'progression') {
    const chords = resolveProgression(demo.source);
    return audio.playSequence(
      chords.map((c, i) => ({ midis: c.map(midiOf), startBeat: i * BEATS_PER_CHORD, durationBeats: BEATS_PER_CHORD })),
      PROGRESSION_BPM,
    );
  }
  const midis = notes.map(midiOf);
  if (demo.mode === 'chord') return audio.chord(midis);
  if (demo.mode === 'compare') return audio.compare(midis[0]!, midis[1]!);
  return audio.playSequence(
    midis.map((m, i) => ({ midis: [m], startBeat: i, durationBeats: 1 })),
    150,
  );
}

/** 鍵盤の表示範囲：音を含む C から B まで（最低1オクターブ半） */
export function keyboardRange(midis: number[]): [number, number] {
  const low = Math.floor(Math.min(...midis) / 12) * 12;
  const high = Math.max(low + 16, Math.ceil((Math.max(...midis) + 1) / 12) * 12 - 1);
  return [low, high];
}

const BUTTON_LABEL: Record<Demo['mode'], string> = {
  chord: '▶ 同時に鳴らす',
  compare: '▶ 2つの音を聴き比べる',
  sequence: '▶ 順番に鳴らす',
  progression: '▶ 進行を鳴らす',
};

export function DemoPlayer({ demo }: { demo: Demo }) {
  const octaveConvention = useSettings((s) => s.octaveConvention);
  const chordStyle = useSettings((s) => s.romanStyle);
  const notes = resolveNotes(demo.source);
  const midis = notes.map(midiOf);
  const [from, to] = keyboardRange(midis);
  const marks: Record<number, KeyMark> = {};
  notes.forEach((p, i) => {
    marks[midis[i]!] = { kind: i === 0 ? 'root' : 'chord', label: formatPitchClass(p, 'unicode') };
  });
  const fmt = (m: number) => formatPitch(pitchFromMidi(m), { octaveConvention, style: 'unicode' });
  const isProgression = demo.mode === 'progression' && 'progression' in demo.source;
  const showKeyboard = demo.keyboard ?? !isProgression;

  return (
    <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold">{demo.title}</p>
          {demo.description && (
            <p className="text-xs text-slate-600 dark:text-slate-400">
              <RichText text={demo.description} />
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => void playDemo(demo, notes)}
          className="min-h-11 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
        >
          {BUTTON_LABEL[demo.mode]}
        </button>
      </div>
      {isProgression && 'progression' in demo.source ? (
        <p className="mt-2 flex flex-wrap gap-1.5 text-sm">
          {demo.source.progression.map((s, i) => (
            <span key={i} className="rounded-lg bg-slate-100 px-2 py-1 font-semibold dark:bg-slate-800">
              {formatChordSymbol(parseChordSymbol(s), { style: chordStyle, accidentals: 'unicode' })}
            </span>
          ))}
        </p>
      ) : (
        <p className="mt-2 text-sm">{notes.map((p) => formatPitch(p, { octaveConvention, style: 'unicode' })).join(demo.mode === 'chord' ? '・' : ' → ')}</p>
      )}
      {!isProgression && (
        <div className="mt-3 max-w-md">
          <Staff groups={demo.mode === 'chord' ? [notes] : notes.map((n) => [n])} ariaLabel={`${demo.title}の五線譜`} />
        </div>
      )}
      {showKeyboard && (
        <div className="mt-3">
          <PianoKeyboard from={from} to={to} marks={marks} cLabel={fmt} keyName={fmt} ariaLabel={`${demo.title}の鍵盤`} />
        </div>
      )}
    </div>
  );
}
