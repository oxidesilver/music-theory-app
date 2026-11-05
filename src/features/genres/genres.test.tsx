import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { Midi } from '@tonejs/midi';
import { routes } from '@/app/routes';
import { db } from '@/storage/db';
import { useSettings } from '@/stores/settingsStore';
import { GENRES, findGenre } from '@/content/genres';
import { useEditor } from '@/features/progression/editorStore';
import { chordHits, TICKS_PER_BAR } from '@/features/compose/logic';
import { makeChord } from '@/features/progression/logic';
import { midiBytes } from '@/midi/exportMidi';
import { sourceFromEditor } from '@/midi/source';
import { formatChordSymbol, parseChordSymbol } from '@/theory/chord';
import { realizeSample, useGenreProgress } from './logic';

vi.mock('@/audio/engine', () => ({
  audio: {
    play: vi.fn(async () => {}),
    playDrum: vi.fn(async () => {}),
    chord: vi.fn(async () => {}),
    compare: vi.fn(async () => {}),
    playSequence: vi.fn(async () => 1),
    stop: vi.fn(),
    setVolume: vi.fn(),
    setDefaultInstrument: vi.fn(),
    subscribe: () => () => {},
    isPlaying: false,
    positionSeconds: null,
  },
}));
import { audio } from '@/audio/engine';

const REQUIRED_SECTIONS = ['ジャンルの特徴', 'リズムの特徴', 'コード進行の傾向', '使用するスケールの傾向', 'ベースラインの特徴', 'メロディーの特徴', 'アレンジの特徴', '音色の特徴'];

describe('ジャンルの教材データ', () => {
  it('指示書の7ジャンルが順番どおりにある', () => {
    expect(GENRES.map((g) => g.name)).toEqual(['ジャパレゲ', 'ダンスホール', 'EDM', 'HIPHOP', 'R&B', 'ポップス', 'ロック']);
  });

  it.each(GENRES.map((g) => [g.name, g] as const))('%s：必要な学習内容・BPM・リズム・サンプルがそろっている', (_, g) => {
    expect(g.sections.map((s) => s.title)).toEqual(REQUIRED_SECTIONS);
    expect(g.bpm.min).toBeLessThan(g.bpm.max);
    expect(g.rhythms.length).toBeGreaterThanOrEqual(2);
    expect(g.samples.length).toBeGreaterThanOrEqual(2);
    expect(g.exercises.length).toBeGreaterThan(0);
    for (const s of g.samples) {
      expect(g.rhythms.some((r) => r.id === s.rhythm), s.id).toBe(true);
      expect(s.bpm).toBeGreaterThanOrEqual(40);
      expect(s.bpm).toBeLessThanOrEqual(240);
      const song = realizeSample(g, s);
      expect(song.chords).toHaveLength(s.romans.length);
      expect(song.bass.length).toBeGreaterThan(0);
    }
  });

  const chords = (genre: string, sample: string) => {
    const g = findGenre(genre)!;
    return realizeSample(g, g.samples.find((s) => s.id === sample)!).chords.map((c) => formatChordSymbol(c)).join(' ');
  };

  it('サンプル進行のコードがローマ数字どおり（理論エンジンで計算）', () => {
    expect(chords('japareggae', 'minor-loop')).toBe('Am F G Am');
    expect(chords('japareggae', 'major-steppers')).toBe('G A F#m Bm');
    expect(chords('rock', 'flat-seven')).toBe('A G D A');
    expect(chords('rnb', 'two-five')).toBe('Fm7 Bb7 Ebmaj7 Cm7');
    expect(chords('hiphop', 'trap-loop')).toBe('Cm Ab Fm G');
    expect(chords('pops', 'oudou')).toBe('Fmaj7 G7 Em7 Am');
    expect(chords('edm', 'minor-loop')).toBe('Fm Db Ab Eb');
  });

  it('ワンドロップは、各小節の3拍目だけにキックがある', () => {
    const g = findGenre('japareggae')!;
    const song = realizeSample(g, g.samples[0]!);
    expect(song.drums.filter((d) => d.drum === 36).map((d) => d.startTick)).toEqual([0, 1, 2, 3].map((bar) => bar * TICKS_PER_BAR + 960));
    expect(song.chordRhythm).toBe('offbeat');
  });
});

