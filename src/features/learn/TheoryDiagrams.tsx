// 第4章以降で使う図解：調号の一覧・コードの組み立て・ダイアトニックコード表
import { useState } from 'react';
import { PianoKeyboard, type KeyMark } from '@/components/PianoKeyboard/PianoKeyboard';
import { ChoiceButton } from '@/components/ui/ChoiceButton';
import { audio } from '@/audio/engine';
import { useSettings } from '@/stores/settingsStore';
import { CHORD_QUALITIES, chordPitches, chordStructure, formatChordSymbol, type ChordQualityId } from '@/theory/chord';
import { FUNCTION_INFO, diatonicChords } from '@/theory/diatonic';
import { intervalNameJa, parseInterval } from '@/theory/interval';
import { COMMON_MAJOR_TONICS, COMMON_MINOR_TONICS, commonKeys, keyName, keyNameJa, keySignature, makeKey, relativeKey } from '@/theory/key';
import { formatPitch, formatPitchClass, midiOf, parsePitchClass, pitchFromMidi } from '@/theory/pitch';
import { romanNumeral } from '@/theory/roman';
import { scaleNotes, type ScaleId } from '@/theory/scale';
import { chordVoicing } from '@/features/progression/logic';
import type { Diagram } from '@/content/lessons/types';
import { keyboardRange } from './DemoPlayer';

const u = formatPitchClass;

function useFmt() {
  const octaveConvention = useSettings((s) => s.octaveConvention);
  return (m: number) => formatPitch(pitchFromMidi(m), { octaveConvention, style: 'unicode' });
}

