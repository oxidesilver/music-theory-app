import { describe, expect, it } from 'vitest';
import { diatonicChords, qualityFromTones } from '../diatonic';
import { commonKeys, makeKey, relativeKey } from '../key';
import { formatChordSymbol } from '../chord';
import { parsePitchClass } from '../pitch';
import { chordNames } from './helpers';

const chords = (tonic: string, mode: 'major' | 'minor', opts = {}) => chordNames(diatonicChords(makeKey(tonic, mode), opts));

describe('メジャーキーのダイアトニックコード', () => {
  it('C メジャー（3和音）', () => {
    expect(chords('C', 'major')).toBe('C Dm Em F G Am Bdim');
  });
  it('C メジャー（4和音）', () => {
    expect(chords('C', 'major', { sevenths: true })).toBe('Cmaj7 Dm7 Em7 Fmaj7 G7 Am7 Bm7b5');
  });
  it.each([
    ['G', 'G Am Bm C D Em F#dim'],
    ['D', 'D Em F#m G A Bm C#dim'],
    ['Eb', 'Eb Fm Gm Ab Bb Cm Ddim'],
    ['F#', 'F# G#m A#m B C# D#m E#dim'],
    ['Db', 'Db Ebm Fm Gb Ab Bbm Cdim'],
  ])('%s メジャー：%s', (tonic, expected) => {
    expect(chords(tonic, 'major')).toBe(expected);
  });
});

describe('マイナーキーのダイアトニックコード', () => {
  it('A マイナー（3和音）', () => {
    expect(chords('A', 'minor')).toBe('Am Bdim C Dm Em F G');
  });
  it('A マイナー（4和音）', () => {
    expect(chords('A', 'minor', { sevenths: true })).toBe('Am7 Bm7b5 Cmaj7 Dm7 Em7 Fmaj7 G7');
  });
  it('F# マイナー（3和音）', () => {
    expect(chords('F#', 'minor')).toBe('F#m G#dim A Bm C#m D E');
  });
  it('F# マイナー（4和音）', () => {
    expect(chords('F#', 'minor', { sevenths: true })).toBe('F#m7 G#m7b5 Amaj7 Bm7 C#m7 Dmaj7 E7');
  });
  it('C マイナー・G# マイナー', () => {
    expect(chords('C', 'minor')).toBe('Cm Ddim Eb Fm Gm Ab Bb');
    expect(chords('G#', 'minor')).toBe('G#m A#dim B C#m D#m E F#');
  });

  it('A ハーモニックマイナー（Ⅴ がメジャーになる）', () => {
    expect(chords('A', 'minor', { scale: 'harmonicMinor' })).toBe('Am Bdim Caug Dm E F G#dim');
    expect(chords('A', 'minor', { scale: 'harmonicMinor', sevenths: true })).toBe(
      'Am(maj7) Bm7b5 Cmaj7#5 Dm7 E7 Fmaj7 G#dim7',
    );
  });
  it('F# ハーモニックマイナーの Ⅴ は C#（構成音 C# E# G#）', () => {
    const v = diatonicChords(makeKey('F#', 'minor'), { scale: 'harmonicMinor' })[4]!;
    expect(formatChordSymbol(v)).toBe('C#');
    expect(v.tones.map((t) => t.letter + (t.accidental ? '#' : ''))).toEqual(['C#', 'E#', 'G#']);
    expect(v.functions).toEqual(['D']);
  });
  it('A メロディックマイナー', () => {
    expect(chords('A', 'minor', { scale: 'melodicMinor' })).toBe('Am Bm Caug D E F#dim G#dim');
    expect(chords('A', 'minor', { scale: 'melodicMinor', sevenths: true })).toBe(
      'Am(maj7) Bm7 Cmaj7#5 D7 E7 F#m7b5 G#m7b5',
    );
  });
});

describe('メジャーとマイナーの関係', () => {
  it('全15キーで、平行調のダイアトニックコードは同じコードを6つずらした並びになる', () => {
    for (const major of commonKeys('major')) {
      const minor = relativeKey(major);
      const a = diatonicChords(major).map((c) => formatChordSymbol(c));
      const b = diatonicChords(minor).map((c) => formatChordSymbol(c));
      expect(b).toEqual([...a.slice(5), ...a.slice(0, 5)]);
    }
  });
});

describe('コードの機能（T・SD・D）', () => {
  it('メジャーキー', () => {
    expect(diatonicChords(makeKey('C', 'major')).map((c) => c.functions)).toEqual([
      ['T'], ['SD'], ['T', 'D'], ['SD'], ['D'], ['T'], ['D'],
    ]);
  });
  it('マイナーキー（ナチュラル）', () => {
    expect(diatonicChords(makeKey('A', 'minor')).map((c) => c.functions)).toEqual([
      ['T'], ['SD'], ['T'], ['SD'], ['D'], ['T', 'SD'], ['SD', 'D'],
    ]);
  });
});

describe('構成音からコードの種類を判定', () => {
  it('3和音・4和音', () => {
    const p = (s: string) => s.split(' ').map(parsePitchClass);
    expect(qualityFromTones(p('C E G'))).toBe('maj');
    expect(qualityFromTones(p('B D F'))).toBe('dim');
    expect(qualityFromTones(p('G B D F'))).toBe('7');
    expect(qualityFromTones(p('G# B D F'))).toBe('dim7');
    expect(() => qualityFromTones(p('C D E'))).toThrow();
  });
});
