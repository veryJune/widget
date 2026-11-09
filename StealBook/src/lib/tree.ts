// 카테고리 계층(트리) 도우미
// 데이터는 각 카테고리의 parent_id 하나로만 표현합니다. 깊이 제한은 없지만 화면은 3단계 정도까지가 편합니다.
import type { Category } from './types';

export interface FlatCat {
  cat: Category;
  depth: number;
  hasChildren: boolean;
}

const bySort = (a: Category, b: Category) => a.sort - b.sort || a.created_at.localeCompare(b.created_at);

/** 상위 → 하위 목록 (상위가 없어진 카테고리는 맨 위로 취급) */
export function childrenMap(cats: Category[]): Map<string | null, Category[]> {
  const ids = new Set(cats.map((c) => c.id));
  const m = new Map<string | null, Category[]>();
  for (const c of cats) {
    const p = c.parent_id && ids.has(c.parent_id) && c.parent_id !== c.id ? c.parent_id : null;
    if (!m.has(p)) m.set(p, []);
    m.get(p)!.push(c);
  }
  for (const list of m.values()) list.sort(bySort);
  return m;
}

/** 화면 표시 순서대로 펼친 목록. collapsed 에 든 카테고리의 하위는 숨김 */
export function flatten(cats: Category[], collapsed?: Set<string>): FlatCat[] {
  const m = childrenMap(cats);
  const out: FlatCat[] = [];
  const seen = new Set<string>();
  const walk = (parent: string | null, depth: number) => {
    for (const c of m.get(parent) || []) {
      if (seen.has(c.id)) continue; // 순환 방지
      seen.add(c.id);
      const kids = m.get(c.id) || [];
      out.push({ cat: c, depth, hasChildren: kids.length > 0 });
      if (!collapsed?.has(c.id)) walk(c.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

/** 자신 + 모든 하위 카테고리 id */
export function descendants(cats: Category[], id: string): Set<string> {
  const m = childrenMap(cats);
  const out = new Set<string>([id]);
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const c of m.get(cur) || []) {
      if (!out.has(c.id)) {
        out.add(c.id);
        stack.push(c.id);
      }
    }
  }
  return out;
}

/** 맨 위부터 자신까지의 경로 */
export function ancestors(cats: Category[], id: string): Category[] {
  const byId = new Map(cats.map((c) => [c.id, c]));
  const path: Category[] = [];
  let cur = byId.get(id);
  const guard = new Set<string>();
  while (cur && !guard.has(cur.id)) {
    guard.add(cur.id);
    path.unshift(cur);
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
  }
  return path;
}

export function pathLabel(cats: Category[], id: string | null, sep = ' › '): string {
  if (!id) return '인박스';
  return ancestors(cats, id).map((c) => c.name).join(sep) || '인박스';
}

/** 다른 카테고리 아래로 옮길 수 있는지 (자기 자신·자기 하위로는 못 옮김) */
export function canMoveUnder(cats: Category[], id: string, parentId: string | null): boolean {
  if (!parentId) return true;
  return !descendants(cats, id).has(parentId);
}

export function siblingsOf(cats: Category[], parentId: string | null): Category[] {
  return childrenMap(cats).get(parentId) || [];
}
