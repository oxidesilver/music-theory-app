import { describe, expect, it } from 'vitest';
import {
  commonKeys,
  keyName,
  keyNameJa,
  keyScale,
  keySignature,
  makeKey,
  parallelKey,
  relativeKey,
  spellInKey,
} from '../key';
import { formatPitch } from '../pitch';
import { names } from './helpers';

describe('調号', () => {
  it.each([
    ['C', 0], ['G', 1], ['D', 2], ['A', 3], ['E', 4], ['B', 5], ['F#', 6], ['C#', 7],
    ['F', -1], ['Bb', -2], ['Eb', -3], ['Ab', -4], ['Db', -5], ['Gb', -6], ['Cb', -7],
  ])('%s メジャー：%i（+ は #、- は ♭ の数）', (tonic, count) => {
    expect(keySignature(makeKey(tonic, 'major')).count).toBe(count);
  });

  it.each([
    ['A', 0], ['E', 1], ['B', 2], ['F#', 3], ['C#', 4], ['G#', 5], ['D#', 6], ['A#', 7],
    ['D', -1], ['G', -2], ['C', -3], ['F', -4], ['Bb', -5], ['Eb', -6], ['Ab', -7],
  ])('%s マイナー：%i', (tonic, count) => {
    expect(keySignature(makeKey(tonic, 'minor')).count).toBe(count);
  });

  it('調号に並ぶ音の順番', () => {
    expect(names(keySignature(makeKey('D', 'major')).accidentals)).toBe('F# C#');
    expect(names(keySignature(makeKey('F#', 'minor')).accidentals)).toBe('F# C# G#');
    expect(names(keySignature(makeKey('F#', 'major')).accidentals)).toBe('F# C# G# D# A# E#');
    expect(names(keySignature(makeKey('Eb', 'major')).accidentals)).toBe('Bb Eb Ab');
    expect(names(keySignature(makeKey('C', 'major')).accidentals)).toBe('');
  });

  it('調号が7個を超えるキーは「理論上のキー」', () => {
    const g = keySignature(makeKey('G#', 'major'));
    expect(g.count).toBe(8);
    expect(g.theoretical).toBe(true);
    expect(keySignature(makeKey('C#', 'major')).theoretical).toBe(false);
  });
});

describe('平行調・同主調', () => {
  it.each([
    ['C', 'major', 'Aマイナー'],
    ['F#', 'minor', 'Aメジャー'],
    ['Eb', 'major', 'Cマイナー'],
    ['Bb', 'minor', 'Dbメジャー'],
    ['Ab', 'major', 'Fマイナー'],
    ['E', 'major', 'C#マイナー'],
  ] as const)('%s %s の平行調は %s', (tonic, mode, expected) => {
    expect(keyName(relativeKey(makeKey(tonic, mode)))).toBe(expected);
  });

  it('平行調は同じ調号', () => {
    for (const k of [...commonKeys('major'), ...commonKeys('minor')]) {
      expect(keySignature(relativeKey(k)).count).toBe(keySignature(k).count);
    }
  });

  it('同主調', () => {
    expect(keyName(parallelKey(makeKey('C', 'major')))).toBe('Cマイナー');
    expect(keyName(parallelKey(makeKey('F#', 'minor')))).toBe('F#メジャー');
  });
});

describe('キーの名前とスケール', () => {
  it('日本語の調名', () => {
    expect(keyNameJa(makeKey('C', 'major'))).toBe('ハ長調');
    expect(keyNameJa(makeKey('A', 'minor'))).toBe('イ短調');
    expect(keyNameJa(makeKey('F#', 'minor'))).toBe('嬰ヘ短調');
    expect(keyNameJa(makeKey('Bb', 'major'))).toBe('変ロ長調');
  });

  it('キーのスケール', () => {
    expect(names(keyScale(makeKey('F#', 'minor')))).toBe('F# G# A B C# D E');
    expect(names(keyScale(makeKey('Eb', 'major')))).toBe('Eb F G Ab Bb C D');
  });

  it('実用的なキーは メジャー・マイナー各15個', () => {
    expect(commonKeys('major')).toHaveLength(15);
    expect(commonKeys('minor')).toHaveLength(15);
  });
});

describe('キーに合わせた音名の付け方', () => {
  it.each([
    [61, 'D', 'major', 'C#4'],
    [61, 'Ab', 'major', 'Db4'],
    [66, 'F#', 'minor', 'F#4'],
    [60, 'C#', 'major', 'B#3'],
    [64, 'Cb', 'major', 'Fb4'],
    [59, 'Cb', 'major', 'Cb4'],
    [70, 'F', 'major', 'Bb4'],
    [63, 'C', 'minor', 'Eb4'],
    [65, 'F#', 'major', 'E#4'],
  ] as const)('MIDI %i を %s %s で表すと %s', (midi, tonic, mode, expected) => {
    expect(formatPitch(spellInKey(midi, makeKey(tonic, mode)))).toBe(expected);
  });
});
