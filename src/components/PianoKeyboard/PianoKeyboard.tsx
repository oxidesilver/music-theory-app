import { useCallback, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { audio } from '@/audio/engine';
import { isBlackKey } from '@/theory/pitch';
import type { InstrumentId } from '@/audio/instruments';

/** 鍵盤に付ける印の種類（色分け） */
export type KeyMarkKind = 'root' | 'chord' | 'scale' | 'tension' | 'caution' | 'outside';

export interface KeyMark {
  kind: KeyMarkKind;
  /** 鍵盤の上に表示する文字（音名など） */
  label?: string;
}

export const MARK_STYLES: Record<KeyMarkKind, { white: string; black: string; legend: string; nameJa: string }> = {
  root: { white: 'fill-rose-400', black: 'fill-rose-500', legend: 'bg-rose-400', nameJa: 'ルート' },
  chord: { white: 'fill-brand-400', black: 'fill-brand-500', legend: 'bg-brand-400', nameJa: 'コードの音' },
  scale: { white: 'fill-sky-200', black: 'fill-sky-600', legend: 'bg-sky-300', nameJa: 'スケールの音' },
  tension: { white: 'fill-amber-300', black: 'fill-amber-500', legend: 'bg-amber-300', nameJa: 'テンション' },
  caution: { white: 'fill-orange-300', black: 'fill-orange-600', legend: 'bg-orange-400', nameJa: '注意が必要な音' },
  outside: { white: 'fill-slate-300', black: 'fill-slate-500', legend: 'bg-slate-400', nameJa: 'スケール外の音' },
};

interface PianoKeyboardProps {
  /** 一番左の鍵盤（MIDI 番号） */
  from: number;
  /** 一番右の鍵盤（MIDI 番号） */
  to: number;
  marks?: Partial<Record<number, KeyMark>>;
  /** 鍵盤を押したときに音を鳴らすか */
  playOnPress?: boolean;
  instrument?: InstrumentId;
  onKeyPress?: (midi: number) => void;
  /** 白鍵の C に表示するラベル（例：C4 / C5）。null なら表示しない */
  cLabel?: ((midi: number) => string) | null;
  /** 鍵盤の名前（読み上げ用） */
  keyName?: (midi: number) => string;
  ariaLabel?: string;
}

const WHITE_W = 24;
const WHITE_H = 96;
const BLACK_W = 14;
const BLACK_H = 60;

/** 白鍵だけを数えたときの位置 */
function whiteIndex(midi: number): number {
  const octave = Math.floor(midi / 12);
  const pos = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6][((midi % 12) + 12) % 12]!;
  return octave * 7 + pos;
}

export function PianoKeyboard({
  from,
  to,
  marks = {},
  playOnPress = true,
  instrument,
  onKeyPress,
  cLabel,
  keyName,
  ariaLabel = 'ピアノ鍵盤',
}: PianoKeyboardProps) {
  const [pressed, setPressed] = useState<number | null>(null);
  const start = isBlackKey(from) ? from - 1 : from;
  const end = isBlackKey(to) ? to + 1 : to;
  const firstWhite = whiteIndex(start);
  const whiteCount = whiteIndex(end) - firstWhite + 1;
  const width = whiteCount * WHITE_W;

  const keys = Array.from({ length: end - start + 1 }, (_, i) => start + i);
  const whites = keys.filter((m) => !isBlackKey(m));
  const blacks = keys.filter((m) => isBlackKey(m));

  const press = useCallback(
    (midi: number) => {
      setPressed(midi);
      window.setTimeout(() => setPressed((p) => (p === midi ? null : p)), 180);
      if (playOnPress) void audio.play(midi, { instrument, duration: 1 });
      onKeyPress?.(midi);
    },
    [playOnPress, instrument, onKeyPress],
  );

  const keyProps = (midi: number) => ({
    role: 'button' as const,
    tabIndex: 0,
    'aria-label': keyName ? keyName(midi) : `MIDI ${midi}`,
    'aria-pressed': marks[midi] ? true : undefined,
    onPointerDown: (e: PointerEvent) => {
      e.preventDefault();
      press(midi);
    },
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        press(midi);
      }
    },
    className: 'cursor-pointer outline-none focus-visible:opacity-80',
  });

  return (
    <div className="w-full overflow-x-auto">
      <svg
        role="group"
        aria-label={ariaLabel}
        viewBox={`0 0 ${width} ${WHITE_H + 2}`}
        className="block w-full touch-manipulation select-none"
        style={{ minWidth: whiteCount * 22 }}
      >
        {whites.map((midi) => {
          const x = (whiteIndex(midi) - firstWhite) * WHITE_W;
          const mark = marks[midi];
          const fill = mark ? MARK_STYLES[mark.kind].white : 'fill-white';
          return (
            <g key={midi} {...keyProps(midi)}>
              <rect
                x={x + 0.5}
                y={0.5}
                width={WHITE_W - 1}
                height={WHITE_H}
                rx={3}
                className={`${fill} stroke-slate-400 transition-[filter] dark:stroke-slate-600 ${pressed === midi ? 'brightness-90' : ''}`}
              />
              {mark?.label && (
                <text x={x + WHITE_W / 2} y={WHITE_H - 20} textAnchor="middle" className="fill-slate-900 text-[9px] font-bold">
                  {mark.label}
                </text>
              )}
              {cLabel && midi % 12 === 0 && (
                <text x={x + WHITE_W / 2} y={WHITE_H - 6} textAnchor="middle" className="fill-slate-400 text-[7px]">
                  {cLabel(midi)}
                </text>
              )}
            </g>
          );
        })}
        {blacks.map((midi) => {
          const x = (whiteIndex(midi) - firstWhite + 1) * WHITE_W - BLACK_W / 2;
          const mark = marks[midi];
          const fill = mark ? MARK_STYLES[mark.kind].black : 'fill-slate-800 dark:fill-slate-950';
          return (
            <g key={midi} {...keyProps(midi)}>
              <rect
                x={x}
                y={0.5}
                width={BLACK_W}
                height={BLACK_H}
                rx={2}
                className={`${fill} stroke-slate-900 ${pressed === midi ? 'brightness-75' : ''}`}
              />
              {mark?.label && (
                <text x={x + BLACK_W / 2} y={BLACK_H - 8} textAnchor="middle" className="fill-white text-[7px] font-bold">
                  {mark.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** 色の意味の説明（凡例） */
export function KeyMarkLegend({ kinds }: { kinds: KeyMarkKind[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
      {kinds.map((k) => (
        <li key={k} className="flex items-center gap-1.5">
          <span className={`inline-block h-3 w-3 rounded-sm ${MARK_STYLES[k].legend}`} aria-hidden="true" />
          {MARK_STYLES[k].nameJa}
        </li>
      ))}
    </ul>
  );
}
