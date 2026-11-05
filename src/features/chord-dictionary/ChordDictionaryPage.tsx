import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { ChoiceButton } from '@/components/ui/ChoiceButton';
import { SoundHint } from '@/components/ui/SoundHint';
import { KeyMarkLegend, PianoKeyboard, type KeyMark } from '@/components/PianoKeyboard/PianoKeyboard';
import { NAV_ITEMS } from '@/app/navigation';
import { audio } from '@/audio/engine';
import { useIsPlaying } from '@/audio/useIsPlaying';
import { INSTRUMENT_INFO, type InstrumentId } from '@/audio/instruments';
import { useSettings } from '@/stores/settingsStore';
import { CHORD_DESCRIPTIONS } from '@/content/chordDescriptions';
import {
  CHORD_QUALITIES,
  CHORD_QUALITY_IDS,
  INVERSION_NAMES_JA,
  chordPitches,
  chordStructure,
  formatChordSymbol,
  type ChordQualityDef,
  type ChordQualityId,
  type Voicing,
} from '@/theory/chord';
import { intervalNameJa, parseInterval } from '@/theory/interval';
import {
  formatPitch,
  formatPitchClass,
  midiOf,
  parsePitchClass,
  pitchFromMidi,
  semitoneOf,
  solfegeName,
  type PitchClass,
} from '@/theory/pitch';
import { SCALES, scaleNotes } from '@/theory/scale';
import { useFavorites } from './useFavorites';
import { useEditor } from '@/features/progression/editorStore';

const ROOT_OPTIONS = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'];

const CATEGORY_LABEL: Record<ChordQualityDef['category'], string> = {
  triad: '3和音（トライアド）',
  sixth: '6th コード',
  seventh: 'セブンスコード（4和音）',
  tension: 'テンションコード',
};

function safeRoot(text: string | undefined): PitchClass {
  try {
    return parsePitchClass(text ?? 'C');
  } catch {
    return parsePitchClass('C');
  }
}

function safeQuality(text: string | undefined): ChordQualityId {
  return CHORD_QUALITY_IDS.includes(text as ChordQualityId) ? (text as ChordQualityId) : 'maj';
}

const u = (p: PitchClass) => formatPitchClass(p, 'unicode');

