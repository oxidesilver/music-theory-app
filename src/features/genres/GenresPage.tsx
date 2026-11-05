import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { SoundHint } from '@/components/ui/SoundHint';
import { NAV_ITEMS } from '@/app/navigation';
import { audio } from '@/audio/engine';
import { useIsPlaying } from '@/audio/useIsPlaying';
import { useSettings } from '@/stores/settingsStore';
import { GENRES, GENRE_ITEMS, findGenre, type Genre, type GenreSample, type RhythmExample } from '@/content/genres';
import { CHORD_RHYTHMS, BASS_PATTERNS, DRUM_LANES } from '@/features/compose/logic';
import { useEditor } from '@/features/progression/editorStore';
import { formatChordSymbol } from '@/theory/chord';
import { keyName } from '@/theory/key';
import { RichText } from '@/features/learn/RichText';
import { NotFoundPage } from '@/features/NotFoundPage';
import { realizeSample, rhythmOf, sampleSequence, useGenreProgress } from './logic';

function useLoadGenreProgress() {
  const { loaded, load } = useGenreProgress();
  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);
}

export function GenresPage() {
  const { genreId } = useParams();
  useLoadGenreProgress();
  if (genreId) {
    const genre = findGenre(genreId);
    return genre ? <GenreDetail genre={genre} /> : <NotFoundPage />;
  }
  return <GenreIndex />;
}

