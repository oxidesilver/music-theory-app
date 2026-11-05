// バックアップと復元（指示書 6章）
// - すべての端末内データを1つの JSON ファイルに書き出す
// - 読み込むときは形式を厳しく検査し、壊れたファイルや別アプリのファイルは受け付けない
// - 復元は「追加（今のデータは消さない）」か「すべて置き換え」を選べる。置き換えの前には今のデータを自動で書き出す

import { z } from 'zod';
import { db } from './db';
import { SONG_SCHEMA_VERSION } from './types';
import type { EarTrainingRecord, FavoriteChord, GenreProgress, LessonProgress, QuizResult, Song } from './types';
import { DEFAULT_SETTINGS, type Settings } from '@/stores/settingsStore';

export const BACKUP_APP_ID = 'music-theory-app';
export const BACKUP_VERSION = 1;
/** 読み込めるファイルの大きさの上限（20MB） */
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;

// ---- データの形（検査用） ----

const letter = z.enum(['C', 'D', 'E', 'F', 'G', 'A', 'B']);
const accidental = z.number().int().min(-2).max(2);
const pitchClass = z.object({ letter, accidental });
const pitch = z.object({ letter, accidental, octave: z.number().int().min(-1).max(9) });
const tick = z.number().int().min(0).max(1e9);
const iso = z.string().min(1).max(40);
const id = z.string().min(1).max(100);

const chordEvent = z.object({
  id,
  root: pitchClass,
  quality: z.string().min(0).max(20),
  bass: pitchClass.optional(),
  inversion: z.number().int().min(0).max(6),
  startTick: tick,
  durationTick: tick.min(1),
});
const noteEvent = z.object({ id, pitch, startTick: tick, durationTick: tick.min(1), velocity: z.number().int().min(1).max(127) });
const drumEvent = z.object({ id, drum: z.number().int().min(0).max(127), startTick: tick, durationTick: tick.min(1), velocity: z.number().int().min(1).max(127) });

const song = z.object({
  id,
  title: z.string().max(200),
  key: z.object({ tonic: pitchClass, mode: z.enum(['major', 'minor']) }),
  bpm: z.number().min(20).max(400),
  timeSignature: z.tuple([z.number().int().min(1).max(32), z.number().int().min(1).max(32)]),
  chords: z.array(chordEvent).max(10000),
  melody: z.array(noteEvent).max(100000),
  bass: z.array(noteEvent).max(100000),
  drums: z.array(drumEvent).max(200000),
  chordRhythm: z.enum(['sustain', 'quarter', 'offbeat']).optional(),
  instruments: z.object({ chord: z.string().max(40), melody: z.string().max(40), bass: z.string().max(40) }),
  createdAt: iso,
  updatedAt: iso,
  schemaVersion: z.number().int().min(1).max(SONG_SCHEMA_VERSION),
});

const lessonProgress = z.object({
  lessonId: id,
  status: z.enum(['not-started', 'in-progress', 'completed']),
  updatedAt: iso,
  completedAt: iso.optional(),
});
const quizResult = z.object({ lessonId: id, questionId: id, correct: z.boolean(), answeredAt: iso });
const earRecord = z.object({
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  questionType: z.string().max(60),
  asked: z.string().max(200),
  answered: z.string().max(200),
  correct: z.boolean(),
  answeredAt: iso,
});
const favorite = z.object({ id, root: pitchClass, quality: z.string().max(20), addedAt: iso });
const genreProgress = z.object({ genreId: id, completedItems: z.array(z.string().max(40)).max(50), updatedAt: iso });

const settings = z.object({
  theme: z.enum(['system', 'light', 'dark']),
  romanStyle: z.enum(['japanese', 'english']),
  octaveConvention: z.enum(['fl', 'standard']),
  masterVolume: z.number().min(0).max(1),
  instrument: z.enum(['piano', 'synth', 'bass']),
});

const backupSchema = z.object({
  app: z.literal(BACKUP_APP_ID),
  backupVersion: z.number().int().min(1).max(BACKUP_VERSION),
  exportedAt: iso,
  data: z.object({
    songs: z.array(song).max(10000),
    lessonProgress: z.array(lessonProgress).max(10000),
    quizResults: z.array(quizResult).max(500000),
    earTraining: z.array(earRecord).max(500000),
    favorites: z.array(favorite).max(10000),
    genreProgress: z.array(genreProgress).max(1000),
  }),
  settings: settings.optional(),
});

