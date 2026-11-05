import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// アプリ設定。軽い情報なので localStorage に保存する（設計書 4-3）。

export type ThemeSetting = 'system' | 'light' | 'dark';
/** ローマ数字の表記：日本式（Ⅵm, Ⅳ△7）／英米式（vi, IVmaj7） */
export type RomanStyle = 'japanese' | 'english';
/** 中央のドの呼び方：FL Studio式（C5）／一般的な表記（C4） */
export type OctaveConvention = 'fl' | 'standard';
export type InstrumentId = 'piano' | 'synth' | 'bass';

export interface Settings {
  theme: ThemeSetting;
  romanStyle: RomanStyle;
  octaveConvention: OctaveConvention;
  masterVolume: number; // 0〜1
  instrument: InstrumentId;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  romanStyle: 'japanese',
  octaveConvention: 'fl',
  masterVolume: 0.8,
  instrument: 'piano',
};

interface SettingsState extends Settings {
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
}

export const SETTINGS_STORAGE_KEY = 'mta-settings';

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      update: (patch) => set(patch),
      reset: () => set(DEFAULT_SETTINGS),
    }),
    {
      name: SETTINGS_STORAGE_KEY,
      version: 1,
      // 関数は保存しない（設定値だけを保存）
      partialize: ({ theme, romanStyle, octaveConvention, masterVolume, instrument }) => ({
        theme,
        romanStyle,
        octaveConvention,
        masterVolume,
        instrument,
      }),
    },
  ),
);
