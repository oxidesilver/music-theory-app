import type { ReactNode } from 'react';

interface ChoiceButtonProps {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  title?: string;
}

/** 選択肢のボタン（選んでいるものが色付きになる） */
export function ChoiceButton({ selected, onClick, children, className = '', title }: ChoiceButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      title={title}
      onClick={onClick}
      className={[
        'min-h-10 rounded-lg border px-2.5 text-sm transition',
        selected
          ? 'border-brand-500 bg-brand-600 font-semibold text-white'
          : 'border-slate-200 bg-white hover:border-brand-400 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-brand-500',
        className,
      ].join(' ')}
    >
      {children}
    </button>
  );
}
