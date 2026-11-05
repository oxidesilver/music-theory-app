import { useSyncExternalStore } from 'react';
import { audio } from './engine';

/** 音声エンジンが再生中かどうかを画面に反映する */
export function useIsPlaying(): boolean {
  return useSyncExternalStore(
    (cb) => audio.subscribe(cb),
    () => audio.isPlaying,
    () => false,
  );
}
