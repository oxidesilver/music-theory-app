import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { NAV_ITEMS } from '@/app/navigation';
import { db } from '@/storage/db';
import type { Song } from '@/storage/types';
import { createId } from '@/lib/id';
import { useSettings } from '@/stores/settingsStore';
import { formatChordSymbol, type ChordQualityId } from '@/theory/chord';
import { keyName } from '@/theory/key';
import { useEditor } from '@/features/progression/editorStore';

export function LibraryPage() {
  const [songs, setSongs] = useState<Song[] | null>(null);
  const style = useSettings((s) => s.romanStyle);
  const navigate = useNavigate();
  const editor = useEditor();

  const reload = useCallback(async () => {
    setSongs(await db.songs.orderBy('updatedAt').reverse().toArray());
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);

  const duplicate = async (s: Song) => {
    const now = new Date().toISOString();
    await db.songs.put({ ...s, id: createId(), title: `${s.title}のコピー`, createdAt: now, updatedAt: now });
    await reload();
  };

  const remove = async (s: Song) => {
    if (!window.confirm(`「${s.title}」を削除しますか？この操作は元に戻せません。`)) return;
    await db.songs.delete(s.id);
    if (editor.songId === s.id) editor.newSong();
    await reload();
  };

  const rename = async (s: Song) => {
    const title = window.prompt('新しい作品名', s.title);
    if (!title?.trim()) return;
    await db.songs.update(s.id, { title: title.trim(), updatedAt: new Date().toISOString() });
    await reload();
  };

  return (
    <>
      <PageHeader icon={NAV_ITEMS.library.icon} title={NAV_ITEMS.library.label} description="この端末に保存した作品の一覧です。" />
      <div className="mb-4">
        <Link
          to="/progression"
          onClick={() => editor.newSong()}
          className="inline-flex min-h-11 items-center rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
        >
          ＋ 新しいコード進行を作る
        </Link>
      </div>
      {songs === null ? (
        <p className="text-sm text-slate-500">読み込み中…</p>
      ) : songs.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-600 dark:text-slate-300">まだ保存した作品はありません。コード進行メーカーで作って「💾 保存」を押すと、ここに並びます。</p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {songs.map((s) => (
            <li key={s.id}>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold">{s.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      キー：{keyName(s.key, 'unicode')}　BPM：{s.bpm}　コード {s.chords.length} 個
                      {s.melody.length > 0 && `　メロディー ${s.melody.length} 音`}
                      　更新：{new Date(s.updatedAt).toLocaleString('ja-JP')}
                    </p>
                    <p className="mt-1 truncate text-sm">
                      {[...s.chords]
                        .sort((a, b) => a.startTick - b.startTick)
                        .map((c) => formatChordSymbol({ root: c.root, quality: c.quality as ChordQualityId, bass: c.bass }, { style, accidentals: 'unicode' }))
                        .join(' → ') || '（コードなし）'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" onClick={() => navigate(`/progression/${s.id}`)} className="min-h-10 rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-700">
                      開く
                    </button>
                    <button type="button" onClick={() => void rename(s)} className="min-h-10 rounded-lg px-3 text-sm hover:bg-slate-100 dark:hover:bg-slate-800">
                      名前を変更
                    </button>
                    <button type="button" onClick={() => void duplicate(s)} className="min-h-10 rounded-lg px-3 text-sm hover:bg-slate-100 dark:hover:bg-slate-800">
                      複製
                    </button>
                    <button type="button" onClick={() => void remove(s)} className="min-h-10 rounded-lg px-3 text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10">
                      削除
                    </button>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">MIDI ファイルとして書き出す機能は Phase 8 で追加します。</p>
    </>
  );
}