export interface BackupData {
  songs: Song[];
  lessonProgress: LessonProgress[];
  quizResults: QuizResult[];
  earTraining: EarTrainingRecord[];
  favorites: FavoriteChord[];
  genreProgress: GenreProgress[];
}

export interface Backup {
  app: typeof BACKUP_APP_ID;
  backupVersion: number;
  exportedAt: string;
  data: BackupData;
  settings?: Settings;
}

export type BackupSummary = Record<keyof BackupData, number>;

export function summarize(data: BackupData): BackupSummary {
  return {
    songs: data.songs.length,
    lessonProgress: data.lessonProgress.length,
    quizResults: data.quizResults.length,
    earTraining: data.earTraining.length,
    favorites: data.favorites.length,
    genreProgress: data.genreProgress.length,
  };
}

export const SUMMARY_LABELS: Record<keyof BackupData, string> = {
  songs: '作品',
  lessonProgress: 'レッスンの進捗',
  quizResults: 'クイズの解答記録',
  earTraining: '耳トレの記録',
  favorites: 'お気に入りコード',
  genreProgress: 'ジャンル講座の進捗',
};

// ---- 書き出し ----

/** 自動で付く番号（id）は、復元先で新しく付け直すので外しておく */
function withoutAutoId<T extends { id?: number }>(rows: T[]): Omit<T, 'id'>[] {
  return rows.map(({ id: _id, ...rest }) => rest);
}

export async function createBackup(currentSettings: Settings): Promise<Backup> {
  const [songs, lp, quiz, ear, favorites, genre] = await Promise.all([
    db.songs.toArray(),
    db.lessonProgress.toArray(),
    db.quizResults.toArray(),
    db.earTraining.toArray(),
    db.favorites.toArray(),
    db.genreProgress.toArray(),
  ]);
  return {
    app: BACKUP_APP_ID,
    backupVersion: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      songs,
      lessonProgress: lp,
      quizResults: withoutAutoId(quiz) as QuizResult[],
      earTraining: withoutAutoId(ear) as EarTrainingRecord[],
      favorites,
      genreProgress: genre,
    },
    settings: currentSettings,
  };
}

export function backupFileName(date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `music-theory-app-backup_${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}_${p(date.getHours())}${p(date.getMinutes())}.json`;
}

