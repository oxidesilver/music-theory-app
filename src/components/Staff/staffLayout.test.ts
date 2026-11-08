import { describe, expect, it } from 'vitest';
import { accidentalSymbol, chooseClef, chordOffsets, keySignatureMarks, ledgerPositions, staffPosition } from './staffLayout';
import { makeKey } from '@/theory/key';
import { parsePitch, parsePitchClass } from '@/theory/pitch';

const pos = (name: string, clef: 'treble' | 'bass' = 'treble') => staffPosition(parsePitch(name), clef);

describe('五線上の位置', () => {
  it('ト音記号：一番下の線が E4、一番上の線が F5', () => {
    expect(pos('E4')).toBe(0);
    expect(pos('G4')).toBe(2); // 下から2本目の線（ト音記号が巻く線）
    expect(pos('B4')).toBe(4); // 真ん中の線
    expect(pos('F5')).toBe(8);
    expect(pos('C4')).toBe(-2); // 加線1本
  });
  it('ヘ音記号：一番下の線が G2、上から2本目の線が F3', () => {
    expect(pos('G2', 'bass')).toBe(0);
    expect(pos('F3', 'bass')).toBe(6);
    expect(pos('A3', 'bass')).toBe(8);
    expect(pos('C2', 'bass')).toBe(-4); // 加線2本
  });
  it('C♯ と D♭ は違う位置に書かれる', () => {
    expect(pos('C#5')).not.toBe(pos('Db5'));
    expect(pos('C#5')).toBe(pos('C5'));
  });
  it('B♯3 は B の位置（オクターブは文字で決まる）', () => {
    expect(pos('B#3')).toBe(pos('B3'));
  });
});

describe('加線', () => {
  it('五線の中の音には加線が無い', () => {
    for (const p of [0, 1, 4, 8]) expect(ledgerPositions(p)).toEqual([]);
  });
  it('下にはみ出す音', () => {
    expect(ledgerPositions(-1)).toEqual([]); // D4（一番下の線のすぐ下の間）
    expect(ledgerPositions(-2)).toEqual([-2]); // C4
    expect(ledgerPositions(-5)).toEqual([-2, -4]); // G3
  });
  it('上にはみ出す音', () => {
    expect(ledgerPositions(9)).toEqual([]); // G5
    expect(ledgerPositions(10)).toEqual([10]); // A5
    expect(ledgerPositions(12)).toEqual([10, 12]); // C6
  });
});

describe('調号の位置', () => {
  it('D メジャー（ト音記号）：F♯ は一番上の線、C♯ は上から2つ目の間', () => {
    expect(keySignatureMarks(makeKey('D', 'major'), 'treble')).toEqual([
      { accidental: 1, position: 8 },
      { accidental: 1, position: 5 },
    ]);
  });
  it('B♭ メジャー（ト音記号）：B♭ は真ん中の線、E♭ は上から1つ目の間', () => {
    expect(keySignatureMarks(makeKey('Bb', 'major'), 'treble')).toEqual([
      { accidental: -1, position: 4 },
      { accidental: -1, position: 7 },
    ]);
  });
  it('ヘ音記号では同じ形が1段下（F♯ は上から2本目の線＝F3）', () => {
    expect(keySignatureMarks(makeKey('G', 'major'), 'bass')).toEqual([{ accidental: 1, position: 6 }]);
  });
  it('C メジャー・A マイナーは調号なし', () => {
    expect(keySignatureMarks(makeKey('C', 'major'), 'treble')).toEqual([]);
    expect(keySignatureMarks(makeKey('A', 'minor'), 'treble')).toEqual([]);
  });
  it('7つの ♯（C♯ メジャー）・7つの ♭（C♭ メジャー）', () => {
    expect(keySignatureMarks(makeKey('C#', 'major'), 'treble')).toHaveLength(7);
    expect(keySignatureMarks(makeKey('Cb', 'major'), 'treble')).toHaveLength(7);
  });
});

describe('音符の前の記号', () => {
  it('調号が無ければ、♯・♭ をそのまま書く', () => {
    expect(accidentalSymbol(parsePitchClass('F#'), undefined)).toBe('♯');
    expect(accidentalSymbol(parsePitchClass('Bb'), undefined)).toBe('♭');
    expect(accidentalSymbol(parsePitchClass('C'), undefined)).toBe('');
  });
  it('調号で決まっている変化は書かず、違うときだけ書く（♮ を含む）', () => {
    const D = makeKey('D', 'major');
    expect(accidentalSymbol(parsePitchClass('F#'), D)).toBe('');
    expect(accidentalSymbol(parsePitchClass('F'), D)).toBe('♮');
    expect(accidentalSymbol(parsePitchClass('G#'), D)).toBe('♯');
    expect(accidentalSymbol(parsePitchClass('E#'), makeKey('F#', 'major'))).toBe('');
  });
  it('ダブルシャープ・ダブルフラット', () => {
    expect(accidentalSymbol(parsePitchClass('F##'), undefined)).toBe('x');
    expect(accidentalSymbol(parsePitchClass('Bbb'), undefined)).toBe('♭♭');
  });
});

describe('音部記号の選び方と和音のずらし方', () => {
  it('低い音はヘ音記号、高い音はト音記号', () => {
    expect(chooseClef(['C2', 'G2'].map(parsePitch))).toBe('bass');
    expect(chooseClef(['C4', 'E4', 'G4'].map(parsePitch))).toBe('treble');
  });
  it('2度でとなり合う音符は右にずらす（Csus2 の C・D）', () => {
    expect(chordOffsets([0, 1, 4])).toEqual([0, 1, 0]);
    expect(chordOffsets([0, 2, 4])).toEqual([0, 0, 0]);
  });
});
