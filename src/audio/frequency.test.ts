import { describe, expect, it } from 'vitest';
import { beatsToSeconds, midiToFrequency, volumeToDb } from './frequency';

describe('音の高さ（周波数）', () => {
  it('A4 = 440Hz、1オクターブ上で2倍', () => {
    expect(midiToFrequency(69)).toBe(440);
    expect(midiToFrequency(81)).toBeCloseTo(880, 6);
    expect(midiToFrequency(57)).toBeCloseTo(220, 6);
  });
  it('中央のド（MIDI 60）は約 261.63Hz', () => {
    expect(midiToFrequency(60)).toBeCloseTo(261.6256, 3);
  });
});

describe('音量', () => {
  it('最大は 0dB、0 は無音', () => {
    expect(volumeToDb(1)).toBe(0);
    expect(volumeToDb(0)).toBe(-Infinity);
    expect(volumeToDb(0.5)).toBeCloseTo(-12.04, 2);
  });
  it('範囲外は 0〜1 に収める', () => {
    expect(volumeToDb(2)).toBe(0);
    expect(volumeToDb(-1)).toBe(-Infinity);
  });
});

describe('テンポ', () => {
  it('BPM 120 で 1拍 = 0.5秒、4拍 = 2秒', () => {
    expect(beatsToSeconds(1, 120)).toBe(0.5);
    expect(beatsToSeconds(4, 120)).toBe(2);
    expect(beatsToSeconds(1, 60)).toBe(1);
  });
});
