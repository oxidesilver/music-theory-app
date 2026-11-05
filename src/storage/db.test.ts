import { afterEach, describe, expect, it } from 'vitest';
import { AppDatabase } from './db';
import { SONG_SCHEMA_VERSION, type Song } from './types';

const dbs: AppDatabase[] = [];
function openTestDb() {
  const d = new AppDatabase(`test-${Math.random()}`);
  dbs.push(d);
  return d;
}
afterEach(async () => {
  for (const d of dbs.splice(0)) await d.delete();
});

function sampleSong(): Song {
  const now = new Date().toISOString();
  return {
    id: 'song-1',
    title: 'F#マイナーの進行',
    key: { tonic: { letter: 'F', accidental: 1 }, mode: 'minor' },
    bpm: 95,
    timeSignature: [4, 4],
    chords: [
      { id: 'c1', root: { letter: 'F', accidental: 1 }, quality: 'm', inversion: 0, startTick: 0, durationTick: 1920 },
    ],
    melody: [],
    bass: [],
    drums: [],
    instruments: { chord: 'piano', melody: 'synth', bass: 'bass' },
    createdAt: now,
    updatedAt: now,
    schemaVersion: SONG_SCHEMA_VERSION,
  };
}

describe('端末内データベース（IndexedDB）', () => {
  it('作品を保存して読み出せる（F# と G♭ の区別も保たれる）', async () => {
    const d = openTestDb();
    await d.songs.put(sampleSong());
    const loaded = await d.songs.get('song-1');
    expect(loaded?.title).toBe('F#マイナーの進行');
    expect(loaded?.key.tonic).toEqual({ letter: 'F', accidental: 1 });
    expect(loaded?.chords[0]?.durationTick).toBe(1920);
  });

  it('学習進捗とクイズ結果を保存できる', async () => {
    const d = openTestDb();
    const now = new Date().toISOString();
    await d.lessonProgress.put({ lessonId: 'ch1-l1', status: 'completed', updatedAt: now, completedAt: now });
    await d.quizResults.add({ lessonId: 'ch1-l1', questionId: 'q1', correct: true, answeredAt: now });
    await d.quizResults.add({ lessonId: 'ch1-l1', questionId: 'q2', correct: false, answeredAt: now });

    expect((await d.lessonProgress.get('ch1-l1'))?.status).toBe('completed');
    expect(await d.quizResults.where('lessonId').equals('ch1-l1').count()).toBe(2);
  });

  it('別の名前のデータベースはお互いに影響しない', async () => {
    const a = openTestDb();
    const b = openTestDb();
    await a.songs.put(sampleSong());
    expect(await b.songs.count()).toBe(0);
  });
});
