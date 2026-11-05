import { useCallback, useEffect, useState } from 'react';
import { db } from '@/storage/db';
import type { FavoriteChord } from '@/storage/types';
import type { ChordQualityId } from '@/theory/chord';
import { formatPitchClass, type PitchClass } from '@/theory/pitch';

export function favoriteId(root: PitchClass, quality: ChordQualityId): string {
  return `${formatPitchClass(root)}|${quality}`;
}

/** お気に入りコード（IndexedDB に保存） */
export function useFavorites() {
  const [items, setItems] = useState<FavoriteChord[]>([]);

  const reload = useCallback(async () => {
    try {
      setItems(await db.favorites.orderBy('addedAt').toArray());
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const toggle = useCallback(
    async (root: PitchClass, quality: ChordQualityId) => {
      const id = favoriteId(root, quality);
      if (await db.favorites.get(id)) await db.favorites.delete(id);
      else await db.favorites.put({ id, root, quality, addedAt: new Date().toISOString() });
      await reload();
    },
    [reload],
  );

  return { items, toggle, has: (root: PitchClass, quality: ChordQualityId) => items.some((f) => f.id === favoriteId(root, quality)) };
}
