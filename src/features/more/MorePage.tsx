import { Link } from 'react-router';
import { PageHeader } from '@/components/ui/PageHeader';
import { SIDE_NAV } from '@/app/navigation';

/** スマホ用：下部ナビに入りきらないメニューを含む、全メニューの一覧 */
export function MorePage() {
  return (
    <>
      <PageHeader icon="☰" title="すべてのメニュー" />
      <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
        {SIDE_NAV.map((item) => (
          <li key={item.path}>
            <Link to={item.path} className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800">
              <span aria-hidden="true" className="w-6 text-center text-xl">
                {item.icon}
              </span>
              <span className="flex-1">
                <span className="block text-sm font-semibold">{item.label}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">{item.description}</span>
              </span>
              <span aria-hidden="true" className="text-slate-400">
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
