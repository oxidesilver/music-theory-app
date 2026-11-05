import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from './routes';
import { SIDE_NAV } from './navigation';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

describe('画面の表示と移動', () => {
  it('ホーム画面が表示される', () => {
    renderAt('/');
    expect(screen.getByRole('heading', { level: 1, name: '音楽理論・作曲ラボ' })).toBeInTheDocument();
  });

  it('サイドメニューに10個のメニューがある', () => {
    renderAt('/');
    const nav = screen.getByRole('navigation', { name: 'メインメニュー' });
    expect(within(nav).getAllByRole('link')).toHaveLength(10);
  });

  it('下部メニューに5個のメニューがある', () => {
    renderAt('/');
    const nav = screen.getByRole('navigation', { name: '下部メニュー' });
    expect(within(nav).getAllByRole('link')).toHaveLength(5);
  });

  it.each(SIDE_NAV.filter((i) => i.path !== '/'))('「$label」の画面に移動できる', async (item) => {
    const router = renderAt('/');
    const nav = screen.getByRole('navigation', { name: 'メインメニュー' });
    await userEvent.click(within(nav).getByRole('link', { name: new RegExp(item.label) }));
    expect(router.state.location.pathname).toBe(item.path);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(item.label);
  });

  it('存在しない URL では「ページが見つかりません」と表示される', () => {
    renderAt('/does-not-exist');
    expect(screen.getByText('ページが見つかりません')).toBeInTheDocument();
  });

  it('設定画面で画面の明るさを「ダーク」に変えると、ダークモードになる', async () => {
    renderAt('/settings');
    await userEvent.click(screen.getByRole('radio', { name: 'ダーク' }));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    await userEvent.click(screen.getByRole('radio', { name: 'ライト' }));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
