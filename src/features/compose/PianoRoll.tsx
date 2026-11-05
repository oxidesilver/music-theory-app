import { useMemo, type MouseEvent } from 'react';
import type { NoteEvent } from '@/storage/types';
import type { MusicalKey } from '@/theory/key';
import { formatPitch, formatPitchClass, isBlackKey, midiOf, type OctaveConvention } from '@/theory/pitch';
import type { ScaleId } from '@/theory/scale';
import type { NoteRole } from '@/theory/tension';
import { formatChordSymbol, type ChordSymbolStyle } from '@/theory/chord';
import type { ProgressionChord } from '@/features/progression/logic';
import { DRUM_TICKS, TICKS_PER_BAR, TICKS_PER_BEAT, chordSpans, noteAt, noteRoleAt } from './logic';

export const ROLE_STYLE: Record<NoteRole, { fill: string; legend: string; nameJa: string }> = {
  'chord-tone': { fill: 'fill-rose-200/70 dark:fill-rose-500/25', legend: 'bg-rose-200 dark:bg-rose-500/40', nameJa: 'コードトーン' },
  tension: { fill: 'fill-amber-100/80 dark:fill-amber-500/20', legend: 'bg-amber-100 dark:bg-amber-500/40', nameJa: 'テンション' },
  scale: { fill: 'fill-sky-100/80 dark:fill-sky-500/15', legend: 'bg-sky-100 dark:bg-sky-500/30', nameJa: 'スケール内の音' },
  caution: { fill: 'fill-orange-200/60 dark:fill-orange-500/25', legend: 'bg-orange-200 dark:bg-orange-500/40', nameJa: '注意が必要な音' },
  outside: { fill: 'fill-slate-100 dark:fill-slate-900', legend: 'bg-slate-100 dark:bg-slate-800', nameJa: 'スケール外の音' },
};

interface PianoRollProps {
  notes: NoteEvent[];
  range: [number, number];
  musicalKey: MusicalKey;
  scaleId: ScaleId;
  chords: ProgressionChord[];
  lengthTicks: number;
  /** 置く位置の細かさ（tick） */
  snap: number;
  /** 1マス（16分音符）の幅（px） */
  cellWidth: number;
  selectedId: string | null;
  playheadTick: number | null;
  octaveConvention: OctaveConvention;
  chordStyle: ChordSymbolStyle;
  /** 空いているところを押した */
  onAdd: (midi: number, tick: number) => void;
  /** 音符を押した */
  onSelect: (note: NoteEvent) => void;
  ariaLabel: string;
}

const ROW_H = 20;
const LABEL_W = 48;
const CHORD_LANE_H = 24;

