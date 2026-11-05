// スケール（音階）。スケールは「主音からの音程の並び」として定義する。

import { parseInterval, transposePitch, transposePitchClass, type Interval } from './interval';
import { semitoneOf, type Pitch, type PitchClass } from './pitch';

export type ScaleId =
  | 'major'
  | 'naturalMinor'
  | 'harmonicMinor'
  | 'melodicMinor'
  | 'majorPentatonic'
  | 'minorPentatonic'
  | 'blues'
  | 'majorBlues'
  | 'dorian'
  | 'phrygian'
  | 'lydian'
  | 'mixolydian'
  | 'locrian'
  | 'wholeTone'
  | 'diminishedWH'
  | 'diminishedHW';

export interface ScaleDefinition {
  id: ScaleId;
  nameJa: string;
  nameEn: string;
  intervals: readonly Interval[];
  /** 初心者向けの一言説明 */
  summary: string;
}

function def(id: ScaleId, nameJa: string, nameEn: string, intervals: string, summary: string): ScaleDefinition {
  return { id, nameJa, nameEn, intervals: intervals.split(' ').map(parseInterval), summary };
}

export const SCALES: Readonly<Record<ScaleId, ScaleDefinition>> = {
  major: def('major', 'メジャースケール', 'Major', 'P1 M2 M3 P4 P5 M6 M7', '「ドレミファソラシ」の並び。明るい響きの基本の音階'),
  naturalMinor: def('naturalMinor', 'ナチュラルマイナースケール', 'Natural Minor', 'P1 M2 m3 P4 P5 m6 m7', '「ラシドレミファソ」の並び。暗い・切ない響きの基本の音階'),
  harmonicMinor: def('harmonicMinor', 'ハーモニックマイナースケール', 'Harmonic Minor', 'P1 M2 m3 P4 P5 m6 M7', 'ナチュラルマイナーの7番目の音を半音上げた音階。主音に戻りたくなる力が強くなる'),
  melodicMinor: def('melodicMinor', 'メロディックマイナースケール', 'Melodic Minor', 'P1 M2 m3 P4 P5 M6 M7', 'ナチュラルマイナーの6番目と7番目の音を半音上げた音階（上行形）。メロディーがなめらかになる'),
  majorPentatonic: def('majorPentatonic', 'メジャーペンタトニック', 'Major Pentatonic', 'P1 M2 M3 P5 M6', 'メジャースケールから4番目と7番目を抜いた5音の音階。どの音も外れにくい'),
  minorPentatonic: def('minorPentatonic', 'マイナーペンタトニック', 'Minor Pentatonic', 'P1 m3 P4 P5 m7', 'ナチュラルマイナーから2番目と6番目を抜いた5音の音階。ロックやR&Bでよく使われる'),
  blues: def('blues', 'ブルーススケール', 'Blues', 'P1 m3 P4 d5 P5 m7', 'マイナーペンタトニックに「♭5（ブルーノート）」を加えた音階'),
  majorBlues: def('majorBlues', 'メジャーブルーススケール', 'Major Blues', 'P1 M2 m3 M3 P5 M6', 'メジャーペンタトニックに短3度を加えた音階'),
  dorian: def('dorian', 'ドリアン', 'Dorian', 'P1 M2 m3 P4 P5 M6 m7', 'マイナーの響きで、6番目の音が明るい。おしゃれなマイナー'),
  phrygian: def('phrygian', 'フリジアン', 'Phrygian', 'P1 m2 m3 P4 P5 m6 m7', '2番目の音が主音のすぐ上（半音）にある、エキゾチックなマイナー'),
  lydian: def('lydian', 'リディアン', 'Lydian', 'P1 M2 M3 A4 P5 M6 M7', '4番目の音が半音高い、浮遊感のあるメジャー'),
  mixolydian: def('mixolydian', 'ミクソリディアン', 'Mixolydian', 'P1 M2 M3 P4 P5 M6 m7', '7番目の音が半音低い、ロックやブルースっぽいメジャー'),
  locrian: def('locrian', 'ロクリアン', 'Locrian', 'P1 m2 m3 P4 d5 m6 m7', '5番目の音が半音低い、不安定な音階。m7(♭5) コードと相性がよい'),
  wholeTone: def('wholeTone', 'ホールトーンスケール', 'Whole Tone', 'P1 M2 M3 A4 A5 m7', 'すべて全音で並んだ6音の音階。夢の中のような響き'),
  diminishedWH: def('diminishedWH', 'ディミニッシュスケール（全半）', 'Diminished (W-H)', 'P1 M2 m3 P4 d5 m6 M6 M7', '全音・半音を交互に並べた8音の音階。dim7 コードと相性がよい'),
  diminishedHW: def('diminishedHW', 'コンビネーションオブディミニッシュ（半全）', 'Diminished (H-W)', 'P1 m2 m3 M3 A4 P5 M6 m7', '半音・全音を交互に並べた8音の音階。セブンスコードの緊張感を強める'),
};

/** スケールの構成音（オクターブなし） */
export function scaleNotes(tonic: PitchClass, scaleId: ScaleId): PitchClass[] {
  return SCALES[scaleId].intervals.map((iv) => transposePitchClass(tonic, iv));
}

/** スケールの構成音（オクターブ付き・主音から上に1オクターブ分） */
export function scalePitches(tonic: Pitch, scaleId: ScaleId): Pitch[] {
  return SCALES[scaleId].intervals.map((iv) => transposePitch(tonic, iv));
}

/** 鍵盤上でスケールに含まれる音か（綴りは問わない） */
export function scaleContainsSemitone(tonic: PitchClass, scaleId: ScaleId, note: PitchClass): boolean {
  const s = semitoneOf(note);
  return scaleNotes(tonic, scaleId).some((n) => semitoneOf(n) === s);
}
