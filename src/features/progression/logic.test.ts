import { describe, expect, it } from 'vitest';
import {
  PRESET_PROGRESSIONS,
  bassPitch,
  chordIndexAt,
  chordVoicing,
  makeChord,
  moodTendency,
  nextChordSuggestions,
  paletteFor,
  realizePreset,
  toSequence,
  totalBeats,
  transposeChords,
  variations,
} from './logic';
import { formatChordSymbol, parseChordSymbol } from '@/theory/chord';
import { makeKey } from '@/theory/key';
import { formatPitch, midiOf } from '@/theory/pitch';

const C = makeKey('C', 'major');
const Am = makeKey('A', 'minor');
const prog = (s: string, beats = 4) => s.split(' ').map((x) => makeChord(parseChordSymbol(x), beats));
const names = (cs: { root: never; quality: never }[] | Parameters<typeof formatChordSymbol>[0][]) =>
  (cs as Parameters<typeof formatChordSymbol>[0][]).map((c) => formatChordSymbol(c)).join(' ');

describe('鳴らす音', () => {
  it('コードはルートが F3〜E4 に入るように置く（F#m7 → F#3 A3 C#4 E4）', () => {
    expect(chordVoicing(parseChordSymbol('F#m7')).map((p) => formatPitch(p)).join(' ')).toBe('F#3 A3 C#4 E4');
    expect(chordVoicing(parseChordSymbol('C')).map((p) => formatPitch(p)).join(' ')).toBe('C4 E4 G4');
    expect(chordVoicing(parseChordSymbol('G')).map((p) => formatPitch(p)).join(' ')).toBe('G3 B3 D4');
  });

  it('ベースは C2〜B2（分数コードはベース音を使う）', () => {
    expect(formatPitch(bassPitch(parseChordSymbol('C')))).toBe('C2');
    expect(formatPitch(bassPitch(parseChordSymbol('B7')))).toBe('B2');
    expect(formatPitch(bassPitch(parseChordSymbol('C/E')))).toBe('E2');
  });

  it('再生データ：開始位置と長さ（拍）、ベースの有無', () => {
    const chords = [makeChord(parseChordSymbol('C'), 4), makeChord(parseChordSymbol('G'), 2)];
    const seq = toSequence(chords, { withBass: true });
    expect(seq.map((e) => [e.startBeat, e.durationBeats, e.instrument ?? 'default'])).toEqual([
      [0, 4, 'default'],
      [0, 4, 'bass'],
      [4, 2, 'default'],
      [4, 2, 'bass'],
    ]);
    expect(seq[0]!.midis).toEqual([60, 64, 67]);
    expect(seq[1]!.midis).toEqual([36]);
    expect(totalBeats(chords)).toBe(6);
  });

  it('再生位置から今のコードを求める（BPM 120 で1拍 0.5秒）', () => {
    const chords = prog('C G');
    expect(chordIndexAt(chords, 0, 120)).toBe(0);
    expect(chordIndexAt(chords, 1.99, 120)).toBe(0);
    expect(chordIndexAt(chords, 2.0, 120)).toBe(1);
    expect(chordIndexAt(chords, 4.1, 120)).toBe(-1);
  });
});

describe('キーに合うコードの候補', () => {
  it('C メジャー（3和音）', () => {
    const groups = paletteFor(C, false);
    expect(names(groups[0]!.chords)).toBe('C Dm Em F G Am Bdim');
    expect(names(groups[1]!.chords)).toBe('Fm Ab Bb');
    expect(names(groups[2]!.chords)).toBe('A7 B7 C7 D7 E7');
  });

  it('A マイナー（3和音・4和音）', () => {
    expect(names(paletteFor(Am, false)[0]!.chords)).toBe('Am Bdim C Dm Em F G');
    expect(names(paletteFor(Am, false)[1]!.chords)).toBe('E G#dim');
    expect(names(paletteFor(Am, true)[1]!.chords)).toBe('E7 G#dim7');
    expect(names(paletteFor(Am, false)[2]!.chords)).toBe('A7 B7 C7');
  });
});

