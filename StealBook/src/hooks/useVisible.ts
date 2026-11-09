// 지금 화면에 보여줄 항목 (범위 · 검색 · 필터 · 정렬 적용)
import { useMemo } from 'react';
import { familiesOf } from '../lib/colors';
import type { Item } from '../lib/types';
import { aspectBucket, shuffleSeeded } from '../lib/util';
import { useStore } from '../store';
import { titleOf } from '../lib/capture';
import { childrenMap, descendants } from '../lib/tree';

function haystack(i: Item): string {
  return [i.title, i.body, i.why, i.url, i.tags.join(' '), i.link?.title, i.link?.site, i.link?.description, ...i.media.map((m) => m.name)]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function useVisibleItems(): Item[] {
  const { items, categories, scope, query, type, aspect, color, tag, sort, shuffleSeed } = useStore();
  return useMemo(() => {
    const q = query.trim().toLowerCase();
    // 상위 카테고리를 보면 하위 카테고리 항목까지 함께 보입니다
    const inScope = scope.kind === 'cat' ? descendants(categories, scope.id) : null;
    const words = q ? q.split(/\s+/) : [];
    let list = items.filter((i) => {
      if (scope.kind === 'inbox' && i.category_id) return false;
      if (scope.kind === 'fav' && !i.favorite) return false;
      if (inScope && !(i.category_id && inScope.has(i.category_id))) return false;
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
  }, [items, categories, scope, query, type, aspect, color, tag, sort, shuffleSeed]);
}

export function useCounts() {
  const items = useStore((s) => s.items);
  const categories = useStore((s) => s.categories);
  return useMemo(() => {
    const direct = new Map<string, number>();
    let inbox = 0;
    let fav = 0;
    for (const i of items) {
      if (i.category_id) direct.set(i.category_id, (direct.get(i.category_id) || 0) + 1);
      else inbox++;
      if (i.favorite) fav++;
    }
    // byCat: 하위 카테고리 항목까지 합친 개수
    const kids = childrenMap(categories);
    const byCat = new Map<string, number>();
    const total = (id: string, seen: Set<string>): number => {
      if (byCat.has(id)) return byCat.get(id)!;
      if (seen.has(id)) return 0;
      seen.add(id);
      const n = (direct.get(id) || 0) + (kids.get(id) || []).reduce((sum, c) => sum + total(c.id, seen), 0);
      byCat.set(id, n);
      return n;
    };
    for (const c of categories) total(c.id, new Set());
    return { all: items.length, inbox, fav, byCat, direct };
  }, [items, categories]);
}

export function useAllTags(): string[] {
  const items = useStore((s) => s.items);
  return useMemo(() => {
    const m = new Map<string, number>();
    for (const i of items) for (const t of i.tags) m.set(t, (m.get(t) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  }, [items]);
}
