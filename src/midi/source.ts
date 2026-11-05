// 画面や保存データから、MIDI を作るための材料をそろえる
import type { Song } from '@/storage/types';
import { eventsToChords, type EditorState } from '@/features/progression/editorStore';
import { eventsToPattern, patternToEvents, songLengthTicks, type ChordRhythm } from '@/features/compose/logic';
import type { MidiSource } from './exportMidi';

/** ドラムは1小節目のパターンを、曲の長さいっぱいに並べ直す（コード進行を長くしたときも最後まで鳴るように） */
function fitDrums(src: MidiSource): MidiSource {
  if (src.drums.length === 0) return src;
  const length = songLengthTicks(src.chords, src.melody, src.bass);
  return { ...src, drums: patternToEvents(eventsToPattern(src.drums), length) };
}

export function sourceFromEditor(
  s: Pick<EditorState, 'title' | 'bpm' | 'key' | 'chords' | 'melody' | 'bass' | 'drums' | 'chordRhythm'>,
): MidiSource {
  return fitDrums({
    title: s.title,
    bpm: s.bpm,
    key: s.key,
    timeSignature: [4, 4],
    chords: s.chords,
    melody: s.melody,
    bass: s.bass,
    drums: s.drums,
    chordRhythm: s.chordRhythm,
  });
}

const RHYTHMS: ChordRhythm[] = ['sustain', 'quarter', 'offbeat'];

export function sourceFromSong(song: Song): MidiSource {
  return fitDrums({
    title: song.title,
    bpm: song.bpm,
    key: song.key,
    timeSignature: song.timeSignature,
    chords: eventsToChords(song.chords),
    melody: song.melody,
    bass: song.bass,
    drums: song.drums ?? [],
    chordRhythm: RHYTHMS.includes(song.chordRhythm as ChordRhythm) ? (song.chordRhythm as ChordRhythm) : 'sustain',
  });
}
