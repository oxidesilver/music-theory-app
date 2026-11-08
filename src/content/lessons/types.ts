// レッスン（教材）のデータの形。
// 鳴らす音や図に出す音は、できるだけ音楽理論エンジンで計算させる（手書きの間違いを防ぐため）。
//
// 文章の書き方：
//   **太字** … 大事な言葉
//   {{C4}}   … 音名。設定（FL Studio式／一般的な表記）に合わせて「C5」「C4」と表示される

import type { ScaleId } from '@/theory/scale';
import type { ChordQualityId } from '@/theory/chord';

/** 鳴らす音の指定 */
export type NoteSource =
  /** 音を直接指定（例：['C4', 'E4', 'G4']） */
  | { notes: string[] }
  /** スケール（主音から上へ。withOctave = true なら最後に1オクターブ上の主音を足す） */
  | { scale: ScaleId; tonic: string; withOctave?: boolean; descending?: boolean }
  /** 音程（from の音と、そこから interval 上の音） */
  | { interval: string; from: string }
  /** コード（例：'Am7'）。ルートを octave（初期値 4）に置き、inversion で転回形 */
  | { chord: string; octave?: number; inversion?: number }
  /** コード進行（例：['C', 'G', 'Am', 'F']）。mode: 'progression' で1つずつ順番に鳴らす */
  | { progression: string[] };

export interface Demo {
  title: string;
  description?: string;
  source: NoteSource;
  /** sequence = 1音ずつ、chord = 同時に、compare = 2音を順番に鳴らしてから同時に、progression = コード進行 */
  mode: 'sequence' | 'chord' | 'compare' | 'progression';
  /** 鍵盤を表示するか（初期値 true） */
  keyboard?: boolean;
}

export type Diagram =
  /** 音名・ドレミ・日本音名の対応表 */
  | { kind: 'note-names' }
  /** 鍵盤の C の位置を示す図 */
  | { kind: 'keyboard-map' }
  /** 音の並びと、間が全音か半音かの図。expectPattern はテストで正しさを確認するための答え */
  | { kind: 'steps'; title?: string; source: NoteSource; expectPattern?: string }
  /** 音程の一覧表（from の音から） */
  | { kind: 'interval-table'; from: string; intervals: string[] }
  /** スケールを自由に選んで比べる */
  | { kind: 'scale-explorer'; scales: ScaleId[] }
  /** キーと調号の一覧 */
  | { kind: 'key-signatures'; mode: 'major' | 'minor' }
  /** ルートとコードの種類を選んで、構成音と音程を確かめる */
  | { kind: 'chord-builder'; qualities: ChordQualityId[]; root?: string }
  /** キーを選んで、ダイアトニックコードの一覧（ローマ数字・役割・音）を見る */
  | { kind: 'diatonic-table'; mode: 'major' | 'minor'; tonic?: string; sevenths?: boolean; scale?: ScaleId };

export interface Term {
  term: string;
  /** 直感的な説明 */
  plain: string;
  /** 少し専門的な説明 */
  formal?: string;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  choices: string[];
  /** 正解の番号（0 から数える） */
  answer: number;
  /** 正解・不正解の理由 */
  explanation: string;
  /** 問題と一緒に聴ける音 */
  listen?: Demo;
}

export interface Lesson {
  id: string;
  chapterId: string;
  title: string;
  /** このレッスンで分かること */
  goal: string;
  /** 1. 理論の説明（段落の配列） */
  explanation: string[];
  terms?: Term[];
  /** 2. 図解 */
  diagrams?: Diagram[];
  /** 3・4. 鍵盤表示と音声 */
  demos?: Demo[];
  /** 5. 使用例 */
  examples: string[];
  /** 6. DTM での活用方法 */
  dtm: string[];
  /** 7. 理解度確認クイズ */
  quiz: QuizQuestion[];
}

export interface Chapter {
  id: string;
  number: number;
  title: string;
  description: string;
  /** 予定しているレッスンの題名（まだ教材が無い章の表示用） */
  plannedTopics: string[];
  lessons: Lesson[];
}
