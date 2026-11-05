import { describe, expect, it } from 'vitest';
import { classifyNote, tensionsFor } from '../tension';
import { makeKey, keyScale } from '../key';
import { parseChordSymbol, type ChordQualityId } from '../chord';
import { parsePitchClass, formatPitchClass } from '../pitch';
import { scaleNotes } from '../scale';

const cMajor = keyScale(makeKey('C', 'major'));

function summary(chord: string, scale = cMajor) {
  const c = parseChordSymbol(chord);
  return tensionsFor(c.root, c.quality as ChordQualityId, scale)
    .map((t) => `${t.label}:${formatPitchClass(t.note)}${t.caution ? '(注意)' : ''}`)
    .join(' ');
}

describe('C メジャースケールでの各ダイアトニックコードのテンション', () => {
  it.each([
    ['Cmaj7', '9:D 11:F(注意) 13:A'],
    ['Dm7', '9:E 11:G 13:B'],
    ['Em7', '♭9:F(注意) 11:A ♭13:C(注意)'],
    ['Fmaj7', '9:G ♯11:B 13:D'],
    ['G7', '9:A 11:C(注意) 13:E'],
    ['Am7', '9:B 11:D ♭13:F(注意)'],
    ['Bm7b5', '♭9:C(注意) 11:E ♭13:G'],
  ])('%s → %s', (chord, expected) => {
    expect(summary(chord)).toBe(expected);
  });
});

describe('ドミナントセブンスの ♭9・♭13', () => {
  it('C ハーモニックマイナーの G7 では ♭9（A♭）と ♭13（E♭）は注意扱いにしない', () => {
    const scale = scaleNotes(parsePitchClass('C'), 'harmonicMinor');
    expect(summary('G7', scale)).toBe('♭9:Ab 11:C(注意) ♭13:Eb');
  });
});

describe('音の役割の判定（メロディー作成用）', () => {
  const chord = { root: parsePitchClass('C'), quality: 'maj' as const };
  it.each([
    ['C', 'chord-tone'],
    ['E', 'chord-tone'],
    ['G', 'chord-tone'],
    ['D', 'tension'],
    ['A', 'tension'],
    ['F', 'caution'],
    ['B', 'scale'],
    ['F#', 'outside'],
    ['Eb', 'outside'],
  ])('C コードに対して %s は %s', (note, role) => {
    expect(classifyNote(parsePitchClass(note), chord, cMajor).role).toBe(role);
  });
});
