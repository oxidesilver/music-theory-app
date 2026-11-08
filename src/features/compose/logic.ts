// 作曲画面の計算（画面から分離。テスト可能）

import { PPQ, type DrumEvent, type NoteEvent } from '@/storage/types';
import type { SequenceEvent } from '@/audio/engine';
import { classifyNote, type NoteRole } from '@/theory/tension';
import { spellInKey, type MusicalKey } from '@/theory/key';
import { midiOf, semitoneOf, type Pitch } from '@/theory/pitch';
import { scaleNotes, type ScaleId } from '@/theory/scale';
import { createId } from '@/lib/id';
import { bassPitch, chordVoicing, type ProgressionChord } from '@/features/progression/logic';
import { FOUR_FOUR, barTicks, isCompound, pulseTicks, type TimeSignature } from '@/theory/meter';

export const TICKS_PER_BEAT = PPQ;
/** 4/4 の1小節の長さ。拍子ごとの長さは barTicks(拍子) */
export const TICKS_PER_BAR = PPQ * 4;
/** 入力の細かさ（1拍を何分割するか）：4分音符・8分音符・16分音符 */
export const SNAP_OPTIONS = [
  { label: '4分音符', ticks: PPQ },
  { label: '8分音符', ticks: PPQ / 2 },
  { label: '16分音符', ticks: PPQ / 4 },
] as const;

export type TrackId = 'melody' | 'bass';

/** 音域（MIDI 番号）。メロディー：C4〜C6、ベース：E1〜G3 */
export const TRACK_RANGE: Record<TrackId, [number, number]> = {
  melody: [60, 84],
  bass: [28, 55],
};

// ---- 時間とコード ----

export interface ChordSpan {
  chord: ProgressionChord;
  index: number;
  start: number;
  end: number;
}

export function chordSpans(chords: ProgressionChord[]): ChordSpan[] {
  let t = 0;
  return chords.map((chord, index) => {
    const start = t;
    t += chord.durationBeats * TICKS_PER_BEAT;
    return { chord, index, start, end: t };
  });
}

export function chordAt(chords: ProgressionChord[], tick: number): ChordSpan | undefined {
  return chordSpans(chords).find((s) => tick >= s.start && tick < s.end);
}

/** 曲の長さ（小節単位に切り上げ。最低4小節） */
export function songLengthTicks(
  chords: ProgressionChord[],
  tracks: { startTick: number; durationTick: number }[][] = [],
  ts: TimeSignature = FOUR_FOUR,
): number {
  const bar = barTicks(ts);
  const chordEnd = chordSpans(chords).at(-1)?.end ?? 0;
  const noteEnd = Math.max(0, ...tracks.flat().map((n) => n.startTick + n.durationTick));
  const end = Math.max(chordEnd, noteEnd, bar * 4);
  return Math.ceil(end / bar) * bar;
}

// ---- 音の役割（スケール補助） ----

export interface NoteRoleInfo {
  role: NoteRole;
  /** キーに合わせた綴り */
  pitch: Pitch;
  inScale: boolean;
  chord?: ProgressionChord;
}

/** ある時刻・ある高さの音が、その時のコードとスケールに対してどんな役割か */
export function noteRoleAt(key: MusicalKey, scaleId: ScaleId, chords: ProgressionChord[], midi: number, tick: number): NoteRoleInfo {
  const pitch = spellInKey(midi, key);
  const scale = scaleNotes(key.tonic, scaleId);
  const inScale = scale.some((n) => semitoneOf(n) === semitoneOf(pitch));
  const span = chordAt(chords, tick);
  if (!span) return { role: inScale ? 'scale' : 'outside', pitch, inScale };
  const { role } = classifyNote(pitch, span.chord, scale);
  return { role, pitch, inScale, chord: span.chord };
}

