// コード進行の分析。
// 各コードを「ダイアトニック」「ハーモニック／メロディックマイナー由来」「セカンダリードミナント」
// 「同主調からの借用（モーダルインターチェンジ）」「その他のノンダイアトニック」に分類する。
// ※ 分類は理論上の一つの見方であり、音楽的な正解・不正解を決めるものではない。

import { chordTones, type ChordQualityId, type ChordSpec } from './chord';
import { diatonicChords, functionsForDegree, type HarmonicFunction } from './diatonic';
import { transposePitchClass, parseInterval } from './interval';
import { keyName, keyScaleId, parallelKey, type MusicalKey } from './key';
import { isEnharmonic, semitoneOf, type PitchClass } from './pitch';
import { degreeOf, formatDegree, romanNumeral, type RomanStyle } from './roman';
import { scaleNotes, type ScaleId } from './scale';

export type ChordCategory =
  | 'diatonic'
  | 'harmonic-minor'
  | 'melodic-minor'
  | 'secondary-dominant'
  | 'borrowed'
  | 'non-diatonic';

export const CATEGORY_LABEL_JA: Record<ChordCategory, string> = {
  diatonic: 'ダイアトニックコード',
  'harmonic-minor': 'ハーモニックマイナー由来',
  'melodic-minor': 'メロディックマイナー由来',
  'secondary-dominant': 'セカンダリードミナント',
  borrowed: '同主調からの借用（モーダルインターチェンジ）',
  'non-diatonic': 'ノンダイアトニックコード',
};

export interface ChordAnalysis {
  chord: ChordSpec;
  roman: string;
  category: ChordCategory;
  /** 機能（2つ以上なら解釈が分かれる。空なら機能を特定しない） */
  functions: HarmonicFunction[];
  /** セカンダリードミナントの場合の表記（例：V7/ii）と、解決先の度数 */
  secondaryOf?: { label: string; targetDegree: number };
  /** サブドミナントマイナーとして説明できる借用コードか */
  subdominantMinor?: boolean;
  /** 初心者向けの説明 */
  notes: string[];
}

function allTonesIn(tones: PitchClass[], scale: PitchClass[]): boolean {
  const set = new Set(scale.map(semitoneOf));
  return tones.every((t) => set.has(semitoneOf(t)));
}

/** ルートをキーのスケールの綴りに合わせる（例：D メジャーキーで G♭ と入力 → F#） */
export function normalizeRoot(key: MusicalKey, chord: ChordSpec): ChordSpec {
  const match = scaleNotes(key.tonic, keyScaleId(key)).find((n) => isEnharmonic(n, chord.root));
  if (!match || (match.letter === chord.root.letter && match.accidental === chord.root.accidental)) return chord;
  return { ...chord, root: { ...match } };
}

/** セカンダリードミナントとして扱うコードの種類と、表記に付ける記号 */
const DOMINANT_SUFFIX: Partial<Record<ChordQualityId, string>> = { maj: '', '7': '7', '9': '9', '13': '13' };