export function PianoRoll({
  notes,
  range,
  musicalKey,
  scaleId,
  chords,
  lengthTicks,
  snap,
  cellWidth,
  selectedId,
  playheadTick,
  octaveConvention,
  chordStyle,
  onAdd,
  onSelect,
  ariaLabel,
}: PianoRollProps) {
  const [low, high] = range;
  const rows = Array.from({ length: high - low + 1 }, (_, i) => high - i); // 上が高い音
  const pxPerTick = cellWidth / DRUM_TICKS;
  const width = lengthTicks * pxPerTick;
  const height = rows.length * ROW_H;
  const spans = chordSpans(chords);

  // 行ごと・コードごとの音の役割（色分け）を先に計算しておく
  const roleCells = useMemo(() => {
    const segments = spans.length ? spans : [{ start: 0, end: lengthTicks }];
    return rows.flatMap((midi, r) =>
      segments.map((s) => ({ r, x: s.start * pxPerTick, w: (Math.min(s.end, lengthTicks) - s.start) * pxPerTick, role: noteRoleAt(musicalKey, scaleId, chords, midi, s.start).role })),
    );
  }, [rows.length, low, high, chords, musicalKey, scaleId, lengthTicks, pxPerTick]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClick = (e: MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const row = Math.floor(y / ROW_H);
    const midi = rows[row];
    if (midi === undefined) return;
    const tick = Math.floor(x / pxPerTick);
    if (tick < 0 || tick >= lengthTicks) return;
    const existing = noteAt(notes, midi, tick);
    if (existing) onSelect(existing);
    else onAdd(midi, Math.floor(tick / snap) * snap);
  };

  const fmt = (midi: number) => formatPitch(noteRoleAt(musicalKey, scaleId, chords, midi, 0).pitch, { octaveConvention, style: 'unicode' });

  return (
    <div className="max-h-[60vh] overflow-auto rounded-xl border border-slate-200 dark:border-slate-700" data-testid="piano-roll-scroll">
      <div className="flex" style={{ width: LABEL_W + width }}>
        {/* 左の鍵盤（音名） */}
        <div className="sticky left-0 z-10 shrink-0 bg-white dark:bg-slate-900" style={{ width: LABEL_W }}>
          <div style={{ height: CHORD_LANE_H }} className="sticky top-0 z-10 border-b border-slate-200 bg-white text-[10px] text-slate-400 dark:border-slate-700 dark:bg-slate-900">
            コード
          </div>
          {rows.map((midi) => (
            <div
              key={midi}
              style={{ height: ROW_H }}
              className={`flex items-center justify-end border-b pr-1 text-[10px] ${
                isBlackKey(midi) ? 'border-slate-700 bg-slate-700 text-slate-200' : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-100 dark:text-slate-700'
              } ${midi % 12 === 0 ? 'font-bold' : ''}`}
            >
              {fmt(midi)}
            </div>
          ))}
        </div>

        <div className="relative" style={{ width }}>
          {/* コードの帯 */}
          <div className="sticky top-0 z-[5] flex border-b border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900" style={{ height: CHORD_LANE_H }}>
            {spans.map((s) => (
              <div
                key={s.chord.id}
                className="truncate border-r border-slate-300 px-1 text-xs font-semibold leading-6 dark:border-slate-600"
                style={{ width: (Math.min(s.end, lengthTicks) - s.start) * pxPerTick }}
              >
                {formatChordSymbol(s.chord, { style: chordStyle, accidentals: 'unicode' })}
              </div>
            ))}
          </div>

          <svg
            width={width}
            height={height}
            role="group"
            aria-label={ariaLabel}
            onClick={handleClick}
            className="block cursor-crosshair touch-manipulation select-none"
          >
            {roleCells.map((c, i) => (
              <rect key={i} x={c.x} y={c.r * ROW_H} width={c.w} height={ROW_H} className={ROLE_STYLE[c.role].fill} />
            ))}
            {/* 横線 */}
            {rows.map((midi, r) => (
              <line key={midi} x1={0} x2={width} y1={(r + 1) * ROW_H} y2={(r + 1) * ROW_H} className={midi % 12 === 0 ? 'stroke-slate-400' : 'stroke-slate-200 dark:stroke-slate-700'} />
            ))}
            {/* 縦線：細かさごと・拍ごと・小節ごと */}
            {Array.from({ length: Math.floor(lengthTicks / snap) + 1 }, (_, i) => i * snap).map((t) => (
              <line
                key={t}
                x1={t * pxPerTick}
                x2={t * pxPerTick}
                y1={0}
                y2={height}
                className={t % TICKS_PER_BAR === 0 ? 'stroke-slate-500' : t % TICKS_PER_BEAT === 0 ? 'stroke-slate-300 dark:stroke-slate-600' : 'stroke-slate-200/70 dark:stroke-slate-800'}
              />
            ))}
            {/* 音符 */}
            {notes.map((n) => {
              const r = high - midiOf(n.pitch);
              if (r < 0 || r >= rows.length) return null;
              const selected = n.id === selectedId;
              const bar = Math.floor(n.startTick / TICKS_PER_BAR) + 1;
              const beat = (n.startTick % TICKS_PER_BAR) / TICKS_PER_BEAT + 1;
              return (
                <g key={n.id} role="button" aria-label={`${formatPitch(n.pitch, { octaveConvention })} ${bar}小節目 ${beat}拍目`} aria-pressed={selected}>
                  <rect
                    x={n.startTick * pxPerTick + 1}
                    y={r * ROW_H + 2}
                    width={Math.max(4, n.durationTick * pxPerTick - 2)}
                    height={ROW_H - 4}
                    rx={4}
                    className={selected ? 'fill-amber-400 stroke-amber-700' : 'fill-brand-500 stroke-brand-700'}
                  />
                  {n.durationTick * pxPerTick > 26 && (
                    <text x={n.startTick * pxPerTick + 5} y={r * ROW_H + 14} className="pointer-events-none fill-white text-[10px] font-bold">
                      {formatPitchClass(n.pitch, 'unicode')}
                    </text>
                  )}
                </g>
              );
            })}
            {playheadTick !== null && (
              <line x1={playheadTick * pxPerTick} x2={playheadTick * pxPerTick} y1={0} y2={height} className="stroke-amber-500" strokeWidth={2} />
            )}
          </svg>
        </div>
      </div>
    </div>
  );
}

export function RoleLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
      {(Object.keys(ROLE_STYLE) as NoteRole[]).map((r) => (
        <li key={r} className="flex items-center gap-1.5">
          <span className={`inline-block h-3 w-3 rounded-sm border border-slate-300 dark:border-slate-600 ${ROLE_STYLE[r].legend}`} aria-hidden="true" />
          {ROLE_STYLE[r].nameJa}
        </li>
      ))}
    </ul>
  );
}
