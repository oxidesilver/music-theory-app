// 作曲画面の計算（画面から分離。テスト可能）

import { PPQ, type DrumEvent, type NoteEvent } from '@/storage/types';
import type { SequenceEvent } from '@/audio/engine';
import { classifyNote, type NoteRole } from '@/theory/tension';
import { spellInKey, type MusicalKey } from '@/theory/key';
import { midiOf, semitoneOf, type Pitch } from '@/theory/pitch';
import { scaleNotes, type ScaleId } from '@/theory/scale';
import { createId } from '@/lib/id';
import { bassPitch, chordVoicing, type ProgressionChord } from '@/features/progression/logic';

export const TICKS_PER_BEAT = PPQ;
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
export function songLengthTicks(chords: ProgressionChord[], ...tracks: { startTick: number; durationTick: number }[][]): number {
  const chordEnd = chordSpans(chords).at(-1)?.end ?? 0;
  const noteEnd = Math.max(0, ...tracks.flat().map((n) => n.startTick + n.durationTick));
  const end = Math.max(chordEnd, noteEnd, TICKS_PER_BAR * 4);
  return Math.ceil(end / TICKS_PER_BAR) * TICKS_PER_BAR;
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
  { id: 'quarter', label: '4分音符でルート', description: '1拍ごとにルート音を弾きます。ロックやポップスの基本形です。' },
  { id: 'eighth', label: '8分音符でルート', description: '半拍ごとにルート音を刻みます。疾走感が出ます。' },
  { id: 'root-fifth', label: 'ルートと5度', description: 'ルート → 5度 を交互に弾きます。安定感と動きが両立します。' },
  { id: 'octave', label: 'オクターブ', description: 'ルートと1オクターブ上を交互に弾きます。ダンス系の曲でよく使われます。' },
];

/** コード進行に合わせてベースラインを作る */
export function bassLine(chords: ProgressionChord[], key: MusicalKey, pattern: BassPattern): NoteEvent[] {
  const notes: NoteEvent[] = [];
  for (const span of chordSpans(chords)) {
    const root = midiOf(bassPitch(span.chord));
    const len = span.end - span.start;
    if (pattern === 'whole') {
      notes.push(makeNote(root, key, span.start, len));
      continue;
    }
    const step = pattern === 'eighth' ? TICKS_PER_BEAT / 2 : TICKS_PER_BEAT;
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

export const STEPS_PER_BAR = 16;
export const DRUM_TICKS = TICKS_PER_BAR / STEPS_PER_BAR; // 16分音符 = 120 tick

export const DRUM_LANES = [
  { drum: 36, name: 'キック' },
  { drum: 38, name: 'スネア' },
  { drum: 39, name: 'クラップ' },
  { drum: 42, name: 'ハイハット（閉）' },
  { drum: 46, name: 'ハイハット（開）' },
] as const;

/** 1小節分のパターン：[レーン][16ステップ] */
export type DrumPattern = boolean[][];

export function emptyPattern(): DrumPattern {
  return DRUM_LANES.map(() => Array.from({ length: STEPS_PER_BAR }, () => false));
}

function patternFrom(steps: Partial<Record<number, number[]>>): DrumPattern {
  return DRUM_LANES.map((l) => Array.from({ length: STEPS_PER_BAR }, (_, i) => (steps[l.drum] ?? []).includes(i)));
}

export const DRUM_PRESETS: { id: string; name: string; description: string; pattern: DrumPattern }[] = [
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

/** パターン → 曲全体のドラムの音（全小節で繰り返す） */
export function patternToEvents(pattern: DrumPattern, lengthTicks: number): DrumEvent[] {
  const events: DrumEvent[] = [];
  const bars = Math.ceil(lengthTicks / TICKS_PER_BAR);
  for (let bar = 0; bar < bars; bar++) {
    DRUM_LANES.forEach((lane, li) => {
      pattern[li]!.forEach((on, step) => {
        if (on) events.push({ id: createId(), drum: lane.drum, startTick: bar * TICKS_PER_BAR + step * DRUM_TICKS, durationTick: DRUM_TICKS, velocity: lane.drum === 42 ? 80 : 110 });
      });
    });
  }
  return events;
}

/** 曲のドラムの音 → 1小節目のパターン */
export function eventsToPattern(events: DrumEvent[]): DrumPattern {
  const p = emptyPattern();
  for (const e of events) {
    if (e.startTick >= TICKS_PER_BAR) continue;
    const li = DRUM_LANES.findIndex((l) => l.drum === e.drum);
    const step = Math.round(e.startTick / DRUM_TICKS);
    if (li >= 0 && step < STEPS_PER_BAR) p[li]![step] = true;
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

export function compositionSequence(
  data: { chords: ProgressionChord[]; melody: NoteEvent[]; bass: NoteEvent[]; drums: DrumEvent[] },
  on: PlaybackOptions,
): SequenceEvent[] {
  const events: SequenceEvent[] = [];
  if (on.chords) {
    for (const s of chordSpans(data.chords)) {
      events.push({ midis: chordVoicing(s.chord).map(midiOf), startBeat: tickToBeat(s.start), durationBeats: tickToBeat(s.end - s.start), velocity: 0.5 });
    }
  }
  if (on.melody) for (const n of data.melody) events.push({ midis: [midiOf(n.pitch)], startBeat: tickToBeat(n.startTick), durationBeats: tickToBeat(n.durationTick), instrument: 'synth', velocity: n.velocity / 127 });
  if (on.bass) for (const n of data.bass) events.push({ midis: [midiOf(n.pitch)], startBeat: tickToBeat(n.startTick), durationBeats: tickToBeat(n.durationTick), instrument: 'bass', velocity: n.velocity / 127 });
  if (on.drums) for (const d of data.drums) events.push({ midis: [], drum: d.drum, startBeat: tickToBeat(d.startTick), durationBeats: tickToBeat(d.durationTick), velocity: d.velocity / 127 });
  return events;
}
