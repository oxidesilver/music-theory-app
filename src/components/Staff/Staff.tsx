// シンプルな五線譜（SVG）。音部記号・調号・全音符・♯♭♮・加線を描く。
// 音部記号は端末のフォントに頼らず、図形として描く（スマホで表示されないことを防ぐため）。
import type { MusicalKey } from '@/theory/key';
import { formatPitchClass, type Pitch } from '@/theory/pitch';
import {
  HALF_SPACE,
  STAFF_BOTTOM,
  STAFF_TOP,
  accidentalSymbol,
  chooseClef,
  chordOffsets,
  keySignatureMarks,
  ledgerPositions,
  staffPosition,
  yOf,
  type Clef,
} from './staffLayout';

interface StaffProps {
  /** 1つの要素が1つの位置。配列の中の音は同時に鳴る（和音） */
  groups: Pitch[][];
  /** 調号を書くキー */
  musicalKey?: MusicalKey;
  clef?: Clef;
  /** 音符の下に音名を書く */
  showNames?: boolean;
  ariaLabel?: string;
}

const NOTE_GAP = 34;
const CLEF_W = 34;

function TrebleClef({ x }: { x: number }) {
  // ト音記号：2本目の線（G）を巻くうず巻きと、縦の線
  const g = yOf(2);
  const s = HALF_SPACE * 2; // 線の間隔
  return (
    <g transform={`translate(${x} 0)`} className="fill-none stroke-current" strokeWidth={1.8} strokeLinecap="round">
      <path
        d={`M 13 ${g + 3}
            C 8 ${g + 3} 7 ${g - 4} 12 ${g - 5}
            C 18 ${g - 6} 21 ${g + 1} 17 ${g + 6}
            C 13 ${g + 11} 4 ${g + 8} 3 ${g + 1}
            C 2 ${g - 8} 10 ${g - 13} 15 ${g - 18}
            C 20 ${g - 23} 21 ${g - 32} 17 ${g - 2.2 * s - 20}
            C 15 ${g - 2.2 * s - 24} 11 ${g - 2.2 * s - 20} 11 ${g - 2.2 * s - 14}
            C 11 ${g - 25} 13 ${g} 14 ${g + 1.8 * s}
            C 14.5 ${g + 1.8 * s + 6} 9 ${g + 1.8 * s + 7} 8 ${g + 1.8 * s + 2}`}
      />
      <circle cx={8.5} cy={g + 1.8 * s + 1} r={2.6} className="fill-current stroke-none" />
    </g>
  );
}

function BassClef({ x }: { x: number }) {
  // ヘ音記号：4本目の線（F）をはさむ2つの点
  const f = yOf(6);
  return (
    <g transform={`translate(${x} 0)`}>
      <path d={`M 5 ${f} C 5 ${f - 9} 21 ${f - 10} 21 ${f + 1} C 21 ${f + 14} 10 ${f + 22} 3 ${f + 26}`} className="fill-none stroke-current" strokeWidth={2} strokeLinecap="round" />
      <circle cx={6} cy={f + 1} r={3.2} className="fill-current" />
      <circle cx={27} cy={f - HALF_SPACE} r={2} className="fill-current" />
      <circle cx={27} cy={f + HALF_SPACE} r={2} className="fill-current" />
    </g>
  );
}

function Accidental({ symbol, x, y }: { symbol: string; x: number; y: number }) {
  return (
    <text x={x} y={y + 5} textAnchor="middle" className="fill-current text-[15px]" style={{ fontFamily: 'system-ui, sans-serif' }}>
      {symbol}
    </text>
  );
}

export function Staff({ groups, musicalKey, clef, showNames = true, ariaLabel = '五線譜' }: StaffProps) {
  const all = groups.flat();
  const useClef = clef ?? chooseClef(all);
  const sigMarks = keySignatureMarks(musicalKey, useClef);
  const sigWidth = sigMarks.length * 10 + (sigMarks.length ? 6 : 0);
  const startX = CLEF_W + sigWidth + 18;
  const width = startX + Math.max(1, groups.length) * NOTE_GAP + 10;

  // 上下にはみ出す音（加線）に合わせて高さを広げる
  const positions = all.map((p) => staffPosition(p, useClef));
  const topPad = Math.max(0, (Math.max(8, ...positions) - 8) * HALF_SPACE + 10);
  const bottomPad = Math.max(0, -Math.min(0, ...positions) * HALF_SPACE + 10);
  const viewTop = STAFF_TOP - 26 - topPad;
  const viewBottom = STAFF_BOTTOM + 22 + bottomPad + (showNames ? 14 : 0);

  const description = `${useClef === 'treble' ? 'ト音記号' : 'ヘ音記号'}の五線譜：${groups.map((g) => g.map((p) => formatPitchClass(p, 'unicode')).join('・')).join('、')}`;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        role="img"
        aria-label={`${ariaLabel}（${description}）`}
        viewBox={`0 ${viewTop} ${width} ${viewBottom - viewTop}`}
        className="block h-auto text-slate-800 dark:text-slate-100"
        style={{ width: Math.max(width, 160), maxWidth: '100%', minWidth: Math.min(width, 320) }}
      >
        {/* 五線 */}
        {[0, 2, 4, 6, 8].map((p) => (
          <line key={p} x1={0} x2={width} y1={yOf(p)} y2={yOf(p)} className="stroke-current" strokeWidth={0.9} />
        ))}
        {useClef === 'treble' ? <TrebleClef x={4} /> : <BassClef x={4} />}

        {/* 調号 */}
        {sigMarks.map((m, i) => (
          <Accidental key={i} symbol={m.accidental > 0 ? '♯' : '♭'} x={CLEF_W + 6 + i * 10} y={yOf(m.position)} />
        ))}

        {/* 音符 */}
        {groups.map((group, gi) => {
          const cx = startX + gi * NOTE_GAP;
          const pos = group.map((p) => staffPosition(p, useClef));
          const offsets = chordOffsets(pos);
          const ledgers = [...new Set(pos.flatMap(ledgerPositions))];
          const lowest = Math.min(...pos);
          return (
            <g key={gi}>
              {ledgers.map((lp) => (
                <line key={lp} x1={cx - 10} x2={cx + 10 + (offsets.some((o) => o) ? 11 : 0)} y1={yOf(lp)} y2={yOf(lp)} className="stroke-current" strokeWidth={0.9} />
              ))}
              {group.map((p, i) => {
                const x = cx + offsets[i]! * 11;
                const y = yOf(pos[i]!);
                const acc = accidentalSymbol(p, musicalKey);
                return (
                  <g key={i}>
                    {acc && <Accidental symbol={acc} x={cx - 15 - (acc.length > 1 ? 5 : 0)} y={y} />}
                    <ellipse cx={x} cy={y} rx={6.2} ry={4.4} transform={`rotate(-18 ${x} ${y})`} className="fill-none stroke-current" strokeWidth={1.8} />
                  </g>
                );
              })}
              {showNames && (
                <text x={cx} y={Math.max(STAFF_BOTTOM, yOf(lowest)) + 20} textAnchor="middle" className="fill-slate-500 text-[9px]">
                  {group.length === 1 ? formatPitchClass(group[0]!, 'unicode') : ''}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
