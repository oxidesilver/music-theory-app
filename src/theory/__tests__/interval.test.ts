import { describe, expect, it } from 'vitest';
import {
  formatInterval,
  intervalBetween,
  intervalBetweenPitchClasses,
  intervalNameJa,
  intervalSemitones,
  invertInterval,
  parseInterval,
  transpose,
  transposePitch,
} from '../interval';
import { formatPitch, formatPitchClass, parsePitch, parsePitchClass } from '../pitch';

describe('音程の半音数', () => {
  it.each([
    ['P1', 0], ['m2', 1], ['M2', 2], ['A2', 3], ['m3', 3], ['M3', 4], ['d4', 4], ['P4', 5],
    ['A4', 6], ['d5', 6], ['P5', 7], ['A5', 8], ['m6', 8], ['M6', 9], ['d7', 9], ['m7', 10],
    ['M7', 11], ['P8', 12], ['m9', 13], ['M9', 14], ['A9', 15], ['P11', 17], ['A11', 18],
    ['m13', 20], ['M13', 21], ['P15', 24],
  ])('%s = %i 半音', (iv, semis) => {
    expect(intervalSemitones(parseInterval(iv))).toBe(semis);
  });

  it('存在しない組み合わせ（長5度・完全3度）はエラー', () => {
    expect(() => parseInterval('M5')).toThrow();
    expect(() => parseInterval('P3')).toThrow();
    expect(() => parseInterval('m4')).toThrow();
    expect(() => parseInterval('X3')).toThrow();
  });
});

describe('音程の分だけ移す（綴りを正しく）', () => {
  it.each([
    ['C', 'M3', 'E'],
    ['F#', 'm3', 'A'],
    ['C', 'd4', 'Fb'],
    ['C', 'A4', 'F#'],
    ['C', 'd5', 'Gb'],
    ['Bb', 'M3', 'D'],
    ['E', 'M3', 'G#'],
    ['Ab', 'M3', 'C'],
    ['B', 'M3', 'D#'],
    ['C', 'd7', 'Bbb'],
    ['G#', 'M7', 'F##'],
    ['F#', 'P5', 'C#'],
    ['F#', 'm7', 'E'],
    ['Eb', 'm3', 'Gb'],
    ['D', 'M9', 'E'],
  ])('%s から %s 上は %s', (from, iv, expected) => {
    expect(formatPitchClass(transpose(parsePitchClass(from), iv))).toBe(expected);
  });

  it('下に移す', () => {
    expect(formatPitchClass(transpose(parsePitchClass('C'), 'm3', -1))).toBe('A');
    expect(formatPitchClass(transpose(parsePitchClass('C#'), 'P5', -1))).toBe('F#');
    expect(formatPitch(transposePitch(parsePitch('C4'), parseInterval('m2'), -1))).toBe('B3');
  });

  it('オクターブをまたぐ', () => {
    expect(formatPitch(transposePitch(parsePitch('C4'), parseInterval('P8')))).toBe('C5');
    expect(formatPitch(transposePitch(parsePitch('B3'), parseInterval('m2')))).toBe('C4');
    expect(formatPitch(transposePitch(parsePitch('B4'), parseInterval('M2')))).toBe('C#5');
    expect(formatPitch(transposePitch(parsePitch('C4'), parseInterval('M9')))).toBe('D5');
    expect(formatPitch(transposePitch(parsePitch('A3'), parseInterval('m3')))).toBe('C4');
  });
});

describe('2つの音の音程', () => {
  it.each([
    ['C4', 'E4', 'M3'],
    ['C4', 'Eb4', 'm3'],
    ['C4', 'G4', 'P5'],
    ['C4', 'C5', 'P8'],
    ['C4', 'C4', 'P1'],
    ['C4', 'D5', 'M9'],
    ['E4', 'C5', 'm6'],
    ['C4', 'F#4', 'A4'],
    ['C4', 'Gb4', 'd5'],
    ['B3', 'F4', 'd5'],
    ['F4', 'B4', 'A4'],
    ['G4', 'C4', 'P5'], // 順番が逆でも低い方（C4）から測る
    ['G3', 'C4', 'P4'],
    ['A3', 'C4', 'm3'],
  ])('%s → %s は %s', (a, b, expected) => {
    expect(formatInterval(intervalBetween(parsePitch(a), parsePitch(b)))).toBe(expected);
  });

  it('オクターブなしの音名どうし（上方向）', () => {
    const iv = (a: string, b: string) => formatInterval(intervalBetweenPitchClasses(parsePitchClass(a), parsePitchClass(b)));
    expect(iv('C', 'Eb')).toBe('m3');
    expect(iv('A', 'C')).toBe('m3');
    expect(iv('F#', 'E')).toBe('m7');
    expect(iv('B#', 'C')).toBe('d2');
    expect(iv('C', 'Cb')).toBe('d1');
    expect(iv('C', 'B#')).toBe('A7');
    expect(iv('G', 'F')).toBe('m7');
  });
});

describe('日本語の音程名・転回', () => {
  it('日本語名', () => {
    expect(intervalNameJa(parseInterval('M3'))).toBe('長3度');
    expect(intervalNameJa(parseInterval('m6'))).toBe('短6度');
    expect(intervalNameJa(parseInterval('P5'))).toBe('完全5度');
    expect(intervalNameJa(parseInterval('A4'))).toBe('増4度');
    expect(intervalNameJa(parseInterval('d5'))).toBe('減5度');
    expect(intervalNameJa(parseInterval('P8'))).toBe('完全8度（オクターブ）');
  });

  it('転回（上下を入れ替えた音程）', () => {
    expect(formatInterval(invertInterval(parseInterval('M3')))).toBe('m6');
    expect(formatInterval(invertInterval(parseInterval('P4')))).toBe('P5');
    expect(formatInterval(invertInterval(parseInterval('A4')))).toBe('d5');
    expect(formatInterval(invertInterval(parseInterval('m7')))).toBe('M2');
  });
});