export const ROLE_HELP: Record<NoteRole, string> = {
  'chord-tone': 'その時のコードの構成音です。長く伸ばしても安定して聞こえやすい音です。',
  tension: 'スケール内の音で、コードに重ねると響きに色が付く音（テンション）です。',
  scale: 'スケール内の音です。経過音（音と音をつなぐ音）として使いやすい音です。',
  caution: 'コードの音とぶつかりやすい音です。短く使ったり、すぐとなりの音へ動いたりすると自然に聞こえます。',
  outside: 'この音は現在選択しているスケールには含まれていません。ただし、経過音や装飾音として使用することもできます。',
};

// ---- 音符の操作 ----

export function makeNote(midi: number, key: MusicalKey, startTick: number, durationTick: number, velocity = 100): NoteEvent {
  return { id: createId(), pitch: spellInKey(midi, key), startTick, durationTick, velocity };
}

/** 半音単位で高さを変える（綴りはキーに合わせて付け直す） */
export function shiftNote(note: NoteEvent, semitones: number, key: MusicalKey): NoteEvent {
  return { ...note, pitch: spellInKey(midiOf(note.pitch) + semitones, key) };
}

/** その位置（高さ・時刻）にある音符 */
export function noteAt(notes: NoteEvent[], midi: number, tick: number): NoteEvent | undefined {
  return notes.find((n) => midiOf(n.pitch) === midi && tick >= n.startTick && tick < n.startTick + n.durationTick);
}

// ---- ベースライン ----

export type BassPattern = 'whole' | 'quarter' | 'eighth' | 'root-fifth' | 'octave';

export const BASS_PATTERNS: { id: BassPattern; label: string; description: string }[] = [
  { id: 'whole', label: 'ルートを伸ばす', description: 'コードのルート音を、コードの長さだけ伸ばします。もっとも基本の形です。' },
  { id: 'quarter', label: '1拍ごとにルート', description: '1拍ごとにルート音を弾きます（6/8 では8分音符3つ分ごと）。ロックやポップスの基本形です。' },
  { id: 'eighth', label: '8分音符でルート', description: '8分音符でルート音を刻みます。疾走感が出ます。' },
  { id: 'root-fifth', label: 'ルートと5度', description: 'ルート → 5度 を1拍ごとに交互に弾きます。安定感と動きが両立します（ワルツの伴奏にも）。' },
  { id: 'octave', label: 'オクターブ', description: 'ルートと1オクターブ上を1拍ごとに交互に弾きます。ダンス系の曲でよく使われます。' },
];

/** コード進行に合わせてベースラインを作る（「1拍」は拍子で変わる。6/8 は付点4分音符） */
export function bassLine(chords: ProgressionChord[], key: MusicalKey, pattern: BassPattern, ts: TimeSignature = FOUR_FOUR): NoteEvent[] {
  const notes: NoteEvent[] = [];
  for (const span of chordSpans(chords)) {
    const root = midiOf(bassPitch(span.chord));
    const len = span.end - span.start;
    if (pattern === 'whole') {
      notes.push(makeNote(root, key, span.start, len));
      continue;
    }
    const step = pattern === 'eighth' ? TICKS_PER_BEAT / 2 : pulseTicks(ts);
    let i = 0;
    for (let t = span.start; t < span.end; t += step, i++) {
      let m = root;
      if (pattern === 'root-fifth' && i % 2 === 1) m = root + 7;
      if (pattern === 'octave' && i % 2 === 1) m = root + 12;
      notes.push(makeNote(m, key, t, step * (pattern === 'eighth' ? 0.9 : 0.95), 100));
    }
  }
  // 長さは tick なので整数にそろえる
  return notes.map((n) => ({ ...n, durationTick: Math.round(n.durationTick) }));
}

/**
 * 経過音を追加する：次のコードに移る直前の1拍を、次のルートへつながる音にする。
 * スケールの音のうち次のルートのすぐ上か下の音（なければ半音上か下）を使う。
 */
