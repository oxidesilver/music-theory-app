// 音楽データの基本の型（設計書 4-1）。
// 音は「半音の数」だけでなく「文字＋変化記号」で持ち、C# と D♭ を区別する。
// 計算処理は Phase 2 の音楽理論エンジン（src/theory/）で実装する。

export type Letter = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';

/** オクターブなしの音名。accidental: +1 = #, -1 = ♭, +2 = ##, -2 = ♭♭ */
export interface PitchClass {
  letter: Letter;
  accidental: number;
}

/** オクターブ付きの音。octave は国際式（中央のド = C4）で保存し、表示だけ設定で切り替える */
export interface Pitch extends PitchClass {
  octave: number;
}

export type KeyMode = 'major' | 'minor';

export interface MusicalKey {
  tonic: PitchClass;
  mode: KeyMode;
}
