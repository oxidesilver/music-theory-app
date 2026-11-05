import { useEffect, useState } from 'react';
import { audio } from './engine';
import { useIsPlaying } from './useIsPlaying';

/** 再生位置（秒）を画面に反映する。再生中だけ1秒に約30回更新する */
export function usePlaybackPosition(): number | null {
  const playing = useIsPlaying();
  const [pos, setPos] = useState<number | null>(null);
  useEffect(() => {
    if (!playing) {
      setPos(null);
      return;
    }
    let raf = 0;
    const tick = () => {
      setPos(audio.positionSeconds);
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [playing]);
  return pos;
}
