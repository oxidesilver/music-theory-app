import { describe, expect, it } from 'vitest';
import { parsePitch, parsePitchClass } from '../pitch';
import { scaleContainsSemitone, scaleNotes, scalePitches, type ScaleId } from '../scale';
import { names, pitchNames } from './helpers';

const notes = (tonic: string, id: ScaleId) => names(scaleNotes(parsePitchClass(tonic), id));

describe('メジャースケール（全15キー＋理論上のキー）', () => {
  it.each([
    ['C', 'C D E F G A B'],
    ['G', 'G A B C D E F#'],
    ['D', 'D E F# G A B C#'],
    ['A', 'A B C# D E F# G#'],
    ['E', 'E F# G# A B C# D#'],
    ['B', 'B C# D# E F# G# A#'],
    ['F#', 'F# G# A# B C# D# E#'],
    ['C#', 'C# D# E# F# G# A# B#'],
    ['F', 'F G A Bb C D E'],
    ['Bb', 'Bb C D Eb F G A'],
    ['Eb', 'Eb F G Ab Bb C D'],
    ['Ab', 'Ab Bb C Db Eb F G'],
    ['Db', 'Db Eb F Gb Ab Bb C'],
    ['Gb', 'Gb Ab Bb Cb Db Eb F'],
    ['Cb', 'Cb Db Eb Fb Gb Ab Bb'],
    ['G#', 'G# A# B# C# D# E# F##'],
  ])('%s メジャー：%s', (tonic, expected) => {
    expect(notes(tonic, 'major')).toBe(expected);
  });
});

describe('マイナースケール', () => {
  it.each([
    ['A', 'A B C D E F G'],
    ['E', 'E F# G A B C D'],
    ['F#', 'F# G# A B C# D E'],
    ['D', 'D E F G A Bb C'],
    ['C', 'C D Eb F G Ab Bb'],
    ['Bb', 'Bb C Db Eb F Gb Ab'],
    ['D#', 'D# E# F# G# A# B C#'],
    ['G#', 'G# A# B C# D# E F#'],
  ])('%s ナチュラルマイナー：%s', (tonic, expected) => {
    expect(notes(tonic, 'naturalMinor')).toBe(expected);
  });

  it('ハーモニックマイナー（7番目の音を半音上げる）', () => {
    expect(notes('A', 'harmonicMinor')).toBe('A B C D E F G#');
    expect(notes('F#', 'harmonicMinor')).toBe('F# G# A B C# D E#');
    expect(notes('C', 'harmonicMinor')).toBe('C D Eb F G Ab B');
    expect(notes('G#', 'harmonicMinor')).toBe('G# A# B C# D# E F##');
  });

  it('メロディックマイナー（6・7番目の音を半音上げる）', () => {
    expect(notes('A', 'melodicMinor')).toBe('A B C D E F# G#');
    expect(notes('F#', 'melodicMinor')).toBe('F# G# A B C# D# E#');
    expect(notes('C', 'melodicMinor')).toBe('C D Eb F G A B');
  });
});

describe('ペンタトニック・ブルース', () => {
  it('メジャーペンタトニック', () => {
    expect(notes('C', 'majorPentatonic')).toBe('C D E G A');
    expect(notes('G', 'majorPentatonic')).toBe('G A B D E');
  });
  it('マイナーペンタトニック', () => {
    expect(notes('A', 'minorPentatonic')).toBe('A C D E G');
    expect(notes('E', 'minorPentatonic')).toBe('E G A B D');
    expect(notes('F#', 'minorPentatonic')).toBe('F# A B C# E');
  });
  it('ブルーススケール（♭5 のブルーノートを含む）', () => {
    expect(notes('A', 'blues')).toBe('A C D Eb E G');
    expect(notes('E', 'blues')).toBe('E G A Bb B D');
    expect(notes('C', 'majorBlues')).toBe('C D Eb E G A');
  });
});

describe('モード・その他のスケール', () => {
  it('C メジャーと同じ音で作るモード', () => {
    expect(notes('D', 'dorian')).toBe('D E F G A B C');
    expect(notes('E', 'phrygian')).toBe('E F G A B C D');
    expect(notes('F', 'lydian')).toBe('F G A B C D E');
    expect(notes('G', 'mixolydian')).toBe('G A B C D E F');
    expect(notes('B', 'locrian')).toBe('B C D E F G A');
  });
  it('主音 C のモード', () => {
    expect(notes('C', 'dorian')).toBe('C D Eb F G A Bb');
    expect(notes('C', 'lydian')).toBe('C D E F# G A B');
    expect(notes('C', 'mixolydian')).toBe('C D E F G A Bb');
  });
  it('ホールトーン・ディミニッシュ', () => {
    expect(notes('C', 'wholeTone')).toBe('C D E F# G# Bb');
    expect(notes('C', 'diminishedWH')).toBe('C D Eb F Gb Ab A B');
    expect(notes('C', 'diminishedHW')).toBe('C Db Eb E F# G A Bb');
  });
});

describe('オクターブ付きのスケール', () => {
  it('C4 から始まる C メジャー', () => {
    expect(pitchNames(scalePitches(parsePitch('C4'), 'major'))).toBe('C4 D4 E4 F4 G4 A4 B4');
  });
  it('A3 から始まる A マイナー（途中でオクターブが上がる）', () => {
    expect(pitchNames(scalePitches(parsePitch('A3'), 'naturalMinor'))).toBe('A3 B3 C4 D4 E4 F4 G4');
  });
  it('スケールに含まれるか（綴りは問わない）', () => {
    expect(scaleContainsSemitone(parsePitchClass('C'), 'major', parsePitchClass('E'))).toBe(true);
    expect(scaleContainsSemitone(parsePitchClass('C'), 'major', parsePitchClass('F#'))).toBe(false);
    expect(scaleContainsSemitone(parsePitchClass('F#'), 'major', parsePitchClass('F'))).toBe(true); // E# と同じ高さ
  });
});
