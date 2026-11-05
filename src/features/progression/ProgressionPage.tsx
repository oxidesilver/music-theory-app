import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { ChoiceButton } from '@/components/ui/ChoiceButton';
import { SoundHint } from '@/components/ui/SoundHint';
import { NAV_ITEMS } from '@/app/navigation';
import { audio } from '@/audio/engine';
import { useIsPlaying } from '@/audio/useIsPlaying';
import { usePlaybackPosition } from '@/audio/usePlaybackPosition';
import { useSettings } from '@/stores/settingsStore';
import { CATEGORY_LABEL_JA, analyzeProgression, type ChordAnalysis } from '@/theory/analysis';
import { CHORD_QUALITIES, CHORD_QUALITY_IDS, chordTones, formatChordSymbol, type ChordQualityId, type ChordSpec } from '@/theory/chord';
import { FUNCTION_INFO, type HarmonicFunction } from '@/theory/diatonic';
import { COMMON_MAJOR_TONICS, COMMON_MINOR_TONICS, keyName, makeKey, type MusicalKey } from '@/theory/key';
import { formatPitchClass, midiOf, parsePitchClass } from '@/theory/pitch';
import { romanNumeral } from '@/theory/roman';
import { useEditor, MAX_BPM, MIN_BPM } from './editorStore';
import {
  DURATION_OPTIONS,
  PRESET_PROGRESSIONS,
  chordIndexAt,
  chordVoicing,
  moodTendency,
  nextChordSuggestions,
  paletteFor,
  realizePreset,
  toSequence,
  totalBeats,
  variations,
  type Mood,
} from './logic';

const FUNCTION_STYLE: Record<HarmonicFunction, string> = {
  T: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  SD: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300',
  D: 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300',
};

type PaletteTab = 'key' | 'next' | 'preset' | 'variation' | 'other';
const ROOTS = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'];

