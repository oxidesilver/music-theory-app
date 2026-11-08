// 拍子（4/4・3/4・6/8）の計算。時間の単位は tick（4分音符 = 480）。
// - 4/4・3/4 は4分音符を1拍として数える「単純拍子」
// - 6/8 は8分音符3つ（付点4分音符）をひとまとまりで感じる「複合拍子」

import { PPQ } from '@/storage/types';

export type TimeSignature = [number, number];

export const FOUR_FOUR: TimeSignature = [4, 4];

export const TIME_SIGNATURES: { id: string; value: TimeSignature; label: string; description: string }[] = [
  { id: '4/4', value: [4, 4], label: '4/4', description: '1小節に4分音符が4つ。ポップス・ロック・ダンスなど、もっとも多い拍子です。' },
  { id: '3/4', value: [3, 4], label: '3/4', description: '1小節に4分音符が3つ。「ズン・チャッ・チャッ」のワルツの拍子です。' },
  { id: '6/8', value: [6, 8], label: '6/8', description: '1小節に8分音符が6つ。3つずつ2まとまりで「タタタ・タタタ」と揺れるように感じる拍子です。' },
];

export function timeSignatureLabel(ts: TimeSignature): string {
  return `${ts[0]}/${ts[1]}`;
}

/** 対応している拍子か（それ以外は 4/4 として扱う） */
export function normalizeTimeSignature(ts: readonly number[] | undefined): TimeSignature {
  const found = TIME_SIGNATURES.find((t) => ts && t.value[0] === ts[0] && t.value[1] === ts[1]);
  return found ? [...found.value] : [...FOUR_FOUR];
}

/** 3つずつまとまって感じる複合拍子か（6/8 など） */
export function isCompound(ts: TimeSignature): boolean {
  return ts[1] === 8 && ts[0] % 3 === 0 && ts[0] > 3;
}

/** 1小節の長さ（tick） */
export function barTicks(ts: TimeSignature): number {
  return (ts[0] * PPQ * 4) / ts[1];
}

/** 1小節の長さ（4分音符を1とした拍数） */
export function barBeats(ts: TimeSignature): number {
  return barTicks(ts) / PPQ;
}

/** 楽譜に書かれた1拍の長さ（分母の音符。4/4・3/4 は4分音符、6/8 は8分音符） */
export function countTicks(ts: TimeSignature): number {
  return (PPQ * 4) / ts[1];
}

/** 体で感じる1拍の長さ（6/8 は付点4分音符） */
export function pulseTicks(ts: TimeSignature): number {
  return isCompound(ts) ? countTicks(ts) * 3 : countTicks(ts);
}

/** ドラム入力の1小節のマス数（16分音符単位）。4/4 → 16、3/4・6/8 → 12 */
export function stepsPerBar(ts: TimeSignature): number {
  return barTicks(ts) / (PPQ / 4);
}

/** コードの長さの選択肢（4分音符を1とした拍数）と表示名 */
export function durationOptions(ts: TimeSignature): { beats: number; label: string }[] {
  const bar = barBeats(ts);
  if (isCompound(ts)) {
    return [
      { beats: bar / 2, label: '半小節' },
      { beats: bar, label: '1小節' },
      { beats: bar * 2, label: '2小節' },
    ];
  }
  const opts = [1, 2, bar, bar * 2].filter((b, i, a) => a.indexOf(b) === i).sort((a, b) => a - b);
  return opts.map((b) => ({ beats: b, label: b === bar ? `${b}拍（1小節）` : b === bar * 2 ? `${b}拍（2小節）` : `${b}拍` }));
}

/** 位置（tick）を「何小節目・何拍目」に直す（拍は楽譜の分母の音符で数える） */
export function barAndCount(tick: number, ts: TimeSignature): { bar: number; count: number } {
  const bar = Math.floor(tick / barTicks(ts)) + 1;
  const count = (tick % barTicks(ts)) / countTicks(ts) + 1;
  return { bar, count };
}
