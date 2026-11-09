// 지금 화면에 보여줄 항목 (범위 · 검색 · 필터 · 정렬 적용)
import { useMemo } from 'react';
import { familiesOf } from '../lib/colors';
import type { Item } from '../lib/types';
import { aspectBucket, shuffleSeeded } from '../lib/util';
import { useStore } from '../store';
import { titleOf } from '../lib/capture';

function haystack(i: Item): string {
  return [i.title, i.body, i.why, i.url, i.tags.join(' '), i.link?.title, i.link?.site, i.link?.description, ...i.media.map((m) => m.name)]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function useVisibleItems(): Item[] {
  const { items, scope, query, type, aspect, color, tag, sort, shuffleSeed } = useStore();
  return useMemo(() => {
    const q = query.trim().toLowerCase();
    const words = q ? q.split(/\s+/) : [];
    let list = items.filter((i) => {
      if (scope.kind === 'inbox' && i.category_id) return false;
      if (scope.kind === 'fav' && !i.favorite) return false;
      if (scope.kind === 'cat' && i.category_id !== scope.id) return false;
      if (type && i.type !== type) return false;
      if (aspect && aspectBucket(i.ratio) !== aspect) return false;
      if (color && !familiesOf(i.colors).has(color)) return false;
      if (tag && !i.tags.includes(tag)) return false;
      if (words.length) {
        const h = haystack(i);
        if (!words.every((w) => h.includes(w))) return false;
      }
      return true;
    });
    if (sort === 'old') list = list.slice().sort((a, b) => a.created_at.localeCompare(b.created_at));
    else if (sort === 'title') list = list.slice().sort((a, b) => titleOf(a).localeCompare(titleOf(b), 'ko'));
    else if (sort === 'shuffle') list = shuffleSeeded(list, shuffleSeed);
    else list = list.slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
    return list;
  }, [items, scope, query, type, aspect, color, tag, sort, shuffleSeed]);
}

export function useCounts() {
  const items = useStore((s) => s.items);
  return useMemo(() => {
    const byCat = new Map<string, number>();
    let inbox = 0;
    let fav = 0;
    for (const i of items) {
      if (i.category_id) byCat.set(i.category_id, (byCat.get(i.category_id) || 0) + 1);
      else inbox++;
      if (i.favorite) fav++;
    }
    return { all: items.length, inbox, fav, byCat };
  }, [items]);
}

export function useAllTags(): string[] {
  const items = useStore((s) => s.items);
  return useMemo(() => {
    const m = new Map<string, number>();
    for (const i of items) for (const t of i.tags) m.set(t, (m.get(t) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  }, [items]);
}
