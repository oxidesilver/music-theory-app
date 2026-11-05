// IndexedDB に保存するデータの型（設計書 4-2・4-3）。
import type { MusicalKey, Pitch, PitchClass } from '@/types/music';

/** 1拍を何 tick に分けるか（MIDI の標準的な細かさ） */
export const PPQ = 480;

/** 現在のデータ形式のバージョン。形式を変えたら数字を上げ、変換処理を追加する */
export const SONG_SCHEMA_VERSION = 1;

export interface ChordEvent {
  id: string;
  root: PitchClass;
  /** コードの種類（例：'m7'）。Phase 2 で種類の一覧を定義する */
  quality: string;
  /** 分数コードのベース音（例：C/E の E） */
  bass?: PitchClass;
  inversion: number;
  startTick: number;
  durationTick: number;
}

export interface NoteEvent {
  id: string;
  pitch: Pitch;
  startTick: number;
  durationTick: number;
  /** 音の強さ 1〜127 */
  velocity: number;
}

export interface DrumEvent {
  id: string;
  /** GM ドラムの音番号（36 = キック、38 = スネア、42 = ハイハット など） */
  drum: number;
  startTick: number;
  durationTick: number;
  velocity: number;
}

export interface Song {
  id: string;
  title: string;
  key: MusicalKey;
  bpm: number;
  timeSignature: [number, number];
  chords: ChordEvent[];
  melody: NoteEvent[];
  bass: NoteEvent[];
  drums: DrumEvent[];
  /** コードの鳴らし方（'sustain' | 'quarter' | 'offbeat'）。古い作品には無いので省略可（＝伸ばす） */
  chordRhythm?: string;
  instruments: { chord: string; melody: string; bass: string };
  createdAt: string;
  updatedAt: string;
  schemaVersion: number;
}

export type LessonStatus = 'not-started' | 'in-progress' | 'completed';

export interface LessonProgress {
  lessonId: string;
  status: LessonStatus;
  updatedAt: string;
  completedAt?: string;
}

export interface QuizResult {
  id?: number;
  lessonId: string;
  questionId: string;
  correct: boolean;
  answeredAt: string;
}

export interface EarTrainingRecord {
  id?: number;
  level: 1 | 2 | 3;
  /** 問題の種類（例：'interval-major3-minor3'） */
  questionType: string;
  /** 出題内容（例：'M3'） */
  asked: string;
  answered: string;
  correct: boolean;
  answeredAt: string;
}

export interface FavoriteChord {
  id: string; // 例：'F#|m7'
  root: PitchClass;
  quality: string;
  addedAt: string;
}

export interface GenreProgress {
  genreId: string;
  completedItems: string[];
  updatedAt: string;
}
