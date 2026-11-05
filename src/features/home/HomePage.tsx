import { Link } from 'react-router';
import { Card } from '@/components/ui/Card';
import { NAV_ITEMS, SIDE_NAV } from '@/app/navigation';

export function HomePage() {
  const features = SIDE_NAV.filter((i) => i.path !== '/');

  return (
    <>
      <header className="mb-6">
        <p className="text-sm font-semibold text-brand-600 dark:text-brand-400">ようこそ</p>
        <h1 className="mt-1 text-2xl font-bold md:text-3xl">音楽理論・作曲ラボ</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          音楽理論を基礎から学んで、コード進行・メロディー作りに活かし、FL Studio へ持ち込むためのアプリです。
        </p>
      </header>

      <Card className="mb-6 bg-gradient-to-br from-brand-600 to-violet-600 text-white dark:from-brand-700 dark:to-violet-800">
        <p className="text-xs font-semibold tracking-wide opacity-80">はじめての方へ</p>
        <p className="mt-1 text-lg font-bold">まずは「第1章：音楽の基礎」から</p>
        <p className="mt-1 text-sm opacity-90">ドレミと C・D・E の関係、鍵盤の仕組みから順番に学べます。</p>
        <Link
          to={NAV_ITEMS.learn.path}
          className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-white px-4 text-sm font-semibold text-brand-700 hover:bg-brand-50"
        >
          学習をはじめる →
        </Link>
      </Card>

      <h2 className="mb-3 text-sm font-semibold text-slate-500 dark:text-slate-400">すべての機能</h2>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((item) => (
          <li key={item.path}>
            <Link
              to={item.path}
              className="flex h-full items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-brand-400 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-500"
            >
              <span aria-hidden="true" className="text-2xl">
                {item.icon}
              </span>
              <span>
                <span className="block font-semibold">{item.label}</span>
                <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{item.description}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