/** キーと調号の一覧（♯ の多い順・♭ の多い順に並べる） */
export function KeySignatureTable({ diagram }: { diagram: Extract<Diagram, { kind: 'key-signatures' }> }) {
  const keys = commonKeys(diagram.mode).sort((a, b) => keySignature(a).count - keySignature(b).count);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[22rem] text-sm">
        <thead className="text-left text-xs text-slate-500 dark:text-slate-400">
          <tr>
            <th className="py-1 font-normal">キー</th>
            <th className="py-1 font-normal">調号</th>
            <th className="py-1 font-normal">付く音</th>
            <th className="py-1 font-normal">{diagram.mode === 'major' ? '平行調（マイナー）' : '平行調（メジャー）'}</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((k) => {
            const sig = keySignature(k);
            return (
              <tr key={keyName(k)} className="border-t border-slate-100 dark:border-slate-800">
                <td className="py-1.5 font-semibold">
                  {keyName(k, 'unicode')}
                  <span className="ml-1 text-xs font-normal text-slate-500">{keyNameJa(k)}</span>
                </td>
                <td className="py-1.5">{sig.count === 0 ? 'なし' : sig.count > 0 ? `♯ ${sig.count}個` : `♭ ${-sig.count}個`}</td>
                <td className="py-1.5 text-xs">{sig.accidentals.map((p) => u(p, 'unicode')).join(' ') || '—'}</td>
                <td className="py-1.5 text-xs">{keyName(relativeKey(k), 'unicode')}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const BUILDER_ROOTS = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'F#', 'Bb', 'Eb'];

/** ルートとコードの種類を選んで、構成音・音程・鍵盤を確かめる */
export function ChordBuilder({ diagram }: { diagram: Extract<Diagram, { kind: 'chord-builder' }> }) {
  const fmt = useFmt();
  const style = useSettings((s) => s.romanStyle);
  const [root, setRoot] = useState(diagram.root ?? 'C');
  const [quality, setQuality] = useState<ChordQualityId>(diagram.qualities[0]!);
  const r = parsePitchClass(root);
  const pitches = chordPitches({ ...r, octave: 4 }, quality);
  const midis = pitches.map(midiOf);
  const [from, to] = keyboardRange(midis);
  const marks: Record<number, KeyMark> = {};
  pitches.forEach((p, i) => (marks[midis[i]!] = { kind: i === 0 ? 'root' : 'chord', label: u(p, 'unicode') }));
  const symbol = formatChordSymbol({ root: r, quality }, { style, accidentals: 'unicode' });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5" aria-label="ルート">
        {BUILDER_ROOTS.map((x) => (
          <ChoiceButton key={x} selected={root === x} onClick={() => setRoot(x)} className="min-w-10">
            {u(parsePitchClass(x), 'unicode')}
          </ChoiceButton>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5" aria-label="コードの種類">
        {diagram.qualities.map((q) => (
          <ChoiceButton key={q} selected={quality === q} onClick={() => setQuality(q)}>
            {CHORD_QUALITIES[q].nameJa}
          </ChoiceButton>
        ))}
      </div>
      <p className="text-2xl font-bold" data-testid="builder-symbol">
        {symbol}
      </p>
      <ul className="space-y-0.5 text-sm">
        {chordStructure(r, quality).map((s) => (
          <li key={s.interval}>
            <span className="inline-block w-12 text-slate-500">{s.role}</span>
            <span className="font-semibold">{u(s.note, 'unicode')}</span>
            <span className="ml-2 text-xs text-slate-500">（ルートから{intervalNameJa(parseInterval(s.interval))}）</span>
          </li>
        ))}
      </ul>
      <PianoKeyboard from={from} to={to} marks={marks} cLabel={fmt} keyName={fmt} ariaLabel={`${symbol} の鍵盤`} />
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => void audio.chord(midis)} className="min-h-11 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
          ▶ 和音で鳴らす
        </button>
        <button type="button" onClick={() => void audio.arpeggio(midis)} className="min-h-11 rounded-xl border border-brand-500 px-4 text-sm font-semibold text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10">
          ♪ 1音ずつ
        </button>
      </div>
    </div>
  );
}

/** キーを選んで、ダイアトニックコードの一覧を見る・鳴らす */
export function DiatonicTable({ diagram }: { diagram: Extract<Diagram, { kind: 'diatonic-table' }> }) {
  const style = useSettings((s) => s.romanStyle);
  const tonics = diagram.mode === 'major' ? COMMON_MAJOR_TONICS.slice(0, 11) : COMMON_MINOR_TONICS.slice(0, 11);
  const [tonic, setTonic] = useState(diagram.tonic ?? (diagram.mode === 'major' ? 'C' : 'A'));
  const [sevenths, setSevenths] = useState(diagram.sevenths ?? false);
  const key = makeKey(tonic, diagram.mode);
  const scale: ScaleId | undefined = diagram.scale;
  const chords = diatonicChords(key, { sevenths, scale });
  const notes = scaleNotes(key.tonic, scale ?? (diagram.mode === 'major' ? 'major' : 'naturalMinor'));

  const playAll = () =>
    void audio.playSequence(
      chords.map((c, i) => ({ midis: chordVoicing(c).map(midiOf), startBeat: i * 2, durationBeats: 2 })),
      100,
    );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5" aria-label="キー">
        {tonics.map((t) => (
          <ChoiceButton key={t} selected={tonic === t} onClick={() => setTonic(t)} className="min-w-10">
            {u(parsePitchClass(t), 'unicode')}
            {diagram.mode === 'minor' ? 'm' : ''}
          </ChoiceButton>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <ChoiceButton selected={!sevenths} onClick={() => setSevenths(false)}>
          3和音
        </ChoiceButton>
        <ChoiceButton selected={sevenths} onClick={() => setSevenths(true)}>
          4和音（セブンス）
        </ChoiceButton>
        <button type="button" onClick={playAll} className="min-h-10 rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-700">
          ▶ 7つを順番に鳴らす
        </button>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {keyName(key, 'unicode')} のスケール：{notes.map((p) => u(p, 'unicode')).join(' ')}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[20rem] text-sm">
          <thead className="text-left text-xs text-slate-500 dark:text-slate-400">
            <tr>
              <th className="py-1 font-normal">度数</th>
              <th className="py-1 font-normal">コード</th>
              <th className="py-1 font-normal">構成音</th>
              <th className="py-1 font-normal">役割</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {chords.map((c) => (
              <tr key={c.degree} className="border-t border-slate-100 dark:border-slate-800">
                <td className="py-1.5 font-semibold">{romanNumeral(key, c, { style })}</td>
                <td className="py-1.5 font-semibold">{formatChordSymbol(c, { style, accidentals: 'unicode' })}</td>
                <td className="py-1.5 text-xs">{c.tones.map((t) => u(t, 'unicode')).join(' ')}</td>
                <td className="py-1.5 text-xs">{c.functions.map((f) => FUNCTION_INFO[f].nameJa).join('／')}</td>
                <td className="py-1.5 text-right">
                  <button
                    type="button"
                    onClick={() => void audio.chord(chordVoicing(c).map(midiOf))}
                    className="min-h-9 rounded-lg px-2 text-xs font-semibold text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10"
                    aria-label={`${formatChordSymbol(c)} を鳴らす`}
                  >
                    ▶
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
