/** 音が出ないときの案内（特に iPhone の消音スイッチ） */
export function SoundHint() {
  return (
    <p className="text-xs text-slate-500 dark:text-slate-400">
      🔇 音が出ないときは、端末の音量と、iPhone の場合は本体横の<strong>消音スイッチ</strong>（マナーモード）を確認してください。
    </p>
  );
}
