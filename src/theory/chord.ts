// コード（和音）の計算。コードの種類は「ルート（根音）からの音程の並び」として定義する。

import {
  intervalBetweenPitchClasses,
  intervalSemitones,
  parseInterval,
  transposePitch,
  transposePitchClass,
  formatInterval,
  type Interval,
} from './interval';
import {
  formatPitchClass,
  midiOf,
  mod,
  parsePitchClass,
  semitoneOf,
  type AccidentalStyle,
  type Pitch,
  type PitchClass,
} from './pitch';
import type { ScaleId } from './scale';

export type ChordQualityId =
  | 'maj'
  | 'm'
  | 'dim'
  | 'aug'
  | 'sus2'
  | 'sus4'
  | '6'
  | 'm6'
  | '7'
  | 'maj7'
  | 'm7'
  | 'mMaj7'
  | 'dim7'
  | 'm7b5'
  | 'augMaj7'
  | '7sus4'
  | 'add9'
  | '9'
  | 'maj9'
  | 'm9'
  | '11'
  | '13';

/** 表記スタイル：日本式（C△7・Cm7(♭5)）／英米式（Cmaj7・Cm7b5） */
export type ChordSymbolStyle = 'japanese' | 'english';

export interface ChordQualityDef {
  id: ChordQualityId;
  nameJa: string;
  nameEn: string;
  /** 理論上の構成音（ルートからの音程） */
  intervals: readonly Interval[];
  /** 実際によく弾かれる形（音を省略する場合）。無ければ intervals と同じ */
  commonIntervals?: readonly Interval[];
  /** 省略についての説明 */
  voicingNote?: string;
  symbols: Record<ChordSymbolStyle, string>;
  /** コード名を読み取るときに受け付ける書き方 */
  aliases: readonly string[];
  category: 'triad' | 'sixth' | 'seventh' | 'tension';
  /** このコードに合わせやすいスケールの候補（絶対的な正解ではない） */
  scaleCandidates: readonly ScaleId[];
}

function q(
  id: ChordQualityId,
  nameJa: string,
  nameEn: string,
  intervals: string,
  symbols: [japanese: string, english: string],
  aliases: string[],
  category: ChordQualityDef['category'],
  scaleCandidates: ScaleId[],
  common?: { intervals: string; note: string },
): ChordQualityDef {
  return {
    id,
    nameJa,
    nameEn,
    intervals: intervals.split(' ').map(parseInterval),
    commonIntervals: common ? common.intervals.split(' ').map(parseInterval) : undefined,
    voicingNote: common?.note,
    symbols: { japanese: symbols[0], english: symbols[1] },
    aliases,
    category,
    scaleCandidates,
  };
}