export function addPassingNotes(notes: NoteEvent[], chords: ProgressionChord[], key: MusicalKey, scaleId: ScaleId): NoteEvent[] {
  const spans = chordSpans(chords);
  const scaleSemis = new Set(scaleNotes(key.tonic, scaleId).map(semitoneOf));
  let result = [...notes];
  for (const span of spans.slice(1)) {
    const prev = result.find((n) => n.startTick < span.start && n.startTick + n.durationTick >= span.start);
    if (!prev || span.start - prev.startTick < TICKS_PER_BEAT * 2) continue;
    const target = midiOf(bassPitch(span.chord));
    const from = midiOf(prev.pitch);
    const direction = from <= target ? -1 : 1; // 下から近づく／上から近づく
    // スケール上のとなりの音（半音となり → 全音となりの順に探す）。どちらも無ければ半音となり
    const candidates = [target + direction, target + direction * 2];
    const passing = candidates.find((m) => scaleSemis.has(((m % 12) + 12) % 12)) ?? target + direction;
    const at = span.start - TICKS_PER_BEAT;
    result = result.map((n) => (n.id === prev.id ? { ...n, durationTick: at - n.startTick } : n));
    result.push(makeNote(passing, key, at, TICKS_PER_BEAT * 0.95 | 0, 90));
  }
  return result.sort((a, b) => a.startTick - b.startTick);
}

/** オクターブ上下（ids を省略するとすべての音） */
export function shiftOctave(notes: NoteEvent[], delta: 1 | -1, key: MusicalKey, ids?: Set<string>): NoteEvent[] {
  return notes.map((n) => (!ids || ids.has(n.id) ? shiftNote(n, 12 * delta, key) : n));
}

// ---- ドラム ----

/** 4/4 の1小節のマス数（16分音符単位）。拍子ごとのマス数は stepsPerBar(拍子) */
export const STEPS_PER_BAR = 16;
export const DRUM_TICKS = TICKS_PER_BAR / STEPS_PER_BAR; // 16分音符 = 120 tick

export const DRUM_LANES = [
  { drum: 36, name: 'キック' },
  { drum: 38, name: 'スネア' },
  { drum: 39, name: 'クラップ' },
  { drum: 42, name: 'ハイハット（閉）' },
  { drum: 46, name: 'ハイハット（開）' },
] as const;

/** 1小節分のパターン：[レーン][マス]（マス数は拍子で変わる：4/4 は16、3/4・6/8 は12） */
export type DrumPattern = boolean[][];

export function emptyPattern(steps = STEPS_PER_BAR): DrumPattern {
  return DRUM_LANES.map(() => Array.from({ length: steps }, () => false));
}

/** 「どのドラムを何マス目に鳴らすか」から1小節のパターンを作る（例：{ 36: [0, 4, 8, 12] }） */
export function patternFrom(steps: Partial<Record<number, number[]>>, length = STEPS_PER_BAR): DrumPattern {
  return DRUM_LANES.map((l) => Array.from({ length }, (_, i) => (steps[l.drum] ?? []).includes(i)));
}

export interface DrumPreset {
  id: string;
  name: string;
  description: string;
  pattern: DrumPattern;
}

/** 4/4 のドラムパターン */
export const DRUM_PRESETS: DrumPreset[] = [
  {
    id: 'four',
    name: '4つ打ち',
    description: '1拍ごとにキック。EDM やハウスなどダンス系の基本です。裏拍のハイハットとセットで使われることが多いです。',
    pattern: patternFrom({ 36: [0, 4, 8, 12], 39: [4, 12], 42: [2, 6, 10, 14] }),
  },
  {
    id: 'eight',
    name: '8ビート',
    description: 'ハイハットを8分音符で刻み、2拍目と4拍目にスネア。ロックやポップスの基本です。',
    pattern: patternFrom({ 36: [0, 8, 10], 38: [4, 12], 42: [0, 2, 4, 6, 8, 10, 12, 14] }),
  },
  {
    id: 'offbeat',
    name: '裏打ち',
    description: '拍の裏（「1と2と」の「と」）でハイハットを鳴らします。レゲエ系のノリの基本になる考え方です。',
    pattern: patternFrom({ 36: [0, 8], 38: [8], 46: [2, 6, 10, 14] }),
  },
  {
    id: 'halftime',
    name: 'ハーフタイム',
    description: '3拍目にスネアを置き、ゆったりと重いノリを作ります。HIPHOP やトラップでよく使われます。',
    pattern: patternFrom({ 36: [0, 3, 10], 38: [8], 42: [0, 2, 4, 6, 8, 10, 12, 14] }),
  },
];

