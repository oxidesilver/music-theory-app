import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '@/app/routes';
import { db } from '@/storage/db';
import { useSettings } from '@/stores/settingsStore';
import { useEarRecords } from './stats';
import { SESSION_LENGTH } from './EarTrainingPage';

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

describe('耳トレーニング画面', () => {
  beforeEach(async () => {
    await db.earTraining.clear();
    useEarRecords.setState({ loaded: false, records: [] });
    useSettings.getState().reset();
    vi.clearAllMocks();
  });

  it('3つのレベルと問題の種類が並ぶ', async () => {
    renderAt('/ear');
    expect(screen.getByText('レベル1：音程')).toBeInTheDocument();
    expect(screen.getByText('レベル2：コード')).toBeInTheDocument();
    expect(screen.getByText('レベル3：コード進行')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /長3度と短3度/ })).toBeInTheDocument();
  });

  it('音を聴くまでは答えられず、聴いて答えると正誤と解説が出て、記録が保存される。10問で結果が出る', async () => {
    renderAt('/ear');
    await userEvent.click(screen.getByRole('button', { name: /長3度と短3度/ }));
    const choice = () => screen.getByRole('button', { name: /^(✅|❌)?長3度$/ });
    expect(choice()).toBeDisabled();

    for (let i = 0; i < SESSION_LENGTH; i++) {
      expect(screen.getByText(`問題 ${i + 1} / ${SESSION_LENGTH}`)).toBeInTheDocument();
      if (i === 0) await userEvent.click(screen.getByRole('button', { name: '▶ 音を聴く' }));
      await userEvent.click(choice());
      expect(await screen.findByRole('status')).toHaveTextContent(/正解！|不正解/);
      expect(screen.getByText('選択肢の音を聴き比べる')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: i === SESSION_LENGTH - 1 ? '結果を見る' : '次の問題へ' }));
    }
    expect(await screen.findByText(new RegExp(`${SESSION_LENGTH}問中 \\d+問 正解！`))).toBeInTheDocument();
    // 音を聴く1回 ＋「次の問題へ」で9回、自動で次の問題の音が鳴る
    expect(vi.mocked(audio.compare).mock.calls.length).toBe(SESSION_LENGTH);
    await waitFor(async () => expect(await db.earTraining.count()).toBe(SESSION_LENGTH));
    const records = await db.earTraining.toArray();
    expect(records.every((r) => r.questionType === 'thirds' && r.level === 1 && r.answered === '長3度')).toBe(true);
    expect(records.every((r) => r.correct === (r.asked === '長3度'))).toBe(true);
  });

  it('コードの問題では和音が鳴る', async () => {
    renderAt('/ear');
    await userEvent.click(screen.getByRole('button', { name: /4種類の3和音/ }));
    await userEvent.click(screen.getByRole('button', { name: '▶ 音を聴く' }));
    expect(audio.chord).toHaveBeenCalledTimes(1);
    expect(vi.mocked(audio.chord).mock.calls[0]![0]).toHaveLength(3);
  });

  it('学習履歴の画面に耳トレーニングの成績が出る', async () => {
    const now = new Date().toISOString();
    await db.earTraining.bulkAdd([
      { level: 1, questionType: 'thirds', asked: '長3度', answered: '長3度', correct: true, answeredAt: now },
      { level: 1, questionType: 'thirds', asked: '短3度', answered: '長3度', correct: false, answeredAt: now },
    ]);
    renderAt('/progress');
    expect(await screen.findByText('長3度と短3度')).toBeInTheDocument();
    // レベル1の正答率と、「長3度と短3度」の正答率の2か所に 50% と出る
    expect(screen.getAllByText('50%')).toHaveLength(2);
  });
});
