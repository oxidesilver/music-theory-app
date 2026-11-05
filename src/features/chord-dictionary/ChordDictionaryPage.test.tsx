import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '@/app/routes';
import { useSettings } from '@/stores/settingsStore';
import { db } from '@/storage/db';

vi.mock('@/audio/engine', () => ({
  audio: {
    play: vi.fn(async () => {}),
    chord: vi.fn(async () => {}),
    arpeggio: vi.fn(async () => {}),
    stop: vi.fn(),
    setVolume: vi.fn(),
    setDefaultInstrument: vi.fn(),
    subscribe: () => () => {},
    isPlaying: false,
  },
}));
import { audio } from '@/audio/engine';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

const symbol = () => screen.getByTestId('chord-symbol').textContent;

describe('コード辞典', () => {
  beforeEach(async () => {
    useSettings.getState().reset();
    vi.clearAllMocks();
    await db.favorites.clear();
  });

  it('URL で指定したコード（F#m7）を表示し、構成音は F♯・A・C♯・E', () => {
    renderAt('/chords/F%23/m7');
    expect(symbol()).toBe('F♯m7');
    const table = screen.getByRole('table');
    const cells = within(table).getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[1]!.textContent);
    expect(cells.map((c) => c!.split('（')[0]!.trim())).toEqual(['F♯', 'A', 'C♯', 'E']);
    expect(within(table).getByText('短3度')).toBeInTheDocument();
    expect(within(table).getByText('短7度')).toBeInTheDocument();
  });

  it('何も指定しないと C メジャーを表示する', () => {
    renderAt('/chords');
    expect(symbol()).toBe('C');
  });

  it('コードの種類を選ぶと表示が変わる（日本式は △7）', async () => {
    renderAt('/chords/C/maj');
    await userEvent.click(screen.getByRole('button', { name: 'C△7' }));
    expect(symbol()).toBe('C△7');
  });

  it('英米式の設定では maj7 と表示する', () => {
    useSettings.getState().update({ romanStyle: 'english' });
    renderAt('/chords/C/maj7');
    expect(symbol()).toBe('Cmaj7');
  });

  it('ルートを選ぶと表示が変わる', async () => {
    renderAt('/chords/C/m7');
    await userEvent.click(screen.getByRole('button', { name: 'B♭' }));
    expect(symbol()).toBe('B♭m7');
  });

  it('「和音で鳴らす」で構成音の MIDI 番号が音声エンジンに渡る（F#m7 = 66, 69, 73, 76）', async () => {
    renderAt('/chords/F%23/m7');
    await userEvent.click(screen.getByRole('button', { name: /和音で鳴らす/ }));
    expect(audio.chord).toHaveBeenCalledWith([66, 69, 73, 76], expect.anything());
  });

  it('転回形を選ぶと、一番下の音が変わる（C の第1転回形 = E・G・C）', async () => {
    renderAt('/chords/C/maj');
    await userEvent.click(screen.getByRole('button', { name: '第1転回形' }));
    await userEvent.click(screen.getByRole('button', { name: /和音で鳴らす/ }));
    expect(audio.chord).toHaveBeenCalledWith([64, 67, 72], expect.anything());
  });

  it('11th では「よく弾かれる形」を選べる（3度を省く）', async () => {
    renderAt('/chords/C/11');
    await userEvent.click(screen.getByRole('button', { name: 'よく弾かれる形' }));
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    expect(rows).toHaveLength(1 + 5);
  });

  it('お気に入りに追加すると端末に保存される', async () => {
    renderAt('/chords/A/m7');
    await userEvent.click(screen.getByRole('button', { name: /お気に入りに追加/ }));
    await waitFor(async () => expect(await db.favorites.get('A|m7')).toBeTruthy());
    expect(await screen.findByRole('button', { name: /お気に入り済み/ })).toBeInTheDocument();
  });

  it('音の高さの表示は FL Studio 式（中央のド = C5）', () => {
    renderAt('/chords/C/maj');
    const section = screen.getByRole('heading', { name: '音の高さ' }).parentElement!;
    expect(within(section).getByRole('button', { name: 'C5' })).toHaveAttribute('aria-pressed', 'true');
    // 鍵盤の中央のドにも C5 と書かれている
    expect(screen.getByRole('group', { name: 'C の鍵盤' })).toHaveTextContent('C5');
  });
});
