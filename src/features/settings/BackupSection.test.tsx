import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '@/app/routes';
import { db } from '@/storage/db';
import { createBackup } from '@/storage/backup';
import { DEFAULT_SETTINGS, useSettings } from '@/stores/settingsStore';
import { SONG_SCHEMA_VERSION } from '@/storage/types';

vi.mock('@/audio/engine', () => ({
  audio: { play: vi.fn(), stop: vi.fn(), setVolume: vi.fn(), setDefaultInstrument: vi.fn(), subscribe: () => () => {}, isPlaying: false },
}));

const now = '2026-11-05T10:00:00.000Z';
const song = (id: string) => ({
  id,
  title: `作品${id}`,
  key: { tonic: { letter: 'C' as const, accidental: 0 }, mode: 'major' as const },
  bpm: 100,
  timeSignature: [4, 4] as [number, number],
  chords: [],
  melody: [],
  bass: [],
  drums: [],
  instruments: { chord: 'piano', melody: 'synth', bass: 'bass' },
  createdAt: now,
  updatedAt: now,
  schemaVersion: SONG_SCHEMA_VERSION,
});

function renderSettings() {
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/settings'] })} />);
}

describe('設定画面のバックアップと復元', () => {
  const created: Blob[] = [];
  beforeEach(async () => {
    await db.songs.clear();
    useSettings.getState().reset();
    created.length = 0;
    URL.createObjectURL = vi.fn((b: Blob) => {
      created.push(b);
      return 'blob:test';
    }) as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => vi.restoreAllMocks());

  it('「バックアップを作成」で JSON ファイルがダウンロードされる', async () => {
    await db.songs.put(song('1'));
    renderSettings();
    await userEvent.click(screen.getByRole('button', { name: /バックアップを作成/ }));
    await waitFor(() => expect(created).toHaveLength(1));
    const json = JSON.parse(await created[0]!.text());
    expect(json.app).toBe('music-theory-app');
    expect(json.data.songs).toHaveLength(1);
    expect(await screen.findByRole('status')).toHaveTextContent('バックアップファイルを作成しました');
  });

  it('ファイルを選ぶと内容の確認が出て、確認するまでデータは変わらない。「置き換え」では事前に自動バックアップされる', async () => {
    await db.songs.put(song('1'));
    const backup = await createBackup(DEFAULT_SETTINGS);
    backup.data.songs = [song('2'), song('3')];
    await db.songs.put(song('old'));
    renderSettings();

    const file = new File([JSON.stringify(backup)], 'backup.json', { type: 'application/json' });
    await userEvent.upload(screen.getByLabelText('バックアップファイルを選ぶ'), file);
    const confirmBox = await screen.findByLabelText('復元の確認');
    expect(confirmBox).toHaveTextContent('作品2 件');
    expect(await db.songs.count()).toBe(2); // まだ変わっていない

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await userEvent.click(screen.getByRole('radio', { name: /すべて置き換える/ }));
    await userEvent.click(screen.getByRole('button', { name: 'すべて置き換えて復元する' }));
    await waitFor(async () => expect((await db.songs.toArray()).map((s) => s.id).sort()).toEqual(['2', '3']));
    expect(window.confirm).toHaveBeenCalled();
    // 置き換える前の自動バックアップ
    expect(created).toHaveLength(1);
    expect(JSON.parse(await created[0]!.text()).data.songs).toHaveLength(2);
    // 復元のあと、記録の読み込み直しが終わってからメッセージが出るので、表示されるまで待つ
    expect(await screen.findByRole('status')).toHaveTextContent('復元しました');
  });

  it('確認で「キャンセル」するとデータは変わらない', async () => {
    const backup = await createBackup(DEFAULT_SETTINGS);
    backup.data.songs = [song('9')];
    renderSettings();
    await userEvent.upload(screen.getByLabelText('バックアップファイルを選ぶ'), new File([JSON.stringify(backup)], 'b.json'));
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    await userEvent.click(await screen.findByRole('button', { name: '追加して復元する' }));
    expect(await db.songs.count()).toBe(0);
  });

  it('壊れたファイルを選ぶと、理由が表示されて何も変わらない', async () => {
    renderSettings();
    await userEvent.upload(screen.getByLabelText('バックアップファイルを選ぶ'), new File(['{ 壊れたファイル'], 'bad.json'));
    expect(await screen.findByRole('status')).toHaveTextContent('壊れているか、JSON 形式ではありません');
    expect(screen.queryByLabelText('復元の確認')).not.toBeInTheDocument();
  });

  it('設定も復元できる（チェックしたときだけ）', async () => {
    const backup = await createBackup({ ...DEFAULT_SETTINGS, theme: 'dark', octaveConvention: 'standard' });
    renderSettings();
    await userEvent.upload(screen.getByLabelText('バックアップファイルを選ぶ'), new File([JSON.stringify(backup)], 'b.json'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await userEvent.click(await screen.findByRole('checkbox', { name: /設定（表示・音・表記）も復元する/ }));
    await userEvent.click(screen.getByRole('button', { name: '追加して復元する' }));
    await waitFor(() => expect(useSettings.getState().octaveConvention).toBe('standard'));
    expect(useSettings.getState().theme).toBe('dark');
  });
});
