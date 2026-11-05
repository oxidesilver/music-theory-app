// コード進行メーカーの計算（画面から分離。テスト可能）
// ※ 候補や傾向は「理論上の目安」「よく使われる傾向」であり、絶対的な正解ではない。

import { analyzeChord, analyzeProgression, normalizeRoot, type ChordAnalysis } from '@/theory/analysis';
import { chordPitches, type ChordQualityId, type ChordSpec } from '@/theory/chord';
import { diatonicChords } from '@/theory/diatonic';
import { intervalBetweenPitchClasses, parseInterval, transposePitchClass } from '@/theory/interval';
import { parallelKey, type MusicalKey } from '@/theory/key';
import { midiOf, semitoneOf, type Pitch, type PitchClass } from '@/theory/pitch';
import { chordFromRoman, degreeOf } from '@/theory/roman';
import type { SequenceEvent } from '@/audio/engine';
import { createId } from '@/lib/id';

export interface ProgressionChord extends ChordSpec {
  id: string;
  /** 長さ（拍）。4拍 = 4/4 拍子の1小節 */
  durationBeats: number;
}

export const DURATION_OPTIONS = [1, 2, 4, 8] as const;

export function makeChord(spec: ChordSpec, durationBeats = 4): ProgressionChord {
  return { ...spec, id: createId(), durationBeats };
}

// ---- 鳴らす音 ----

/** 指定範囲にルートが入るオクターブを選ぶ */
function placeInRange(pc: PitchClass, low: number, high: number): Pitch {
  for (let octave = -1; octave <= 9; octave++) {
    const p = { ...pc, octave };
    const m = midiOf(p);
    if (m >= low && m <= high) return p;
  }
  return { ...pc, octave: 4 };
}

/** コードの音（中音域。ルートが F3〜E4 に入るように置く） */
export function chordVoicing(chord: ChordSpec): Pitch[] {
  const root = placeInRange(chord.root, 53, 64);
  return chordPitches(root, chord.quality, { voicing: 'common' });
}

/** ベースの音（C2〜B2） */
export function bassPitch(chord: ChordSpec): Pitch {
  return placeInRange(chord.bass ?? chord.root, 36, 47);
}

export function totalBeats(chords: ProgressionChord[]): number {
  return chords.reduce((s, c) => s + c.durationBeats, 0);
}

/** 再生用のデータに変換する */
export function toSequence(chords: ProgressionChord[], opts: { withBass?: boolean } = {}): SequenceEvent[] {
  const events: SequenceEvent[] = [];
  let beat = 0;
  for (const c of chords) {
    events.push({ midis: chordVoicing(c).map(midiOf), startBeat: beat, durationBeats: c.durationBeats, velocity: 0.7 });
    if (opts.withBass) events.push({ midis: [midiOf(bassPitch(c))], startBeat: beat, durationBeats: c.durationBeats, instrument: 'bass', velocity: 0.8 });
    beat += c.durationBeats;
  }
  return events;
}

/** 再生位置（秒）から、今鳴っているコードの番号 */
export function chordIndexAt(chords: ProgressionChord[], seconds: number, bpm: number): number {
  const beat = (seconds * bpm) / 60;
  let acc = 0;
  for (const [i, c] of chords.entries()) {
    acc += c.durationBeats;
    if (beat < acc) return i;
  }
  return -1;
}

// ---- コードの候補（パレット） ----

export interface PaletteGroup {
  title: string;
  /** 初心者向けの説明 */
  note: string;
  chords: ChordSpec[];
}

