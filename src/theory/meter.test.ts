import { describe, expect, it } from 'vitest';
import { barAndCount, barBeats, barTicks, countTicks, durationOptions, isCompound, normalizeTimeSignature, pulseTicks, stepsPerBar, type TimeSignature } from './meter';

const T44: TimeSignature = [4, 4];
const T34: TimeSignature = [3, 4];
const T68: TimeSignature = [6, 8];

describe('拍子の計算（4分音符 = 480 tick）', () => {
  it('1小節の長さ', () => {
    expect(barTicks(T44)).toBe(1920);
    expect(barTicks(T34)).toBe(1440);
    expect(barTicks(T68)).toBe(1440); // 8分音符6つ = 4分音符3つ分
    expect(barBeats(T34)).toBe(3);
    expect(barBeats(T68)).toBe(3);
  });

  it('6/8 だけが複合拍子（3つずつまとまる）', () => {
    expect(isCompound(T44)).toBe(false);
    expect(isCompound(T34)).toBe(false);
    expect(isCompound(T68)).toBe(true);
  });

  it('楽譜の1拍と、体で感じる1拍', () => {
    expect(countTicks(T44)).toBe(480);
    expect(countTicks(T68)).toBe(240); // 8分音符
    expect(pulseTicks(T34)).toBe(480);
    expect(pulseTicks(T68)).toBe(720); // 付点4分音符
  });

  it('ドラム入力のマス数（16分音符単位）', () => {
    expect(stepsPerBar(T44)).toBe(16);
    expect(stepsPerBar(T34)).toBe(12);
    expect(stepsPerBar(T68)).toBe(12);
  });

  it('コードの長さの選択肢', () => {
    expect(durationOptions(T44).map((o) => o.beats)).toEqual([1, 2, 4, 8]);
    expect(durationOptions(T34).map((o) => o.beats)).toEqual([1, 2, 3, 6]);
    expect(durationOptions(T34).find((o) => o.beats === 3)?.label).toBe('3拍（1小節）');
    expect(durationOptions(T68).map((o) => [o.beats, o.label])).toEqual([
      [1.5, '半小節'],
      [3, '1小節'],
      [6, '2小節'],
    ]);
  });

  it('位置を「何小節目・何拍目」に直す', () => {
    expect(barAndCount(0, T44)).toEqual({ bar: 1, count: 1 });
    expect(barAndCount(1440, T44)).toEqual({ bar: 1, count: 4 });
    expect(barAndCount(1440, T34)).toEqual({ bar: 2, count: 1 });
    expect(barAndCount(720, T68)).toEqual({ bar: 1, count: 4 }); // 4番目の8分音符（2つ目のまとまりの頭）
  });

  it('対応していない拍子は 4/4 として扱う', () => {
    expect(normalizeTimeSignature([5, 4])).toEqual([4, 4]);
    expect(normalizeTimeSignature(undefined)).toEqual([4, 4]);
    expect(normalizeTimeSignature([6, 8])).toEqual([6, 8]);
  });
});