export function analyzeChord(
  key: MusicalKey,
  input: ChordSpec,
  opts: { style?: RomanStyle } = {},
): ChordAnalysis {
  const style = opts.style ?? 'japanese';
  const chord = normalizeRoot(key, input);
  const tones = chordTones(chord.root, chord.quality, 'common');
  const roman = romanNumeral(key, chord, { style });
  const deg = degreeOf(key, chord.root);
  const keyNotes = scaleNotes(key.tonic, keyScaleId(key));

  // 1. ダイアトニック
  if (allTonesIn(tones, keyNotes)) {
    const notes = [`キー ${keyName(key)} のスケールの音だけでできたコードです。`];
    return { chord, roman, category: 'diatonic', functions: functionsForDegree(key.mode, deg.degree), notes };
  }

  // 2. マイナーキー：ハーモニック／メロディックマイナー由来
  if (key.mode === 'minor') {
    for (const [scale, category] of [
      ['harmonicMinor', 'harmonic-minor'],
      ['melodicMinor', 'melodic-minor'],
    ] as [ScaleId, ChordCategory][]) {
      if (allTonesIn(tones, scaleNotes(key.tonic, scale))) {
        const functions: HarmonicFunction[] =
          deg.degree === 5 || deg.degree === 7 ? ['D'] : functionsForDegree('minor', deg.degree);
        const scaleName = scale === 'harmonicMinor' ? 'ハーモニックマイナー' : 'メロディックマイナー';
        return {
          chord,
          roman,
          category,
          functions,
          notes: [
            `${scaleName}スケールの音でできたコードです。`,
            ...(functions.includes('D') ? ['導音（主音の半音下の音）を含むため、主音に戻りたくなる力が強いコードです。'] : []),
          ],
        };
      }
    }
  }

  // 3. セカンダリードミナント（あるダイアトニックコードの「Ⅴ」にあたるコード）
  const dominantSuffix = DOMINANT_SUFFIX[chord.quality];
  if (dominantSuffix !== undefined) {
    const targetRoot = transposePitchClass(chord.root, parseInterval('P5'), -1);
    const target = keyNotes.find((n) => isEnharmonic(n, targetRoot));
    if (target) {
      const tDeg = degreeOf(key, target);
      const targetQuality = diatonicChords(key)[tDeg.degree - 1]!.quality;
      // 主音（Ⅰ）へのドミナントは通常のⅤ、ディミニッシュは一時的な主役になりにくいため対象外
      if (tDeg.degree !== 1 && targetQuality !== 'dim') {
        const targetIsMinor = targetQuality === 'm';
        const targetLabel =
          style === 'japanese'
            ? formatDegree(tDeg, 'japanese') + (targetIsMinor ? 'm' : '')
            : formatDegree(tDeg, 'english', targetIsMinor);
        const label = `${style === 'japanese' ? 'Ⅴ' : 'V'}${dominantSuffix}/${targetLabel}`;
        return {
          chord,
          roman,
          category: 'secondary-dominant',
          functions: ['D'],
          secondaryOf: { label, targetDegree: tDeg.degree },
          notes: [
            `「${targetLabel}」を一時的に主役に見立てたときのドミナント（${label}）として説明できます。`,
            `次に「${targetLabel}」へ進むと、解決した感じが強く出ます。`,
          ],
        };
      }
    }
  }

  // 4. 同主調からの借用
  const parallel = parallelKey(key);
  if (allTonesIn(tones, scaleNotes(parallel.tonic, keyScaleId(parallel)))) {
    const pDeg = degreeOf(parallel, chord.root);
    const functions = functionsForDegree(parallel.mode, pDeg.degree);
    const subdominantMinor = key.mode === 'major' && functions.includes('SD');
    return {
      chord,
      roman,
      category: 'borrowed',
      functions,
      subdominantMinor,
      notes: [
        `同主調（${keyName(parallel)}）のダイアトニックコードを借りてきたコードです。`,
        ...(subdominantMinor
          ? ['サブドミナントマイナーとして使われることが多く、明るい曲に切なさや陰りを加えます。']
          : []),
      ],
    };
  }

  // 5. その他
  return {
    chord,
    roman,
    category: 'non-diatonic',
    functions: [],
    notes: ['キーのスケールに含まれない音を使ったコードです。経過的なコードや転調のきっかけとして使われることがあります。'],
  };
}

export interface ProgressionAnalysis {
  chords: ChordAnalysis[];
  /** 「解決」と説明できる動き（index は前のコードの位置） */
  resolutions: { index: number; kind: 'dominant' | 'secondary-dominant'; description: string }[];
}

/** コード進行全体の分析 */
export function analyzeProgression(
  key: MusicalKey,
  chords: ChordSpec[],
  opts: { style?: RomanStyle } = {},
): ProgressionAnalysis {
  const analyses = chords.map((c) => analyzeChord(key, c, opts));
  const resolutions: ProgressionAnalysis['resolutions'] = [];
  for (let i = 0; i < analyses.length - 1; i++) {
    const a = analyses[i]!;
    const b = analyses[i + 1]!;
    const fallsFifth =
      (semitoneOf(a.chord.root) - semitoneOf(b.chord.root) + 12) % 12 === 7;
    if (!fallsFifth) continue;
    if (a.category === 'secondary-dominant' && a.secondaryOf && degreeOf(key, b.chord.root).degree === a.secondaryOf.targetDegree) {
      resolutions.push({ index: i, kind: 'secondary-dominant', description: `${a.roman} → ${b.roman}：セカンダリードミナントの解決` });
    } else if (a.functions.length === 1 && a.functions[0] === 'D' && degreeOf(key, b.chord.root).degree === 1 && degreeOf(key, b.chord.root).accidental === 0) {
      resolutions.push({ index: i, kind: 'dominant', description: `${a.roman} → ${b.roman}：ドミナントからトニックへの解決（ドミナントモーション）` });
    }
  }
  return { chords: analyses, resolutions };
}
