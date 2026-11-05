# 音楽理論・作曲ラボ

音楽理論を基礎から学び、コード進行・メロディー作りに活かして、FL Studio 21 へ MIDI で持ち込むための個人用学習アプリ。

設計と決定事項は [docs/design.md](docs/design.md) を参照。

## よく使うコマンド

PowerShell で、このフォルダ（`D:\music app`）を開いた状態で実行します。

| コマンド | 何をするか |
|---|---|
| `npm run dev` | 開発用サーバーを起動します。表示された `http://localhost:5173` をブラウザで開きます |
| `npm run dev:lan` | 同じ Wi-Fi のスマホからも見られる形で起動します（表示された `Network:` の URL をスマホで開きます） |
| `npm test` | 自動テストをすべて実行します |
| `npm run build` | 公開用のファイルを `dist` フォルダに作ります |
| `npm run preview` | `build` で作ったものを確認用に起動します（オフライン機能もこちらで確認） |

サーバーを止めるときは、PowerShell の画面で `Ctrl + C` を押します。

## 技術

React / TypeScript / Vite / Tailwind CSS / React Router / Zustand / Dexie（IndexedDB）/ vite-plugin-pwa / Vitest。
（Phase 3 以降で Tone.js・@tonejs/midi を追加予定）
