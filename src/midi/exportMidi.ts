// MIDI 出力（指示書 5章）
// 標準 MIDI ファイル（Format 1・1拍 = 480 tick）を作る。
//   Track 1：Chord（コード）／ Track 2：Melody ／ Track 3：Bass ／ Track 4：Drums（チャンネル10）
// テンポ（BPM）・拍子・調号も書き込む。

import { Midi } from '@tonejs/midi';
import { PPQ, type DrumEvent, type NoteEvent } from '@/storage/types';
import type { MusicalKey } from '@/theory/key';
import { midiOf } from '@/theory/pitch';
import type { ProgressionChord } from '@/features/progression/logic';
import { chordHits, type ChordRhythm } from '@/features/compose/logic';

export type PartId = 'chord' | 'melody' | 'bass' | 'drums';

export const PART_INFO: Record<PartId, { trackName: string; nameJa: string; channel: number; program: number }> = {
  chord: { trackName: 'Chord', nameJa: 'コード', channel: 0, program: 0 }, // 0 = アコースティックピアノ
  melody: { trackName: 'Melody', nameJa: 'メロディー', channel: 1, program: 80 }, // 80 = シンセリード（矩形波）
  bass: { trackName: 'Bass', nameJa: 'ベース', channel: 2, program: 38 }, // 38 = シンセベース
  drums: { trackName: 'Drums', nameJa: 'ドラム', channel: 9, program: 0 }, // チャンネル10（0から数えて9）がドラム
};

export const ALL_PARTS: PartId[] = ['chord', 'melody', 'bass', 'drums'];

export interface MidiSource {
  title: string;
  bpm: number;
  key: MusicalKey;
  timeSignature: [number, number];
  chords: ProgressionChord[];
  melody: NoteEvent[];
  bass: NoteEvent[];
  drums: DrumEvent[];
  /** コードの鳴らし方（省略時は伸ばす） */
  chordRhythm?: ChordRhythm;
}

const velocity = (v: number) => Math.min(1, Math.max(0, v / 127));

/** MIDI データを作る。parts を指定すると、そのパートだけのファイルになる */
export function buildMidi(src: MidiSource, parts: PartId[] = ALL_PARTS): Midi {
  const midi = new Midi();
  if (midi.header.ppq !== PPQ) throw new Error(`MIDI の分解能が想定と違います：${midi.header.ppq}`);
  // ファイル内の曲名は英数字のときだけ書く（ライブラリが1文字1バイトで書き込むため、日本語は文字化けする）。
  // 日本語の曲名はファイル名に残る。
  midi.header.name = /^[\x20-\x7e]*$/.test(src.title) ? src.title : '';
  midi.header.setTempo(src.bpm);
  midi.header.timeSignatures.push({ ticks: 0, timeSignature: [...src.timeSignature] });
  // 調号は書き込まない：@tonejs/midi 2.0.28 は調号の値を範囲外（−7〜+7 ではない値）で書き込む不具合があり、
  // 他のソフトで正しく読めない可能性があるため。調号は読み込みに必須ではなく、音符・テンポ・拍子には影響しない。

  for (const part of parts) {
    const info = PART_INFO[part];
    const track = midi.addTrack();
    track.name = info.trackName;
    track.channel = info.channel;
    if (part !== 'drums') track.instrument.number = info.program;

    if (part === 'chord') {
      for (const hit of chordHits(src.chords, src.chordRhythm, src.timeSignature)) {
        for (const m of hit.midis) track.addNote({ midi: m, ticks: hit.start, durationTicks: hit.duration, velocity: 0.7 });
      }
    } else if (part === 'drums') {
      for (const d of src.drums) track.addNote({ midi: d.drum, ticks: d.startTick, durationTicks: d.durationTick, velocity: velocity(d.velocity) });
    } else {
      for (const n of src[part]) track.addNote({ midi: midiOf(n.pitch), ticks: n.startTick, durationTicks: n.durationTick, velocity: velocity(n.velocity) });
    }
  }
  return midi;
}

export function midiBytes(src: MidiSource, parts?: PartId[]): Uint8Array {
  return buildMidi(src, parts).toArray();
}

/** ファイル名に使えない文字を取り除く */
export function midiFileName(title: string, suffix?: string): string {
  const safe = title.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').trim().slice(0, 60) || 'song';
  return `${safe}${suffix ? `_${suffix}` : ''}.mid`;
}

/** ブラウザでファイルとしてダウンロードさせる（PC は「ダウンロード」フォルダ、iPhone は「ファイル」アプリに保存される） */
export function downloadMidi(bytes: Uint8Array, fileName: string) {
  const blob = new Blob([bytes as BlobPart], { type: 'audio/midi' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** パートごとの音符の数（ボタンに表示する用） */
export function partCounts(src: MidiSource): Record<PartId, number> {
  return { chord: src.chords.length, melody: src.melody.length, bass: src.bass.length, drums: src.drums.length };
}
