// 지금 화면에 보여줄 항목 (범위 · 검색 · 필터 · 정렬 적용)
import { useMemo } from 'react';
import type { Criteria } from '../lib/types';
import { shuffleSeeded } from '../lib/util';
import { useStore } from '../store';
import { titleOf } from '../lib/capture';
import { childrenMap } from '../lib/tree';
import { makeMatcher } from '../lib/filter';

export function useVisibleItems() {
  const { items, categories, collections, scope, query, type, color, tags, sort, shuffleSeed } = useStore();
  return useMemo(() => {
    let list;
    if (scope.kind === 'trash') {
      // 휴지통: 지운 순서(최근 먼저), 검색만 적용
      const m = makeMatcher({ query }, categories);
      list = items.filter((i) => i.deleted_at && m({ ...i, deleted_at: null })).sort((a, b) => (b.deleted_at || '').localeCompare(a.deleted_at || ''));
      return list;
    }
    const base: Criteria =
      scope.kind === 'smart'
        ? collections.find((c) => c.id === scope.id)?.criteria || {}
        : scope.kind === 'inbox'
          ? { inbox: true }
          : scope.kind === 'fav'
            ? { favorite: true }
            : scope.kind === 'cat'
              ? { categoryId: scope.id }
              : {};
    // 컬렉션 조건 위에 지금 고른 필터를 덧붙입니다 (검색어는 둘 다 만족)
    const scopeMatch = makeMatcher(base, categories);
    const viewMatch = makeMatcher({ query, type, color, tags }, categories);
    list = items.filter((i) => scopeMatch(i) && viewMatch(i));
    if (sort === 'old') list.sort((a, b) => a.created_at.localeCompare(b.created_at));
    else if (sort === 'title') list.sort((a, b) => titleOf(a).localeCompare(titleOf(b), 'ko'));
    else if (sort === 'shuffle') list = shuffleSeeded(list, shuffleSeed);
    else list.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return list;
  }, [items, categories, collections, scope, query, type, color, tags, sort, shuffleSeed]);
}

export function useCounts() {
  const items = useStore((s) => s.items);
  const categories = useStore((s) => s.categories);
  const collections = useStore((s) => s.collections);
  return useMemo(() => {
    const direct = new Map<string, number>();
    const known = new Set(categories.map((c) => c.id));
    let inbox = 0;
    let fav = 0;
    let all = 0;
    let trash = 0;
    for (const i of items) {
      if (i.deleted_at) {
        trash++;
        continue;
      }
      all++;
      if (i.category_id && known.has(i.category_id)) direct.set(i.category_id, (direct.get(i.category_id) || 0) + 1);
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
    const byCollection = new Map<string, number>();
    for (const c of collections) {
      const m = makeMatcher(c.criteria, categories);
      byCollection.set(c.id, items.reduce((n, i) => n + (m(i) ? 1 : 0), 0));
    }
    return { all, inbox, fav, trash, byCat, direct, byCollection };
  }, [items, categories, collections]);
}

/** 태그와 개수 (많이 쓴 순) */
export function useTagCounts(): [string, number][] {
  const items = useStore((s) => s.items);
  return useMemo(() => {
    const m = new Map<string, number>();
    for (const i of items) if (!i.deleted_at) for (const t of i.tags) m.set(t, (m.get(t) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'));
  }, [items]);
}

export function useAllTags(): string[] {
  const counts = useTagCounts();
  return useMemo(() => counts.map(([t]) => t), [counts]);
}