/** 3/4 のドラムパターン（12マス：1拍 = 4マス） */
const DRUM_PRESETS_3_4: DrumPreset[] = [
  {
    id: 'waltz',
    name: 'ワルツ',
    description: '1拍目にキック、2拍目と3拍目にハイハット。「ズン・チャッ・チャッ」のワルツの基本です。',
    pattern: patternFrom({ 36: [0], 42: [4, 8] }, 12),
  },
  {
    id: 'ballad-3',
    name: '3拍子のバラード',
    description: '1拍目にキック、3拍目にスネア、ハイハットは8分音符。ゆったりした3拍子の曲に。',
    pattern: patternFrom({ 36: [0], 38: [8], 42: [0, 2, 4, 6, 8, 10] }, 12),
  },
];

/** 6/8 のドラムパターン（12マス：8分音符 = 2マス、1まとまり = 6マス） */
const DRUM_PRESETS_6_8: DrumPreset[] = [
  {
    id: 'six-eight',
    name: '6/8 の基本',
    description: '1つ目のまとまりの頭にキック、2つ目のまとまりの頭にスネア。ハイハットは8分音符6つ。「タタタ・タタタ」の揺れが出ます。',
    pattern: patternFrom({ 36: [0], 38: [6], 42: [0, 2, 4, 6, 8, 10] }, 12),
  },
  {
    id: 'six-eight-ballad',
    name: '6/8 のバラード',
    description: 'キックを少し増やした、ロッカバラード風の 6/8。ゆったりしたバラードに。',
    pattern: patternFrom({ 36: [0, 4, 10], 38: [6], 42: [0, 2, 4, 6, 8, 10] }, 12),
  },
];

/** 拍子に合ったドラムパターン */
export function drumPresetsFor(ts: TimeSignature): DrumPreset[] {
  if (isCompound(ts)) return DRUM_PRESETS_6_8;
  if (ts[0] === 3) return DRUM_PRESETS_3_4;
  return DRUM_PRESETS;
}

/** パターン → 曲全体のドラムの音（全小節で繰り返す。1小節の長さはパターンのマス数で決まる） */
export function patternToEvents(pattern: DrumPattern, lengthTicks: number): DrumEvent[] {
  const events: DrumEvent[] = [];
  const steps = pattern[0]?.length ?? STEPS_PER_BAR;
  const bar = steps * DRUM_TICKS;
  const bars = Math.ceil(lengthTicks / bar);
  for (let b = 0; b < bars; b++) {
    DRUM_LANES.forEach((lane, li) => {
      pattern[li]!.forEach((on, step) => {
        if (on) events.push({ id: createId(), drum: lane.drum, startTick: b * bar + step * DRUM_TICKS, durationTick: DRUM_TICKS, velocity: lane.drum === 42 ? 80 : 110 });
      });
    });
  }
  return events;
}

/** 曲のドラムの音 → 1小節目のパターン（steps は拍子の1小節のマス数） */
export function eventsToPattern(events: DrumEvent[], steps = STEPS_PER_BAR): DrumPattern {
  const p = emptyPattern(steps);
  for (const e of events) {
    if (e.startTick >= steps * DRUM_TICKS) continue;
    const li = DRUM_LANES.findIndex((l) => l.drum === e.drum);
    const step = Math.round(e.startTick / DRUM_TICKS);
    if (li >= 0 && step < steps) p[li]![step] = true;
  }
  return p;
}

// ---- 再生 ----

export interface PlaybackOptions {
  chords: boolean;
  melody: boolean;
  bass: boolean;
  drums: boolean;
}

const tickToBeat = (t: number) => t / TICKS_PER_BEAT;

