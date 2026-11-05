// ダイアトニックコード：キーのスケールの音だけで作るコード。
// スケールの音を「1つ飛ばし」に3つ（または4つ）重ねて作る。

import { CHORD_QUALITIES, chordIntervalsFromTones, type ChordQualityId } from './chord';
import { keyScaleId, type MusicalKey } from './key';
import type { PitchClass } from './pitch';
import { scaleNotes, type ScaleId } from './scale';

/** コードの機能：T = トニック（安定）、SD = サブドミナント（展開）、D = ドミナント（緊張） */
export type HarmonicFunction = 'T' | 'SD' | 'D';

export const FUNCTION_INFO: Record<HarmonicFunction, { nameJa: string; short: string; plain: string }> = {
  T: { nameJa: 'トニック', short: 'T', plain: '曲の「家」のような、落ち着いて安定した役割' },
  SD: { nameJa: 'サブドミナント', short: 'SD', plain: '家から少し出かけるような、広がり・展開を感じさせる役割' },
  D: { nameJa: 'ドミナント', short: 'D', plain: '主役のコード（トニック）に戻りたくなるような、緊張感を作る役割' },
};

/**
 * 度数ごとの機能。
 * 2つ以上ある場合は「解釈が分かれる」ことを表す（並び順に優劣はない）。
 * 根拠：機能和声の一般的な分類（長調：Ⅲ は T／D の両面、短調：Ⅵ は T／SD、Ⅶ は SD／D の両面を持つとされる）
 */
const MAJOR_FUNCTIONS: Record<number, HarmonicFunction[]> = {
  1: ['T'],
  2: ['SD'],
  3: ['T', 'D'],
  4: ['SD'],
  5: ['D'],
  6: ['T'],
  7: ['D'],
};
const MINOR_FUNCTIONS: Record<number, HarmonicFunction[]> = {
  1: ['T'],
  2: ['SD'],
  3: ['T'],
  4: ['SD'],
  5: ['D'],
  6: ['T', 'SD'],
  7: ['SD', 'D'],
};

export function functionsForDegree(mode: MusicalKey['mode'], degree: number): HarmonicFunction[] {
  return [...((mode === 'major' ? MAJOR_FUNCTIONS : MINOR_FUNCTIONS)[degree] ?? [])];
}

export interface DiatonicChord {
  /** 度数（1〜7） */
  degree: number;
  root: PitchClass;
  quality: ChordQualityId;
  tones: PitchClass[];
  /** どのスケールから作ったか */
  scale: ScaleId;
  functions: HarmonicFunction[];
}

const TRIAD_QUALITIES: ChordQualityId[] = ['maj', 'm', 'dim', 'aug'];
const SEVENTH_QUALITIES: ChordQualityId[] = ['maj7', 'm7', '7', 'm7b5', 'dim7', 'mMaj7', 'augMaj7'];

/** 構成音の並び（綴り）から、コードの種類を判定する */
export function qualityFromTones(tones: PitchClass[]): ChordQualityId {
  const ivs = chordIntervalsFromTones(tones).join(' ');
  const candidates = tones.length === 3 ? TRIAD_QUALITIES : SEVENTH_QUALITIES;
  const found = candidates.find((id) => CHORD_QUALITIES[id].intervals.map((i) => `${i.quality}${i.number}`).join(' ') === ivs);
  if (!found) throw new Error(`コードの種類を判定できません：${ivs}`);
  return found;
}

/**
 * ダイアトニックコードの一覧。
 * - sevenths：true なら4和音（セブンスコード）
 * - scale：マイナーキーでハーモニック／メロディックマイナーから作る場合に指定
 */
export function diatonicChords(
  key: MusicalKey,
  opts: { sevenths?: boolean; scale?: ScaleId } = {},
): DiatonicChord[] {
  const scale = opts.scale ?? keyScaleId(key);
  const notes = scaleNotes(key.tonic, scale);
  if (notes.length !== 7) throw new Error('ダイアトニックコードは7音のスケールでのみ作れます');
  const size = opts.sevenths ? 4 : 3;
  return notes.map((root, i) => {
    const tones = Array.from({ length: size }, (_, k) => notes[(i + k * 2) % 7]!);
    const degree = i + 1;
    let functions = functionsForDegree(key.mode, degree);
    // ハーモニック／メロディックマイナーの Ⅴ と Ⅶ は導音を含むためドミナント
    if (key.mode === 'minor' && scale !== 'naturalMinor' && (degree === 5 || degree === 7)) functions = ['D'];
    return { degree, root, quality: qualityFromTones(tones), tones, scale, functions };
  });
}
