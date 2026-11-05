import { describe, expect, it } from 'vitest';
import {
  DRUM_PRESETS,
  TICKS_PER_BAR,
  addPassingNotes,
  bassLine,
  chordAt,
  compositionSequence,
  eventsToPattern,
  makeNote,
  noteRoleAt,
  patternToEvents,
  shiftNote,
  shiftOctave,
  songLengthTicks,
} from './logic';
import { makeChord } from '@/features/progression/logic';
import { parseChordSymbol } from '@/theory/chord';
import { makeKey } from '@/theory/key';
import { formatPitch, midiOf } from '@/theory/pitch';

const C = makeKey('C', 'major');
const prog = (s: string, beats = 4) => s.split(' ').map((x) => makeChord(parseChordSymbol(x), beats));
const pitches = (notes: { pitch: Parameters<typeof formatPitch>[0] }[]) => notes.map((n) => formatPitch(n.pitch)).join(' ');

describe('曲の長さとコードの位置', () => {
  it('コードが無ければ4小節、コードが長ければその長さ（小節単位）', () => {
    expect(songLengthTicks([])).toBe(TICKS_PER_BAR * 4);
    expect(songLengthTicks(prog('C G'))).toBe(TICKS_PER_BAR * 4);
    expect(songLengthTicks(prog('C G Am F Dm G'))).toBe(TICKS_PER_BAR * 6);
    expect(songLengthTicks(prog('C'), [{ startTick: TICKS_PER_BAR * 5, durationTick: 10 }])).toBe(TICKS_PER_BAR * 6);
  });
  it('ある時刻に鳴っているコード', () => {
    const chords = prog('C G7');
    expect(chordAt(chords, 0)?.chord.quality).toBe('maj');
    expect(chordAt(chords, 1919)?.index).toBe(0);
    expect(chordAt(chords, 1920)?.index).toBe(1);
    expect(chordAt(chords, 3840)).toBeUndefined();
  });
});

describe('音の役割（スケール補助）', () => {
  const chords = prog('C G7');
  const role = (midi: number, tick: number, key = C, scale: Parameters<typeof noteRoleAt>[1] = 'major', ch = chords) => noteRoleAt(key, scale, ch, midi, tick).role;

  it('C コードの間（キー C）', () => {
    expect(role(64, 0)).toBe('chord-tone'); // E
    expect(role(62, 0)).toBe('tension'); // D = 9th
    expect(role(65, 0)).toBe('caution'); // F = 11th（E の半音上）
    expect(role(71, 0)).toBe('scale'); // B
    expect(role(66, 0)).toBe('outside'); // F#
  });
  it('G7 の間', () => {
    expect(role(65, 1920)).toBe('chord-tone'); // F = 7th
    expect(role(60, 1920)).toBe('caution'); // C = 11th（B の半音上）
    expect(role(69, 1920)).toBe('tension'); // A = 9th
  });
  it('マイナーキーではキーに合わせて綴り、選んだスケールで判定する（A マイナーで G#）', () => {
    const Am = makeKey('A', 'minor');
    const ch = prog('Am E');
    const info = noteRoleAt(Am, 'naturalMinor', ch, 68, 1920);
    expect(formatPitch(info.pitch)).toBe('G#4');
    // G# はナチュラルマイナーのスケール外だが、E コードの構成音なので「コードトーン」
    expect(info.inScale).toBe(false);
    expect(info.role).toBe('chord-tone');
    expect(role(68, 1920, Am, 'harmonicMinor', ch)).toBe('chord-tone');
    // Am の間の G# はスケール外の音
    expect(role(68, 0, Am, 'naturalMinor', ch)).toBe('outside');
  });
  it('コードが無い位置ではスケール内かどうかだけで判定', () => {
    expect(role(64, 0, C, 'major', [])).toBe('scale');
    expect(role(66, 0, C, 'major', [])).toBe('outside');
  });
});