/** 選んだキーに合うコードの候補 */
export function paletteFor(key: MusicalKey, sevenths: boolean): PaletteGroup[] {
  const diatonic = diatonicChords(key, { sevenths }).map(({ root, quality }) => ({ root, quality }));
  const groups: PaletteGroup[] = [
    {
      title: 'ダイアトニックコード',
      note: 'キーのスケールの音だけで作ったコード。まずはここから選ぶと、まとまりのある進行になりやすいです。',
      chords: diatonic,
    },
  ];
  if (key.mode === 'minor') {
    const harmonic = diatonicChords(key, { sevenths, scale: 'harmonicMinor' });
    groups.push({
      title: 'ハーモニックマイナー由来',
      note: 'マイナーキーでよく使われる、主役のコードに戻りたくなる力が強いコード。',
      chords: [harmonic[4]!, harmonic[6]!].map(({ root, quality }) => ({ root, quality })),
    });
  } else {
    const minor = diatonicChords(parallelKey(key), { sevenths });
    groups.push({
      title: '同主調からの借用（サブドミナントマイナーなど）',
      note: '同じ主音のマイナーキーから借りたコード。明るい曲に切なさや陰りを加えます。',
      chords: [minor[3]!, minor[5]!, minor[6]!].map(({ root, quality }) => ({ root, quality })),
    });
  }
  // セカンダリードミナント（ダイアトニックコードの Ⅴ7）
  const secondary: ChordSpec[] = [];
  for (const c of diatonicChords(key)) {
    if (c.degree === 1 || c.quality === 'dim' || c.quality === 'aug') continue;
    const root = transposePitchClass(c.root, parseInterval('P5'));
    const spec = normalizeRoot(key, { root, quality: '7' });
    if (analyzeChord(key, spec).category === 'secondary-dominant') secondary.push(spec);
  }
  groups.push({
    title: 'セカンダリードミナント',
    note: '次のコードを一時的に主役に見立てて、そこへ向かう力を強めるコード。',
    chords: secondary,
  });
  return groups;
}

// ---- 次のコードの候補 ----

export interface Suggestion {
  chord: ChordSpec;
  reason: string;
}

/** 前のコードの役割から、理論上つながりやすい次のコードの例を挙げる */
export function nextChordSuggestions(key: MusicalKey, last: ChordSpec | undefined, sevenths = false): Suggestion[] {
  const diatonic = diatonicChords(key, { sevenths });
  const pick = (deg: number) => {
    const c = diatonic[deg - 1]!;
    return { root: c.root, quality: c.quality };
  };
  if (!last) return [{ chord: pick(1), reason: '主役のコード（Ⅰ）から始めると、キーがはっきり伝わります。' }];

  const a = analyzeChord(key, last);
  if (a.category === 'secondary-dominant' && a.secondaryOf) {
    return [{ chord: pick(a.secondaryOf.targetDegree), reason: `${a.secondaryOf.label} は「${a.secondaryOf.label.split('/')[1]}」へ進むと解決した感じが出ます。` }];
  }
  const fn = a.functions.length === 1 ? a.functions[0] : undefined;
  const out: Suggestion[] = [];
  const add = (deg: number, reason: string) => {
    const chord = pick(deg);
    const same = semitoneOf(chord.root) === semitoneOf(last.root) && chord.quality === last.quality;
    if (!same && !out.some((s) => semitoneOf(s.chord.root) === semitoneOf(chord.root))) out.push({ chord, reason });
  };
  if (fn === 'D') {
    add(1, 'ドミナント → トニック：もっとも基本的な「解決」の動きです。');
    add(6, key.mode === 'major' ? 'Ⅴ → Ⅵm：解決すると見せかけて外す「偽終止」。意外性が出ます。' : 'Ⅴ → Ⅵ：解決を少しずらす動きです。');
  } else if (fn === 'SD') {
    add(5, 'サブドミナント → ドミナント：緊張を高めて、次の解決を準備します。');
    add(1, 'サブドミナント → トニック：おだやかに落ち着く動きです。');
    if (degreeOf(key, last.root).degree === 4) add(2, 'Ⅳ → Ⅱm：同じサブドミナントの仲間へ移り、展開を続けます。');
  } else {
    // トニック、または解釈が分かれるコード
    add(4, 'トニック → サブドミナント：家から出かけるように、展開を始めます。');
    add(5, 'トニック → ドミナント：一気に緊張感を作ります。');
    add(6, key.mode === 'major' ? 'Ⅰ → Ⅵm：同じトニックの仲間で、雰囲気を少し暗くします。' : 'Ⅰm → Ⅵ：マイナーキーで定番の動きです。');
    add(2, 'Ⅱ のコードを経由すると、Ⅴ への流れが作りやすくなります。');
  }
  return out;
}

