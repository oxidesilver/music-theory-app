import { useState } from 'react';
import { ALL_PARTS, PART_INFO, downloadMidi, midiBytes, midiFileName, partCounts, type MidiSource, type PartId } from './exportMidi';

/** MIDI ファイルの書き出しボタン（全パートまとめて／パートごと） */
export function ExportMidiPanel({ source, compact = false }: { source: MidiSource; compact?: boolean }) {
  const [done, setDone] = useState<string | null>(null);
  const counts = partCounts(source);
  const empty = ALL_PARTS.every((p) => counts[p] === 0);

  const exportParts = (parts: PartId[], suffix?: string) => {
    try {
      const name = midiFileName(source.title, suffix);
      downloadMidi(midiBytes(source, parts), name);
      setDone(`「${name}」を書き出しました`);
    } catch (e) {
      setDone(`書き出しに失敗しました：${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={empty}
          onClick={() => exportParts(ALL_PARTS)}
          className="min-h-11 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
        >
          ⬇ MIDI を書き出す（全パート）
        </button>
        {!compact &&
          ALL_PARTS.map((p) => (
            <button
              key={p}
              type="button"
              disabled={counts[p] === 0}
              onClick={() => exportParts([p], PART_INFO[p].trackName)}
              className="min-h-11 rounded-xl border border-emerald-600 px-3 text-sm text-emerald-700 hover:bg-emerald-50 disabled:opacity-40 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
            >
              {PART_INFO[p].nameJa}だけ
            </button>
          ))}
      </div>
      {done && (
        <p role="status" className="text-xs text-emerald-700 dark:text-emerald-300">
          {done}
        </p>
      )}
      {!compact && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          全パートのファイルは「Chord／Melody／Bass／Drums」の4トラックに分かれています（BPM {source.bpm}・4/4拍子の情報付き）。
          PC では「ダウンロード」フォルダ、iPhone では「ファイル」アプリに保存されます。FL Studio へはファイルをドラッグ＆ドロップするか、「File → Import → MIDI file」で読み込めます。
        </p>
      )}
    </div>
  );
}
