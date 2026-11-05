// 音の高さ・音量の変換（Tone.js に依存しない純粋な計算。テスト可能）

/** MIDI ノート番号 → 周波数（Hz）。A4（MIDI 69）= 440Hz の平均律 */
export function midiToFrequency(midi: number, a4 = 440): number {
  return a4 * 2 ** ((midi - 69) / 12);
}

/** 0〜1 の音量 → デシベル（0 は無音） */
export function volumeToDb(volume: number): number {
  const v = Math.min(1, Math.max(0, volume));
  if (v === 0) return -Infinity;
  // 人の耳の感じ方に近づけるため2乗カーブにする
  return 20 * Math.log10(v * v);
}

/** BPM と拍数から秒数 */
export function beatsToSeconds(beats: number, bpm: number): number {
  return (60 / bpm) * beats;
}