export function downloadBackup(backup: Backup, fileName = backupFileName()) {
  const blob = new Blob([JSON.stringify(backup, null, 1)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// ---- 読み込み（検査） ----

export type ParseResult = { ok: true; backup: Backup; summary: BackupSummary } | { ok: false; error: string };

const FIELD_NAMES: Record<string, string> = {
  songs: '作品',
  lessonProgress: 'レッスンの進捗',
  quizResults: 'クイズの記録',
  earTraining: '耳トレの記録',
  favorites: 'お気に入り',
  genreProgress: 'ジャンル講座の進捗',
  settings: '設定',
};

/** バックアップファイルの中身（文字列）を検査する */
export function parseBackup(text: string): ParseResult {
  if (text.length > MAX_BACKUP_BYTES) return { ok: false, error: 'ファイルが大きすぎます（20MB まで）。' };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: 'ファイルが壊れているか、JSON 形式ではありません。このアプリで作ったバックアップファイルを選んでください。' };
  }
  if (typeof json !== 'object' || json === null || (json as { app?: unknown }).app !== BACKUP_APP_ID) {
    return { ok: false, error: 'このアプリのバックアップファイルではありません。' };
  }
  const version = (json as { backupVersion?: unknown }).backupVersion;
  if (typeof version === 'number' && version > BACKUP_VERSION) {
    return { ok: false, error: 'より新しいバージョンのアプリで作られたバックアップです。アプリを更新してから読み込んでください。' };
  }
  const result = backupSchema.safeParse(json);
  if (!result.success) {
    const issue = result.error.issues[0]!;
    const path = issue.path.map(String);
    const where = path[0] === 'data' ? FIELD_NAMES[path[1] ?? ''] : FIELD_NAMES[path[0] ?? ''];
    const index = path[0] === 'data' && typeof issue.path[2] === 'number' ? `の ${Number(issue.path[2]) + 1} 件目` : '';
    return { ok: false, error: `ファイルの内容が正しくありません（${where ?? '全体'}${index}：${path.slice(3).join('.') || path.join('.')}）。ファイルが壊れている可能性があります。` };
  }
  const backup = result.data as Backup;
  return { ok: true, backup, summary: summarize(backup.data) };
}

// ---- 復元 ----

export type RestoreMode = 'merge' | 'replace';

export interface RestoreResult {
  added: BackupSummary;
  skipped: BackupSummary;
}

const ZERO: BackupSummary = { songs: 0, lessonProgress: 0, quizResults: 0, earTraining: 0, favorites: 0, genreProgress: 0 };

/**
 * 復元する。
 * - merge：今のデータを残したまま、まだ無いものだけ追加する（同じ ID の作品などはスキップ）
 * - replace：今のデータをすべて消して、バックアップの内容にする
 */
export async function restoreBackup(backup: Backup, mode: RestoreMode): Promise<RestoreResult> {
  const d = backup.data;
  const added = { ...ZERO };
  const skipped = { ...ZERO };

  await db.transaction('rw', [db.songs, db.lessonProgress, db.quizResults, db.earTraining, db.favorites, db.genreProgress], async () => {
    if (mode === 'replace') {
      await Promise.all([db.songs.clear(), db.lessonProgress.clear(), db.quizResults.clear(), db.earTraining.clear(), db.favorites.clear(), db.genreProgress.clear()]);
      await db.songs.bulkAdd(d.songs);
      await db.lessonProgress.bulkAdd(d.lessonProgress);
      await db.quizResults.bulkAdd(withoutAutoId(d.quizResults) as QuizResult[]);
      await db.earTraining.bulkAdd(withoutAutoId(d.earTraining) as EarTrainingRecord[]);
      await db.favorites.bulkAdd(d.favorites);
      await db.genreProgress.bulkAdd(d.genreProgress);
      Object.assign(added, summarize(d));
      return;
    }

    // merge：キー（ID）が同じものは追加しない
    const addMissing = async <T,>(table: { get: (k: string) => Promise<T | undefined>; add: (v: T) => Promise<unknown> }, rows: T[], key: (r: T) => string, name: keyof BackupSummary) => {
      for (const r of rows) {
        if (await table.get(key(r))) skipped[name] += 1;
        else {
          await table.add(r);
          added[name] += 1;
        }
      }
    };
    await addMissing(db.songs as never, d.songs, (r) => r.id, 'songs');
    await addMissing(db.lessonProgress as never, d.lessonProgress, (r) => r.lessonId, 'lessonProgress');
    await addMissing(db.favorites as never, d.favorites, (r) => r.id, 'favorites');
    await addMissing(db.genreProgress as never, d.genreProgress, (r) => r.genreId, 'genreProgress');

    // 記録（自動の番号つき）は、同じ問題・同じ解答時刻のものを重複とみなす
    const quizKeys = new Set((await db.quizResults.toArray()).map((r) => `${r.lessonId}|${r.questionId}|${r.answeredAt}`));
    for (const r of withoutAutoId(d.quizResults) as QuizResult[]) {
      const k = `${r.lessonId}|${r.questionId}|${r.answeredAt}`;
      if (quizKeys.has(k)) skipped.quizResults += 1;
      else {
        await db.quizResults.add(r);
        quizKeys.add(k);
        added.quizResults += 1;
      }
    }
    const earKeys = new Set((await db.earTraining.toArray()).map((r) => `${r.questionType}|${r.asked}|${r.answered}|${r.answeredAt}`));
    for (const r of withoutAutoId(d.earTraining) as EarTrainingRecord[]) {
      const k = `${r.questionType}|${r.asked}|${r.answered}|${r.answeredAt}`;
      if (earKeys.has(k)) skipped.earTraining += 1;
      else {
        await db.earTraining.add(r);
        earKeys.add(k);
        added.earTraining += 1;
      }
    }
  });
  return { added, skipped };
}

/** 設定の検査（バックアップに含まれていない場合は初期値） */
export function settingsFromBackup(backup: Backup): Settings {
  return { ...DEFAULT_SETTINGS, ...(backup.settings ?? {}) };
}