describe('定番進行', () => {
  const realize = (tonic: string, mode: 'major' | 'minor', id: string) =>
    names(realizePreset(makeKey(tonic, mode), PRESET_PROGRESSIONS.find((p) => p.id === id)!));

  it('キー C の定番進行', () => {
    expect(realize('C', 'major', 'oudou')).toBe('Fmaj7 G7 Em7 Am');
    expect(realize('C', 'major', 'komuro')).toBe('Am F G C');
    expect(realize('C', 'major', 'canon')).toBe('C G Am Em F C F G');
    expect(realize('C', 'major', 'twofive')).toBe('Dm7 G7 Cmaj7');
    expect(realize('C', 'major', 'sdm')).toBe('C F Fm C');
  });

  it('指示書の例：F#マイナーで Ⅰm–Ⅵ–Ⅶ–Ⅴ は F#m → D → E → C#', () => {
    expect(realize('F#', 'minor', 'minor-dominant')).toBe('F#m D E C#');
  });

  it('マイナーキーの定番進行', () => {
    expect(realize('A', 'minor', 'andalusian')).toBe('Am G F E');
    expect(realize('A', 'minor', 'minor-cadence')).toBe('Am Dm E7 Am');
    expect(realize('A', 'minor', 'minor-twofive')).toBe('Bm7b5 E7 Am7');
  });

  it('すべての定番進行が、全15キーで計算できる', () => {
    for (const p of PRESET_PROGRESSIONS) {
      for (const t of ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb']) {
        expect(() => realizePreset(makeKey(t, p.mode), p), `${p.id} in ${t}`).not.toThrow();
      }
    }
  });
});

describe('次のコードの候補', () => {
  const next = (key = C, last?: string) =>
    nextChordSuggestions(key, last ? parseChordSymbol(last) : undefined).map((s) => formatChordSymbol(s.chord));

  it('最初は Ⅰ', () => {
    expect(next(C)).toEqual(['C']);
    expect(next(Am)).toEqual(['Am']);
  });
  it('ドミナント（G）の次はトニック（C）や Ⅵm（Am）', () => {
    expect(next(C, 'G')).toEqual(['C', 'Am']);
  });
  it('サブドミナント（F）の次は G・C・Dm', () => {
    expect(next(C, 'F')).toEqual(['G', 'C', 'Dm']);
  });
  it('セカンダリードミナント（D7）の次は解決先（G）', () => {
    expect(next(C, 'D7')).toEqual(['G']);
  });
  it('同じコードは候補に出さない', () => {
    expect(next(C, 'C')).not.toContain('C');
  });
});

describe('雰囲気の傾向', () => {
  it('C → G → Am → F は明るめ', () => {
    expect(moodTendency(C, prog('C G Am F'))?.brightness).toBe('明るめ');
  });
  it('Am → Dm → Em は暗め', () => {
    expect(moodTendency(Am, prog('Am Dm Em'))?.brightness).toBe('暗め');
  });
  it('G7 → C には解決感がある', () => {
    expect(moodTendency(C, prog('Dm7 G7 C'))?.resolution).toBe(true);
    expect(moodTendency(C, prog('C F'))?.resolution).toBe(false);
  });
  it('コードが無ければ null', () => {
    expect(moodTendency(C, [])).toBeNull();
  });
});

describe('同じ進行の別パターン', () => {
  const vars = (s: string) => Object.fromEntries(variations(C, prog(s)).map((v) => [v.id, v]));

  it('セブンスコードにする', () => {
    expect(names(vars('C Am F G').sevenths!.chords)).toBe('Cmaj7 Am7 Fmaj7 G7');
  });
  it('代理コードに置き換える（前後と同じコードにはしない）', () => {
    expect(names(vars('C Am F G').substitute!.chords)).toBe('C Am Dm G');
  });
  it('セカンダリードミナントを挟む（全体の長さは変わらない）', () => {
    const v = vars('C Am F G').secondary!;
    expect(names(v.chords)).toBe('C E7 Am C7 F D7 G');
    expect(totalBeats(v.chords)).toBe(16);
    expect(v.chords.map((c) => c.durationBeats)).toEqual([2, 2, 2, 2, 2, 2, 4]);
  });
});

describe('移調', () => {
  it('C メジャー → F# メジャー', () => {
    const moved = transposeChords(prog('C Am F G7'), C, makeKey('F#', 'major'));
    expect(names(moved)).toBe('F# D#m B C#7');
  });
  it('C メジャー → E♭ メジャー（♭の綴りになる）', () => {
    expect(names(transposeChords(prog('C Am F G'), C, makeKey('Eb', 'major')))).toBe('Eb Cm Ab Bb');
  });
  it('分数コードのベースも移調する', () => {
    expect(names(transposeChords(prog('C/E'), C, makeKey('D', 'major')))).toBe('D/F#');
  });
  it('鳴らす音（MIDI）も半音の差だけ動く', () => {
    const moved = transposeChords(prog('C'), C, makeKey('D', 'major'));
    expect(chordVoicing(moved[0]!).map(midiOf)).toEqual([62, 66, 69]);
  });
});
