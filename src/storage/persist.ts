/**
 * ブラウザに「このサイトのデータを自動で消さないで」と依頼する。
 * iPhone の Safari は長く使わないサイトのデータを消すことがあるため（設計書 9章のリスク対策）。
 * 結果：true = 永続保存が有効、false = 許可されなかった、null = この機能に未対応
 */
export async function requestPersistentStorage(): Promise<boolean | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return null;
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}

export async function isStoragePersisted(): Promise<boolean | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persisted) return null;
  try {
    return await navigator.storage.persisted();
  } catch {
    return null;
  }
}
