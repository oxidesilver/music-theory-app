import { useRef, useState } from 'react';
import { Card } from '@/components/ui/Card';
import {
  SUMMARY_LABELS,
  createBackup,
  downloadBackup,
  parseBackup,
  restoreBackup,
  settingsFromBackup,
  type Backup,
  type BackupSummary,
  type RestoreMode,
} from '@/storage/backup';
import { useSettings, type Settings } from '@/stores/settingsStore';
import { useProgress } from '@/stores/progressStore';
import { useEarRecords } from '@/features/ear/stats';
import { useGenreProgress } from '@/features/genres/logic';

function SummaryList({ summary }: { summary: BackupSummary }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm">
      {(Object.keys(summary) as (keyof BackupSummary)[]).map((k) => (
        <li key={k} className="flex justify-between gap-2">
          <span className="text-slate-600 dark:text-slate-300">{SUMMARY_LABELS[k]}</span>
          <span className="font-semibold">{summary[k]} 件</span>
        </li>
      ))}
    </ul>
  );
}

function currentSettings(): Settings {
  const { theme, romanStyle, octaveConvention, masterVolume, instrument } = useSettings.getState();
  return { theme, romanStyle, octaveConvention, masterVolume, instrument };
}

/** 設定画面の「バックアップと復元」 */
export function BackupSection({ onRestored }: { onRestored: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [pending, setPending] = useState<{ backup: Backup; summary: BackupSummary; fileName: string } | null>(null);
  const [mode, setMode] = useState<RestoreMode>('merge');
  const [withSettings, setWithSettings] = useState(false);
  const [busy, setBusy] = useState(false);

  const exportNow = async () => {
    setBusy(true);
    try {
      downloadBackup(await createBackup(currentSettings()));
      setMessage({ kind: 'ok', text: 'バックアップファイルを作成しました（PC は「ダウンロード」フォルダ、iPhone は「ファイル」アプリに保存されます）。' });
    } catch (e) {
      setMessage({ kind: 'error', text: `バックアップの作成に失敗しました：${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (file: File | undefined) => {
    setMessage(null);
    setPending(null);
    if (!file) return;
    const result = parseBackup(await file.text());
    if (!result.ok) {
      setMessage({ kind: 'error', text: result.error });
      return;
    }
    setPending({ backup: result.backup, summary: result.summary, fileName: file.name });
    setMode('merge');
    setWithSettings(false);
  };

  const restore = async () => {
    if (!pending) return;
    const warning =
      mode === 'replace'
        ? '今の端末のデータをすべて消して、バックアップの内容に置き換えます。\n（念のため、置き換える前に今のデータのバックアップを自動で保存します）\n\n本当に実行しますか？'
        : 'バックアップの中から、この端末にまだ無いデータを追加します。今のデータは消えません。\n\n実行しますか？';
    if (!window.confirm(warning)) return;
    setBusy(true);
    try {
      if (mode === 'replace') downloadBackup(await createBackup(currentSettings()), `before-restore_${Date.now()}.json`);
      const result = await restoreBackup(pending.backup, mode);
      if (withSettings && pending.backup.settings) useSettings.getState().update(settingsFromBackup(pending.backup));
      await Promise.all([useProgress.getState().load(), useEarRecords.getState().load(), useGenreProgress.getState().load()]);
      const addedTotal = Object.values(result.added).reduce((a, b) => a + b, 0);
      const skippedTotal = Object.values(result.skipped).reduce((a, b) => a + b, 0);
      setMessage({
        kind: 'ok',
        text:
          mode === 'replace'
            ? `復元しました（${addedTotal} 件のデータに置き換えました）。`
            : `復元しました（${addedTotal} 件を追加、すでにあった ${skippedTotal} 件はそのままにしました）。`,
      });
      setPending(null);
      if (fileRef.current) fileRef.current.value = '';
      onRestored();
    } catch (e) {
      setMessage({ kind: 'error', text: `復元に失敗しました。データは変更されていません。（${e instanceof Error ? e.message : String(e)}）` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="space-y-4">
      <h2 className="font-bold">バックアップと復元</h2>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        作品・学習記録・耳トレの記録・お気に入り・設定を、1つのファイル（JSON 形式）に保存できます。別の端末へデータを移すときや、万一に備えるときに使ってください。
      </p>

      <div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void exportNow()}
          className="min-h-11 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          ⬇ バックアップを作成（ダウンロード）
        </button>
      </div>

      <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
        <p className="text-sm font-semibold">バックアップから復元する</p>
        <label className="mt-2 inline-flex min-h-11 cursor-pointer items-center rounded-xl border border-slate-300 px-4 text-sm hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800">
          📂 バックアップファイルを選ぶ
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-label="バックアップファイルを選ぶ"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
        </label>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">ファイルを選んだだけでは、データは変わりません。内容を確認してから復元できます。</p>
      </div>

      {pending && (
        <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50/60 p-4 dark:border-amber-500/40 dark:bg-amber-500/10" aria-label="復元の確認">
          <p className="text-sm font-bold">復元の確認：{pending.fileName}</p>
          <p className="text-xs text-slate-600 dark:text-slate-300">作成日時：{new Date(pending.backup.exportedAt).toLocaleString('ja-JP')}</p>
          <SummaryList summary={pending.summary} />
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">復元の方法</legend>
            <label className="flex items-start gap-2 text-sm">
              <input type="radio" name="restore-mode" checked={mode === 'merge'} onChange={() => setMode('merge')} className="mt-1" />
              <span>
                <span className="font-semibold">追加する（おすすめ）</span>
                <span className="block text-xs text-slate-600 dark:text-slate-300">今のデータは残したまま、この端末にまだ無いデータだけを追加します。</span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="radio" name="restore-mode" checked={mode === 'replace'} onChange={() => setMode('replace')} className="mt-1" />
              <span>
                <span className="font-semibold">すべて置き換える</span>
                <span className="block text-xs text-slate-600 dark:text-slate-300">今のデータを消して、バックアップの内容にします。置き換える前に、今のデータのバックアップを自動で保存します。</span>
              </span>
            </label>
          </fieldset>
          {pending.backup.settings && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={withSettings} onChange={(e) => setWithSettings(e.target.checked)} />
              設定（表示・音・表記）も復元する
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void restore()}
              className={`min-h-11 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-50 ${mode === 'replace' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-brand-600 hover:bg-brand-700'}`}
            >
              {mode === 'replace' ? 'すべて置き換えて復元する' : '追加して復元する'}
            </button>
            <button
              type="button"
              onClick={() => {
                setPending(null);
                if (fileRef.current) fileRef.current.value = '';
              }}
              className="min-h-11 rounded-xl px-4 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              やめる
            </button>
          </div>
        </div>
      )}

      {message && (
        <p
          role="status"
          className={`rounded-lg p-3 text-sm ${message.kind === 'ok' ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-rose-50 text-rose-800 dark:bg-rose-500/10 dark:text-rose-300'}`}
        >
          {message.text}
        </p>
      )}
    </Card>
  );
}
