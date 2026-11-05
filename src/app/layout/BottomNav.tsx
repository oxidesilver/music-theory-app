import { NavLink, useLocation } from 'react-router';
import { BOTTOM_NAV, SIDE_NAV } from '@/app/navigation';

/** 下部ナビに無い画面（コード辞典など）を開いているときは「その他」を選択中として表示する */
function useIsMoreActive(): boolean {
  const { pathname } = useLocation();
  const bottomPaths = BOTTOM_NAV.map((i) => i.path).filter((p) => p !== '/more');
  const inBottom = bottomPaths.some((p) => (p === '/' ? pathname === '/' : pathname.startsWith(p)));
  const known = SIDE_NAV.some((i) => (i.path === '/' ? pathname === '/' : pathname.startsWith(i.path)));
  return pathname.startsWith('/more') || (known && !inBottom);
}

export function BottomNav() {
  const moreActive = useIsMoreActive();

  return (
    <nav
      aria-label="下部メニュー"
      className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden dark:border-slate-800 dark:bg-slate-900/95"
    >
      <ul className="grid grid-cols-5">
        {BOTTOM_NAV.map((item) => (
          <li key={item.path}>
            <NavLink
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => {
                const active = item.path === '/more' ? moreActive : isActive;
                return [
                  'flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px]',
                  active ? 'font-semibold text-brand-600 dark:text-brand-400' : 'text-slate-500 dark:text-slate-400',
                ].join(' ');
              }}
            >
              <span aria-hidden="true" className="text-xl leading-none">
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