// ---- 定番の進行（使用傾向） ----

export type Mood = '明るい' | '暗い' | '切ない' | '緊張感' | '解決感' | 'おしゃれ' | '力強い';

export interface PresetProgression {
  id: string;
  name: string;
  mode: MusicalKey['mode'];
  /** ローマ数字（日本式・キーの基準スケール） */
  romans: string[];
  moods: Mood[];
  description: string;
}

/** 実際の音楽でよく使われる進行の例（ジャンルや曲によって使われ方は様々） */
export const PRESET_PROGRESSIONS: PresetProgression[] = [
  { id: 'oudou', name: '王道進行', mode: 'major', romans: ['Ⅳ△7', 'Ⅴ7', 'Ⅲm7', 'Ⅵm'], moods: ['切ない', '明るい'], description: 'J-POP やアニメソングのサビで非常によく使われる進行。明るさと切なさが同居します。' },
  { id: 'komuro', name: '小室進行', mode: 'major', romans: ['Ⅵm', 'Ⅳ', 'Ⅴ', 'Ⅰ'], moods: ['切ない', '力強い'], description: '1990年代の J-POP で多用された進行。疾走感と切なさがあります。' },
  { id: 'canon', name: 'カノン進行', mode: 'major', romans: ['Ⅰ', 'Ⅴ', 'Ⅵm', 'Ⅲm', 'Ⅳ', 'Ⅰ', 'Ⅳ', 'Ⅴ'], moods: ['明るい', '解決感'], description: 'パッヘルベルの「カノン」に由来する進行。感動的で、多くのポップスで使われています。' },
  { id: 'pop4', name: 'Ⅰ–Ⅴ–Ⅵm–Ⅳ', mode: 'major', romans: ['Ⅰ', 'Ⅴ', 'Ⅵm', 'Ⅳ'], moods: ['明るい'], description: '洋楽ポップスで定番の、明るく前向きな循環進行。' },
  { id: 'fifties', name: 'Ⅰ–Ⅵm–Ⅳ–Ⅴ', mode: 'major', romans: ['Ⅰ', 'Ⅵm', 'Ⅳ', 'Ⅴ'], moods: ['明るい', '解決感'], description: '1950年代のポップスで多用された、懐かしい雰囲気の循環進行。' },
  { id: 'twofive', name: 'ツーファイブワン', mode: 'major', romans: ['Ⅱm7', 'Ⅴ7', 'Ⅰ△7'], moods: ['おしゃれ', '解決感'], description: 'ジャズの基本となる進行。R&B やシティポップでもよく使われます。' },
  { id: 'sdm', name: 'サブドミナントマイナー', mode: 'major', romans: ['Ⅰ', 'Ⅳ', 'Ⅳm', 'Ⅰ'], moods: ['切ない', '解決感'], description: 'Ⅳ を途中でマイナーに変えて、切なく終わる進行。バラードの終わりなどで使われます。' },
  { id: 'minor-6-7', name: 'Ⅰm–Ⅵ–Ⅶ–Ⅰm', mode: 'minor', romans: ['Ⅰm', 'Ⅵ', 'Ⅶ', 'Ⅰm'], moods: ['暗い', '力強い'], description: 'ロックや EDM、ダンスホールなどでよく聞かれる、力強いマイナーの進行。' },
  { id: 'minor-6-3-7', name: 'Ⅰm–Ⅵ–Ⅲ–Ⅶ', mode: 'minor', romans: ['Ⅰm', 'Ⅵ', 'Ⅲ', 'Ⅶ'], moods: ['切ない'], description: 'ポップスや EDM で多用される、切ない循環進行。' },
  { id: 'minor-dominant', name: 'Ⅰm–Ⅵ–Ⅶ–Ⅴ', mode: 'minor', romans: ['Ⅰm', 'Ⅵ', 'Ⅶ', 'Ⅴ'], moods: ['緊張感', '解決感'], description: '最後のⅤ（ハーモニックマイナー由来）が、最初の Ⅰm へ戻りたくなる力を作ります。' },
  { id: 'minor-cadence', name: 'Ⅰm–Ⅳm–Ⅴ7–Ⅰm', mode: 'minor', romans: ['Ⅰm', 'Ⅳm', 'Ⅴ7', 'Ⅰm'], moods: ['緊張感', '解決感'], description: 'マイナーキーの基本的な終止の形。クラシックや歌謡曲でおなじみです。' },
  { id: 'minor-twofive', name: 'マイナーのツーファイブ', mode: 'minor', romans: ['Ⅱm7(♭5)', 'Ⅴ7', 'Ⅰm7'], moods: ['おしゃれ', '切ない'], description: 'ジャズや R&B で使われる、マイナーキーのツーファイブワン。' },
  { id: 'andalusian', name: 'アンダルシア進行', mode: 'minor', romans: ['Ⅰm', 'Ⅶ', 'Ⅵ', 'Ⅴ'], moods: ['暗い', '緊張感'], description: 'フラメンコに由来するといわれる、下がっていく情熱的な進行。' },
];