describe('コードの鳴らし方（裏打ちなど）', () => {
  const prog = [makeChord(parseChordSymbol('C'), 4)];
  it('伸ばす・4分で刻む・裏打ち', () => {
    expect(chordHits(prog, 'sustain').map((h) => [h.start, h.duration])).toEqual([[0, 1920]]);
    expect(chordHits(prog, 'quarter').map((h) => h.start)).toEqual([0, 480, 960, 1440]);
    expect(chordHits(prog, 'offbeat').map((h) => [h.start, h.duration])).toEqual([
      [240, 120],
      [720, 120],
      [1200, 120],
      [1680, 120],
    ]);
  });
  it('MIDI にも鳴らし方が反映される', () => {
    const g = findGenre('japareggae')!;
    const song = realizeSample(g, g.samples[0]!);
    const m = new Midi(midiBytes(sourceFromEditor(song)));
    const starts = [...new Set(m.tracks.find((t) => t.name === 'Chord')!.notes.map((n) => n.ticks))].slice(0, 4);
    expect(starts).toEqual([240, 720, 1200, 1680]);
  });
});

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

describe('ジャンル別作曲講座の画面', () => {
  beforeEach(async () => {
    await db.genreProgress.clear();
    useGenreProgress.setState({ loaded: false, progress: {} });
    useEditor.getState().newSong();
    useSettings.getState().reset();
    vi.clearAllMocks();
  });

  it('一覧に7ジャンルが並び、開くと特徴とリズムの聴き比べが表示される', async () => {
    renderAt('/genres');
    expect(screen.getAllByRole('link', { name: /BPM の目安/ })).toHaveLength(7);
    await userEvent.click(screen.getByRole('link', { name: /ジャパレゲ/ }));
    expect(screen.getByRole('heading', { level: 1, name: /ジャパレゲ/ })).toBeInTheDocument();
    for (const t of REQUIRED_SECTIONS) expect(screen.getByRole('heading', { name: t })).toBeInTheDocument();
    expect(screen.getByText('ワンドロップ')).toBeInTheDocument();
    expect(screen.getByText('ステッパーズ')).toBeInTheDocument();
    // 開いただけで「特徴を読んだ」が記録される
    await waitFor(async () => expect((await db.genreProgress.get('japareggae'))?.completedItems).toContain('read'));
  });

  it('リズムを聴くとループ再生され、「リズムを聴き比べた」が記録される', async () => {
    renderAt('/genres/japareggae');
    const item = screen.getByText('ワンドロップ').closest('li')!;
    await userEvent.click(within(item).getByRole('button', { name: '▶ 聴く' }));
    const [events, bpm, opts] = vi.mocked(audio.playSequence).mock.calls[0]!;
    expect(bpm).toBe(80);
    expect(opts).toMatchObject({ loop: true });
    expect(events.some((e) => e.drum === 38)).toBe(true);
    await waitFor(async () => expect((await db.genreProgress.get('japareggae'))?.completedItems).toContain('rhythm'));
  });

  it('「このサンプルで作曲を始める」で作曲画面に移動し、コード・BPM・ドラム・ベースが入っている', async () => {
    const router = renderAt('/genres/edm');
    await userEvent.click(screen.getAllByRole('button', { name: '🎵 このサンプルで作曲を始める' })[0]!);
    expect(router.state.location.pathname).toBe('/compose');
    const ed = useEditor.getState();
    expect(ed.bpm).toBe(126);
    expect(ed.chords.map((c) => formatChordSymbol(c))).toEqual(['Fm', 'Db', 'Ab', 'Eb']);
    expect(ed.drums.filter((d) => d.drum === 36)).toHaveLength(16);
    expect(ed.bass.length).toBeGreaterThan(0);
    expect(ed.title).toContain('EDM');
    await waitFor(async () => expect((await db.genreProgress.get('edm'))?.completedItems).toContain('compose'));
  });

  it('存在しないジャンルは「ページが見つかりません」', () => {
    renderAt('/genres/jazz');
    expect(screen.getByText('ページが見つかりません')).toBeInTheDocument();
  });
});