export function ChordDictionaryPage() {
  const params = useParams();
  const navigate = useNavigate();
  const root = safeRoot(params.root);
  const quality = safeQuality(params.quality);
  const def = CHORD_QUALITIES[quality];

  const style = useSettings((s) => s.romanStyle);
  const octaveConvention = useSettings((s) => s.octaveConvention);
  const defaultInstrument = useSettings((s) => s.instrument);

  const [octave, setOctave] = useState(4); // 内部の国際式（C4 = 中央のド）
  const [inversion, setInversion] = useState(0);
  const [voicing, setVoicing] = useState<Voicing>('full');
  const [instrument, setInstrument] = useState<InstrumentId>(defaultInstrument === 'bass' ? 'piano' : defaultInstrument);
  const playing = useIsPlaying();
  const favorites = useFavorites();

  const effectiveVoicing: Voicing = def.commonIntervals ? voicing : 'full';
  const structure = chordStructure(root, quality, effectiveVoicing);
  const maxInversion = structure.length - 1;
  const inv = Math.min(inversion, maxInversion);

  const pitches = chordPitches({ ...root, octave }, quality, { inversion: inv, voicing: effectiveVoicing });
  const midis = pitches.map(midiOf);

  // 鍵盤の表示範囲：構成音を含む C から、最低2オクターブ
  const low = Math.floor(Math.min(...midis) / 12) * 12;
  const high = Math.max(low + 23, Math.ceil((Math.max(...midis) + 1) / 12) * 12 - 1);

  const marks: Record<number, KeyMark> = {};
  pitches.forEach((p, i) => {
    const isRoot = semitoneOf(p) === semitoneOf(root);
    marks[midis[i]!] = { kind: isRoot ? 'root' : 'chord', label: u(p) };
  });

  const symbol = formatChordSymbol({ root, quality }, { style, accidentals: 'unicode' });
  const desc = CHORD_DESCRIPTIONS[quality];
  const fmtMidi = (m: number) => formatPitch(pitchFromMidi(m), { octaveConvention, style: 'unicode' });

  const go = (r: PitchClass, q: ChordQualityId) => {
    navigate(`/chords/${encodeURIComponent(formatPitchClass(r))}/${q}`, { replace: true });
  };

  const isFav = favorites.has(root, quality);
  const grouped = (['triad', 'sixth', 'seventh', 'tension'] as const).map((cat) => ({
    cat,
    items: CHORD_QUALITY_IDS.filter((id) => CHORD_QUALITIES[id].category === cat),
  }));

  return (
    <>
      <PageHeader
        icon={NAV_ITEMS.chords.icon}
        title={NAV_ITEMS.chords.label}
        description="ルート（コードの土台になる音）とコードの種類を選ぶと、構成音・響き・使い方を確認できます。"
      />

      {/* スマホでは「コード表示 → 選択欄 → 構成音 → 解説」の順、PC では右側に選択欄 */}
      <div className="grid gap-4 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="contents lg:block lg:space-y-4">
          {/* コードの表示と再生 */}
          <Card className="order-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-4xl font-bold tracking-tight" data-testid="chord-symbol">
                  {symbol}
                </p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {u(root)}（{solfegeName(root)}）の{def.nameJa}
                  <span className="ml-2 text-xs text-slate-400">{def.nameEn}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => void favorites.toggle(root, quality)}
                aria-pressed={isFav}
                className="min-h-10 rounded-lg px-3 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {isFav ? '★ お気に入り済み' : '☆ お気に入りに追加'}
              </button>
            </div>

            <div className="mt-4">
              <PianoKeyboard
                from={low}
                to={high}
                marks={marks}
                instrument={instrument}
                cLabel={fmtMidi}
                keyName={fmtMidi}
                ariaLabel={`${symbol} の鍵盤`}
              />
              <div className="mt-2">
                <KeyMarkLegend kinds={['root', 'chord']} />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void audio.chord(midis, { instrument })}
                className="min-h-11 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
              >
                ▶ 和音で鳴らす
              </button>
              <button
                type="button"
                onClick={() => void audio.arpeggio(midis, { instrument })}
                className="min-h-11 rounded-xl border border-brand-500 px-4 text-sm font-semibold text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10"
              >
                ♪ 1音ずつ鳴らす
              </button>
              <button
                type="button"
                onClick={() => {
                  useEditor.getState().add({ root, quality }, 4);
                  navigate('/progression');
                }}
                className="min-h-11 rounded-xl px-4 text-sm font-semibold text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10"
              >
                ＋ コード進行に追加
              </button>
              {playing && (
                <button
                  type="button"
                  onClick={() => audio.stop()}
                  className="min-h-11 rounded-xl px-4 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  ■ 停止
                </button>
              )}
            </div>
            <div className="mt-2">
              <SoundHint />
            </div>
          </Card>

          {/* 構成音 */}
          <Card className="order-3">
            <h2 className="font-bold">構成音</h2>
            <table className="mt-3 w-full text-sm">
              <thead className="text-left text-xs text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="py-1 font-normal">役割</th>
                  <th className="py-1 font-normal">音名</th>
                  <th className="py-1 font-normal">ルートからの音程</th>
                </tr>
              </thead>
              <tbody>
                {structure.map((s) => (
                  <tr key={s.interval} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="py-2">{s.role}</td>
                    <td className="py-2 font-semibold">
                      {u(s.note)} <span className="text-xs font-normal text-slate-500">（{solfegeName(s.note)}）</span>
                    </td>
                    <td className="py-2">{intervalNameJa(parseInterval(s.interval))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {def.voicingNote && (
              <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                💡 {def.voicingNote}
              </p>
            )}
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              鍵盤で押さえている音（低い順）：{pitches.map((p) => formatPitch(p, { octaveConvention, style: 'unicode' })).join(' ・ ')}
            </p>
          </Card>

          {/* 解説 */}
          <Card className="order-4 space-y-3 text-sm leading-relaxed">
            <div>
              <h2 className="font-bold">響きの特徴</h2>
              <p className="mt-1">{desc.sound}</p>
            </div>
            <div>
              <h2 className="font-bold">よく使われる場面</h2>
              <p className="mt-1">{desc.usage}</p>
            </div>
            <div>
              <h2 className="font-bold">DTM での活用</h2>
              <p className="mt-1">{desc.dtm}</p>
            </div>
            <div>
              <h2 className="font-bold">合わせやすいスケールの候補</h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                メロディーやアドリブで使いやすい音階の例です。曲のキーや前後のコードによって、合うスケールは変わります。
              </p>
              <ul className="mt-2 space-y-1">
                {def.scaleCandidates.map((id) => (
                  <li key={id}>
                    <span className="font-semibold">
                      {u(root)} {SCALES[id].nameJa}
                    </span>
                    ：{scaleNotes(root, id).map(u).join(' ')}
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </div>

        {/* 選択パネル */}
        <div className="order-2 space-y-4 lg:order-none">
          <Card>
            <h2 className="text-sm font-bold">ルート（土台の音）</h2>
            <div className="mt-2 grid grid-cols-6 gap-1.5 lg:grid-cols-5">
              {ROOT_OPTIONS.map((r) => {
                const p = parsePitchClass(r);
                return (
                  <ChoiceButton
                    key={r}
                    selected={formatPitchClass(root) === r}
                    onClick={() => go(p, quality)}
                    className="px-1"
                  >
                    {u(p)}
                  </ChoiceButton>
                );
              })}
            </div>
          </Card>

          <Card>
            <h2 className="text-sm font-bold">コードの種類</h2>
            <div className="mt-2 space-y-3">
              {grouped.map(({ cat, items }) => (
                <div key={cat}>
                  <p className="mb-1 text-xs text-slate-500 dark:text-slate-400">{CATEGORY_LABEL[cat]}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {items.map((id) => (
                      <ChoiceButton
                        key={id}
                        selected={quality === id}
                        onClick={() => go(root, id)}
                        title={CHORD_QUALITIES[id].nameJa}
                      >
                        {u(root)}
                        {CHORD_QUALITIES[id].symbols[style]}
                      </ChoiceButton>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="space-y-3">
            <div>
              <h2 className="text-sm font-bold">音の高さ</h2>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[2, 3, 4, 5].map((o) => (
                  <ChoiceButton key={o} selected={octave === o} onClick={() => setOctave(o)}>
                    {formatPitch({ ...root, octave: o }, { octaveConvention, style: 'unicode' })}
                  </ChoiceButton>
                ))}
              </div>
            </div>
            <div>
              <h2 className="text-sm font-bold">転回形（音の積み方）</h2>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Array.from({ length: maxInversion + 1 }, (_, i) => (
                  <ChoiceButton key={i} selected={inv === i} onClick={() => setInversion(i)}>
                    {INVERSION_NAMES_JA[i]}
                  </ChoiceButton>
                ))}
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                転回形：一番下の音を1オクターブ上に移した形。構成音は同じでも響きが少し変わります。
              </p>
            </div>
            {def.commonIntervals && (
              <div>
                <h2 className="text-sm font-bold">音の配置</h2>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <ChoiceButton selected={effectiveVoicing === 'full'} onClick={() => setVoicing('full')}>
                    すべての音
                  </ChoiceButton>
                  <ChoiceButton selected={effectiveVoicing === 'common'} onClick={() => setVoicing('common')}>
                    よく弾かれる形
                  </ChoiceButton>
                </div>
              </div>
            )}
            <div>
              <h2 className="text-sm font-bold">音色</h2>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(['piano', 'synth', 'bass'] as const).map((id) => (
                  <ChoiceButton key={id} selected={instrument === id} onClick={() => setInstrument(id)}>
                    {INSTRUMENT_INFO[id].nameJa}
                  </ChoiceButton>
                ))}
              </div>
            </div>
          </Card>

          {favorites.items.length > 0 && (
            <Card>
              <h2 className="text-sm font-bold">★ お気に入り</h2>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {favorites.items.map((f) => (
                  <ChoiceButton
                    key={f.id}
                    selected={f.id === `${formatPitchClass(root)}|${quality}`}
                    onClick={() => go(f.root, f.quality as ChordQualityId)}
                  >
                    {formatChordSymbol({ root: f.root, quality: f.quality as ChordQualityId }, { style, accidentals: 'unicode' })}
                  </ChoiceButton>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
