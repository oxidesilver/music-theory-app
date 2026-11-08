// 学習カリキュラム全体（指示書 4-1）
import type { Chapter, Lesson } from './types';
import { CH1_LESSONS } from './ch1';
import { CH2_LESSONS } from './ch2';
import { CH3_LESSONS } from './ch3';
import { CH4_LESSONS } from './ch4';
import { CH5_LESSONS } from './ch5';
import { CH6_LESSONS } from './ch6';

export const CHAPTERS: Chapter[] = [
  {
    id: 'ch1',
    number: 1,
    title: '音楽の基礎',
    description: '音名・鍵盤・半音と全音・♯と♭・オクターブ',
    plannedTopics: [],
    lessons: CH1_LESSONS,
  },
  {
    id: 'ch2',
    number: 2,
    title: '音程',
    description: '2つの音の距離を「〇度」で表す方法と、響きの聴き分け',
    plannedTopics: [],
    lessons: CH2_LESSONS,
  },
  {
    id: 'ch3',
    number: 3,
    title: 'スケール',
    description: 'メジャー・マイナー・ペンタトニック・ブルースなどの音階',
    plannedTopics: [],
    lessons: CH3_LESSONS,
  },
  {
    id: 'ch4',
    number: 4,
    title: 'キー',
    description: '曲の「主役の音」と調号',
    plannedTopics: [],
    lessons: CH4_LESSONS,
  },
  {
    id: 'ch5',
    number: 5,
    title: 'コードの基礎',
    description: '和音の仕組みと種類',
    plannedTopics: [],
    lessons: CH5_LESSONS,
  },
  {
    id: 'ch6',
    number: 6,
    title: 'ダイアトニックコード',
    description: 'キーの中で使えるコードと、その役割',
    plannedTopics: [],
    lessons: CH6_LESSONS,
  },
  {
    id: 'ch7',
    number: 7,
    title: 'コード進行',
    description: '定番の進行と、その分析',
    plannedTopics: ['コード進行とは', 'トニックからの進行', 'ドミナントからの解決', '定番コード進行', 'カノン進行', '王道進行', '小室進行', 'マイナーキーの定番進行', 'コード進行の分析'],
    lessons: [],
  },
  {
    id: 'ch8',
    number: 8,
    title: '応用理論',
    description: 'セブンス・テンション・借用和音・転調',
    plannedTopics: ['セブンスコード', 'テンションコード', '9th・11th・13th', 'セカンダリードミナント', 'サブドミナントマイナー', 'モーダルインターチェンジ', 'ディミニッシュの活用', '転調', '代理コード', 'ノンダイアトニックコード'],
    lessons: [],
  },
  {
    id: 'ch9',
    number: 9,
    title: '実践的な作曲理論',
    description: 'メロディー・ベース・リズム・構成',
    plannedTopics: ['メロディーの作り方', 'コードとメロディーの関係', 'コードトーン', 'アプローチノート', 'ベースライン', 'ボイシング', 'リズムとグルーヴ', '楽曲構成', 'アレンジの基礎'],
    lessons: [],
  },
];

export const ALL_LESSONS: Lesson[] = CHAPTERS.flatMap((c) => c.lessons);

export function findLesson(id: string): { lesson: Lesson; chapter: Chapter; index: number } | null {
  for (const chapter of CHAPTERS) {
    const index = chapter.lessons.findIndex((l) => l.id === id);
    if (index >= 0) return { lesson: chapter.lessons[index]!, chapter, index };
  }
  return null;
}

/** 全体の中で次のレッスン */
export function nextLesson(id: string): Lesson | null {
  const i = ALL_LESSONS.findIndex((l) => l.id === id);
  return i >= 0 ? (ALL_LESSONS[i + 1] ?? null) : null;
}
