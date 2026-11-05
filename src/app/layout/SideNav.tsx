import { NavLink } from 'react-router';
import { SIDE_NAV } from '@/app/navigation';

export function SideNav() {
  return (
    <nav
      aria-label="メインメニュー"
      className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="px-5 py-6">
        <p className="text-lg font-bold">🎶 音楽理論・作曲ラボ</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">理論を学んで、曲を作ろう</p>
      </div>
      <ul className="flex-1 space-y-1 overflow-y-auto px-3 pb-6">
        {SIDE_NAV.map((item) => (
          <li key={item.path}>
            <NavLink
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                  isActive
                    ? 'bg-brand-50 font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-400'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
                ].join(' ')
              }
            >
              <span aria-hidden="true" className="w-5 text-center">
                {item.icon}
              </span>
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
