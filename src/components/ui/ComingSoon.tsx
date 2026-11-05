import { PageHeader } from './PageHeader';
import { Card } from './Card';

interface ComingSoonProps {
  icon: string;
  title: string;
  description: string;
  phase: string;
  features: string[];
}

/** まだ実装していない画面の仮表示。どの Phase で何ができるようになるかを示す */
export function ComingSoon({ icon, title, description, phase, features }: ComingSoonProps) {
  return (
    <>
      <PageHeader icon={icon} title={title} description={description} />
      <Card>
        <p className="inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
          準備中（{phase}で実装予定）
        </p>
        <p className="mt-4 text-sm font-semibold">この画面でできるようになること</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-300">
          {features.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </Card>
    </>
  );
}
