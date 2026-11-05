import type { ReactNode } from 'react';

interface PageHeaderProps {
  icon?: string;
  title: string;
  description?: ReactNode;
}

export function PageHeader({ icon, title, description }: PageHeaderProps) {
  return (
    <header className="mb-6">
      <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl">
        {icon && <span aria-hidden="true">{icon}</span>}
        {title}
      </h1>
      {description && <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{description}</p>}
    </header>
  );
}
