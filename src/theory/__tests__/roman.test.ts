import { describe, expect, it } from 'vitest';
import { chordFromRoman, romanNumeral, romanNumerals } from '../roman';
import { commonKeys, makeKey } from '../key';
import { diatonicChords } from '../diatonic';
import { formatChordSymbol, parseChordSymbol } from '../chord';

const C = makeKey('C', 'major');
const prog = (s: string) => s.split(' ').map(parseChordSymbol);

describe('ローマ数字（メジャーキー）', () => {
  it('C メジャーのダイアトニック（日本式）', () => {
    expect(romanNumerals(C, diatonicChords(C), { style: 'japanese' })).toEqual(['Ⅰ', 'Ⅱm', 'Ⅲm', 'Ⅳ', 'Ⅴ', 'Ⅵm', 'Ⅶdim']);
  });
  it('C メジャーのダイアトニック（英米式）', () => {
    expect(romanNumerals(C, diatonicChords(C), { style: 'english' })).toEqual(['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']);
  });
  it('4和音（日本式・英米式）', () => {
    const sevenths = diatonicChords(C, { sevenths: true });
    expect(romanNumerals(C, sevenths, { style: 'japanese' })).toEqual(['Ⅰ△7', 'Ⅱm7', 'Ⅲm7', 'Ⅳ△7', 'Ⅴ7', 'Ⅵm7', 'Ⅶm7(♭5)']);
    expect(romanNumerals(C, sevenths, { style: 'english' })).toEqual(['Imaj7', 'ii7', 'iii7', 'IVmaj7', 'V7', 'vi7', 'viiø7']);
  });
});

describe('ローマ数字（マイナーキー）', () => {
  it('指示書の例：キー F#マイナーで F#m → D → E → C#', () => {
    const key = makeKey('F#', 'minor');
    expect(romanNumerals(key, prog('F#m D E C#'), { style: 'english' })).toEqual(['i', 'VI', 'VII', 'V']);
    expect(romanNumerals(key, prog('F#m D E C#'), { style: 'japanese' })).toEqual(['Ⅰm', 'Ⅵ', 'Ⅶ', 'Ⅴ']);
  });
  it('A マイナーのダイアトニック（英米式）', () => {
    const key = makeKey('A', 'minor');
    expect(romanNumerals(key, diatonicChords(key), { style: 'english' })).toEqual(['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII']);
  });
  it('同じ主音のメジャースケールを基準にする書き方（♭Ⅲ・♭Ⅵ・♭Ⅶ）', () => {
    const key = makeKey('A', 'minor');
    expect(romanNumerals(key, prog('Am C F G'), { style: 'japanese', reference: 'major' })).toEqual(['Ⅰm', '♭Ⅲ', '♭Ⅵ', '♭Ⅶ']);
  });
});

describe('スケール外のコード・分数コード', () => {
  it.each([
    ['Bb', '♭Ⅶ', '♭VII'],
    ['Fm', 'Ⅳm', 'iv'],
    ['Ab', '♭Ⅵ', '♭VI'],
    ['Eb', '♭Ⅲ', '♭III'],
    ['D7', 'Ⅱ7', 'II7'],
    ['E7', 'Ⅲ7', 'III7'],
    ['F#m7b5', '♯Ⅳm7(♭5)', '♯ivø7'],
    ['C/E', 'Ⅰ/Ⅲ', 'I/III'],
    ['Db', '♭Ⅱ', '♭II'],
  ])('キー C で %s は 日本式 %s／英米式 %s', (chord, ja, en) => {
    expect(romanNumeral(C, parseChordSymbol(chord), { style: 'japanese' })).toBe(ja);
    expect(romanNumeral(C, parseChordSymbol(chord), { style: 'english' })).toBe(en);
  });
});

describe('定番進行（キー C）', () => {
  it('王道進行：F → G → Em → Am', () => {
    expect(romanNumerals(C, prog('F G Em Am'))).toEqual(['Ⅳ', 'Ⅴ', 'Ⅲm', 'Ⅵm']);
    expect(romanNumerals(C, prog('Fmaj7 G7 Em7 Am'))).toEqual(['Ⅳ△7', 'Ⅴ7', 'Ⅲm7', 'Ⅵm']);
  });
  it('小室進行：Am → F → G → C', () => {
    expect(romanNumerals(C, prog('Am F G C'))).toEqual(['Ⅵm', 'Ⅳ', 'Ⅴ', 'Ⅰ']);
  });
  it('カノン進行：C → G → Am → Em → F → C → F → G', () => {
    expect(romanNumerals(C, prog('C G Am Em F C F G'))).toEqual(['Ⅰ', 'Ⅴ', 'Ⅵm', 'Ⅲm', 'Ⅳ', 'Ⅰ', 'Ⅳ', 'Ⅴ']);
  });
});

describe('ローマ数字からコードを作る', () => {
  it.each([
    ['D', 'major', 'Ⅳ△7', 'Gmaj7'],
    ['D', 'major', 'Ⅵm', 'Bm'],
    ['C', 'major', '♭VII', 'Bb'],
    ['C', 'major', 'ii7', 'Dm7'],
    ['C', 'major', 'viiø7', 'Bm7b5'],
    ['C', 'major', 'Ⅰ/Ⅲ', 'C/E'],
    ['F#', 'minor', 'Ⅴ', 'C#'],
    ['F#', 'minor', 'VI', 'D'],
    ['Eb', 'major', 'Ⅱm7', 'Fm7'],
    ['A', 'minor', '♭Ⅵ', 'Fb'], // A マイナーの基準（ナチュラルマイナー）では F が6度なので ♭Ⅵ は F♭
  ] as const)('キー %s %s で %s は %s', (tonic, mode, roman, expected) => {
    expect(formatChordSymbol(chordFromRoman(makeKey(tonic, mode), roman))).toBe(expected);
  });

  it('同じ主音のメジャー基準で読む', () => {
    expect(formatChordSymbol(chordFromRoman(makeKey('A', 'minor'), '♭Ⅵ', { reference: 'major' }))).toBe('F');
  });

  it('全30キー × ダイアトニックコード（3和音・4和音）で「コード → ローマ数字 → コード」が元に戻る', () => {
    for (const key of [...commonKeys('major'), ...commonKeys('minor')]) {
      for (const sevenths of [false, true]) {
        for (const c of diatonicChords(key, { sevenths })) {
          const chord = { root: c.root, quality: c.quality };
          for (const style of ['japanese', 'english'] as const) {
            const roman = romanNumeral(key, chord, { style });
            expect(chordFromRoman(key, roman), roman).toEqual(chord);
          }
        }
      }
    }
  });

  it('読めないローマ数字はエラー', () => {
    expect(() => chordFromRoman(C, 'Ⅷ')).toThrow();
    expect(() => chordFromRoman(C, 'X')).toThrow();
  });
});
