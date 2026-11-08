import { audio } from '@/audio/engine';
import { DRUM_LANES, type DrumPattern } from './logic';
import { FOUR_FOUR, isCompound, type TimeSignature } from '@/theory/meter';

interface DrumGridProps {
  pattern: DrumPattern;
  onChange: (p: DrumPattern) => void;
  playingStep: number | null;
  timeSignature?: TimeSignature;
}

/** 1小節分のドラム入力（4/4 は16マス、3/4・6/8 は12マス）。ここで作ったパターンを全小節で繰り返す */
export function DrumGrid({ pattern, onChange, playingStep, timeSignature = FOUR_FOUR }: DrumGridProps) {
  const steps = pattern[0]?.length ?? 16;
  const compound = isCompound(timeSignature);
  // 見出し：4/4・3/4 は「n拍」（4マスごと）、6/8 は8分音符の番号（2マスごと。1と4が強い）
  const header = (s: number) => (compound ? (s % 2 === 0 ? `${s / 2 + 1}` : '') : s % 4 === 0 ? `${s / 4 + 1}拍` : s % 2 === 0 ? 'と' : '');
  const strong = (s: number) => (compound ? s % 6 === 0 : s % 4 === 0);
  const toggle = (lane: number, step: number) => {
    const next = pattern.map((row) => [...row]);
    next[lane]![step] = !next[lane]![step];
    onChange(next);
    if (next[lane]![step]) void audio.playDrum(DRUM_LANES[lane]!.drum);
  };

  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-1">
        <thead>
          <tr>
            <th />
            {Array.from({ length: steps }, (_, s) => (
              <th key={s} className={`w-8 text-[10px] font-normal ${strong(s) ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'}`}>
                {header(s)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DRUM_LANES.map((lane, li) => (
            <tr key={lane.drum}>
              <th className="whitespace-nowrap pr-2 text-right text-xs font-semibold">
                <button type="button" onClick={() => void audio.playDrum(lane.drum)} className="hover:text-brand-600" title="音を聴く">
                  {lane.name}
                </button>
              </th>
              {pattern[li]!.map((on, s) => (
                <td key={s}>
                  <button
                    type="button"
                    aria-label={`${lane.name} ${s + 1}`}
                    aria-pressed={on}
                    onClick={() => toggle(li, s)}
                    className={[
                      'h-9 w-8 rounded-md border transition',
                      on ? 'border-brand-700 bg-brand-500' : strong(s) ? 'border-slate-300 bg-slate-100 dark:border-slate-600 dark:bg-slate-800' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900',
                      playingStep === s ? 'ring-2 ring-amber-400' : '',
                    ].join(' ')}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