// ---- コードの鳴らし方 ----

/** sustain = コードの長さだけ伸ばす、quarter = 1拍ずつ刻む、offbeat = 拍の裏（8分の裏）で短く鳴らす（裏打ち） */
export type ChordRhythm = 'sustain' | 'quarter' | 'offbeat';

export const CHORD_RHYTHMS: { id: ChordRhythm; label: string; description: string }[] = [
  { id: 'sustain', label: '伸ばす', description: 'コードの長さだけ音を伸ばします。もっとも基本の鳴らし方です。' },
  { id: 'quarter', label: '1拍ごとに刻む', description: '1拍ごとにコードを鳴らします（6/8 では8分音符3つ分ごと）。ピアノやギターの基本的な伴奏です。' },
  { id: 'offbeat', label: '裏打ち', description: '拍の裏（「1と2と」の「と」、6/8 では「タ・チャ・チャ」の「チャ」）で短く鳴らします。レゲエ系の「スカンク」やハウスの裏打ちに使われます。' },
];

export interface ChordHit {
  midis: number[];
  start: number;
  duration: number;
}

/** コード進行を、鳴らし方に合わせた「音の塊」に分ける（再生と MIDI 出力の両方で使う） */
export function chordHits(chords: ProgressionChord[], rhythm: ChordRhythm = 'sustain', ts: TimeSignature = FOUR_FOUR): ChordHit[] {
  const hits: ChordHit[] = [];
  for (const s of chordSpans(chords)) {
    const midis = chordVoicing(s.chord).map(midiOf);
    if (rhythm === 'sustain') {
      hits.push({ midis, start: s.start, duration: s.end - s.start });
      continue;
    }
    // 「1拍」は拍子で変わる（4/4・3/4 は4分音符、6/8 は付点4分音符）
    const pulse = pulseTicks(ts);
    const eighth = TICKS_PER_BEAT / 2;
    for (let beat = s.start; beat < s.end; beat += pulse) {
      if (rhythm === 'quarter') {
        hits.push({ midis, start: beat, duration: Math.round(pulse * 0.9) });
      } else if (isCompound(ts)) {
        // 6/8 の裏打ち：まとまりの頭以外の8分音符（「タ・チャ・チャ」の「チャ」）
        for (let k = 1; k * eighth < pulse; k++) {
          if (beat + k * eighth < s.end) hits.push({ midis, start: beat + k * eighth, duration: eighth / 2 });
        }
      } else {
        hits.push({ midis, start: beat + eighth, duration: eighth / 2 });
      }
    }
  }
  return hits;
}

export function compositionSequence(
  data: {
    chords: ProgressionChord[];
    melody: NoteEvent[];
    bass: NoteEvent[];
    drums: DrumEvent[];
    chordRhythm?: ChordRhythm;
    timeSignature?: TimeSignature;
  },
  on: PlaybackOptions,
): SequenceEvent[] {
  const events: SequenceEvent[] = [];
  if (on.chords) {
    for (const h of chordHits(data.chords, data.chordRhythm, data.timeSignature)) {
      events.push({ midis: h.midis, startBeat: tickToBeat(h.start), durationBeats: tickToBeat(h.duration), velocity: 0.5 });
    }
  }
  if (on.melody) for (const n of data.melody) events.push({ midis: [midiOf(n.pitch)], startBeat: tickToBeat(n.startTick), durationBeats: tickToBeat(n.durationTick), instrument: 'synth', velocity: n.velocity / 127 });
  if (on.bass) for (const n of data.bass) events.push({ midis: [midiOf(n.pitch)], startBeat: tickToBeat(n.startTick), durationBeats: tickToBeat(n.durationTick), instrument: 'bass', velocity: n.velocity / 127 });
  if (on.drums) for (const d of data.drums) events.push({ midis: [], drum: d.drum, startBeat: tickToBeat(d.startTick), durationBeats: tickToBeat(d.durationTick), velocity: d.velocity / 127 });
  return events;
}
