import { create } from 'zustand';
import { db } from '@/storage/db';
import { PPQ, SONG_SCHEMA_VERSION, type ChordEvent, type Song } from '@/storage/types';
import { createId } from '@/lib/id';
import { makeKey, type MusicalKey } from '@/theory/key';
import type { ChordQualityId, ChordSpec } from '@/theory/chord';
import { makeChord, transposeChords, type ProgressionChord } from './logic';

// 編集中のコード進行（画面を移動しても内容を保つため、ストアに置く）

export interface EditorState {
  songId: string | null;
  title: string;
  key: MusicalKey;
  bpm: number;
  chords: ProgressionChord[];
  selected: number | null;
  dirty: boolean;
  /** 読み込んだ作品が持っているメロディーなど（コード進行メーカーでは編集しないが、保存時に消さない） */
  base: Song | null;

  setTitle: (t: string) => void;
  setKey: (k: MusicalKey, transpose: boolean) => void;
  setBpm: (bpm: number) => void;
  select: (i: number | null) => void;
  add: (spec: ChordSpec, durationBeats?: number) => void;
  replace: (i: number, spec: ChordSpec) => void;
  remove: (i: number) => void;
  duplicate: (i: number) => void;
  move: (i: number, delta: -1 | 1) => void;
  setDuration: (i: number, beats: number) => void;
  setChords: (chords: ProgressionChord[]) => void;
  clear: () => void;
  newSong: () => void;
  load: (id: string) => Promise<boolean>;
  save: () => Promise<string>;
}

export const MIN_BPM = 40;
export const MAX_BPM = 240;
const TICKS_PER_BEAT = PPQ;

const initial = () => ({
  songId: null,
  title: '新しいコード進行',
  key: makeKey('C', 'major'),
  bpm: 100,
  chords: [] as ProgressionChord[],
  selected: null,
  dirty: false,
  base: null,
});

/** 進行 → 保存用のデータ（tick 単位） */
export function chordsToEvents(chords: ProgressionChord[]): ChordEvent[] {
  let tick = 0;
  return chords.map((c) => {
    const e: ChordEvent = {
      id: c.id,
      root: c.root,
      quality: c.quality,
      ...(c.bass ? { bass: c.bass } : {}),
      inversion: 0,
      startTick: tick,
      durationTick: c.durationBeats * TICKS_PER_BEAT,
    };
    tick += e.durationTick;
    return e;
  });
}

/** 保存用のデータ → 進行（開始位置の順に並べる） */
export function eventsToChords(events: ChordEvent[]): ProgressionChord[] {
  return [...events]
    .sort((a, b) => a.startTick - b.startTick)
    .map((e) => ({
      id: e.id,
      root: e.root,
      quality: e.quality as ChordQualityId,
      ...(e.bass ? { bass: e.bass } : {}),
      durationBeats: e.durationTick / TICKS_PER_BEAT,
    }));
}

export const useEditor = create<EditorState>()((set, get) => ({
  ...initial(),

  setTitle: (title) => set({ title, dirty: true }),
  setKey: (key, transpose) =>
    set((s) => ({ key, chords: transpose ? transposeChords(s.chords, s.key, key) : s.chords, dirty: true })),
  setBpm: (bpm) => set({ bpm: Math.round(Math.min(MAX_BPM, Math.max(MIN_BPM, bpm))), dirty: true }),
  select: (selected) => set({ selected }),
  add: (spec, durationBeats = 4) =>
    set((s) => ({ chords: [...s.chords, makeChord(spec, durationBeats)], selected: s.chords.length, dirty: true })),
  replace: (i, spec) =>
    set((s) => ({
      chords: s.chords.map((c, j) => (j === i ? { ...c, root: spec.root, quality: spec.quality, bass: spec.bass } : c)),
      dirty: true,
    })),
  remove: (i) =>
    set((s) => {
      const chords = s.chords.filter((_, j) => j !== i);
      return { chords, selected: chords.length === 0 ? null : Math.min(i, chords.length - 1), dirty: true };
    }),
  duplicate: (i) =>
    set((s) => {
      const c = s.chords[i];
      if (!c) return s;
      const chords = [...s.chords.slice(0, i + 1), { ...c, id: createId() }, ...s.chords.slice(i + 1)];
      return { chords, selected: i + 1, dirty: true };
    }),
  move: (i, delta) =>
    set((s) => {
      const j = i + delta;
      if (j < 0 || j >= s.chords.length) return s;
      const chords = [...s.chords];
      [chords[i], chords[j]] = [chords[j]!, chords[i]!];
      return { chords, selected: j, dirty: true };
    }),
  setDuration: (i, beats) =>
    set((s) => ({ chords: s.chords.map((c, j) => (j === i ? { ...c, durationBeats: beats } : c)), dirty: true })),
  setChords: (chords) => set({ chords, selected: null, dirty: true }),
  clear: () => set({ chords: [], selected: null, dirty: true }),
  newSong: () => set(initial()),

  load: async (id) => {
    const song = await db.songs.get(id);
    if (!song) return false;
    set({
      songId: song.id,
      title: song.title,
      key: song.key,
      bpm: song.bpm,
      chords: eventsToChords(song.chords),
      selected: null,
      dirty: false,
      base: song,
    });
    return true;
  },

  save: async () => {
    const s = get();
    const now = new Date().toISOString();
    const id = s.songId ?? createId();
    const song: Song = {
      id,
      title: s.title.trim() || '無題のコード進行',
      key: s.key,
      bpm: s.bpm,
      timeSignature: [4, 4],
      chords: chordsToEvents(s.chords),
      melody: s.base?.melody ?? [],
      bass: s.base?.bass ?? [],
      drums: s.base?.drums ?? [],
      instruments: s.base?.instruments ?? { chord: 'piano', melody: 'synth', bass: 'bass' },
      createdAt: s.base?.createdAt ?? now,
      updatedAt: now,
      schemaVersion: SONG_SCHEMA_VERSION,
    };
    await db.songs.put(song);
    set({ songId: id, dirty: false, base: song, title: song.title });
    return id;
  },
}));
