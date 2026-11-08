import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '@/app/routes';
import { db } from '@/storage/db';
import { useSettings } from '@/stores/settingsStore';
import { chordsToEvents, eventsToChords, useEditor } from './editorStore';
import { makeChord } from './logic';
import { parseChordSymbol } from '@/theory/chord';

vi.mock('@/audio/engine', () => ({
  audio: {
    play: vi.fn(async () => {}),
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

const timeline = () => screen.getByRole('list', { name: '並べたコード' });
const chordNamesInTimeline = () => within(timeline()).getAllByRole('button').map((b) => b.getAttribute('aria-label')!.split(' ')[1]);

describe('保存用データの変換', () => {
  it('4拍 = 1920 tick（1拍 480）で、順番に並ぶ', () => {
    const chords = [makeChord(parseChordSymbol('C'), 4), makeChord(parseChordSymbol('G7'), 2), makeChord(parseChordSymbol('Am'), 8)];
    const events = chordsToEvents(chords);
    expect(events.map((e) => [e.startTick, e.durationTick])).toEqual([
      [0, 1920],
      [1920, 960],
      [2880, 3840],
    ]);
    expect(eventsToChords(events)).toEqual(chords);
  });
});

describe('コード進行メーカー', () => {
  beforeEach(async () => {
    await db.songs.clear();
    useEditor.getState().newSong();
    useSettings.getState().reset();
    vi.clearAllMocks();
  });

  it('候補のコードを押すと順番に並び、ローマ数字が表示される', async () => {
    renderAt('/progression');
    for (const name of ['C', 'Am', 'F', 'G']) {
      await userEvent.click(screen.getByRole('button', { name: new RegExp(`^${name}(Ⅰ|Ⅵm|Ⅳ|Ⅴ)$`) }));
    }
    expect(chordNamesInTimeline()).toEqual(['C', 'Am', 'F', 'G']);
    expect(within(timeline()).getByText('Ⅵm')).toBeInTheDocument();
  });

  it('再生ボタンで、ループ付き・BPM どおりに音声エンジンへ渡す', async () => {
    useEditor.getState().setChords([makeChord(parseChordSymbol('C')), makeChord(parseChordSymbol('G'))]);
    renderAt('/progression');
    await userEvent.click(screen.getByRole('button', { name: 'BPM を上げる' }));
    expect(screen.getByTestId('bpm')).toHaveTextContent('101');
    await userEvent.click(screen.getByRole('button', { name: '▶ 再生' }));
    const [events, bpm, opts] = vi.mocked(audio.playSequence).mock.calls[0]!;
    expect(bpm).toBe(101);
    expect(opts).toEqual({ loop: true, lengthBeats: 8 });
    expect(events.filter((e) => e.instrument === 'bass')).toHaveLength(2);
  });

  it('選んだコードの複製・削除・並べ替え・長さの変更', async () => {
    useEditor.getState().setChords(['C', 'F', 'G'].map((c) => makeChord(parseChordSymbol(c))));
    renderAt('/progression');
    await userEvent.click(within(timeline()).getByRole('button', { name: '2番目 F' }));
    await userEvent.click(screen.getByRole('button', { name: '複製' }));
    expect(chordNamesInTimeline()).toEqual(['C', 'F', 'F', 'G']);
    await userEvent.click(screen.getByRole('button', { name: '後へ ▶' }));
    await userEvent.click(screen.getByRole('button', { name: '🗑 削除' }));
    expect(chordNamesInTimeline()).toEqual(['C', 'F', 'G']);
    await userEvent.click(within(timeline()).getByRole('button', { name: '1番目 C' }));
    await userEvent.click(screen.getByRole('button', { name: '◀ 前へ' })); // 先頭なので動かない
    await userEvent.click(screen.getByRole('button', { name: /2拍/ }));
    expect(useEditor.getState().chords.map((c) => c.durationBeats)).toEqual([2, 4, 4]);
  });

  it('マイナーキーではハーモニックマイナー由来のコードが候補に出る', async () => {
    renderAt('/progression');
    await userEvent.click(screen.getByRole('button', { name: 'マイナー' }));
    expect(screen.getByText('ハーモニックマイナー由来')).toBeInTheDocument();
  });

  it('定番進行を「使う」と並び替わる（キー C の王道進行）', async () => {
    renderAt('/progression');
    await userEvent.click(screen.getByRole('button', { name: '定番進行' }));
    const item = screen.getByText('王道進行').closest('li')!;
    await userEvent.click(within(item).getByRole('button', { name: '使う' }));
    expect(chordNamesInTimeline()).toEqual(['F△7', 'G7', 'Em7', 'Am']);
  });

  it('保存すると端末に保存され、保存した作品の一覧に表示され、開き直せる', async () => {
    renderAt('/progression');
    await userEvent.clear(screen.getByRole('textbox', { name: '作品名' }));
    await userEvent.type(screen.getByRole('textbox', { name: '作品名' }), 'テスト進行');
    await userEvent.click(screen.getByRole('button', { name: /^CⅠ$/ }));
    await userEvent.click(screen.getByRole('button', { name: /^GⅤ$/ }));
    await userEvent.click(screen.getByRole('button', { name: '💾 保存' }));
    await waitFor(async () => expect(await db.songs.count()).toBe(1));
    const saved = (await db.songs.toArray())[0]!;
    expect(saved.title).toBe('テスト進行');
    expect(saved.chords.map((c) => c.durationTick)).toEqual([1920, 1920]);

    useEditor.getState().newSong();
    renderAt('/library');
    expect(await screen.findByText('テスト進行')).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: '開く' })[0]!);
    await waitFor(() => expect(useEditor.getState().songId).toBe(saved.id));
    expect(useEditor.getState().chords.map((c) => c.quality)).toEqual(['maj', 'maj']);
  });

  it('存在しない作品の URL では案内を表示する', async () => {
    renderAt('/progression/nothing');
    expect(await screen.findByText('作品が見つかりませんでした。')).toBeInTheDocument();
  });

  it('コード辞典から「コード進行に追加」できる', async () => {
    const router = renderAt('/chords/D/m7');
    await userEvent.click(screen.getByRole('button', { name: '＋ コード進行に追加' }));
    expect(router.state.location.pathname).toBe('/progression');
    expect(chordNamesInTimeline()).toEqual(['Dm7']);
  });

  it('拍子を 3/4 にすると、コードは1小節＝3拍で追加され、長さの選択肢も変わる', async () => {
    renderAt('/progression');
    await userEvent.click(within(screen.getByRole('group', { name: '拍子' })).getByRole('button', { name: '3/4' }));
    await userEvent.click(screen.getByRole('button', { name: /^CⅠ$/ }));
    expect(useEditor.getState().chords[0]!.durationBeats).toBe(3);
    expect(screen.getByRole('button', { name: '3拍（1小節）' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/拍子 3\/4・全 3 拍（1 小節）/)).toBeInTheDocument();
  });

  it('拍子を変えると、1小節ちょうどのコードは新しい拍子の1小節に合わせ、ドラムは消える（確認あり）', async () => {
    useEditor.getState().setChords([makeChord(parseChordSymbol('C'), 4), makeChord(parseChordSymbol('G'), 2)]);
    useEditor.getState().setDrums([{ id: 'd', drum: 36, startTick: 0, durationTick: 120, velocity: 100 }]);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderAt('/progression');
    await userEvent.click(within(screen.getByRole('group', { name: '拍子' })).getByRole('button', { name: '6/8' }));
    expect(confirmSpy).toHaveBeenCalled();
    expect(useEditor.getState().timeSignature).toEqual([6, 8]);
    expect(useEditor.getState().chords.map((c) => c.durationBeats)).toEqual([3, 2]);
    expect(useEditor.getState().drums).toEqual([]);
    confirmSpy.mockRestore();
  });

  it('拍子は保存され、開き直しても元に戻る', async () => {
    useEditor.getState().setTimeSignature([3, 4]);
    useEditor.getState().add(parseChordSymbol('C'));
    const id = await useEditor.getState().save();
    expect((await db.songs.get(id))?.timeSignature).toEqual([3, 4]);
    useEditor.getState().newSong();
    expect(useEditor.getState().timeSignature).toEqual([4, 4]);
    await useEditor.getState().load(id);
    expect(useEditor.getState().timeSignature).toEqual([3, 4]);
  });
});
