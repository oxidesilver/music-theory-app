// MIDI 書き出しのテスト：書き出したファイルを読み込み直して、内容が元のデータと一致するか確かめる
import { describe, expect, it } from 'vitest';
import { Midi } from '@tonejs/midi';
import { ALL_PARTS, midiBytes, midiFileName, type MidiSource } from './exportMidi';
import { sourceFromSong } from './source';
import { makeChord } from '@/features/progression/logic';
import { DRUM_PRESETS, TICKS_PER_BAR, bassLine, makeNote, patternToEvents } from '@/features/compose/logic';
import { chordsToEvents } from '@/features/progression/editorStore';
import { parseChordSymbol } from '@/theory/chord';
import { makeKey } from '@/theory/key';
import { SONG_SCHEMA_VERSION, type Song } from '@/storage/types';

const key = makeKey('F#', 'minor');
const chords = ['F#m', 'D', 'E', 'C#'].map((c) => makeChord(parseChordSymbol(c), 4));
const melody = [makeNote(73, key, 0, 480, 100), makeNote(74, key, 480, 240, 90), makeNote(76, key, 720, 1200, 127)];
const bass = bassLine(chords, key, 'whole');
const drums = patternToEvents(DRUM_PRESETS.find((p) => p.id === 'four')!.pattern, TICKS_PER_BAR * 4);

const src: MidiSource = { title: 'テスト曲', bpm: 95, key, timeSignature: [4, 4], chords, melody, bass, drums };

/** MIDI ファイルの先頭（ヘッダー）を直接読む */
function rawHeader(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    magic: String.fromCharCode(...bytes.slice(0, 4)),
    format: view.getUint16(8),
    tracks: view.getUint16(10),
    division: view.getUint16(12),
  };
}

describe('MIDI ファイルの形式', () => {
  it('標準 MIDI ファイル（Format 1・1拍 = 480 tick）', () => {
    const h = rawHeader(midiBytes(src));
    expect(h.magic).toBe('MThd');
    expect(h.format).toBe(1);
    expect(h.division).toBe(480);
    // テンポなどを入れる最初のトラック ＋ Chord・Melody・Bass・Drums
    expect(h.tracks).toBe(5);
  });

  it('BPM・拍子・曲名が保存される', () => {
    const m = new Midi(midiBytes(src));
    // MIDI はテンポを「1拍のマイクロ秒（整数）」で記録するため、ごくわずかな誤差が出る（95 → 95.0001）
    expect(m.header.tempos[0]!.bpm).toBeCloseTo(95, 2);
    expect(m.header.tempos[0]!.ticks).toBe(0);
    expect(m.header.timeSignatures[0]!.timeSignature).toEqual([4, 4]);
  });

  it('曲名：英数字はファイル内に書き、日本語は文字化けを防ぐため書かない', () => {
    expect(new Midi(midiBytes({ ...src, title: 'My Song 1' })).header.name).toBe('My Song 1');
    expect(new Midi(midiBytes(src)).header.name).toBe('');
  });

  it('調号は書き込まない（ライブラリの不具合で壊れた値になるため）', () => {
    const bytes = midiBytes(src);
    expect(new Midi(bytes).header.keySignatures).toHaveLength(0);
    // 調号のメタイベント（FF 59）がファイルに含まれていない
    const hasKeySig = bytes.some((b, i) => b === 0xff && bytes[i + 1] === 0x59 && bytes[i + 2] === 0x02);
    expect(hasKeySig).toBe(false);
  });
});

