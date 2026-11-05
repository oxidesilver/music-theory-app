import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <div className="py-16 text-center">
      <p className="text-4xl">🎵❓</p>
      <h1 className="mt-4 text-xl font-bold">ページが見つかりません</h1>
      <Link to="/" className="mt-6 inline-block text-sm font-semibold text-brand-600 dark:text-brand-400">
        ホームに戻る
      </Link>
    </div>
  );
}
