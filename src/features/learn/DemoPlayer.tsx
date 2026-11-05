import { PianoKeyboard, type KeyMark } from '@/components/PianoKeyboard/PianoKeyboard';
import { audio } from '@/audio/engine';
import { useSettings } from '@/stores/settingsStore';
import { formatPitch, formatPitchClass, midiOf, pitchFromMidi, type Pitch } from '@/theory/pitch';
import { resolveNotes } from '@/content/lessons/resolve';
import type { Demo } from '@/content/lessons/types';
import { RichText } from './RichText';

/** 音を鳴らす（教材の指定どおりの鳴らし方で） */
export function playDemo(demo: Demo, notes: Pitch[] = resolveNotes(demo.source)) {
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

export function DemoPlayer({ demo }: { demo: Demo }) {
  const octaveConvention = useSettings((s) => s.octaveConvention);
  const notes = resolveNotes(demo.source);
  const midis = notes.map(midiOf);
  const [from, to] = keyboardRange(midis);
  const marks: Record<number, KeyMark> = {};
  notes.forEach((p, i) => {
    marks[midis[i]!] = { kind: i === 0 ? 'root' : 'chord', label: formatPitchClass(p, 'unicode') };
  });
  const fmt = (m: number) => formatPitch(pitchFromMidi(m), { octaveConvention, style: 'unicode' });
  const buttonLabel = demo.mode === 'chord' ? '▶ 同時に鳴らす' : demo.mode === 'compare' ? '▶ 2つの音を聴き比べる' : '▶ 順番に鳴らす';

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
          {buttonLabel}
        </button>
      </div>
      <p className="mt-2 text-sm">
        {notes.map((p) => formatPitch(p, { octaveConvention, style: 'unicode' })).join(' → ')}
      </p>
      {demo.keyboard !== false && (
        <div className="mt-3">
          <PianoKeyboard from={from} to={to} marks={marks} cLabel={fmt} keyName={fmt} ariaLabel={`${demo.title}の鍵盤`} />
        </div>
      )}
    </div>
  );
}