describe('トラック分け', () => {
  const m = new Midi(midiBytes(src));
  const byName = (name: string) => m.tracks.find((t) => t.name === name)!;

  it('Track 1：Chord、Track 2：Melody、Track 3：Bass、Track 4：Drums の順', () => {
    expect(m.tracks.map((t) => t.name)).toEqual(['Chord', 'Melody', 'Bass', 'Drums']);
    expect(m.tracks.map((t) => t.channel)).toEqual([0, 1, 2, 9]);
    expect(byName('Drums').instrument.percussion).toBe(true);
  });

  it('コード：構成音が、コードの長さで並ぶ（F#m → F#3 A3 C#4）', () => {
    const notes = byName('Chord').notes;
    const first = notes.filter((n) => n.ticks === 0).map((n) => n.midi).sort((a, b) => a - b);
    expect(first).toEqual([54, 57, 61]);
    expect(notes.every((n) => n.durationTicks === 1920)).toBe(true);
    expect([...new Set(notes.map((n) => n.ticks))]).toEqual([0, 1920, 3840, 5760]);
    // C# のコード（ハーモニックマイナーの Ⅴ）には E# が含まれる（MIDI 65）
    expect(notes.filter((n) => n.ticks === 5760).map((n) => n.midi).sort((a, b) => a - b)).toEqual([61, 65, 68]);
  });

  it('メロディー：音程・開始位置・長さ・強さがずれない', () => {
    const notes = byName('Melody').notes;
    expect(notes.map((n) => [n.midi, n.ticks, n.durationTicks])).toEqual([
      [73, 0, 480],
      [74, 480, 240],
      [76, 720, 1200],
    ]);
    expect(notes[2]!.velocity).toBeCloseTo(1, 2);
    expect(Math.round(notes[0]!.velocity * 127)).toBe(100);
  });

  it('ベース：コードのルートが1小節ずつ', () => {
    expect(byName('Bass').notes.map((n) => [n.midi, n.ticks, n.durationTicks])).toEqual([
      [42, 0, 1920],
      [38, 1920, 1920],
      [40, 3840, 1920],
      [37, 5760, 1920],
    ]);
  });

  it('ドラム：4つ打ちのキック（36）が4小節で16回、1拍（480 tick）ごと', () => {
    const kicks = byName('Drums').notes.filter((n) => n.midi === 36).map((n) => n.ticks);
    expect(kicks).toHaveLength(16);
    expect(kicks.slice(0, 5)).toEqual([0, 480, 960, 1440, 1920]);
  });

  it('秒に直した位置も BPM どおり（BPM 95 で 1拍 ≒ 0.632秒）', () => {
    const second = byName('Melody').notes[1]!;
    expect(second.time).toBeCloseTo(60 / 95, 3);
  });
});

describe('パートごとの書き出し', () => {
  it('メロディーだけ', () => {
    const m = new Midi(midiBytes(src, ['melody']));
    expect(m.tracks.map((t) => t.name)).toEqual(['Melody']);
    expect(m.header.tempos[0]!.bpm).toBeCloseTo(95, 2);
  });
  it('どのパートの組み合わせでも書き出せる', () => {
    for (const p of ALL_PARTS) expect(new Midi(midiBytes(src, [p])).tracks).toHaveLength(1);
  });
  it('空のパートは空のトラックになる（エラーにならない）', () => {
    const m = new Midi(midiBytes({ ...src, melody: [], drums: [] }));
    expect(m.tracks.find((t) => t.name === 'Melody')!.notes).toHaveLength(0);
  });
});

describe('保存した作品からの書き出し', () => {
  it('ドラムは曲の長さいっぱいに並べ直す（コード進行を伸ばした場合）', () => {
    const longChords = Array.from({ length: 8 }, () => makeChord(parseChordSymbol('Am'), 4));
    const now = new Date().toISOString();
    const song: Song = {
      id: 's1', title: '長い曲', key: makeKey('A', 'minor'), bpm: 120, timeSignature: [4, 4],
      chords: chordsToEvents(longChords), melody: [], bass: [],
      drums: patternToEvents(DRUM_PRESETS[0]!.pattern, TICKS_PER_BAR * 4), // 4小節分しか無い
      instruments: { chord: 'piano', melody: 'synth', bass: 'bass' }, createdAt: now, updatedAt: now, schemaVersion: SONG_SCHEMA_VERSION,
    };
    const m = new Midi(midiBytes(sourceFromSong(song)));
    const kicks = m.tracks.find((t) => t.name === 'Drums')!.notes.filter((n) => n.midi === 36);
    expect(kicks).toHaveLength(32); // 8小節 × 4
    expect(m.tracks.find((t) => t.name === 'Chord')!.notes).toHaveLength(8 * 3);
  });
});

describe('ファイル名', () => {
  it('使えない文字を取り除く', () => {
    expect(midiFileName('My Song: 1/2?')).toBe('My Song 12.mid');
    expect(midiFileName('王道進行', 'Melody')).toBe('王道進行_Melody.mid');
    expect(midiFileName('   ')).toBe('song.mid');
  });
});
