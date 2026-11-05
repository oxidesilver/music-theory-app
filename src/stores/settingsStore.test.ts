import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY, useSettings } from './settingsStore';

describe('設定の保存（localStorage）', () => {
  beforeEach(() => useSettings.getState().reset());

  it('初期値は 日本式ローマ数字・FL Studio式オクターブ', () => {
    const s = useSettings.getState();
    expect(s.romanStyle).toBe('japanese');
    expect(s.octaveConvention).toBe('fl');
    expect(s.theme).toBe('system');
  });

  it('変更した設定が localStorage に保存される', () => {
    useSettings.getState().update({ theme: 'dark', masterVolume: 0.5 });
    const saved = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}');
    expect(saved.state.theme).toBe('dark');
    expect(saved.state.masterVolume).toBe(0.5);
    expect(saved.state.update).toBeUndefined(); // 関数は保存しない
  });

  it('リセットで初期値に戻る', () => {
    useSettings.getState().update({ romanStyle: 'english' });
    useSettings.getState().reset();
    expect(useSettings.getState().romanStyle).toBe(DEFAULT_SETTINGS.romanStyle);
  });
});
