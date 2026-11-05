// まだ実装していない画面の仮ページ。各 Phase で本物の画面に置き換える。
import { ComingSoon } from '@/components/ui/ComingSoon';
import { NAV_ITEMS } from '@/app/navigation';


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


