// まだ実装していない画面の仮ページ。各 Phase で本物の画面に置き換える。
import { ComingSoon } from '@/components/ui/ComingSoon';
import { NAV_ITEMS } from '@/app/navigation';


export function ProgressionPage() {
  const n = NAV_ITEMS.progression;
  return (
    <ComingSoon
      icon={n.icon}
      title={n.label}
      description="キーを選んでコードを並べ、再生・保存できます。"
      phase="Phase 5"
      features={['ローマ数字とコードの役割を表示', 'BPM・ループ再生・音量調整', '次に使えるコードの候補', 'MIDI出力（Phase 8）']}
    />
  );
}

export function EarTrainingPage() {
  const n = NAV_ITEMS.ear;
  return (
    <ComingSoon
      icon={n.icon}
      title={n.label}
      description="音を聴いて、音程・コード・進行を聴き分ける練習です。"
      phase="Phase 6"
      features={['レベル1：音程　レベル2：コード　レベル3：コード進行', '毎回ランダムに出題・解説つき', '正答率と苦手な問題の記録']}
    />
  );
}

export function ComposePage() {
  const n = NAV_ITEMS.compose;
  return (
    <ComingSoon
      icon={n.icon}
      title={n.label}
      description="コード進行に合わせて、メロディーとベースラインを作ります。"
      phase="Phase 7"
      features={['ピアノロールで音符を入力', 'スケールの音・コードトーンを色分け表示', 'メロディー・ベース・ドラムをMIDIで出力']}
    />
  );
}

export function GenresPage() {
  const n = NAV_ITEMS.genres;
  return (
    <ComingSoon
      icon={n.icon}
      title={n.label}
      description="ジャパレゲ・ダンスホール・EDM・HIPHOP・R&B・ポップス・ロックの作り方を学べます。"
      phase="Phase 9"
      features={['ジャンルの特徴・BPM・リズムの傾向', 'リズムパターンやサンプル進行の聴き比べ', 'そのまま作曲画面へ移動']}
    />
  );
}

export function LibraryPage() {
  const n = NAV_ITEMS.library;
  return (
    <ComingSoon
      icon={n.icon}
      title={n.label}
      description="作ったコード進行や曲の一覧です。"
      phase="Phase 5"
      features={['作品の一覧・複製・削除', '作曲画面で開き直す', 'MIDIファイルとして書き出し']}
    />
  );
}

