import { Dexie, type EntityTable } from 'dexie';
import type {
  EarTrainingRecord,
  FavoriteChord,
  GenreProgress,
  LessonProgress,
  QuizResult,
  Song,
} from './types';

/**
 * 端末内データベース（IndexedDB）。
 * 下の文字列は「検索に使う項目」の指定で、それ以外の項目もすべて保存される。
 * 将来データ形式を変えるときは version(2) を追加し、古いデータを変換する処理を書く。
 */
export class AppDatabase extends Dexie {
  songs!: EntityTable<Song, 'id'>;
  lessonProgress!: EntityTable<LessonProgress, 'lessonId'>;
  quizResults!: EntityTable<QuizResult, 'id'>;
  earTraining!: EntityTable<EarTrainingRecord, 'id'>;
  favorites!: EntityTable<FavoriteChord, 'id'>;
  genreProgress!: EntityTable<GenreProgress, 'genreId'>;

  constructor(name = 'music-theory-app') {
    super(name);
    this.version(1).stores({
      songs: 'id, title, updatedAt',
      lessonProgress: 'lessonId, status',
      quizResults: '++id, lessonId, questionId, answeredAt',
      earTraining: '++id, level, questionType, answeredAt',
      favorites: 'id, addedAt',
      genreProgress: 'genreId',
    });
  }
}

export const db = new AppDatabase();