export function realizePreset(key: MusicalKey, preset: PresetProgression): ProgressionChord[] {
  return preset.romans.map((r) => makeChord(normalizeRoot(key, chordFromRoman(key, r)), 4));
}

// ---- 雰囲気の傾向 ----

const MINORISH = new Set<ChordQualityId>(['m', 'm6', 'm7', 'm9', 'mMaj7', 'dim', 'dim7', 'm7b5']);
const TENSE = new Set<ChordQualityId>(['7', '9', '11', '13', 'dim', 'dim7', 'm7b5', 'aug', 'augMaj7', '7sus4']);

export interface MoodTendency {
  brightness: '明るめ' | '暗め' | '明るさと暗さが混ざる';
  tension: '高め' | 'ふつう' | '控えめ';
  resolution: boolean;
  /** ノンダイアトニック（スケール外）のコードの数 */
  colorful: number;
}

/** 進行全体の雰囲気の傾向（コードの種類と動きから計算した目安） */
export function moodTendency(key: MusicalKey, chords: ChordSpec[]): MoodTendency | null {
  if (chords.length === 0) return null;
  const analysis = analyzeProgression(key, chords);
  const minor = chords.filter((c) => MINORISH.has(c.quality)).length / chords.length;
  const tense = chords.filter((c) => TENSE.has(c.quality)).length / chords.length;
  const colorful = analysis.chords.filter((c) => c.category !== 'diatonic').length;
  return {
    brightness: minor <= 0.3 ? '明るめ' : minor >= 0.6 ? '暗め' : '明るさと暗さが混ざる',
    tension: tense >= 0.4 || colorful >= 2 ? '高め' : tense === 0 && colorful === 0 ? '控えめ' : 'ふつう',
    resolution: analysis.resolutions.length > 0,
    colorful,
  };
}

// ---- 同じ進行の別パターン ----

export interface Variation {
  id: string;
  title: string;
  description: string;
  chords: ProgressionChord[];
}

const SUBSTITUTE: Record<MusicalKey['mode'], Record<number, number>> = {
  major: { 1: 6, 6: 1, 4: 2, 2: 4, 3: 1 },
  minor: { 1: 3, 3: 1, 4: 2, 2: 4, 6: 4 },
};

function sameChord(a: ChordSpec, b: ChordSpec) {
  return semitoneOf(a.root) === semitoneOf(b.root) && a.quality === b.quality;
}