const LIST: ChordQualityDef[] = [
  q('maj', 'メジャー', 'Major', 'P1 M3 P5', ['', ''], ['', 'M', 'maj', 'major', 'Maj'], 'triad', ['major', 'lydian', 'mixolydian', 'majorPentatonic']),
  q('m', 'マイナー', 'Minor', 'P1 m3 P5', ['m', 'm'], ['m', 'min', '-', 'minor'], 'triad', ['naturalMinor', 'dorian', 'phrygian', 'minorPentatonic']),
  q('dim', 'ディミニッシュ', 'Diminished', 'P1 m3 d5', ['dim', 'dim'], ['dim', '°', 'o', 'm(b5)', 'm(♭5)', 'mb5', 'm♭5', 'm-5', 'm(-5)'], 'triad', ['locrian', 'diminishedWH']),
  q('aug', 'オーギュメント', 'Augmented', 'P1 M3 A5', ['aug', 'aug'], ['aug', '+', '+5', '(#5)', '(♯5)', '#5', '♯5', '(+5)'], 'triad', ['wholeTone']),
  q('sus2', 'サスツー', 'Suspended 2nd', 'P1 M2 P5', ['sus2', 'sus2'], ['sus2'], 'triad', ['major', 'mixolydian', 'dorian']),
  q('sus4', 'サスフォー', 'Suspended 4th', 'P1 P4 P5', ['sus4', 'sus4'], ['sus4', 'sus'], 'triad', ['mixolydian', 'major', 'dorian']),
  q('6', 'シックス', 'Major 6th', 'P1 M3 P5 M6', ['6', '6'], ['6', 'M6', 'maj6', 'add6'], 'sixth', ['major', 'majorPentatonic']),
  q('m6', 'マイナーシックス', 'Minor 6th', 'P1 m3 P5 M6', ['m6', 'm6'], ['m6', 'min6', '-6'], 'sixth', ['dorian', 'melodicMinor']),
  q('7', 'セブンス（ドミナントセブンス）', 'Dominant 7th', 'P1 M3 P5 m7', ['7', '7'], ['7', 'dom7'], 'seventh', ['mixolydian', 'diminishedHW', 'wholeTone']),
  q('maj7', 'メジャーセブンス', 'Major 7th', 'P1 M3 P5 M7', ['△7', 'maj7'], ['maj7', 'M7', '△7', 'Δ7', '△', 'Δ', 'ma7', 'Maj7'], 'seventh', ['major', 'lydian']),
  q('m7', 'マイナーセブンス', 'Minor 7th', 'P1 m3 P5 m7', ['m7', 'm7'], ['m7', 'min7', '-7'], 'seventh', ['dorian', 'naturalMinor', 'phrygian']),
  q('mMaj7', 'マイナーメジャーセブンス', 'Minor Major 7th', 'P1 m3 P5 M7', ['m△7', 'm(maj7)'], ['mM7', 'm(maj7)', 'mmaj7', 'mMaj7', 'm△7', 'mΔ7', 'm(M7)', 'm(△7)', '-maj7', 'minmaj7'], 'seventh', ['melodicMinor', 'harmonicMinor']),
  q('dim7', 'ディミニッシュセブンス', 'Diminished 7th', 'P1 m3 d5 d7', ['dim7', 'dim7'], ['dim7', '°7', 'o7'], 'seventh', ['diminishedWH']),
  q('m7b5', 'ハーフディミニッシュ（マイナーセブンスフラットファイブ）', 'Half Diminished 7th', 'P1 m3 d5 m7', ['m7(♭5)', 'm7b5'], ['m7b5', 'm7(b5)', 'm7♭5', 'm7(♭5)', 'm7-5', 'm7(-5)', 'ø', 'ø7', 'Ø', 'Ø7'], 'seventh', ['locrian']),
  q('augMaj7', 'オーギュメントメジャーセブンス', 'Augmented Major 7th', 'P1 M3 A5 M7', ['△7(♯5)', 'maj7#5'], ['maj7#5', 'maj7(#5)', 'M7(#5)', 'M7#5', '△7(#5)', '△7(♯5)', '+M7', '+maj7', 'augMaj7'], 'seventh', ['melodicMinor', 'harmonicMinor']),
  q('7sus4', 'セブンスサスフォー', 'Dominant 7th sus4', 'P1 P4 P5 m7', ['7sus4', '7sus4'], ['7sus4', '7sus'], 'seventh', ['mixolydian']),
  q('add9', 'アドナインス', 'Add 9', 'P1 M3 P5 M9', ['add9', 'add9'], ['add9', '(add9)', 'add2'], 'tension', ['major', 'lydian', 'mixolydian']),
  q('9', 'ナインス', 'Dominant 9th', 'P1 M3 P5 m7 M9', ['9', '9'], ['9', '7(9)'], 'tension', ['mixolydian']),
  q('maj9', 'メジャーナインス', 'Major 9th', 'P1 M3 P5 M7 M9', ['△9', 'maj9'], ['maj9', 'M9', '△9', 'Δ9', 'M7(9)', '△7(9)'], 'tension', ['major', 'lydian']),
  q('m9', 'マイナーナインス', 'Minor 9th', 'P1 m3 P5 m7 M9', ['m9', 'm9'], ['m9', 'min9', '-9', 'm7(9)'], 'tension', ['dorian', 'naturalMinor']),
  q('11', 'イレブンス', 'Dominant 11th', 'P1 M3 P5 m7 M9 P11', ['11', '11'], ['11', '7(9,11)'], 'tension', ['mixolydian'], {
    intervals: 'P1 P5 m7 M9 P11',
    note: '3度の音と11度の音がぶつかるため、実際は3度を省いて弾くことが多い',
  }),
  q('13', 'サーティーンス', 'Dominant 13th', 'P1 M3 P5 m7 M9 P11 M13', ['13', '13'], ['13', '7(13)', '7(9,13)'], 'tension', ['mixolydian'], {
    intervals: 'P1 M3 P5 m7 M9 M13',
    note: '11度の音は3度とぶつかるため省くのが一般的。さらに5度や9度を省くこともある',
  }),
];

