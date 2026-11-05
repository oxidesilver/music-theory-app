import { useEffect, useState, type ReactNode } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { NAV_ITEMS } from '@/app/navigation';
import { useSettings, type InstrumentId, type OctaveConvention, type RomanStyle, type ThemeSetting } from '@/stores/settingsStore';
import { db } from '@/storage/db';
import { isStoragePersisted } from '@/storage/persist';
import { audio } from '@/audio/engine';
import { BackupSection } from './BackupSection';

interface Option<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

function Segmented<T extends string>({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: T;
  options: Option<T>[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={name} className="grid gap-2 sm:grid-cols-[repeat(auto-fit,minmax(0,1fr))]">
      {options.map((o) => {
        const checked = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={() => onChange(o.value)}
            className={[
              'min-h-11 rounded-xl border px-3 py-2 text-left text-sm transition',
              checked
                ? 'border-brand-500 bg-brand-50 font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
                : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600',
            ].join(' ')}
          >
            {o.label}
            {o.hint && <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">{o.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}

function Field({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        {help && <p className="text-xs text-slate-500 dark:text-slate-400">{help}</p>}
      </div>
      {children}
    </div>
  );
}

function useStorageInfo(refresh: number) {
  const [info, setInfo] = useState<{ persisted: boolean | null; songs: number; lessons: number } | null>(null);
  useEffect(() => {
    let alive = true;
    void (async () => {
      const [persisted, songs, lessons] = await Promise.all([
        isStoragePersisted(),
        db.songs.count().catch(() => 0),
        db.lessonProgress.count().catch(() => 0),
      ]);
      if (alive) setInfo({ persisted, songs, lessons });
    })();
    return () => {
      alive = false;
    };
  }, [refresh]);
  return info;
}

export function SettingsPage() {
  const s = useSettings();
  const [refresh, setRefresh] = useState(0);
  const storage = useStorageInfo(refresh);
  const n = NAV_ITEMS.settings;

  return (
    <>
      <PageHeader icon={n.icon} title={n.label} description="表示や音、データの扱いを設定します。設定は自動で保存されます。" />

      <div className="space-y-4">
        <Card className="space-y-5">
          <h2 className="font-bold">表示</h2>
          <Field label="画面の明るさ">
            <Segmented<ThemeSetting>
              name="画面の明るさ"
              value={s.theme}
              onChange={(theme) => s.update({ theme })}
              options={[
                { value: 'system', label: '端末に合わせる' },
                { value: 'light', label: 'ライト' },
                { value: 'dark', label: 'ダーク' },
              ]}
            />
          </Field>
          <Field
            label="コード名・ローマ数字の書き方"
            help="コード名と、コード進行を「Ⅰ・Ⅳ・Ⅴ」のような数字で表すときの書き方です。"
          >
            <Segmented<RomanStyle>
              name="コード名・ローマ数字の書き方"
              value={s.romanStyle}
              onChange={(romanStyle) => s.update({ romanStyle })}
              options={[
                { value: 'japanese', label: '日本式', hint: '例：C△7・Ⅵm・Ⅳ△7' },
                { value: 'english', label: '英米式', hint: '例：Cmaj7・vi・IVmaj7' },
              ]}
            />
          </Field>
          <Field label="音の高さの表記" help="同じ「中央のド」でも、ソフトによって呼び方が違います。">
            <Segmented<OctaveConvention>
              name="音の高さの表記"
              value={s.octaveConvention}
              onChange={(octaveConvention) => s.update({ octaveConvention })}
              options={[
                { value: 'fl', label: 'FL Studio式', hint: '中央のド = C5' },
                { value: 'standard', label: '一般的な表記', hint: '中央のド = C4' },
              ]}
            />
          </Field>
        </Card>

        <Card className="space-y-5">
          <h2 className="font-bold">音</h2>
          <Field label={`全体の音量：${Math.round(s.masterVolume * 100)}%`}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={s.masterVolume}
              onChange={(e) => s.update({ masterVolume: Number(e.target.value) })}
              aria-label="全体の音量"
              className="w-full accent-brand-600"
            />
          </Field>
          <Field label="基本の音色" help="鍵盤をタップしたときなどに使う音色です。">
            <button
              type="button"
              onClick={() => void audio.play([60, 64, 67], { duration: 1.2 })}
              className="mb-2 min-h-10 rounded-lg border border-brand-500 px-3 text-sm font-semibold text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10"
            >
              ▶ 試しに鳴らす
            </button>
            <Segmented<InstrumentId>
              name="基本の音色"
              value={s.instrument}
              onChange={(instrument) => s.update({ instrument })}
              options={[
                { value: 'piano', label: 'ピアノ' },
                { value: 'synth', label: 'シンセ' },
                { value: 'bass', label: 'ベース' },
              ]}
            />
          </Field>
        </Card>

        <Card className="space-y-3">
          <h2 className="font-bold">データ</h2>
          <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
            <p className="font-semibold">⚠️ データは「この端末の中」だけに保存されます</p>
            <p className="mt-1 text-xs leading-relaxed">
              PC とスマートフォンの間でデータは自動で同期されません。別の端末に移したいときや、万一に備えるときは「バックアップ」を使ってください。
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-slate-500 dark:text-slate-400">保存した作品</dt>
            <dd>{storage ? `${storage.songs} 件` : '確認中…'}</dd>
            <dt className="text-slate-500 dark:text-slate-400">学習記録</dt>
            <dd>{storage ? `${storage.lessons} 件` : '確認中…'}</dd>
            <dt className="text-slate-500 dark:text-slate-400">自動削除の防止</dt>
            <dd>
              {storage === null
                ? '確認中…'
                : storage.persisted === true
                  ? '有効'
                  : storage.persisted === false
                    ? '未許可（ホーム画面に追加すると有効になりやすくなります）'
                    : 'この端末では未対応'}
            </dd>
          </dl>
        </Card>

        <BackupSection onRestored={() => setRefresh((r) => r + 1)} />

        <div className="text-right">
          <button
            type="button"
            onClick={() => {
              if (window.confirm('表示と音の設定を初期状態に戻しますか？（作品や学習記録は消えません）')) s.reset();
            }}
            className="min-h-11 rounded-xl px-4 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            設定を初期状態に戻す
          </button>
        </div>
      </div>
    </>
  );
}
