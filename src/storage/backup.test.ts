import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { BACKUP_VERSION, createBackup, parseBackup, restoreBackup, type Backup } from './backup';
import { SONG_SCHEMA_VERSION, type Song } from './types';
import { DEFAULT_SETTINGS } from '@/stores/settingsStore';

const now = '2026-11-05T10:00:00.000Z';
function song(id: string, title = id): Song {
  return {
    id,
    title,
    key: { tonic: { letter: 'F', accidental: 1 }, mode: 'minor' },
    bpm: 95,
    timeSignature: [4, 4],
    chords: [{ id: `${id}-c1`, root: { letter: 'F', accidental: 1 }, quality: 'm', inversion: 0, startTick: 0, durationTick: 1920 }],
    melody: [{ id: `${id}-n1`, pitch: { letter: 'C', accidental: 1, octave: 5 }, startTick: 0, durationTick: 480, velocity: 100 }],
    bass: [],
    drums: [{ id: `${id}-d1`, drum: 36, startTick: 0, durationTick: 120, velocity: 110 }],
    chordRhythm: 'offbeat',
    instruments: { chord: 'piano', melody: 'synth', bass: 'bass' },
    createdAt: now,
    updatedAt: now,
    schemaVersion: SONG_SCHEMA_VERSION,
  };
}

async function clearAll() {
  await Promise.all([db.songs.clear(), db.lessonProgress.clear(), db.quizResults.clear(), db.earTraining.clear(), db.favorites.clear(), db.genreProgress.clear()]);
}

async function seed() {
  await db.songs.bulkPut([song('a', '作品A'), song('b', '作品B')]);
  await db.lessonProgress.put({ lessonId: 'ch1-l1', status: 'completed', updatedAt: now, completedAt: now });
  await db.quizResults.bulkAdd([
    { lessonId: 'ch1-l1', questionId: 'q1', correct: true, answeredAt: now },
    { lessonId: 'ch1-l1', questionId: 'q2', correct: false, answeredAt: now },
  ]);
  await db.earTraining.add({ level: 1, questionType: 'thirds', asked: '長3度', answered: '短3度', correct: false, answeredAt: now });
  await db.favorites.put({ id: 'F#|m7', root: { letter: 'F', accidental: 1 }, quality: 'm7', addedAt: now });
  await db.genreProgress.put({ genreId: 'japareggae', completedItems: ['read'], updatedAt: now });
}

describe('バックアップの作成と検査', () => {
  beforeEach(async () => {
    await clearAll();
    await seed();
  });

  it('すべてのデータと設定を書き出し、読み込むと同じ内容に戻る', async () => {
    const backup = await createBackup({ ...DEFAULT_SETTINGS, theme: 'dark' });
    expect(backup.app).toBe('music-theory-app');
    expect(backup.backupVersion).toBe(BACKUP_VERSION);
    const parsed = parseBackup(JSON.stringify(backup));
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.summary).toEqual({ songs: 2, lessonProgress: 1, quizResults: 2, earTraining: 1, favorites: 1, genreProgress: 1 });
    expect(parsed.backup.data.songs.find((s) => s.id === 'a')).toEqual(song('a', '作品A'));
    expect(parsed.backup.settings?.theme).toBe('dark');
    // 自動で付く番号は書き出さない
    expect(parsed.backup.data.quizResults[0]).not.toHaveProperty('id');
  });

  it.each([
    ['JSON ではない', 'これはテキストです', /壊れているか、JSON 形式ではありません/],
    ['別のアプリのファイル', JSON.stringify({ app: 'other', data: {} }), /このアプリのバックアップファイルではありません/],
    ['新しすぎるバージョン', JSON.stringify({ app: 'music-theory-app', backupVersion: 99, exportedAt: now, data: {} }), /より新しいバージョン/],
  ])('%s は読み込まない', (_, text, message) => {
    const r = parseBackup(text);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(message);
  });

  it('作品の中身が壊れていると、どこが壊れているかを伝えて読み込まない', async () => {
    const backup = await createBackup(DEFAULT_SETTINGS);
    const broken = structuredClone(backup) as unknown as { data: { songs: { bpm: unknown }[] } };
    broken.data.songs[1]!.bpm = '速い';
    const r = parseBackup(JSON.stringify(broken));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/作品の 2 件目/);
  });

  it('必要な項目が足りないファイルや、ありえない値は読み込まない', async () => {
    const backup = (await createBackup(DEFAULT_SETTINGS)) as Backup;
    const noData = { ...backup, data: { ...backup.data, songs: undefined } };
    expect(parseBackup(JSON.stringify(noData)).ok).toBe(false);
    const badPitch = structuredClone(backup);
    badPitch.data.songs[0]!.melody[0]!.pitch.accidental = 5;
    expect(parseBackup(JSON.stringify(badPitch)).ok).toBe(false);
    const badVelocity = structuredClone(backup);
    badVelocity.data.songs[0]!.melody[0]!.velocity = 300;
    expect(parseBackup(JSON.stringify(badVelocity)).ok).toBe(false);
  });

  it('大きすぎるファイルは読み込まない', () => {
    const r = parseBackup('x'.repeat(20 * 1024 * 1024 + 1));
    expect(r.ok).toBe(false);
  });
});

describe('復元', () => {
  let backup: Backup;
  beforeEach(async () => {
    await clearAll();
    await seed();
    backup = await createBackup(DEFAULT_SETTINGS);
    await clearAll();
  });

  it('「追加する」：今のデータを残したまま、無いものだけ追加する（同じ作品はスキップ）', async () => {
    await db.songs.put(song('a', '端末で編集した作品A'));
    await db.songs.put(song('c', '端末だけの作品C'));
    const r = await restoreBackup(backup, 'merge');
    expect(r.added.songs).toBe(1);
    expect(r.skipped.songs).toBe(1);
    expect((await db.songs.get('a'))?.title).toBe('端末で編集した作品A'); // 上書きしない
    expect(await db.songs.count()).toBe(3);
    expect(await db.quizResults.count()).toBe(2);
  });

  it('「追加する」を2回行っても、記録が重複しない', async () => {
    await restoreBackup(backup, 'merge');
    const second = await restoreBackup(backup, 'merge');
    expect(Object.values(second.added).every((n) => n === 0)).toBe(true);
    expect(await db.quizResults.count()).toBe(2);
    expect(await db.earTraining.count()).toBe(1);
  });

  it('「すべて置き換える」：今のデータを消して、バックアップの内容だけにする', async () => {
    await db.songs.put(song('z', '消える作品'));
    await db.quizResults.add({ lessonId: 'x', questionId: 'y', correct: true, answeredAt: now });
    await restoreBackup(backup, 'replace');
    expect((await db.songs.toArray()).map((s) => s.id).sort()).toEqual(['a', 'b']);
    expect(await db.quizResults.count()).toBe(2);
    expect((await db.genreProgress.get('japareggae'))?.completedItems).toEqual(['read']);
  });
});
