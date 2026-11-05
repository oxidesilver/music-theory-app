// 耳トレーニングの問題を作る（画面から分離。乱数を差し替えればテストで同じ問題を再現できる）
// 正解の音は音楽理論エンジンで計算する。

import type { SequenceEvent } from '@/audio/engine';
import { chordPitches, type ChordQualityId } from '@/theory/chord';
import { intervalNameJa, intervalSemitones, parseInterval, transposePitch } from '@/theory/interval';
import { makeKey, type MusicalKey } from '@/theory/key';
import { midiOf, pitchFromMidi, type Pitch } from '@/theory/pitch';
import { chordFromRoman, romanNumeral, type RomanStyle } from '@/theory/roman';
import { normalizeRoot } from '@/theory/analysis';
import { makeChord, toSequence } from '@/features/progression/logic';

export type Rng = () => number;

/** 再現できる乱数（テスト用） */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(rng: Rng, items: readonly T[]): T => items[Math.floor(rng() * items.length)]!;
const randInt = (rng: Rng, min: number, max: number) => min + Math.floor(rng() * (max - min + 1));
function shuffle<T>(rng: Rng, items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** 鳴らし方 */
export type PlaySpec =
  | { kind: 'compare'; midis: [number, number] }
  | { kind: 'chord'; midis: number[] }
  | { kind: 'sequence'; events: SequenceEvent[]; bpm: number };

export interface Choice {
  label: string;
  /** その選択肢の音（答えたあとに聴き比べる用） */
  play: PlaySpec;
}

export interface EarQuestion {
  type: QuestionTypeId;
  level: 1 | 2 | 3;
  prompt: string;
  choices: Choice[];
  answer: number;
  /** 出題した音 */
  play: PlaySpec;
  explanation: string;
}

export type QuestionTypeId =
  | 'same-different'
  | 'half-whole'
  | 'thirds'
  | 'fifth-octave'
  | 'intervals-mixed'
  | 'major-minor'
  | 'triads'
  | 'sevenths'
  | 'bright-dark'
  | 'resolution'
  | 'progression-identify';

export interface QuestionTypeInfo {
  id: QuestionTypeId;
  level: 1 | 2 | 3;
  title: string;
  description: string;
}

export const QUESTION_TYPES: QuestionTypeInfo[] = [
  { id: 'same-different', level: 1, title: '同じ音か違う音か', description: '2つの音が同じ高さか、違う高さかを聴き分けます。' },
  { id: 'half-whole', level: 1, title: '半音と全音', description: 'となりの音（半音）か、1つ飛ばした音（全音）かを聴き分けます。' },
  { id: 'thirds', level: 1, title: '長3度と短3度', description: '明るい3度（長3度）か、暗い3度（短3度）かを聴き分けます。' },
  { id: 'fifth-octave', level: 1, title: '完全4度・完全5度・オクターブ', description: 'よく溶け合う3つの音程を聴き分けます。' },
  { id: 'intervals-mixed', level: 1, title: '音程いろいろ（応用）', description: '短2度〜オクターブまでの音程から答えます。' },
  { id: 'major-minor', level: 2, title: 'メジャーとマイナー', description: '明るいコードか、暗いコードかを聴き分けます。' },
  { id: 'triads', level: 2, title: '4種類の3和音', description: 'メジャー・マイナー・ディミニッシュ・オーギュメントを聴き分けます。' },
  { id: 'sevenths', level: 2, title: 'セブンスコード', description: '7・maj7・m7・m7(♭5) を聴き分けます。' },
  { id: 'bright-dark', level: 3, title: '明るい進行と暗い進行', description: 'コード進行全体の明るさを聴き分けます。' },
  { id: 'resolution', level: 3, title: '解決感と緊張感', description: '最後に落ち着いて終わるか、緊張感が残ったまま終わるかを聴き分けます。' },
  { id: 'progression-identify', level: 3, title: 'コード進行の聴き分け', description: '3つの進行の中から、鳴った進行を選びます。' },
];

export const LEVEL_INFO: Record<1 | 2 | 3, { title: string; description: string }> = {
  1: { title: 'レベル1：音程', description: '2つの音の距離を聴き分けます。' },
  2: { title: 'レベル2：コード', description: 'コードの種類を聴き分けます。' },
  3: { title: 'レベル3：コード進行', description: '進行の雰囲気や流れを聴き分けます。' },
};

export interface GenerateContext {
  rng: Rng;
  /** 音名の表示（設定に合わせる） */
  fmt: (p: Pitch) => string;
  romanStyle: RomanStyle;
}

/** 音名の綴り：# 系か ♭ 系かをランダムに選ぶ */
function randomPitch(rng: Rng, low: number, high: number): Pitch {
  return pitchFromMidi(randInt(rng, low, high), rng() < 0.5 ? 'sharp' : 'flat');
}

// ---- レベル1：音程 ----

function intervalQuestion(
  type: QuestionTypeId,
  ctx: GenerateContext,
  options: { interval: string; label: string; feel: string }[],
  prompt: string,
): EarQuestion {
  const from = randomPitch(ctx.rng, 55, 67);
  const choices = options.map((o) => {
    const to = transposePitch(from, parseInterval(o.interval));
    return { label: o.label, play: { kind: 'compare', midis: [midiOf(from), midiOf(to)] } as PlaySpec };
  });
  const answer = Math.floor(ctx.rng() * options.length);
  const o = options[answer]!;
  const iv = parseInterval(o.interval);
  const to = transposePitch(from, iv);
  return {
    type,
    level: 1,
    prompt,
    choices,
    answer,
    play: choices[answer]!.play,
    explanation: `今回は ${ctx.fmt(from)} → ${ctx.fmt(to)} の **${intervalNameJa(iv)}**（半音${intervalSemitones(iv)}つ分）でした。${o.feel}`,
  };
}

function sameDifferent(ctx: GenerateContext): EarQuestion {
  const a = randomPitch(ctx.rng, 55, 69);
  const same = ctx.rng() < 0.5;
  const offset = pick(ctx.rng, [-2, -1, 1, 2]);
  const b = same ? a : pitchFromMidi(midiOf(a) + offset, offset > 0 ? 'sharp' : 'flat');
  const diffMidi = midiOf(a) + offset;
  const choices: Choice[] = [
    { label: '同じ音', play: { kind: 'compare', midis: [midiOf(a), midiOf(a)] } },
    { label: '違う音', play: { kind: 'compare', midis: [midiOf(a), diffMidi] } },
  ];
  return {
    type: 'same-different',
    level: 1,
    prompt: '2つの音は同じ高さ？違う高さ？',
    choices,
    answer: same ? 0 : 1,
    play: { kind: 'compare', midis: [midiOf(a), midiOf(b)] },
    explanation: same
      ? `どちらも ${ctx.fmt(a)} の **同じ音** でした。同時に鳴らしたとき、うなりがなく1つの音に聞こえます。`
      : `${ctx.fmt(a)} → ${ctx.fmt(b)} で、**半音${Math.abs(offset)}つ分違う音** でした。同時に鳴らすと、2つの音がぶつかって聞こえます。`,
  };
}

// ---- レベル2：コード ----

const CHORD_LABEL: Partial<Record<ChordQualityId, { label: string; feel: string }>> = {
  maj: { label: 'メジャー', feel: '明るく安定した響き' },
  m: { label: 'マイナー', feel: '暗く切ない響き' },
  dim: { label: 'ディミニッシュ', feel: '不安定で怪しい響き' },
  aug: { label: 'オーギュメント', feel: 'ふわっと広がる不思議な響き' },
  '7': { label: '7（セブンス）', feel: '少し緊張感があり、次へ進みたくなる響き' },
  maj7: { label: 'maj7（メジャーセブンス）', feel: 'やわらかく、おしゃれな響き' },
  m7: { label: 'm7（マイナーセブンス）', feel: '暗さにやわらかさが加わった響き' },
  m7b5: { label: 'm7(♭5)（ハーフディミニッシュ）', feel: '暗く不安定な響き' },
};

function chordQuestion(type: QuestionTypeId, ctx: GenerateContext, qualities: ChordQualityId[], prompt: string): EarQuestion {
  const root = randomPitch(ctx.rng, 48, 59);
  const choices = qualities.map((q) => ({
    label: CHORD_LABEL[q]!.label,
    play: { kind: 'chord', midis: chordPitches(root, q).map(midiOf) } as PlaySpec,
  }));
  const answer = Math.floor(ctx.rng() * qualities.length);
  const q = qualities[answer]!;
  const tones = chordPitches(root, q).map(ctx.fmt).join('・');
  return {
    type,
    level: 2,
    prompt,
    choices,
    answer,
    play: choices[answer]!.play,
    explanation: `今回は **${CHORD_LABEL[q]!.label}** のコード（${tones}）でした。${CHORD_LABEL[q]!.feel}が特徴です。`,
  };
}

// ---- レベル3：コード進行 ----

const MAJOR_KEYS = ['C', 'D', 'Eb', 'F', 'G', 'A', 'Bb'];
const MINOR_KEYS = ['A', 'B', 'C', 'D', 'E', 'F#', 'G'];

function progressionPlay(key: MusicalKey, romans: string[]): PlaySpec {
  const chords = romans.map((r) => makeChord(normalizeRoot(key, chordFromRoman(key, r)), 2));
  return { kind: 'sequence', events: toSequence(chords, { withBass: true }), bpm: 100 };
}

function romanLabel(key: MusicalKey, romans: string[], style: RomanStyle) {
  return romans.map((r) => romanNumeral(key, normalizeRoot(key, chordFromRoman(key, r)), { style })).join(' – ');
}

const BRIGHT = [['Ⅰ', 'Ⅳ', 'Ⅴ', 'Ⅰ'], ['Ⅰ', 'Ⅵm', 'Ⅳ', 'Ⅴ'], ['Ⅰ', 'Ⅴ', 'Ⅵm', 'Ⅳ'], ['Ⅳ', 'Ⅴ', 'Ⅰ', 'Ⅰ']];
const DARK = [['Ⅰm', 'Ⅳm', 'Ⅴ7', 'Ⅰm'], ['Ⅰm', 'Ⅵ', 'Ⅶ', 'Ⅰm'], ['Ⅰm', 'Ⅳm', 'Ⅶ', 'Ⅲ'], ['Ⅰm', 'Ⅵ', 'Ⅲ', 'Ⅶ']];
const RESOLVED = [['Ⅱm', 'Ⅴ7', 'Ⅰ', 'Ⅰ'], ['Ⅰ', 'Ⅳ', 'Ⅴ7', 'Ⅰ'], ['Ⅵm', 'Ⅱm', 'Ⅴ7', 'Ⅰ']];
const UNRESOLVED = [['Ⅰ', 'Ⅳ', 'Ⅱm', 'Ⅴ7'], ['Ⅰ', 'Ⅵm', 'Ⅳ', 'Ⅴ'], ['Ⅳ', 'Ⅰ', 'Ⅱm', 'Ⅴ7']];
const IDENTIFY = [
  ['Ⅰ', 'Ⅳ', 'Ⅴ', 'Ⅰ'],
  ['Ⅰ', 'Ⅵm', 'Ⅳ', 'Ⅴ'],
  ['Ⅰ', 'Ⅴ', 'Ⅵm', 'Ⅳ'],
  ['Ⅵm', 'Ⅳ', 'Ⅴ', 'Ⅰ'],
  ['Ⅳ', 'Ⅴ', 'Ⅲm', 'Ⅵm'],
  ['Ⅰ', 'Ⅲm', 'Ⅳ', 'Ⅴ'],
];

function brightDark(ctx: GenerateContext): EarQuestion {
  const tonicIndex = Math.floor(ctx.rng() * MAJOR_KEYS.length);
  const major = makeKey(MAJOR_KEYS[tonicIndex]!, 'major');
  const minor = makeKey(MINOR_KEYS[tonicIndex]!, 'minor');
  const bright = pick(ctx.rng, BRIGHT);
  const dark = pick(ctx.rng, DARK);
  const choices: Choice[] = [
    { label: '明るい進行', play: progressionPlay(major, bright) },
    { label: '暗い進行', play: progressionPlay(minor, dark) },
  ];
  const answer = ctx.rng() < 0.5 ? 0 : 1;
  const label = answer === 0 ? romanLabel(major, bright, ctx.romanStyle) : romanLabel(minor, dark, ctx.romanStyle);
  return {
    type: 'bright-dark',
    level: 3,
    prompt: 'このコード進行は明るい？暗い？',
    choices,
    answer,
    play: choices[answer]!.play,
    explanation:
      answer === 0
        ? `メジャーキーの **明るい進行**（${label}）でした。主役のコードがメジャーコードで、全体が明るく聞こえます。`
        : `マイナーキーの **暗い進行**（${label}）でした。主役のコードがマイナーコードで、全体が暗く・切なく聞こえます。`,
  };
}

function resolution(ctx: GenerateContext): EarQuestion {
  const key = makeKey(pick(ctx.rng, MAJOR_KEYS), 'major');
  const res = pick(ctx.rng, RESOLVED);
  const unres = pick(ctx.rng, UNRESOLVED);
  const choices: Choice[] = [
    { label: '落ち着いて終わる（解決感）', play: progressionPlay(key, res) },
    { label: '緊張感が残ったまま終わる', play: progressionPlay(key, unres) },
  ];
  const answer = ctx.rng() < 0.5 ? 0 : 1;
  const label = romanLabel(key, answer === 0 ? res : unres, ctx.romanStyle);
  return {
    type: 'resolution',
    level: 3,
    prompt: '最後のコードで、落ち着いて終わった？緊張感が残った？',
    choices,
    answer,
    play: choices[answer]!.play,
    explanation:
      answer === 0
        ? `${label}：ドミナント（Ⅴ7）から主役のコード（Ⅰ）へ進んで終わるので、**解決した感じ** がします。`
        : `${label}：ドミナント（Ⅴ）で終わるので、主役のコードに戻りたい **緊張感が残ります**。`,
  };
}

function progressionIdentify(ctx: GenerateContext): EarQuestion {
  const key = makeKey(pick(ctx.rng, MAJOR_KEYS), 'major');
  const options = shuffle(ctx.rng, IDENTIFY).slice(0, 3);
  const choices: Choice[] = options.map((r) => ({ label: romanLabel(key, r, ctx.romanStyle), play: progressionPlay(key, r) }));
  const answer = Math.floor(ctx.rng() * choices.length);
  return {
    type: 'progression-identify',
    level: 3,
    prompt: '鳴ったコード進行はどれ？',
    choices,
    answer,
    play: choices[answer]!.play,
    explanation: `正解は **${choices[answer]!.label}** でした。ベース（一番低い音）の動きに注目すると、聴き分けやすくなります。`,
  };
}

/** 種類を指定して、問題を1つ作る */
export function generateQuestion(type: QuestionTypeId, ctx: GenerateContext): EarQuestion {
  switch (type) {
    case 'same-different':
      return sameDifferent(ctx);
    case 'half-whole':
      return intervalQuestion(type, ctx, [
        { interval: 'm2', label: '半音（短2度）', feel: 'となりの鍵盤どうしで、ぶつかるように聞こえます。' },
        { interval: 'M2', label: '全音（長2度）', feel: '1つ飛ばした鍵盤どうしで、半音より少し広く聞こえます。' },
      ], '2つの音の距離は、半音？全音？');
    case 'thirds':
      return intervalQuestion(type, ctx, [
        { interval: 'M3', label: '長3度', feel: '明るい響きが特徴です。' },
        { interval: 'm3', label: '短3度', feel: '暗い・切ない響きが特徴です。' },
      ], 'この3度は、長3度？短3度？');
    case 'fifth-octave':
      return intervalQuestion(type, ctx, [
        { interval: 'P4', label: '完全4度', feel: '溶け合いながらも、少し浮いた感じがします。' },
        { interval: 'P5', label: '完全5度', feel: '力強く、空間が広がったような響きです。' },
        { interval: 'P8', label: 'オクターブ', feel: '同じ音名で、1つの音のように溶け合います。' },
      ], 'この音程はどれ？');
    case 'intervals-mixed':
      return intervalQuestion(type, ctx, [
        { interval: 'm2', label: '短2度', feel: 'ぶつかる響きです。' },
        { interval: 'M2', label: '長2度', feel: '少しにじんだ響きです。' },
        { interval: 'm3', label: '短3度', feel: '暗い響きです。' },
        { interval: 'M3', label: '長3度', feel: '明るい響きです。' },
        { interval: 'P4', label: '完全4度', feel: '溶け合う響きです。' },
        { interval: 'P5', label: '完全5度', feel: '力強い響きです。' },
        { interval: 'M6', label: '長6度', feel: '広がりのある明るい響きです。' },
        { interval: 'P8', label: 'オクターブ', feel: '同じ音が重なる響きです。' },
      ], 'この音程はどれ？');
    case 'major-minor':
      return chordQuestion(type, ctx, ['maj', 'm'], 'このコードは、メジャー？マイナー？');
    case 'triads':
      return chordQuestion(type, ctx, ['maj', 'm', 'dim', 'aug'], 'このコードの種類は？');
    case 'sevenths':
      return chordQuestion(type, ctx, ['7', 'maj7', 'm7', 'm7b5'], 'このセブンスコードの種類は？');
    case 'bright-dark':
      return brightDark(ctx);
    case 'resolution':
      return resolution(ctx);
    case 'progression-identify':
      return progressionIdentify(ctx);
  }
}
