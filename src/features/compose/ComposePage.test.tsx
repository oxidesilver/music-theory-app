import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '@/app/routes';
import { db } from '@/storage/db';
import { useSettings } from '@/stores/settingsStore';
import { useEditor } from '@/features/progression/editorStore';
import { makeChord } from '@/features/progression/logic';
import { parseChordSymbol } from '@/theory/chord';
import { formatPitch } from '@/theory/pitch';

vi.mock('@/audio/engine', () => ({
  audio: {
    play: vi.fn(async () => {}),
    playDrum: vi.fn(async () => {}),
    chord: vi.fn(async () => {}),
    arpeggio: vi.fn(async () => {}),
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

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

// ピアノロールのマス目：1行 20px（メロディーは上が C6=84）、16分音符 1マス 22px
const ROW_H = 20;
const clickRoll = (name: string, top: number, midi: number, x = 5) =>
  fireEvent.click(screen.getByRole('group', { name }), { clientX: x, clientY: (top - midi) * ROW_H + ROW_H / 2 });

describe('メロディー・作曲画面', () => {
  beforeEach(async () => {
    await db.songs.clear();
    useEditor.getState().newSong();
    useEditor.getState().setChords(['C', 'G7'].map((c) => makeChord(parseChordSymbol(c))));
    useSettings.getState().reset();
    vi.clearAllMocks();
  });

  it('ピアノロールを押すと音符が置かれ、その時のコードに対する役割が表示される', async () => {
    renderAt('/compose');
    clickRoll('メロディーのピアノロール', 84, 64);
    const melody = useEditor.getState().melody;
    expect(melody).toHaveLength(1);
    expect(formatPitch(melody[0]!.pitch)).toBe('E4');
    expect(melody[0]!.startTick).toBe(0);
    expect(audio.play).toHaveBeenCalledWith(64, expect.anything());
    // FL Studio 式の表示
    expect(screen.getByText(/選んだ音符：E5/)).toBeInTheDocument();
    expect(screen.getByText('コードトーン', { selector: 'span.font-semibold' })).toBeInTheDocument();
    // 半音上げると F（C コードの11度＝注意が必要な音）
    await userEvent.click(screen.getByRole('button', { name: '↑ 半音上' }));
    expect(formatPitch(useEditor.getState().melody[0]!.pitch)).toBe('F4');
    expect(screen.getByText('注意が必要な音', { selector: 'span.font-semibold' })).toBeInTheDocument();
  });

  it('スケール外の音には、警告ではなく補足説明が出る', async () => {
    renderAt('/compose');
    clickRoll('メロディーのピアノロール', 84, 66); // F#
    expect(screen.getByText(/この音は現在選択しているスケールには含まれていません。ただし、経過音や装飾音として使用することもできます。/)).toBeInTheDocument();
  });

  it('音符の位置・長さの変更と削除', async () => {
    renderAt('/compose');
    clickRoll('メロディーのピアノロール', 84, 67);
    await userEvent.click(screen.getByRole('button', { name: '後へ →' }));
    await userEvent.click(screen.getByRole('button', { name: '長く' }));
    const n = useEditor.getState().melody[0]!;
    expect([n.startTick, n.durationTick]).toEqual([240, 720]);
    await userEvent.click(screen.getByRole('button', { name: '🗑 削除' }));
    expect(useEditor.getState().melody).toHaveLength(0);
  });

  it('ベース：コード進行からルート音を自動配置できる', async () => {
    renderAt('/compose');
    await userEvent.click(screen.getByRole('button', { name: /^🎸 ベース/ }));
    await userEvent.click(screen.getByRole('button', { name: 'ルートを伸ばす' }));
    expect(useEditor.getState().bass.map((n) => formatPitch(n.pitch))).toEqual(['C2', 'G2']);
    await userEvent.click(screen.getByRole('button', { name: '全体を1オクターブ上へ' }));
    expect(useEditor.getState().bass.map((n) => formatPitch(n.pitch))).toEqual(['C3', 'G3']);
  });

  it('ドラム：定番パターンを選ぶとマス目に反映され、マスを押して切り替えられる', async () => {
    renderAt('/compose');
    await userEvent.click(screen.getByRole('button', { name: /^🥁 ドラム/ }));
    await userEvent.click(screen.getByRole('button', { name: '4つ打ち' }));
    expect(screen.getByRole('button', { name: 'キック 1' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'キック 2' })).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(screen.getByRole('button', { name: 'キック 2' }));
    expect(screen.getByRole('button', { name: 'キック 2' })).toHaveAttribute('aria-pressed', 'true');
    expect(audio.playDrum).toHaveBeenCalledWith(36);
    // 4小節すべてに並ぶ（4つ打ち4回＋追加1回）× 4小節
    expect(useEditor.getState().drums.filter((d) => d.drum === 36)).toHaveLength(20);
  });

  it('再生すると、コード・メロディー・ベース・ドラムがまとめて音声エンジンに渡る', async () => {
    renderAt('/compose');
    clickRoll('メロディーのピアノロール', 84, 72);
    await userEvent.click(screen.getByRole('button', { name: /^🥁 ドラム/ }));
    await userEvent.click(screen.getByRole('button', { name: '8ビート' }));
    await userEvent.click(screen.getByRole('button', { name: '▶ 再生' }));
    const [events, , opts] = vi.mocked(audio.playSequence).mock.calls[0]!;
    expect(events.some((e) => e.instrument === 'synth' && e.midis[0] === 72)).toBe(true);
    expect(events.some((e) => e.drum === 38)).toBe(true);
    expect(opts).toEqual({ loop: true, lengthBeats: 16 });
  });

  it('保存すると、メロディー・ベース・ドラムも作品に保存され、作曲画面で開き直せる', async () => {
    renderAt('/compose');
    clickRoll('メロディーのピアノロール', 84, 64);
    await userEvent.click(screen.getByRole('button', { name: /^🎸 ベース/ }));
    await userEvent.click(screen.getByRole('button', { name: '1拍ごとにルート' }));
    await userEvent.click(screen.getByRole('button', { name: '💾 保存' }));
    await waitFor(async () => expect(await db.songs.count()).toBe(1));
    const saved = (await db.songs.toArray())[0]!;
    expect(saved.melody).toHaveLength(1);
    expect(saved.bass).toHaveLength(8);

    useEditor.getState().newSong();
    renderAt('/library');
    await userEvent.click(await screen.findByRole('button', { name: '作曲画面で開く' }));
    await waitFor(() => expect(useEditor.getState().melody).toHaveLength(1));
    expect(useEditor.getState().bass).toHaveLength(8);
  });

  it('キーを変えて移調すると、メロディーも一緒に移調される', () => {
    useEditor.getState().setTrack('melody', [{ id: 'n1', pitch: { letter: 'E', accidental: 0, octave: 4 }, startTick: 0, durationTick: 480, velocity: 100 }]);
    useEditor.getState().setKey({ tonic: { letter: 'D', accidental: 0 }, mode: 'major' }, true);
    expect(formatPitch(useEditor.getState().melody[0]!.pitch)).toBe('F#4');
    expect(useEditor.getState().chords.map((c) => c.root.letter)).toEqual(['D', 'A']);
  });


  it('3/4 の作品では、ドラムが12マスになり、ワルツのパターンを選べる', async () => {
    useEditor.getState().setTimeSignature([3, 4]);
    renderAt('/compose');
    expect(screen.getByText(/拍子：3\/4/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^🥁 ドラム/ }));
    expect(screen.getAllByRole('button', { name: /^キック \d+$/ })).toHaveLength(12);
    await userEvent.click(screen.getByRole('button', { name: 'ワルツ' }));
    expect(screen.getByRole('button', { name: 'キック 1' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'ハイハット（閉） 5' })).toHaveAttribute('aria-pressed', 'true');
  });
});
