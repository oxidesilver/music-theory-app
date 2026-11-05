import { describe, expect, it } from 'vitest';
import {
  formatPitch,
  formatPitchClass,
  isBlackKey,
  isEnharmonic,
  japaneseName,
  midiOf,
  parsePitch,
  parsePitchClass,
  pitchFromMidi,
  respell,
  samePitchClass,
  semitoneOf,
  solfegeName,
} from '../pitch';

describe('音名の読み取りと表示', () => {
  it.each([
    ['C', 'C'],
    ['F#', 'F#'],
    ['Bb', 'Bb'],
    ['E♭', 'Eb'],
    ['F♯', 'F#'],
    ['C##', 'C##'],
    ['Cx', 'C##'],
    ['Dbb', 'Dbb'],
    ['g#', 'G#'],
  ])('「%s」→「%s」', (input, expected) => {
    expect(formatPitchClass(parsePitchClass(input))).toBe(expected);
  });

  it('読めない文字はエラーになる', () => {
    expect(() => parsePitchClass('H')).toThrow();
    expect(() => parsePitchClass('C#?')).toThrow();
    expect(() => parsePitchClass('')).toThrow();
  });

  it('記号付きの表示（♯・♭）', () => {
    expect(formatPitchClass(parsePitchClass('Bb'), 'unicode')).toBe('B♭');
    expect(formatPitchClass(parsePitchClass('F#'), 'unicode')).toBe('F♯');
    expect(formatPitchClass(parsePitchClass('C##'), 'unicode')).toBe('C𝄪');
  });
});

describe('MIDIノート番号', () => {
  it.each([
    ['C4', 60],
    ['A4', 69],
    ['C-1', 0],
    ['G9', 127],
    ['C#4', 61],
    ['Db4', 61],
    ['B#3', 60],
    ['Cb4', 59],
    ['E#4', 65],
    ['Fb4', 64],
    ['A0', 21],
    ['C8', 108],
  ])('%s = %i', (name, midi) => {
    expect(midiOf(parsePitch(name))).toBe(midi);
  });

  it('MIDI番号から音名（# 寄り／♭ 寄り）', () => {
    expect(formatPitch(pitchFromMidi(61, 'sharp'))).toBe('C#4');
    expect(formatPitch(pitchFromMidi(61, 'flat'))).toBe('Db4');
    expect(formatPitch(pitchFromMidi(0))).toBe('C-1');
    expect(formatPitch(pitchFromMidi(70, 'flat'))).toBe('Bb4');
    expect(formatPitch(pitchFromMidi(59))).toBe('B3');
  });

  it('すべての MIDI 番号（0〜127）で、番号 → 音名 → 番号 が一致する', () => {
    for (let m = 0; m <= 127; m++) {
      expect(midiOf(pitchFromMidi(m, 'sharp'))).toBe(m);
      expect(midiOf(pitchFromMidi(m, 'flat'))).toBe(m);
    }
  });
});

describe('オクターブ表記（FL Studio 式）', () => {
  it('中央のド（MIDI 60）は、一般的な表記で C4、FL Studio 式で C5', () => {
    const c = pitchFromMidi(60);
    expect(formatPitch(c, { octaveConvention: 'standard' })).toBe('C4');
    expect(formatPitch(c, { octaveConvention: 'fl' })).toBe('C5');
  });
});

describe('異名同音（同じ高さで違う名前の音）', () => {
  it('C# と Db は鍵盤上は同じだが、綴りは別物', () => {
    const cs = parsePitchClass('C#');
    const db = parsePitchClass('Db');
    expect(isEnharmonic(cs, db)).toBe(true);
    expect(samePitchClass(cs, db)).toBe(false);
    expect(semitoneOf(cs)).toBe(1);
  });

  it('E# と F、B# と C、Cb と B も同じ高さ', () => {
    expect(isEnharmonic(parsePitchClass('E#'), parsePitchClass('F'))).toBe(true);
    expect(isEnharmonic(parsePitchClass('B#'), parsePitchClass('C'))).toBe(true);
    expect(isEnharmonic(parsePitchClass('Cb'), parsePitchClass('B'))).toBe(true);
  });

  it('綴り直し（同じ高さのまま別の文字で）', () => {
    expect(formatPitch(respell(parsePitch('C#4'), 'D'))).toBe('Db4');
    expect(formatPitch(respell(parsePitch('C4'), 'B'))).toBe('B#3');
    expect(formatPitch(respell(parsePitch('C4'), 'D'))).toBe('Dbb4');
    expect(formatPitch(respell(parsePitch('B3'), 'C'))).toBe('Cb4');
    expect(() => respell(parsePitch('C4'), 'F')).toThrow();
  });
});

describe('読み方', () => {
  it('ドレミ', () => {
    expect(solfegeName(parsePitchClass('C'))).toBe('ド');
    expect(solfegeName(parsePitchClass('F#'))).toBe('ファ♯');
    expect(solfegeName(parsePitchClass('Bb'))).toBe('シ♭');
  });

  it('日本音名', () => {
    expect(japaneseName(parsePitchClass('C'))).toBe('ハ');
    expect(japaneseName(parsePitchClass('F#'))).toBe('嬰ヘ');
    expect(japaneseName(parsePitchClass('Bb'))).toBe('変ロ');
  });

  it('黒鍵の判定', () => {
    expect([60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71].map(isBlackKey)).toEqual([
      false, true, false, true, false, false, true, false, true, false, true, false,
    ]);
  });
});