function FunctionBadges({ functions }: { functions: HarmonicFunction[] }) {
  if (functions.length === 0) return null;
  return (
    <span className="inline-flex gap-1">
      {functions.map((f) => (
        <span key={f} className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${FUNCTION_STYLE[f]}`} title={FUNCTION_INFO[f].nameJa}>
          {f}
        </span>
      ))}
    </span>
  );
}

export function ProgressionPage() {
  const { songId } = useParams();
  const navigate = useNavigate();
  const ed = useEditor();
  const style = useSettings((s) => s.romanStyle);
  const playing = useIsPlaying();
  const position = usePlaybackPosition();
  const [loop, setLoop] = useState(true);
  const [withBass, setWithBass] = useState(true);
  const [sevenths, setSevenths] = useState(false);
  const [tab, setTab] = useState<PaletteTab>('key');
  const [replaceMode, setReplaceMode] = useState(false);
  const [transposeWithKey, setTransposeWithKey] = useState(true);
  const [moodFilter, setMoodFilter] = useState<Mood | null>(null);
  const [otherRoot, setOtherRoot] = useState('C');
  const [notFound, setNotFound] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // URL の作品を読み込む
  useEffect(() => {
    setNotFound(false);
    if (songId && songId !== ed.songId) {
      void ed.load(songId).then((ok) => setNotFound(!ok));
    }
  }, [songId]); // eslint-disable-line react-hooks/exhaustive-deps

  // 画面を離れたら再生を止める
  useEffect(() => () => audio.stop(), []);

  const sym = (c: ChordSpec) => formatChordSymbol(c, { style, accidentals: 'unicode' });
  const analysis = useMemo(() => analyzeProgression(ed.key, ed.chords, { style }), [ed.key, ed.chords, style]);
  const playingIndex = position !== null ? chordIndexAt(ed.chords, position, ed.bpm) : -1;
  const selected = ed.selected !== null ? ed.chords[ed.selected] : undefined;
  const selectedAnalysis: ChordAnalysis | undefined = ed.selected !== null ? analysis.chords[ed.selected] : undefined;
  const mood = moodTendency(ed.key, ed.chords);

  const preview = (c: ChordSpec) => void audio.chord(chordVoicing(c).map(midiOf), { duration: 1.2 });

  const choose = (c: ChordSpec) => {
    if (replaceMode && ed.selected !== null) ed.replace(ed.selected, c);
    else ed.add(c, 4);
    preview(c);
  };

  const play = () => {
    if (ed.chords.length === 0) return;
    void audio.playSequence(toSequence(ed.chords, { withBass }), ed.bpm, { loop, lengthBeats: totalBeats(ed.chords) });
  };

  const save = async () => {
    const id = await ed.save();
    setMessage('保存しました');
    window.setTimeout(() => setMessage(null), 2000);
    if (songId !== id) navigate(`/progression/${id}`, { replace: true });
  };

  const changeKey = (k: MusicalKey) => {
    audio.stop();
    ed.setKey(k, transposeWithKey);
  };

  if (notFound) {
    return (
      <Card>
        <p className="font-bold">作品が見つかりませんでした。</p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">削除されたか、別の端末で作られた作品の可能性があります。</p>
        <Link to="/progression" className="mt-3 inline-block text-sm font-semibold text-brand-600" onClick={() => ed.newSong()}>
          新しく作る
        </Link>
      </Card>
    );
  }

  const tonics = ed.key.mode === 'major' ? COMMON_MAJOR_TONICS : COMMON_MINOR_TONICS;
  const nextFrom = selected ?? ed.chords[ed.chords.length - 1];

  return (
    <>
      <PageHeader
        icon={NAV_ITEMS.progression.icon}
        title={NAV_ITEMS.progression.label}
        description="キーを選んで、下の候補からコードを選ぶと順番に並びます。再生して響きを確かめ、気に入ったら保存しましょう。"
      />

      {/* 作品名と保存 */}
      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <label className="min-w-0 flex-1">
            <span className="sr-only">作品名</span>
            <input
              value={ed.title}
              onChange={(e) => ed.setTitle(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-base font-semibold dark:border-slate-700"
              aria-label="作品名"
            />
          </label>
          <button type="button" onClick={() => void save()} className="min-h-11 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
            💾 保存
          </button>
          <Link
            to={ed.songId ? `/compose/${ed.songId}` : '/compose'}
            className="flex min-h-11 items-center rounded-xl border border-brand-500 px-3 text-sm font-semibold text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10"
          >
            🎵 メロディーを作る
          </Link>
          <button
            type="button"
            onClick={() => {
              if (!ed.dirty || window.confirm('保存していない変更があります。新しい進行を作りますか？')) {
                audio.stop();
                ed.newSong();
                navigate('/progression');
              }
            }}
            className="min-h-11 rounded-xl px-3 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            ＋ 新規
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400" role="status">
          {message ?? (ed.dirty ? '● 保存していない変更があります' : ed.songId ? '保存済み' : '')}
        </p>
      </Card>

      {/* キー・テンポ・再生 */}
      <Card className="mb-4 space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <p className="mb-1 text-xs font-semibold">キー</p>
            <div className="flex gap-2">
              <select
                aria-label="キーの主音"
                value={formatPitchClass(ed.key.tonic)}
                onChange={(e) => changeKey(makeKey(e.target.value, ed.key.mode))}
                className="min-h-10 rounded-lg border border-slate-200 bg-white px-2 dark:border-slate-700 dark:bg-slate-900"
              >
                {tonics.map((t) => (
                  <option key={t} value={t}>
                    {formatPitchClass(parsePitchClass(t), 'unicode')}
                  </option>
                ))}
                {!tonics.includes(formatPitchClass(ed.key.tonic)) && (
                  <option value={formatPitchClass(ed.key.tonic)}>{formatPitchClass(ed.key.tonic, 'unicode')}</option>
                )}
              </select>
              <ChoiceButton selected={ed.key.mode === 'major'} onClick={() => changeKey({ ...ed.key, mode: 'major' })}>
                メジャー
              </ChoiceButton>
              <ChoiceButton selected={ed.key.mode === 'minor'} onClick={() => changeKey({ ...ed.key, mode: 'minor' })}>
                マイナー
              </ChoiceButton>
            </div>
            <label className="mt-1 flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
              <input type="checkbox" checked={transposeWithKey} onChange={(e) => setTransposeWithKey(e.target.checked)} />
              キーを変えたら、並べたコードも一緒に移調する
            </label>
          </div>
          <div className="min-w-48 flex-1">
            <p className="mb-1 text-xs font-semibold">
              テンポ（BPM）：<span data-testid="bpm">{ed.bpm}</span>
            </p>
            <div className="flex items-center gap-2">
              <button type="button" aria-label="BPM を下げる" onClick={() => ed.setBpm(ed.bpm - 1)} className="h-10 w-10 rounded-lg border border-slate-200 dark:border-slate-700">
                −
              </button>
              <input
                type="range"
                min={MIN_BPM}
                max={MAX_BPM}
                value={ed.bpm}
                onChange={(e) => ed.setBpm(Number(e.target.value))}
                aria-label="BPM"
                className="flex-1 accent-brand-600"
              />
              <button type="button" aria-label="BPM を上げる" onClick={() => ed.setBpm(ed.bpm + 1)} className="h-10 w-10 rounded-lg border border-slate-200 dark:border-slate-700">
                ＋
              </button>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {playing ? (
            <button type="button" onClick={() => audio.stop()} className="min-h-11 rounded-xl bg-slate-800 px-5 text-sm font-semibold text-white dark:bg-slate-200 dark:text-slate-900">
              ■ 停止
            </button>
          ) : (
            <button
              type="button"
              onClick={play}
              disabled={ed.chords.length === 0}
              className="min-h-11 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40"
            >
              ▶ 再生
            </button>
          )}
          <label className="flex items-center gap-1.5 text-sm">
            <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} /> ループ再生
          </label>
          <label className="flex items-center gap-1.5 text-sm">
            <input type="checkbox" checked={withBass} onChange={(e) => setWithBass(e.target.checked)} /> ベースも鳴らす
          </label>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            全 {totalBeats(ed.chords)} 拍（{totalBeats(ed.chords) / 4} 小節）・音量は「設定」で変更できます
          </span>
        </div>
        <SoundHint />
      </Card>

      {/* 並べたコード */}
      <Card className="mb-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-bold">コード進行（キー：{keyName(ed.key, 'unicode')}）</h2>
          {ed.chords.length > 0 && (
            <button
              type="button"
              onClick={() => window.confirm('並べたコードをすべて消しますか？') && ed.clear()}
              className="text-xs text-slate-500 hover:text-rose-600"
            >
              すべて消す
            </button>
          )}
        </div>
        {ed.chords.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">
            まだコードがありません。下の「コードを選ぶ」から追加するか、「定番進行」を読み込んでみましょう。
          </p>
        ) : (
          <ol className="mt-3 grid grid-cols-8 gap-2 md:grid-cols-16" aria-label="並べたコード">
            {ed.chords.map((c, i) => {
              const a = analysis.chords[i]!;
              const isSel = ed.selected === i;
              const isPlaying = playingIndex === i;
              return (
                <li key={c.id} style={{ gridColumn: `span ${Math.min(c.durationBeats, 8)} / span ${Math.min(c.durationBeats, 8)}` }}>
                  <button
                    type="button"
                    onClick={() => {
                      ed.select(i);
                      preview(c);
                    }}
                    aria-pressed={isSel}
                    aria-label={`${i + 1}番目 ${sym(c)}`}
                    className={[
                      'flex h-full min-h-20 w-full flex-col items-start justify-between rounded-xl border p-2 text-left transition',
                      isPlaying ? 'border-amber-400 bg-amber-50 dark:bg-amber-500/15' : isSel ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/15' : 'border-slate-200 hover:border-brand-400 dark:border-slate-700',
                    ].join(' ')}
                  >
                    <span className="text-lg font-bold leading-tight">{sym(c)}</span>
                    <span className="text-xs text-slate-600 dark:text-slate-300">{a.roman}</span>
                    <span className="flex items-center gap-1">
                      <FunctionBadges functions={a.functions} />
                      {a.category !== 'diatonic' && <span className="text-[10px] text-violet-600 dark:text-violet-300">★</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          T＝トニック（安定）／SD＝サブドミナント（展開）／D＝ドミナント（緊張）、★＝キーのスケール外の音を含むコード。1マス＝1拍。
        </p>
      </Card>

      {/* 選んだコードの詳細と操作 */}
      {selected && selectedAnalysis && ed.selected !== null && (
        <Card className="mb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs text-slate-500">{ed.selected + 1}番目のコード</p>
              <p className="text-2xl font-bold">
                {sym(selected)} <span className="text-base font-semibold text-slate-500">{selectedAnalysis.roman}</span>
              </p>
              <p className="text-sm">
                構成音：{chordTones(selected.root, selected.quality).map((t) => formatPitchClass(t, 'unicode')).join('・')}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <ChoiceButton selected={false} onClick={() => ed.move(ed.selected!, -1)}>
                ◀ 前へ
              </ChoiceButton>
              <ChoiceButton selected={false} onClick={() => ed.move(ed.selected!, 1)}>
                後へ ▶
              </ChoiceButton>
              <ChoiceButton selected={false} onClick={() => ed.duplicate(ed.selected!)}>
                複製
              </ChoiceButton>
              <ChoiceButton selected={false} onClick={() => ed.remove(ed.selected!)}>
                🗑 削除
              </ChoiceButton>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold">長さ：</span>
            {DURATION_OPTIONS.map((b) => (
              <ChoiceButton key={b} selected={selected.durationBeats === b} onClick={() => ed.setDuration(ed.selected!, b)}>
                {b}拍{b === 4 ? '（1小節）' : b === 8 ? '（2小節）' : ''}
              </ChoiceButton>
            ))}
          </div>
          <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
            <p className="font-semibold">
              {CATEGORY_LABEL_JA[selectedAnalysis.category]}
              {selectedAnalysis.secondaryOf && `（${selectedAnalysis.secondaryOf.label}）`}
            </p>
            {selectedAnalysis.functions.length > 0 && (
              <p className="mt-1">
                役割：
                {selectedAnalysis.functions.map((f) => FUNCTION_INFO[f].nameJa).join(' または ')}
                {selectedAnalysis.functions.length === 1 && ` … ${FUNCTION_INFO[selectedAnalysis.functions[0]!].plain}`}
                {selectedAnalysis.functions.length > 1 && '（解釈が分かれるコードです）'}
              </p>
            )}
            {selectedAnalysis.notes.map((n) => (
              <p key={n} className="mt-1 text-slate-600 dark:text-slate-300">
                {n}
              </p>
            ))}
          </div>
          <label className="mt-3 flex items-center gap-1.5 text-sm">
            <input type="checkbox" checked={replaceMode} onChange={(e) => setReplaceMode(e.target.checked)} />
            下の候補を押したとき、追加ではなくこのコードを置き換える
          </label>
        </Card>
      )}

      {/* 候補 */}
      <Card className="mb-4">
        <h2 className="font-bold">コードを選ぶ</h2>
        <div className="mt-2 flex flex-wrap gap-1.5" role="tablist">
          {(
            [
              ['key', 'キーに合うコード'],
              ['next', '次のコードの候補'],
              ['preset', '定番進行'],
              ['variation', '別パターン'],
              ['other', 'その他のコード'],
            ] as [PaletteTab, string][]
          ).map(([id, label]) => (
            <ChoiceButton key={id} selected={tab === id} onClick={() => setTab(id)}>
              {label}
            </ChoiceButton>
          ))}
        </div>

        <div className="mt-4">
          {tab === 'key' && (
            <div className="space-y-4">
              <div className="flex gap-1.5">
                <ChoiceButton selected={!sevenths} onClick={() => setSevenths(false)}>
                  3和音
                </ChoiceButton>
                <ChoiceButton selected={sevenths} onClick={() => setSevenths(true)}>
                  4和音（セブンス）
                </ChoiceButton>
              </div>
              {paletteFor(ed.key, sevenths).map((g) => (
                <div key={g.title}>
                  <p className="text-sm font-semibold">{g.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{g.note}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {g.chords.map((c) => (
                      <ChordChoice key={sym(c)} keyCtx={ed.key} chord={c} style={style} onChoose={choose} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'next' && (
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {nextFrom ? `「${sym(nextFrom)}」の次に、理論上つながりやすいコードの例です。` : '最初のコードの例です。'}
                これ以外の進み方も自由です。耳で確かめて選びましょう。
              </p>
              <ul className="mt-2 space-y-2">
                {nextChordSuggestions(ed.key, nextFrom, sevenths).map((s) => (
                  <li key={sym(s.chord)} className="flex flex-wrap items-center gap-2">
                    <ChordChoice keyCtx={ed.key} chord={s.chord} style={style} onChoose={choose} />
                    <span className="text-sm text-slate-600 dark:text-slate-300">{s.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {tab === 'preset' && (
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                実際の曲でよく使われる進行の例です（キー {keyName(ed.key, 'unicode')} に合わせて表示）。雰囲気の分類は一般的な傾向で、曲によって印象は変わります。
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <ChoiceButton selected={moodFilter === null} onClick={() => setMoodFilter(null)}>
                  すべて
                </ChoiceButton>
                {(['明るい', '暗い', '切ない', '緊張感', '解決感', 'おしゃれ', '力強い'] as Mood[]).map((m) => (
                  <ChoiceButton key={m} selected={moodFilter === m} onClick={() => setMoodFilter(m)}>
                    {m}
                  </ChoiceButton>
                ))}
              </div>
              <ul className="mt-3 space-y-2">
                {PRESET_PROGRESSIONS.filter((p) => p.mode === ed.key.mode && (!moodFilter || p.moods.includes(moodFilter))).map((p) => {
                  const chords = realizePreset(ed.key, p);
                  return (
                    <li key={p.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold">
                            {p.name} <span className="text-xs font-normal text-slate-500">{p.moods.join('・')}</span>
                          </p>
                          <p className="text-sm">{chords.map(sym).join(' → ')}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{p.description}</p>
                        </div>
                        <div className="flex gap-1.5">
                          <ChoiceButton
                            selected={false}
                            onClick={() => void audio.playSequence(toSequence(chords, { withBass }), ed.bpm)}
                          >
                            ▶ 試聴
                          </ChoiceButton>
                          <ChoiceButton
                            selected={false}
                            onClick={() => {
                              if (ed.chords.length === 0 || window.confirm('今の進行を、この定番進行に置き換えますか？')) ed.setChords(chords);
                            }}
                          >
                            使う
                          </ChoiceButton>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {tab === 'variation' && (
            <div>
              {ed.chords.length === 0 ? (
                <p className="text-sm text-slate-500">コードを並べると、同じ進行の別パターンを提案します。</p>
              ) : (
                <>
                  <p className="text-xs text-slate-500 dark:text-slate-400">今の進行をもとに、理論的な置き換えを使った別パターンの例です。</p>
                  <ul className="mt-2 space-y-2">
                    {variations(ed.key, ed.chords).map((v) => (
                      <li key={v.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                        <p className="font-semibold">{v.title}</p>
                        <p className="text-sm">{v.chords.map(sym).join(' → ')}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{v.description}</p>
                        <div className="mt-2 flex gap-1.5">
                          <ChoiceButton selected={false} onClick={() => void audio.playSequence(toSequence(v.chords, { withBass }), ed.bpm)}>
                            ▶ 試聴
                          </ChoiceButton>
                          <ChoiceButton selected={false} onClick={() => ed.setChords(v.chords)}>
                            このパターンにする
                          </ChoiceButton>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          {tab === 'other' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">キーに関係なく、好きなコードを選べます。</p>
              <div className="flex flex-wrap gap-1.5">
                {ROOTS.map((r) => (
                  <ChoiceButton key={r} selected={otherRoot === r} onClick={() => setOtherRoot(r)} className="min-w-10">
                    {formatPitchClass(parsePitchClass(r), 'unicode')}
                  </ChoiceButton>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {CHORD_QUALITY_IDS.map((q: ChordQualityId) => (
                  <ChordChoice key={q} keyCtx={ed.key} chord={{ root: parsePitchClass(otherRoot), quality: q }} style={style} onChoose={choose} title={CHORD_QUALITIES[q].nameJa} />
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* 分析 */}
      {ed.chords.length > 0 && mood && (
        <Card>
          <h2 className="font-bold">進行の分析</h2>
          <ul className="mt-2 space-y-1 text-sm">
            <li>明るさ：{mood.brightness}</li>
            <li>緊張感：{mood.tension}</li>
            <li>解決感：{mood.resolution ? 'あり（ドミナントから解決する動きがあります）' : 'はっきりした解決の動きはありません'}</li>
            <li>スケール外のコード：{mood.colorful} 個</li>
          </ul>
          {analysis.resolutions.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-sm text-slate-600 dark:text-slate-300">
              {analysis.resolutions.map((r) => (
                <li key={r.index}>{r.description}</li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            ※ コードの種類と動きから計算した目安です。実際の印象は、リズム・音色・メロディーによって大きく変わります。
          </p>
        </Card>
      )}
    </>
  );
}

function ChordChoice({
  keyCtx,
  chord,
  style,
  onChoose,
  title,
}: {
  keyCtx: MusicalKey;
  chord: ChordSpec;
  style: 'japanese' | 'english';
  onChoose: (c: ChordSpec) => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChoose(chord)}
      title={title}
      className="flex min-h-12 min-w-16 flex-col items-center justify-center rounded-xl border border-slate-200 px-3 py-1 hover:border-brand-400 hover:bg-brand-50 dark:border-slate-700 dark:hover:bg-brand-500/10"
    >
      <span className="font-bold">{formatChordSymbol(chord, { style, accidentals: 'unicode' })}</span>
      <span className="text-[11px] text-slate-500">{romanNumeral(keyCtx, chord, { style })}</span>
    </button>
  );
}