function GenreIndex() {
  const progress = useGenreProgress((s) => s.progress);
  return (
    <>
      <PageHeader
        icon={NAV_ITEMS.genres.icon}
        title={NAV_ITEMS.genres.label}
        description="ジャンルごとの特徴を学び、サンプルのリズムやコード進行を聴き比べて、そのまま作曲を始められます。"
      />
      <ul className="grid gap-3 sm:grid-cols-2">
        {GENRES.map((g) => {
          const done = progress[g.id]?.completedItems.length ?? 0;
          return (
            <li key={g.id}>
              <Link to={`/genres/${g.id}`} className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 hover:border-brand-400 dark:border-slate-800 dark:bg-slate-900">
                <span className="text-lg font-bold">
                  <span aria-hidden="true">{g.icon}</span> {g.name}
                </span>
                <span className="mt-1 text-xs text-slate-500 dark:text-slate-400">BPM の目安：{g.bpm.min}〜{g.bpm.max}</span>
                <span className="mt-2 line-clamp-3 text-sm text-slate-600 dark:text-slate-300">{g.summary}</span>
                <span className="mt-2 text-xs text-brand-600 dark:text-brand-400">
                  学習 {done} / {GENRE_ITEMS.length}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
        ※ 各ジャンルの特徴は、そのジャンルの曲でよく見られる「傾向」です。1つの BPM やコード進行が、そのジャンルの絶対的な特徴というわけではありません。
      </p>
    </>
  );
}

function rhythmSummary(r: RhythmExample) {
  const drums = DRUM_LANES.filter((l) => (r.drums[l.drum] ?? []).length > 0).map((l) => l.name);
  return `ドラム：${drums.length ? drums.join('・') : 'なし'}／コード：${CHORD_RHYTHMS.find((c) => c.id === r.chordRhythm)!.label}／ベース：${BASS_PATTERNS.find((b) => b.id === r.bass)!.label}`;
}

function GenreDetail({ genre }: { genre: Genre }) {
  const navigate = useNavigate();
  const style = useSettings((s) => s.romanStyle);
  const playing = useIsPlaying();
  const progress = useGenreProgress((s) => s.progress[genre.id]);
  const mark = useGenreProgress((s) => s.mark);
  const [playingId, setPlayingId] = useState<string | null>(null);

  useEffect(() => {
    void mark(genre.id, 'read');
  }, [genre.id, mark]);
  useEffect(() => () => audio.stop(), []);
  useEffect(() => {
    if (!playing) setPlayingId(null);
  }, [playing]);

  const play = (id: string, sample: GenreSample, rhythm?: RhythmExample) => {
    const seq = sampleSequence(genre, sample, rhythm);
    void audio.playSequence(seq.events, seq.bpm, { loop: true, lengthBeats: seq.lengthBeats });
    setPlayingId(id);
  };

  const startComposing = (sample: GenreSample) => {
    const ed = useEditor.getState();
    if (ed.dirty && !window.confirm('作業中の作品に保存していない変更があります。サンプルで新しく作曲を始めますか？')) return;
    audio.stop();
    ed.replaceSong(realizeSample(genre, sample));
    void mark(genre.id, 'compose');
    navigate('/compose');
  };

  const stopButton = (id: string) =>
    playingId === id && playing ? (
      <button type="button" onClick={() => audio.stop()} className="min-h-10 rounded-lg bg-slate-800 px-3 text-sm font-semibold text-white dark:bg-slate-200 dark:text-slate-900">
        ■ 停止
      </button>
    ) : null;

  const firstSample = genre.samples[0]!;

  return (
    <>
      <nav className="mb-3 text-xs text-slate-500 dark:text-slate-400">
        <Link to="/genres" className="hover:underline">
          ジャンル別作曲講座
        </Link>
        {' › '}
        {genre.name}
      </nav>
      <PageHeader icon={genre.icon} title={genre.name} description={genre.summary} />

      <Card className="mb-4">
        <p className="text-sm">
          <span className="font-semibold">よく使われる BPM の目安：</span>
          {genre.bpm.min}〜{genre.bpm.max}
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{genre.bpm.note}</p>
        <ul className="mt-3 flex flex-wrap gap-2 text-xs">
          {GENRE_ITEMS.map((i) => {
            const done = progress?.completedItems.includes(i.id);
            return (
              <li key={i.id} className={`rounded-full px-2.5 py-1 ${done ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>
                {done ? '✓' : '○'} {i.label}
              </li>
            );
          })}
        </ul>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {genre.sections.map((s) => (
          <Card key={s.title}>
            <h2 className="font-bold">{s.title}</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed">
              {s.points.map((p) => (
                <li key={p}>
                  <RichText text={p} />
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      <Card className="mt-4">
        <h2 className="font-bold">リズムを聴き比べる</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          同じコード進行（{firstSample.name}：{keyName(realizeSample(genre, firstSample).key, 'unicode')}・BPM {firstSample.bpm}）で、リズムだけを変えて鳴らします。
        </p>
        <ul className="mt-3 space-y-2">
          {genre.rhythms.map((r) => (
            <li key={r.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{r.name}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{r.description}</p>
                  <p className="text-xs text-slate-500">{rhythmSummary(r)}</p>
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      play(`rhythm-${r.id}`, firstSample, r);
                      void mark(genre.id, 'rhythm');
                    }}
                    className="min-h-10 rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-700"
                  >
                    ▶ 聴く
                  </button>
                  {stopButton(`rhythm-${r.id}`)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="mt-4">
        <h2 className="font-bold">サンプル進行</h2>
        <ul className="mt-3 space-y-2">
          {genre.samples.map((s) => {
            const song = realizeSample(genre, s);
            return (
              <li key={s.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <p className="font-semibold">{s.name}</p>
                <p className="text-sm">
                  {keyName(song.key, 'unicode')}・BPM {s.bpm}：{song.chords.map((c) => formatChordSymbol(c, { style, accidentals: 'unicode' })).join(' → ')}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {s.description}（{s.romans.join(' – ')}）
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      play(`sample-${s.id}`, s);
                      void mark(genre.id, 'sample');
                    }}
                    className="min-h-10 rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-700"
                  >
                    ▶ 聴く
                  </button>
                  {stopButton(`sample-${s.id}`)}
                  <button
                    type="button"
                    onClick={() => startComposing(s)}
                    className="min-h-10 rounded-lg border border-brand-500 px-3 text-sm font-semibold text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10"
                  >
                    🎵 このサンプルで作曲を始める
                  </button>
                </div>
                <p className="mt-1 text-xs text-slate-500">リズム：{rhythmOf(genre, s).name}</p>
              </li>
            );
          })}
        </ul>
        <div className="mt-2">
          <SoundHint />
        </div>
      </Card>

      <Card className="mt-4">
        <h2 className="font-bold">実践課題</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
          {genre.exercises.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ol>
      </Card>

      <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
        ※ ここに書いた特徴は、{genre.name}の曲でよく見られる傾向です。曲やアーティストによって大きく異なり、これに当てはまらない曲もたくさんあります。
      </p>
    </>
  );
}
