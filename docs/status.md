# 開発の進み具合（2026-11-05 時点）

次回の作業を始めるときは、まずこのファイルと [design.md](design.md) を読むこと。

## 完了した Phase

| Phase | 内容 | 状態 |
|---|---|---|
| 0 | 設計 | ✅ 承認済み |
| 1 | 基盤（React / TS / Vite / Tailwind / PWA / IndexedDB） | ✅ |
| 2 | 音楽理論エンジン（src/theory） | ✅ |
| 3 | 音声エンジン（Tone.js）・鍵盤・コード辞典 | ✅ |
| 4 | 学習機能（第1〜3章・18レッスン・クイズ・進捗） | ✅ |
| 5 | コード進行メーカー・保存した作品 | ✅ |
| 6 | 耳トレーニング（3レベル・11種類） | ✅ |
| 7 | メロディー・作曲（ピアノロール・ベース・ドラム） | ✅ |
| 8 | MIDI 出力（4トラック） | ✅（FL Studio での確認待ち） |
| 9 | ジャンル別作曲講座（7ジャンル）・コードの鳴らし方 | ✅ |
| 10 | 仕上げ（バックアップと復元・スマホ改善・GitHub Pages 公開） | ✅（iPhone 実機の確認待ち） |

公開アドレス：https://oxidesilver.github.io/music-theory-app/
（main ブランチに Push すると、GitHub Actions がテスト → ビルド → 公開を自動で行う）

自動テスト：588件すべて合格（`npm test`）。各 Phase 完了時にローカル Commit 済み（GitHub へはまだ Push していない）。

## 今後の候補（未着手）

- 第4〜9章の教材の執筆（キー・コードの基礎・ダイアトニック・コード進行・応用理論・実践的な作曲理論）
- 五線譜の表示
- 3/4・6/8 拍子への対応
- 高品質なサンプル音源への差し替え

## ユーザーに確認・お願いが必要なこと

- GitHub：ユーザー名 oxidesilver、リポジトリ oxidesilver/music-theory-app（公開）。Commit の名前は oxidesilver と GitHub の noreply アドレスに付け直し済み（このリポジトリ内だけの設定）。
- **Push・GitHub Pages 公開の許可**は、作業の直前に毎回確認する。
- **FL Studio 21 での MIDI 読み込み確認**：手順は [fl-studio-test/README.md](fl-studio-test/README.md)。
- 教材の文章・ジャンル内容・音色についての感想（任意）。

## 開発環境のメモ

- Node.js 26.13.0・Git 2.56.0 を winget でインストール済み。このアプリを再起動すると、PowerShell で `npm` などのコマンドが使えるようになる。
- スマホで試すとき：`npm run build` のあと `npx vite preview --host --port 4173` で起動し、スマホから `http://（PC の IP アドレス）:4173` を開く（同じ Wi-Fi の場合）。自宅以外のネットワークでは使わない。
- 使用しているライブラリの不具合への対処：@tonejs/midi 2.0.28 は調号を範囲外の値で書き込み、日本語の曲名が文字化けするため、MIDI では調号と日本語の曲名を書き込まない（src/midi/exportMidi.ts）。