export const CHORD_QUALITIES: Readonly<Record<ChordQualityId, ChordQualityDef>> = Object.fromEntries(
  LIST.map((d) => [d.id, d]),
) as Record<ChordQualityId, ChordQualityDef>;

export const CHORD_QUALITY_IDS = LIST.map((d) => d.id);

export interface ChordSpec {
  root: PitchClass;
  quality: ChordQualityId;
  /** 分数コードのベース音（例：C/E の E） */
  bass?: PitchClass;
}

export type Voicing = 'full' | 'common';

function intervalsOf(quality: ChordQualityId, voicing: Voicing): readonly Interval[] {
  const d = CHORD_QUALITIES[quality];
  return voicing === 'common' && d.commonIntervals ? d.commonIntervals : d.intervals;
}

/** コードの構成音（オクターブなし。ルートから順に） */
export function chordTones(root: PitchClass, quality: ChordQualityId, voicing: Voicing = 'full'): PitchClass[] {
  return intervalsOf(quality, voicing).map((iv) => transposePitchClass(root, iv));
}

/**
 * 鍵盤で弾く音（オクターブ付き・低い順）。
 * inversion：0 = 基本形、1 = 第1転回形（一番下の音を1オクターブ上へ）…
 * bass を指定すると、その音を一番下に追加する（分数コード）。
 */
export function chordPitches(
  root: Pitch,
  quality: ChordQualityId,
  opts: { inversion?: number; voicing?: Voicing; bass?: PitchClass } = {},
): Pitch[] {
  const ivs = intervalsOf(quality, opts.voicing ?? 'full');
  let notes = ivs.map((iv) => transposePitch(root, iv));
  const inversion = opts.inversion ?? 0;
  if (inversion < 0 || inversion >= notes.length) throw new Error(`転回形の番号が範囲外です：${inversion}`);
  for (let i = 0; i < inversion; i++) {
    const [lowest, ...rest] = notes;
    notes = [...rest, { ...lowest!, octave: lowest!.octave + 1 }];
  }
  notes.sort((a, b) => midiOf(a) - midiOf(b));
  if (opts.bass) {
    const lowestMidi = midiOf(notes[0]!);
    let bass: Pitch = { ...opts.bass, octave: notes[0]!.octave };
    while (midiOf(bass) >= lowestMidi) bass = { ...bass, octave: bass.octave - 1 };
    notes = [bass, ...notes];
  }
  return notes;
}

export const INVERSION_NAMES_JA = ['基本形', '第1転回形', '第2転回形', '第3転回形', '第4転回形', '第5転回形', '第6転回形'];

/** コードの役割を表す度数名（例：m3 → 「短3度（3rd）」） */
export function chordToneLabel(iv: Interval): string {
  const n = iv.number;
  const name: Record<number, string> = { 1: 'ルート', 2: '2nd', 3: '3rd', 4: '4th', 5: '5th', 6: '6th', 7: '7th', 9: '9th', 11: '11th', 13: '13th' };
  return name[n] ?? `${n}th`;
}

/** コード名を作る（例：F#m7、C/E） */
export function formatChordSymbol(
  chord: ChordSpec,
  opts: { style?: ChordSymbolStyle; accidentals?: AccidentalStyle } = {},
): string {
  const style = opts.style ?? 'english';
  const acc = opts.accidentals ?? 'ascii';
  const base = formatPitchClass(chord.root, acc) + CHORD_QUALITIES[chord.quality].symbols[style];
  return chord.bass ? `${base}/${formatPitchClass(chord.bass, acc)}` : base;
}