describe('音符の操作', () => {
  it('高さを変えるとキーに合わせて綴り直す', () => {
    const n = makeNote(63, makeKey('Eb', 'major'), 0, 480);
    expect(formatPitch(n.pitch)).toBe('Eb4');
    expect(formatPitch(shiftNote(n, 1, makeKey('Eb', 'major')).pitch)).toBe('E4');
    expect(formatPitch(shiftNote(n, 12, makeKey('Eb', 'major')).pitch)).toBe('Eb5');
  });
  it('オクターブ上下', () => {
    const notes = [makeNote(36, C, 0, 480), makeNote(43, C, 480, 480)];
    expect(pitches(shiftOctave(notes, 1, C))).toBe('C3 G3');
    expect(pitches(shiftOctave(notes, -1, C, new Set([notes[1]!.id])))).toBe('C2 G1');
  });
});

describe('ベースライン', () => {
  const chords = prog('C G');
  it('ルートを伸ばす', () => {
    const b = bassLine(chords, C, 'whole');
    expect(pitches(b)).toBe('C2 G2');
    expect(b.map((n) => [n.startTick, n.durationTick])).toEqual([[0, 1920], [1920, 1920]]);
  });
  it('4分音符・8分音符で刻む', () => {
    expect(bassLine(chords, C, 'quarter')).toHaveLength(8);
    expect(bassLine(chords, C, 'eighth')).toHaveLength(16);
  });
  it('ルートと5度、オクターブ', () => {
    expect(pitches(bassLine(prog('C'), C, 'root-fifth'))).toBe('C2 G2 C2 G2');
    expect(pitches(bassLine(prog('C'), C, 'octave'))).toBe('C2 C3 C2 C3');
  });
  it('分数コードはベース音を弾く', () => {
    expect(pitches(bassLine(prog('C/E'), C, 'whole'))).toBe('E2');
  });
  it('経過音を追加：次のコードの直前1拍に、次のルートへつながるスケールの音を入れる', () => {
    const ch = prog('C F G');
    const result = addPassingNotes(bassLine(ch, C, 'whole'), ch, C, 'major');
    expect(pitches(result)).toBe('C2 E2 F2 F2 G2');
    expect(result.map((n) => n.startTick)).toEqual([0, 1440, 1920, 3360, 3840]);
    expect(result[0]!.durationTick).toBe(1440);
  });
});

describe('ドラム', () => {
  it('4つ打ちパターンを2小節に並べると、キックが8回', () => {
    const four = DRUM_PRESETS.find((p) => p.id === 'four')!;
    const events = patternToEvents(four.pattern, TICKS_PER_BAR * 2);
    expect(events.filter((e) => e.drum === 36).map((e) => e.startTick)).toEqual([0, 480, 960, 1440, 1920, 2400, 2880, 3360]);
    expect(events.filter((e) => e.drum === 42).map((e) => e.startTick).slice(0, 4)).toEqual([240, 720, 1200, 1680]);
  });
  it('並べたドラムから1小節目のパターンを読み戻せる', () => {
    for (const p of DRUM_PRESETS) expect(eventsToPattern(patternToEvents(p.pattern, TICKS_PER_BAR * 4))).toEqual(p.pattern);
  });
});

describe('再生データ', () => {
  it('パートのオン・オフに合わせて、コード・メロディー・ベース・ドラムを並べる', () => {
    const chords = prog('C');
    const data = {
      chords,
      melody: [makeNote(64, C, 0, 480)],
      bass: [makeNote(36, C, 0, 1920)],
      drums: patternToEvents(DRUM_PRESETS[0]!.pattern, TICKS_PER_BAR),
    };
    const all = compositionSequence(data, { chords: true, melody: true, bass: true, drums: true });
    expect(all.filter((e) => e.drum !== undefined).length).toBeGreaterThan(0);
    expect(all.find((e) => e.instrument === 'synth')).toMatchObject({ midis: [64], startBeat: 0, durationBeats: 1 });
    expect(all.find((e) => e.instrument === 'bass')).toMatchObject({ midis: [36], durationBeats: 4 });
    const noDrums = compositionSequence(data, { chords: true, melody: false, bass: false, drums: false });
    expect(noDrums).toHaveLength(1);
    expect(noDrums[0]!.midis.map((m) => m)).toEqual([60, 64, 67]);
    expect(midiOf(data.melody[0]!.pitch)).toBe(64);
  });
});
