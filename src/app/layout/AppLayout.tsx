import { Outlet, useLocation } from 'react-router';
import { useEffect } from 'react';
import { SideNav } from './SideNav';
import { BottomNav } from './BottomNav';
import { useApplyTheme } from '@/app/useApplyTheme';
import { useAudioSettings } from '@/audio/useAudioSettings';
import { useProgress } from '@/stores/progressStore';

/**
 * アプリ全体の枠組み。
 * - PC（画面幅 768px 以上）：左にサイドメニュー
 * - スマホ：画面下にナビゲーション
 */
export function AppLayout() {
  useApplyTheme();
  useAudioSettings();
  const loadProgress = useProgress((s) => s.load);
  useEffect(() => {
    void loadProgress();
  }, [loadProgress]);
  const { pathname } = useLocation();

  // 画面を移動したら一番上までスクロールを戻す
  useEffect(() => {
    document.getElementById('main-scroll')?.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="flex h-full">
      <SideNav />
      <main id="main-scroll" className="pt-safe min-w-0 flex-1 overflow-y-auto pb-24 md:pb-0">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-10">
          <Outlet />
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