const ALIAS_MAP: ReadonlyMap<string, ChordQualityId> = new Map(
  LIST.flatMap((d) => d.aliases.map((a) => [a, d.id] as const)),
);

/** コードの種類の文字（"m7"・"△7" など）を読み取る */
export function parseChordQuality(text: string): ChordQualityId {
  const id = ALIAS_MAP.get(text.trim());
  if (!id) throw new Error(`コードの種類として読めません：「${text}」`);
  return id;
}

/** コード名を読み取る（例："F#m7"・"Bbmaj7"・"C/E"・"Bm7(b5)"） */
export function parseChordSymbol(text: string): ChordSpec {
  const t = text.trim();
  const m = /^([A-G])([#♯b♭]*)(.*)$/u.exec(t);
  if (!m) throw new Error(`コード名として読めません：「${text}」`);
  const root = parsePitchClass(m[1]! + m[2]!);
  let rest = m[3]!;
  let bass: PitchClass | undefined;
  const slash = rest.lastIndexOf('/');
  if (slash >= 0) {
    try {
      bass = parsePitchClass(rest.slice(slash + 1));
      rest = rest.slice(0, slash);
    } catch {
      // "/" の後ろが音名でなければ分数コードではない
    }
  }
  return bass ? { root, quality: parseChordQuality(rest), bass } : { root, quality: parseChordQuality(rest) };
}

/** 構成音の半音の集合（ルート = 0） */
function semitoneSet(quality: ChordQualityId, voicing: Voicing): number[] {
  return [...new Set(intervalsOf(quality, voicing).map((iv) => mod(intervalSemitones(iv), 12)))].sort((a, b) => a - b);
}

/**
 * 鳴っている音からコード名の候補を探す（例：[E, G, C] → C/E）。
 * notes[0] をベース（一番低い音）として扱う。
 */
export function identifyChord(notes: PitchClass[]): ChordSpec[] {
  if (notes.length < 2) return [];
  const bass = notes[0]!;
  const present = [...new Set(notes.map(semitoneOf))];
  const results: ChordSpec[] = [];
  // ベースをルートとする候補を先に並べる
  const roots = [bass, ...notes.slice(1).filter((n) => semitoneOf(n) !== semitoneOf(bass))];
  const seen = new Set<string>();
  for (const root of roots) {
    const rel = present.map((s) => mod(s - semitoneOf(root), 12)).sort((a, b) => a - b);
    for (const d of LIST) {
      for (const voicing of ['full', 'common'] as const) {
        const set = semitoneSet(d.id, voicing);
        if (set.length === rel.length && set.every((v, i) => v === rel[i])) {
          const key = `${formatPitchClass(root)}${d.id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          // 綴りをコードの定義に合わせる（例：ルート C のとき D# ではなく E♭ と分かるように）
          const spec: ChordSpec = { root: { ...root }, quality: d.id };
          if (semitoneOf(root) !== semitoneOf(bass)) {
            const tones = chordTones(root, d.id, voicing);
            spec.bass = tones.find((t) => semitoneOf(t) === semitoneOf(bass)) ?? { ...bass };
          }
          results.push(spec);
        }
      }
    }
  }
  return results;
}

/** 構成音とルートからの音程の一覧（コード辞典の表示用） */
export function chordStructure(root: PitchClass, quality: ChordQualityId, voicing: Voicing = 'full') {
  return intervalsOf(quality, voicing).map((iv) => ({
    note: transposePitchClass(root, iv),
    interval: formatInterval(iv),
    role: chordToneLabel(iv),
  }));
}

/** ルートと構成音から、定義どおりの音程か確かめる（テスト・検証用） */
export function chordIntervalsFromTones(tones: PitchClass[]): string[] {
  const [root] = tones;
  if (!root) return [];
  return tones.map((t) => formatInterval(intervalBetweenPitchClasses(root, t)));
}
