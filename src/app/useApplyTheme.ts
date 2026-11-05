import { useEffect } from 'react';
import { useSettings } from '@/stores/settingsStore';

/** 設定（システム／ライト／ダーク）に合わせて <html> に dark クラスを付け外しする */
export function useApplyTheme() {
  const theme = useSettings((s) => s.theme);

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && (media?.matches ?? false));
      document.documentElement.classList.toggle('dark', dark);
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0f172a' : '#f8fafc');
    };
    apply();
    if (theme !== 'system' || !media) return;
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
}
