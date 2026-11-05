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
import type { NoteEvent } from '@/storage/types';
import { formatChordSymbol } from '@/theory/chord';
import { keyName } from '@/theory/key';
import { formatPitch, formatPitchClass, midiOf } from '@/theory/pitch';
import { SCALES, scaleNotes, type ScaleId } from '@/theory/scale';
import { NOTE_ROLE_LABEL_JA } from '@/theory/tension';
import { useEditor } from '@/features/progression/editorStore';
import { totalBeats } from '@/features/progression/logic';
import {
  BASS_PATTERNS,
  DRUM_PRESETS,
  DRUM_TICKS,
  ROLE_HELP,
  SNAP_OPTIONS,
  STEPS_PER_BAR,
  TICKS_PER_BAR,
  TICKS_PER_BEAT,
  TRACK_RANGE,
  addPassingNotes,
  bassLine,
  compositionSequence,
  emptyPattern,
  eventsToPattern,
  makeNote,
  noteRoleAt,
  patternToEvents,
  shiftNote,
  shiftOctave,
  songLengthTicks,
  type DrumPattern,
  type PlaybackOptions,
  type TrackId,
} from './logic';
import { PianoRoll, RoleLegend } from './PianoRoll';
import { DrumGrid } from './DrumGrid';

type Tab = TrackId | 'drums';

const NOTE_LENGTHS = [
  { label: '16分', ticks: TICKS_PER_BEAT / 4 },
  { label: '8分', ticks: TICKS_PER_BEAT / 2 },
  { label: '4分（1拍）', ticks: TICKS_PER_BEAT },
  { label: '2分（2拍）', ticks: TICKS_PER_BEAT * 2 },
  { label: '全音符（4拍）', ticks: TICKS_PER_BEAT * 4 },
];

function scaleOptions(mode: 'major' | 'minor'): ScaleId[] {
  return mode === 'major'
    ? ['major', 'majorPentatonic', 'majorBlues', 'mixolydian', 'lydian']
    : ['naturalMinor', 'harmonicMinor', 'melodicMinor', 'minorPentatonic', 'blues', 'dorian'];
}

