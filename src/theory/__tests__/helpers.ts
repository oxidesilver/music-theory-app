import { formatPitchClass, formatPitch, type Pitch, type PitchClass } from '../pitch';
import { formatChordSymbol, type ChordSpec } from '../chord';

/** 音名の一覧を "C D E" のような文字列にする（テストで読みやすくするため） */
export const names = (ps: PitchClass[]) => ps.map((p) => formatPitchClass(p)).join(' ');
export const pitchNames = (ps: Pitch[]) => ps.map((p) => formatPitch(p)).join(' ');
export const chordNames = (cs: ChordSpec[]) => cs.map((c) => formatChordSymbol(c)).join(' ');
