import { Fragment } from 'react';
import { useSettings } from '@/stores/settingsStore';
import { formatPitch, parsePitch } from '@/theory/pitch';

/**
 * 教材の文章を表示する。
 * **太字** と {{C4}}（設定に合わせた音名表示）に対応。
 */
export function RichText({ text }: { text: string }) {
  const octaveConvention = useSettings((s) => s.octaveConvention);
  const parts = text.split(/(\*\*[^*]+\*\*|\{\{[^}]+\}\})/g).filter(Boolean);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**')) return <strong key={i} className="font-bold text-brand-700 dark:text-brand-300">{part.slice(2, -2)}</strong>;
        if (part.startsWith('{{')) {
          const name = part.slice(2, -2);
          try {
            return <Fragment key={i}>{formatPitch(parsePitch(name), { octaveConvention, style: 'unicode' })}</Fragment>;
          } catch {
            return <Fragment key={i}>{name}</Fragment>;
          }
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}