export function variations(key: MusicalKey, chords: ProgressionChord[]): Variation[] {
  if (chords.length === 0) return [];
  const triads = diatonicChords(key);
  const sevenths = diatonicChords(key, { sevenths: true });
  const analyses = chords.map((c) => analyzeChord(key, c));
  const degreeIfDiatonic = (a: ChordAnalysis) => {
    if (a.category !== 'diatonic') return null;
    const d = degreeOf(key, a.chord.root);
    return d.accidental === 0 ? d.degree : null;
  };
  const out: Variation[] = [];

  // 1. セブンスコードにする
  const v1 = chords.map((c, i) => {
    const deg = degreeIfDiatonic(analyses[i]!);
    if (deg && sameChord(c, triads[deg - 1]!)) {
      const s = sevenths[deg - 1]!;
      return { ...c, id: createId(), root: s.root, quality: s.quality };
    }
    return { ...c, id: createId() };
  });
  if (v1.some((c, i) => c.quality !== chords[i]!.quality)) {
    out.push({ id: 'sevenths', title: 'セブンスコードにする', description: '3和音を、同じ度数の4和音（セブンス）に変えます。響きが大人っぽく、おしゃれになります。', chords: v1 });
  }

  // 2. 同じ役割の代理コードに置き換える
  //    （最初のコードはそのまま。前後と同じコードになる場合や、直前を置き換えた場合は置き換えない）
  const v2: ProgressionChord[] = [];
  let replacedPrev = false;
  chords.forEach((c, i) => {
    const deg = degreeIfDiatonic(analyses[i]!);
    const sub = deg ? SUBSTITUTE[key.mode][deg] : undefined;
    const s = sub ? triads[sub - 1]! : undefined;
    const prev = v2[i - 1];
    const next = chords[i + 1];
    if (i > 0 && s && !replacedPrev && !(prev && sameChord(prev, s)) && !(next && sameChord(next, s))) {
      v2.push({ ...c, id: createId(), root: s.root, quality: s.quality });
      replacedPrev = true;
    } else {
      v2.push({ ...c, id: createId() });
      replacedPrev = false;
    }
  });
  if (v2.some((c, i) => !sameChord(c, chords[i]!))) {
    out.push({ id: 'substitute', title: '代理コードに置き換える', description: '同じ役割（トニック・サブドミナント）を持つ別のコードに置き換えます。流れは保ったまま、雰囲気が変わります。', chords: v2 });
  }

  // 3. セカンダリードミナントを挟む
  const v3: ProgressionChord[] = [];
  chords.forEach((c, i) => {
    const prev = v3[v3.length - 1];
    const deg = degreeIfDiatonic(analyses[i]!);
    const target = deg ? triads[deg - 1] : undefined;
    if (i > 0 && prev && prev.durationBeats >= 2 && deg && deg !== 1 && target && target.quality !== 'dim') {
      const dom = normalizeRoot(key, { root: transposePitchClass(c.root, parseInterval('P5')), quality: '7' });
      if (!sameChord(dom, prev) && analyzeChord(key, dom).category === 'secondary-dominant') {
        const half = prev.durationBeats / 2;
        prev.durationBeats = half;
        v3.push(makeChord(dom, half));
      }
    }
    v3.push({ ...c, id: createId() });
  });
  if (v3.length > chords.length) {
    out.push({ id: 'secondary', title: 'セカンダリードミナントを挟む', description: '前のコードの後半に、次のコードへ向かう「Ⅴ7」を入れます。次のコードへの勢いが強くなります。', chords: v3 });
  }
  return out;
}

// ---- キーの変更（移調） ----

/** キーを変えるとき、コードも同じだけ移調する */
export function transposeChords(chords: ProgressionChord[], from: MusicalKey, to: MusicalKey): ProgressionChord[] {
  const iv = intervalBetweenPitchClasses(from.tonic, to.tonic);
  return chords.map((c) => {
    const moved: ChordSpec = {
      root: transposePitchClass(c.root, iv),
      quality: c.quality,
      ...(c.bass ? { bass: transposePitchClass(c.bass, iv) } : {}),
    };
    return { ...c, ...normalizeRoot(to, moved) };
  });
}
