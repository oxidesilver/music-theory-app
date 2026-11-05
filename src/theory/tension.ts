// テンションと「コードに対する音の役割」の計算。
// メロディー作り（Phase 7）で、各音がコードに対してどんな役割かを表示するために使う。
// ※ ここでの「注意が必要」は一般的な目安（アボイドノートの考え方）であり、使ってはいけない音という意味ではない。

import { chordTones, type ChordQualityId } from './chord';
import { intervalBetweenPitchClasses, type Interval } from './interval';
import { mod, semitoneOf, type PitchClass } from './pitch';

export type NoteRole = 'chord-tone' | 'tension' | 'scale' | 'caution' | 'outside';

export const NOTE_ROLE_LABEL_JA: Record<NoteRole, string> = {
  'chord-tone': 'コードトーン',
  tension: 'テンションとして使える音',
  scale: 'スケール内の音',
  caution: '注意が必要な音',
  outside: 'スケール外の音',
};

/** ドミナント系のコード（♭9・♭13 も一般的なテンションとして扱う） */
const DOMINANT_FAMILY = new Set<ChordQualityId>(['7', '9', '13', '11', '7sus4']);

export interface TensionInfo {
  note: PitchClass;
  /** 表示用（例：9・♭9・♯11・13） */
  label: string;
  interval: Interval;
  /** コードトーンの半音上にあたる（ぶつかりやすい）音か */
  caution: boolean;
  reason?: string;
}

function tensionLabel(iv: Interval): string | undefined {
  const n = iv.number;
  if (n !== 2 && n !== 4 && n !== 6) return undefined;
  const number = n + 7; // 2度 → 9th、4度 → 11th、6度 → 13th
  const natural = n === 4 ? 'P' : 'M';
  if (iv.quality === natural) return String(number);
  if (iv.quality === 'm' || iv.quality === 'd') return `♭${number}`;
  if (iv.quality === 'A') return `♯${number}`;
  return undefined;
}

/** コードトーンのすぐ半音上にある音か（ぶつかって濁りやすい） */
function halfStepAboveChordTone(note: PitchClass, tones: PitchClass[]): PitchClass | undefined {
  const s = semitoneOf(note);
  return tones.find((t) => mod(s - semitoneOf(t), 12) === 1);
}

function isCaution(label: string, quality: ChordQualityId, note: PitchClass, tones: PitchClass[]): { caution: boolean; reason?: string } {
  const clash = halfStepAboveChordTone(note, tones);
  if (!clash) return { caution: false };
  if (DOMINANT_FAMILY.has(quality) && (label === '♭9' || label === '♭13')) return { caution: false };
  return { caution: true, reason: `コードの音（${clash.letter}${clash.accidental > 0 ? '#' : clash.accidental < 0 ? '♭' : ''}）の半音上にあり、長く伸ばすとぶつかって聞こえやすい音です` };
}

/** スケールの音のうち、コードに対してテンションになる音の一覧 */
export function tensionsFor(root: PitchClass, quality: ChordQualityId, scale: PitchClass[]): TensionInfo[] {
  const tones = chordTones(root, quality);
  const toneSemis = new Set(tones.map(semitoneOf));
  const result: TensionInfo[] = [];
  for (const note of scale) {
    if (toneSemis.has(semitoneOf(note))) continue;
    const iv = intervalBetweenPitchClasses(root, note);
    const label = tensionLabel(iv);
    if (!label) continue;
    result.push({ note, label, interval: iv, ...isCaution(label, quality, note, tones) });
  }
  return result.sort((a, b) => a.interval.number - b.interval.number);
}

/**
 * ある音がコードに対してどんな役割か。
 * - chord-tone：コードの構成音
 * - tension：スケール内で、9th・11th・13th として使いやすい音
 * - caution：スケール内だが、コードの音とぶつかりやすい音
 * - scale：スケール内のその他の音（経過音などに使える）
 * - outside：スケール外の音（経過音・装飾音として使うこともできる）
 */
export function classifyNote(
  note: PitchClass,
  chord: { root: PitchClass; quality: ChordQualityId },
  scale: PitchClass[],
): { role: NoteRole; tension?: TensionInfo } {
  const s = semitoneOf(note);
  if (chordTones(chord.root, chord.quality).some((t) => semitoneOf(t) === s)) return { role: 'chord-tone' };
  if (!scale.some((n) => semitoneOf(n) === s)) return { role: 'outside' };
  const tension = tensionsFor(chord.root, chord.quality, scale).find((t) => semitoneOf(t.note) === s);
  if (tension) return { role: tension.caution ? 'caution' : 'tension', tension };
  return { role: 'scale' };
}
