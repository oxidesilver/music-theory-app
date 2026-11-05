// メニュー項目の定義。サイドメニュー（PC）と下部ナビ（スマホ）の両方がここを参照する。

export interface NavItem {
  path: string;
  label: string;
  icon: string;
  description: string;
}

export const NAV_ITEMS = {
  home: { path: '/', label: 'ホーム', icon: '🏠', description: '学習の続きや最近の作品' },
  learn: { path: '/learn', label: '音楽理論を学ぶ', icon: '📖', description: '基礎から順番に学べるレッスン' },
  progression: { path: '/progression', label: 'コード進行メーカー', icon: '🎼', description: 'コードを並べて進行を作る' },
  chords: { path: '/chords', label: 'コード辞典', icon: '🎹', description: 'コードの構成音と響きを調べる' },
  ear: { path: '/ear', label: '耳トレーニング', icon: '👂', description: '音程・コード・進行の聴き分け' },
  compose: { path: '/compose', label: 'メロディー・作曲', icon: '🎵', description: 'ピアノロールでメロディーとベース' },
  genres: { path: '/genres', label: 'ジャンル別作曲講座', icon: '🎧', description: 'ジャンルごとの作り方' },
  library: { path: '/library', label: '保存した作品', icon: '💾', description: '作ったコード進行や曲' },
  progress: { path: '/progress', label: '学習履歴・進捗', icon: '📊', description: '正答率や学習の記録' },
  settings: { path: '/settings', label: '設定・バックアップ', icon: '⚙️', description: '表示・音・データの管理' },
  more: { path: '/more', label: 'その他', icon: '☰', description: 'すべてのメニュー' },
} satisfies Record<string, NavItem>;

/** PC のサイドメニューに並べる順番（指示書のメインメニュー順） */
export const SIDE_NAV: NavItem[] = [
  NAV_ITEMS.home,
  NAV_ITEMS.learn,
  NAV_ITEMS.progression,
  NAV_ITEMS.chords,
  NAV_ITEMS.ear,
  NAV_ITEMS.compose,
  NAV_ITEMS.genres,
  NAV_ITEMS.library,
  NAV_ITEMS.progress,
  NAV_ITEMS.settings,
];

/** スマホの下部ナビ（5つまで） */
export const BOTTOM_NAV: NavItem[] = [
  { ...NAV_ITEMS.home },
  { ...NAV_ITEMS.learn, label: '学ぶ' },
  { ...NAV_ITEMS.progression, label: '作る' },
  { ...NAV_ITEMS.ear, label: '耳トレ' },
  NAV_ITEMS.more,
];