export function ComposePage() {
  const { songId } = useParams();
  const navigate = useNavigate();
  const ed = useEditor();
  const octaveConvention = useSettings((s) => s.octaveConvention);
  const chordStyle = useSettings((s) => s.romanStyle);
  const playing = useIsPlaying();
  const position = usePlaybackPosition();

  const [tab, setTab] = useState<Tab>('melody');
  const [scaleId, setScaleId] = useState<ScaleId>(ed.key.mode === 'major' ? 'major' : 'naturalMinor');
  const [snap, setSnap] = useState<number>(TICKS_PER_BEAT / 2);
  const [noteLength, setNoteLength] = useState<number>(TICKS_PER_BEAT);
  const [cellWidth, setCellWidth] = useState(22);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loop, setLoop] = useState(true);
  const [on, setOn] = useState<PlaybackOptions>({ chords: true, melody: true, bass: true, drums: true });
  const [notFound, setNotFound] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setNotFound(false);
    if (songId && songId !== ed.songId) void ed.load(songId).then((ok) => setNotFound(!ok));
  }, [songId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => audio.stop(), []);
  // キーのモードが変わったら、スケールの選択を合わせる
  useEffect(() => {
    if (!scaleOptions(ed.key.mode).includes(scaleId)) setScaleId(ed.key.mode === 'major' ? 'major' : 'naturalMinor');
  }, [ed.key.mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const lengthTicks = songLengthTicks(ed.chords, ed.melody, ed.bass);
  const track: TrackId | null = tab === 'drums' ? null : tab;
  const notes = track ? ed[track] : [];
  const selected = notes.find((n) => n.id === selectedId) ?? null;
  const pattern = useMemo(() => eventsToPattern(ed.drums), [ed.drums]);
  const playheadTick = position !== null ? (position * ed.bpm * TICKS_PER_BEAT) / 60 : null;

  const setNotes = (next: NoteEvent[]) => track && ed.setTrack(track, next);
  const updateSelected = (fn: (n: NoteEvent) => NoteEvent) => {
    if (!selected) return;
    const updated = fn(selected);
    setNotes(notes.map((n) => (n.id === selected.id ? updated : n)));
    void audio.play(midiOf(updated.pitch), { instrument: track === 'bass' ? 'bass' : 'synth', duration: 0.4 });
  };

  const play = () => {
    // ドラムは1小節目のパターンを、今の曲の長さに合わせて並べ直してから鳴らす
    const drums = ed.drums.length > 0 ? patternToEvents(pattern, lengthTicks) : [];
    const events = compositionSequence({ chords: ed.chords, melody: ed.melody, bass: ed.bass, drums }, on);
    if (events.length === 0) return;
    void audio.playSequence(events, ed.bpm, { loop, lengthBeats: lengthTicks / TICKS_PER_BEAT });
  };

  const save = async () => {
    const id = await ed.save();
    setMessage('保存しました');
    window.setTimeout(() => setMessage(null), 2000);
    if (songId !== id) navigate(`/compose/${id}`, { replace: true });
  };

  const setPattern = (p: DrumPattern) => ed.setDrums(patternToEvents(p, lengthTicks));

  if (notFound) {
    return (
      <Card>
        <p className="font-bold">作品が見つかりませんでした。</p>
        <Link to="/compose" className="mt-3 inline-block text-sm font-semibold text-brand-600" onClick={() => ed.newSong()}>
          新しく作る
        </Link>
      </Card>
    );
  }

  const selectedRole = selected ? noteRoleAt(ed.key, scaleId, ed.chords, midiOf(selected.pitch), selected.startTick) : null;
  const instrumentForTrack = track === 'bass' ? 'bass' : 'synth';

  return (
    <>
      <PageHeader
        icon={NAV_ITEMS.compose.icon}
        title={NAV_ITEMS.compose.label}
        description="コード進行に合わせて、メロディー・ベース・ドラムを作ります。マス目を押すと音符が置けます。背景の色は、その時のコードに対する音の役割です。"
      />

      <Card className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-bold">{ed.title}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              キー：{keyName(ed.key, 'unicode')}　BPM：{ed.bpm}　{lengthTicks / TICKS_PER_BAR} 小節
              {ed.chords.length > 0 ? ed.chords.map((c) => formatChordSymbol(c, { style: chordStyle, accidentals: 'unicode' })).join(' → ') : 'コード進行なし'}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Link to={ed.songId ? `/progression/${ed.songId}` : '/progression'} className="flex min-h-11 items-center rounded-xl px-3 text-sm hover:bg-slate-100 dark:hover:bg-slate-800">
              🎼 コード進行を編集
            </Link>
            <button type="button" onClick={() => void save()} className="min-h-11 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
              💾 保存
            </button>
          </div>
        </div>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400" role="status">
          {message ?? (ed.dirty ? '● 保存していない変更があります' : ed.songId ? '保存済み' : '')}
        </p>
        {ed.chords.length === 0 && (
          <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
            まだコード進行がありません。先に「コード進行を編集」でコードを並べると、コードに合わせた色分けやベースの自動配置が使えます。
          </p>
        )}
      </Card>

      {/* 再生 */}
      <Card className="mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {playing ? (
            <button type="button" onClick={() => audio.stop()} className="min-h-11 rounded-xl bg-slate-800 px-5 text-sm font-semibold text-white dark:bg-slate-200 dark:text-slate-900">
              ■ 停止
            </button>
          ) : (
            <button type="button" onClick={play} className="min-h-11 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700">
              ▶ 再生
            </button>
          )}
          <label className="flex items-center gap-1.5 text-sm">
            <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} /> ループ
          </label>
          <span className="mx-1 h-6 w-px bg-slate-200 dark:bg-slate-700" aria-hidden="true" />
          <span className="text-xs text-slate-500">鳴らすパート：</span>
          {(
            [
              ['chords', 'コード'],
              ['melody', 'メロディー'],
              ['bass', 'ベース'],
              ['drums', 'ドラム'],
            ] as [keyof PlaybackOptions, string][]
          ).map(([k, label]) => (
            <label key={k} className="flex items-center gap-1 text-sm">
              <input type="checkbox" checked={on[k]} onChange={(e) => setOn({ ...on, [k]: e.target.checked })} /> {label}
            </label>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-xs text-slate-500">BPM：</span>
          <button type="button" aria-label="BPM を下げる" onClick={() => ed.setBpm(ed.bpm - 5)} className="h-9 w-9 rounded-lg border border-slate-200 dark:border-slate-700">
            −
          </button>
          <span className="w-10 text-center font-semibold">{ed.bpm}</span>
          <button type="button" aria-label="BPM を上げる" onClick={() => ed.setBpm(ed.bpm + 5)} className="h-9 w-9 rounded-lg border border-slate-200 dark:border-slate-700">
            ＋
          </button>
        </div>
        <SoundHint />
      </Card>

      <Card>
        <div className="flex flex-wrap gap-1.5" role="tablist">
          {(
            [
              ['melody', '🎵 メロディー'],
              ['bass', '🎸 ベース'],
              ['drums', '🥁 ドラム'],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <ChoiceButton
              key={id}
              selected={tab === id}
              onClick={() => {
                setTab(id);
                setSelectedId(null);
              }}
            >
              {label}
              {id !== 'drums' && `（${ed[id as TrackId].length}）`}
            </ChoiceButton>
          ))}
        </div>

        {track && (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <p className="mb-1 text-xs font-semibold">スケール（色分けの基準）</p>
                <select
                  aria-label="スケール"
                  value={scaleId}
                  onChange={(e) => setScaleId(e.target.value as ScaleId)}
                  className="min-h-10 rounded-lg border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  {scaleOptions(ed.key.mode).map((id) => (
                    <option key={id} value={id}>
                      {keyName(ed.key, 'unicode').replace(/メジャー|マイナー/, '')} {SCALES[id].nameJa}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  構成音：{scaleNotes(ed.key.tonic, scaleId).map((p) => formatPitchClass(p, 'unicode')).join(' ')}
                </p>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold">置く位置の細かさ</p>
                <div className="flex gap-1">
                  {SNAP_OPTIONS.map((o) => (
                    <ChoiceButton key={o.ticks} selected={snap === o.ticks} onClick={() => setSnap(o.ticks)}>
                      {o.label}
                    </ChoiceButton>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold">新しく置く音符の長さ</p>
                <div className="flex flex-wrap gap-1">
                  {NOTE_LENGTHS.map((o) => (
                    <ChoiceButton key={o.ticks} selected={noteLength === o.ticks} onClick={() => setNoteLength(o.ticks)}>
                      {o.label}
                    </ChoiceButton>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold">表示の幅</p>
                <div className="flex gap-1">
                  <ChoiceButton selected={false} onClick={() => setCellWidth((w) => Math.max(10, w - 4))}>
                    縮小
                  </ChoiceButton>
                  <ChoiceButton selected={false} onClick={() => setCellWidth((w) => Math.min(40, w + 4))}>
                    拡大
                  </ChoiceButton>
                </div>
              </div>
            </div>

            {track === 'bass' && (
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                <p className="text-sm font-semibold">ベースラインを自動で作る</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">コード進行のルート音をもとに作ります。作ったあとで、1音ずつ自由に直せます。</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {BASS_PATTERNS.map((p) => (
                    <ChoiceButton
                      key={p.id}
                      selected={false}
                      title={p.description}
                      onClick={() => {
                        if (ed.chords.length === 0) return;
                        if (ed.bass.length === 0 || window.confirm('今のベースラインを置き換えますか？')) ed.setTrack('bass', bassLine(ed.chords, ed.key, p.id));
                      }}
                    >
                      {p.label}
                    </ChoiceButton>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <ChoiceButton selected={false} onClick={() => ed.setTrack('bass', addPassingNotes(ed.bass, ed.chords, ed.key, scaleId))}>
                    経過音を追加
                  </ChoiceButton>
                  <ChoiceButton selected={false} onClick={() => ed.setTrack('bass', shiftOctave(ed.bass, 1, ed.key))}>
                    全体を1オクターブ上へ
                  </ChoiceButton>
                  <ChoiceButton selected={false} onClick={() => ed.setTrack('bass', shiftOctave(ed.bass, -1, ed.key))}>
                    全体を1オクターブ下へ
                  </ChoiceButton>
                </div>
              </div>
            )}

            <PianoRoll
              notes={notes}
              range={TRACK_RANGE[track]}
              musicalKey={ed.key}
              scaleId={scaleId}
              chords={ed.chords}
              lengthTicks={lengthTicks}
              snap={snap}
              cellWidth={cellWidth}
              selectedId={selectedId}
              playheadTick={playheadTick}
              octaveConvention={octaveConvention}
              chordStyle={chordStyle}
              ariaLabel={track === 'melody' ? 'メロディーのピアノロール' : 'ベースのピアノロール'}
              onAdd={(midi, tick) => {
                const n = makeNote(midi, ed.key, tick, Math.min(noteLength, lengthTicks - tick));
                setNotes([...notes, n]);
                setSelectedId(n.id);
                void audio.play(midi, { instrument: instrumentForTrack, duration: 0.4 });
              }}
              onSelect={(n) => {
                setSelectedId(n.id);
                void audio.play(midiOf(n.pitch), { instrument: instrumentForTrack, duration: 0.4 });
              }}
            />
            <RoleLegend />

            {selected && selectedRole ? (
              <div className="rounded-xl border border-amber-300 bg-amber-50/60 p-3 text-sm dark:border-amber-500/40 dark:bg-amber-500/10">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold">
                    選んだ音符：{formatPitch(selected.pitch, { octaveConvention, style: 'unicode' })}
                    <span className="ml-2 text-xs font-normal text-slate-600 dark:text-slate-300">
                      {Math.floor(selected.startTick / TICKS_PER_BAR) + 1}小節目・{(selected.startTick % TICKS_PER_BAR) / TICKS_PER_BEAT + 1}拍目・長さ {selected.durationTick / TICKS_PER_BEAT}拍
                    </span>
                  </p>
                  <button type="button" onClick={() => setSelectedId(null)} className="text-xs text-slate-500 hover:underline">
                    選択をやめる
                  </button>
                </div>
                <p className="mt-1">
                  <span className="font-semibold">{NOTE_ROLE_LABEL_JA[selectedRole.role]}</span>
                  {selectedRole.chord && `（${formatChordSymbol(selectedRole.chord, { style: chordStyle, accidentals: 'unicode' })} に対して）`}：{ROLE_HELP[selectedRole.role]}
                </p>
                {!selectedRole.inScale && selectedRole.role !== 'outside' && (
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                    ※ 選んでいるスケールには含まれない音ですが、このコードの構成音なので自然に聞こえやすい音です。
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <ChoiceButton selected={false} onClick={() => updateSelected((n) => shiftNote(n, 1, ed.key))}>
                    ↑ 半音上
                  </ChoiceButton>
                  <ChoiceButton selected={false} onClick={() => updateSelected((n) => shiftNote(n, -1, ed.key))}>
                    ↓ 半音下
                  </ChoiceButton>
                  <ChoiceButton selected={false} onClick={() => updateSelected((n) => shiftNote(n, 12, ed.key))}>
                    1オクターブ上
                  </ChoiceButton>
                  <ChoiceButton selected={false} onClick={() => updateSelected((n) => shiftNote(n, -12, ed.key))}>
                    1オクターブ下
                  </ChoiceButton>
                  <ChoiceButton selected={false} onClick={() => updateSelected((n) => ({ ...n, startTick: Math.max(0, n.startTick - snap) }))}>
                    ← 前へ
                  </ChoiceButton>
                  <ChoiceButton selected={false} onClick={() => updateSelected((n) => ({ ...n, startTick: Math.min(lengthTicks - n.durationTick, n.startTick + snap) }))}>
                    後へ →
                  </ChoiceButton>
                  <ChoiceButton selected={false} onClick={() => updateSelected((n) => ({ ...n, durationTick: Math.max(snap, n.durationTick - snap) }))}>
                    短く
                  </ChoiceButton>
                  <ChoiceButton selected={false} onClick={() => updateSelected((n) => ({ ...n, durationTick: Math.min(lengthTicks - n.startTick, n.durationTick + snap) }))}>
                    長く
                  </ChoiceButton>
                  <ChoiceButton
                    selected={false}
                    onClick={() => {
                      setNotes(notes.filter((n) => n.id !== selected.id));
                      setSelectedId(null);
                    }}
                  >
                    🗑 削除
                  </ChoiceButton>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                ヒント：音符を押すと選べます。選んだ音符は、高さ・位置・長さを変えたり削除したりできます。背景の色は「その時のコードに対して、その高さの音がどんな役割か」の目安で、どの色の音を使っても構いません。
              </p>
            )}
            {notes.length > 0 && (
              <button
                type="button"
                onClick={() => window.confirm(`${track === 'melody' ? 'メロディー' : 'ベース'}の音符をすべて消しますか？`) && (setNotes([]), setSelectedId(null))}
                className="text-xs text-slate-500 hover:text-rose-600"
              >
                このパートの音符をすべて消す
              </button>
            )}
          </div>
        )}

        {tab === 'drums' && (
          <div className="mt-4 space-y-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              1小節分（16マス＝16分音符）のパターンを作ると、曲の全小節で繰り返します。マスを押すとオン・オフが切り替わります。
            </p>
            <div className="flex flex-wrap gap-1.5">
              {DRUM_PRESETS.map((p) => (
                <ChoiceButton key={p.id} selected={false} title={p.description} onClick={() => setPattern(p.pattern)}>
                  {p.name}
                </ChoiceButton>
              ))}
              <ChoiceButton selected={false} onClick={() => setPattern(emptyPattern())}>
                すべて消す
              </ChoiceButton>
            </div>
            <ul className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
              {DRUM_PRESETS.map((p) => (
                <li key={p.id}>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{p.name}</span>：{p.description}
                </li>
              ))}
            </ul>
            <DrumGrid
              pattern={pattern}
              onChange={setPattern}
              playingStep={playheadTick !== null ? Math.floor((playheadTick % TICKS_PER_BAR) / DRUM_TICKS) % STEPS_PER_BAR : null}
            />
          </div>
        )}
      </Card>
      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        曲の長さはコード進行の長さ（全 {totalBeats(ed.chords)} 拍）に合わせています（最低4小節）。MIDI ファイルとして FL Studio に持ち込む機能は Phase 8 で追加します。
      </p>
    </>
  );
}
