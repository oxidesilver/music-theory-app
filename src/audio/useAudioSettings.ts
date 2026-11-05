import { useEffect } from 'react';
import { useSettings } from '@/stores/settingsStore';
import { audio } from './engine';

/** 設定画面の音量・音色を音声エンジンに反映する（アプリ全体で1回だけ使う） */
export function useAudioSettings() {
  const volume = useSettings((s) => s.masterVolume);
  const instrument = useSettings((s) => s.instrument);
  useEffect(() => audio.setVolume(volume), [volume]);
  useEffect(() => audio.setDefaultInstrument(instrument), [instrument]);
}
