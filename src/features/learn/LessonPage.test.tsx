import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '@/app/routes';
import { db } from '@/storage/db';
import { useProgress } from '@/stores/progressStore';
import { useSettings } from '@/stores/settingsStore';
import { CH1_LESSONS } from '@/content/lessons/ch1';

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
  },
}));
import { audio } from '@/audio/engine';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

describe('学習機能', () => {
  beforeEach(async () => {
    await db.lessonProgress.clear();
    await db.quizResults.clear();
    useProgress.setState({ loaded: false, progress: {}, quizResults: [] });
    useSettings.getState().reset();
    vi.clearAllMocks();
  });

  it('レッスン一覧に第1〜9章が並び、「準備中」の章は無い', async () => {
    renderAt('/learn');
    expect(await screen.findByText(/第1章.*音楽の基礎/)).toBeInTheDocument();
    expect(screen.getByText(/第9章.*実践的な作曲理論/)).toBeInTheDocument();
    expect(screen.queryAllByText('準備中')).toHaveLength(0);
  });

  it('レッスン画面に7つの構成（説明・図解・鍵盤と音・使用例・DTM・クイズ）が表示される', async () => {
    renderAt('/learn/ch1-l1');
    for (const title of ['理論の説明', '図解', '鍵盤と音で確かめる', '使用例', 'DTM（FL Studio）での活用', '理解度確認クイズ']) {
      expect(await screen.findByRole('heading', { name: new RegExp(title.replace(/[()（）]/g, '.')) })).toBeInTheDocument();
    }
  });

  it('音を鳴らすボタンで、C から C までのドレミが順番に鳴る', async () => {
    renderAt('/learn/ch1-l1');
    await userEvent.click(await screen.findByRole('button', { name: '▶ 順番に鳴らす' }));
    const [events] = vi.mocked(audio.playSequence).mock.calls[0]!;
    expect(events.map((e) => e.midis[0])).toEqual([60, 62, 64, 65, 67, 69, 71, 72]);
  });

  it('クイズに答えると正誤と解説が出て、最後まで答えるとレッスン完了として保存される', async () => {
    renderAt('/learn/ch1-l1');
    const lesson = CH1_LESSONS[0]!;
    for (const [i, q] of lesson.quiz.entries()) {
      await screen.findByText(`問題 ${i + 1} / ${lesson.quiz.length}`);
      // 1問目はわざと間違える
      const choice = i === 0 ? q.choices[(q.answer + 1) % q.choices.length]! : q.choices[q.answer]!;
      await userEvent.click(screen.getByRole('button', { name: new RegExp(`^${choice}$`) }));
      expect(await screen.findByText(i === 0 ? '不正解' : '正解！')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: i === lesson.quiz.length - 1 ? '結果を見る' : '次の問題へ' }));
    }
    expect(await screen.findByText(`${lesson.quiz.length}問中 ${lesson.quiz.length - 1}問 正解！`)).toBeInTheDocument();

    await waitFor(async () => expect((await db.lessonProgress.get('ch1-l1'))?.status).toBe('completed'));
    const results = await db.quizResults.where('lessonId').equals('ch1-l1').toArray();
    expect(results.map((r) => r.correct)).toEqual([false, true, true]);
  });

  it('完了したレッスンは一覧で ✅ になり、「続きから」は次のレッスンを指す', async () => {
    const now = new Date().toISOString();
    await db.lessonProgress.put({ lessonId: 'ch1-l1', status: 'completed', updatedAt: now, completedAt: now });
    renderAt('/learn');
    expect(await screen.findByRole('link', { name: /続きから学ぶ：ピアノ鍵盤の仕組み/ })).toHaveAttribute('href', '/learn/ch1-l2');
    expect(screen.getByText('1 / 67 レッスン完了')).toBeInTheDocument();
  });

  it('文章中の音名は設定に合わせて表示される（中央のド：FL Studio 式 C5 ／ 一般的な表記 C4）', async () => {
    renderAt('/learn/ch1-l5');
    expect(await screen.findByText(/今の設定では C5 と表示/)).toBeInTheDocument();
  });

  it('存在しないレッスンは「ページが見つかりません」', () => {
    renderAt('/learn/xxx');
    expect(screen.getByText('ページが見つかりません')).toBeInTheDocument();
  });

  it('学習履歴の画面に、間違えた問題が「苦手な問題」として表示される', async () => {
    await db.quizResults.add({ lessonId: 'ch1-l3', questionId: 'q1', correct: false, answeredAt: new Date().toISOString() });
    renderAt('/progress');
    const weakCard = (await screen.findByRole('heading', { name: '苦手な問題' })).parentElement!;
    expect(await within(weakCard).findByText('E と F の間の距離は？')).toBeInTheDocument();
    expect(within(weakCard).getByText(/正解 0\/1/)).toBeInTheDocument();
  });

  it('第4章：調号の一覧に、キーと ♯・♭ の数と平行調が表示される', async () => {
    renderAt('/learn/ch4-l4');
    const row = (await screen.findAllByText('Dメジャー'))[0]!.closest('tr')!;
    expect(row).toHaveTextContent('♯ 2個');
    expect(row).toHaveTextContent('F♯ C♯');
    expect(row).toHaveTextContent('Bマイナー');
  });

  it('第5章：コードの組み立ての図で種類を切り替えると、構成音と鳴らす音が変わる', async () => {
    renderAt('/learn/ch5-l2');
    await screen.findByTestId('builder-symbol');
    await userEvent.click(screen.getByRole('button', { name: 'ディミニッシュ' }));
    expect(screen.getByTestId('builder-symbol')).toHaveTextContent('Cdim');
    await userEvent.click(screen.getByRole('button', { name: '▶ 和音で鳴らす' }));
    expect(audio.chord).toHaveBeenCalledWith([60, 63, 66]);
  });

  it('第6章：ダイアトニック表でキーを切り替えると、コードが変わる（キー D）', async () => {
    renderAt('/learn/ch6-l2');
    const keys = await screen.findByLabelText('キー');
    await userEvent.click(within(keys).getByRole('button', { name: 'D' }));
    for (const c of ['D', 'Em', 'F♯m', 'G', 'A', 'Bm', 'C♯dim']) expect(screen.getByRole('button', { name: `${c.replace('♯', '#')} を鳴らす` })).toBeInTheDocument();
  });

  it('コード進行のデモは、コードを順番に鳴らす', async () => {
    renderAt('/learn/ch6-l5');
    await userEvent.click((await screen.findAllByRole('button', { name: '▶ 進行を鳴らす' }))[0]!);
    const [events] = vi.mocked(audio.playSequence).mock.calls[0]!;
    expect(events).toHaveLength(4);
    expect(events[0]!.midis).toEqual([60, 64, 67]);
  });
});
