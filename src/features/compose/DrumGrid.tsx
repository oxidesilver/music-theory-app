import { audio } from '@/audio/engine';
import { DRUM_LANES, STEPS_PER_BAR, type DrumPattern } from './logic';

interface DrumGridProps {
  pattern: DrumPattern;
  onChange: (p: DrumPattern) => void;
  playingStep: number | null;
}

/** 1小節分（16ステップ）のドラム入力。ここで作ったパターンを全小節で繰り返す */
export function DrumGrid({ pattern, onChange, playingStep }: DrumGridProps) {
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
            {Array.from({ length: STEPS_PER_BAR }, (_, s) => (
              <th key={s} className={`w-8 text-[10px] font-normal ${s % 4 === 0 ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'}`}>
                {s % 4 === 0 ? `${s / 4 + 1}拍` : s % 2 === 0 ? 'と' : ''}
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
                      on ? 'border-brand-700 bg-brand-500' : s % 4 === 0 ? 'border-slate-300 bg-slate-100 dark:border-slate-600 dark:bg-slate-800' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900',
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
