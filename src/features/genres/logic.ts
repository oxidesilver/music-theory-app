// ジャンル講座のサンプルを、作品データ・再生データに変換する
import { create } from 'zustand';
import { db } from '@/storage/db';
import type { GenreProgress } from '@/storage/types';
import { normalizeRoot } from '@/theory/analysis';
import { makeKey } from '@/theory/key';
import { chordFromRoman } from '@/theory/roman';
import { makeChord } from '@/features/progression/logic';
import { bassLine, compositionSequence, patternFrom, patternToEvents, songLengthTicks } from '@/features/compose/logic';
import type { Genre, GenreItemId, GenreSample, RhythmExample } from '@/content/genres';

export function rhythmOf(genre: Genre, sample: GenreSample): RhythmExample {
  return genre.rhythms.find((r) => r.id === sample.rhythm) ?? genre.rhythms[0]!;
}

/** サンプル → 作品の中身（コード・ベース・ドラム・BPM・キー） */
export function realizeSample(genre: Genre, sample: GenreSample, rhythm: RhythmExample = rhythmOf(genre, sample)) {
  const key = makeKey(sample.tonic, sample.mode);
  const chords = sample.romans.map((r) => makeChord(normalizeRoot(key, chordFromRoman(key, r)), 4));
  const length = songLengthTicks(chords);
  return {
    title: `${genre.name}：${sample.name}`,
    key,
    bpm: sample.bpm,
    chords,
    melody: [],
    bass: bassLine(chords, key, rhythm.bass),
    drums: patternToEvents(patternFrom(rhythm.drums), length),
    chordRhythm: rhythm.chordRhythm,
    timeSignature: [4, 4] as [number, number],
  };
}

/** 再生用のデータ */
export function sampleSequence(genre: Genre, sample: GenreSample, rhythm?: RhythmExample) {
  const song = realizeSample(genre, sample, rhythm);
  return {
    events: compositionSequence(song, { chords: true, melody: false, bass: true, drums: true }),
    bpm: song.bpm,
    lengthBeats: songLengthTicks(song.chords) / 480,
  };
}

// ---- 学習の進み具合（IndexedDB） ----

interface GenreProgressState {
  loaded: boolean;
  progress: Record<string, GenreProgress>;
  load: () => Promise<void>;
  mark: (genreId: string, item: GenreItemId) => Promise<void>;
}

export const useGenreProgress = create<GenreProgressState>()((set, get) => ({
  loaded: false,
  progress: {},
  load: async () => {
    try {
      const list = await db.genreProgress.toArray();
      set({ loaded: true, progress: Object.fromEntries(list.map((p) => [p.genreId, p])) });
    } catch {
      set({ loaded: true });
    }
  },
  mark: async (genreId, item) => {
    const prev = get().progress[genreId];
    if (prev?.completedItems.includes(item)) return;
    const next: GenreProgress = { genreId, completedItems: [...(prev?.completedItems ?? []), item], updatedAt: new Date().toISOString() };
    await db.genreProgress.put(next);
    set((s) => ({ progress: { ...s.progress, [genreId]: next } }));
  },
}));
