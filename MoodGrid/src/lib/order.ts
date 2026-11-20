// 보드 항목의 순서 · 보기 · 이동 계산 (화면과 무관한 순수 함수 모음)
//
// 순서는 각 항목의 pos(소수)로 저장합니다. 항목 하나를 옮겨도 그 항목의 pos 만 바뀌고,
// 이웃 사이에 넣을 틈이 너무 좁아졌을 때만 전체를 다시 번호 매깁니다.
// 필터·접힌 섹션 때문에 화면에 안 보이는 항목도 항상 '전체 목록' 기준으로 계산하므로 순서가 꼬이지 않습니다.
import type { Item, SortMode } from '../types';
import { hexToHsl, itemMatchesColor } from './colors';

export const byPos = (a: Item, b: Item) => a.pos - b.pos || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id);

/** 지워지지 않은 항목을 순서대로 */
export function liveSorted(items: Item[]): Item[] {
  return items.filter((i) => !i.deleted_at).sort(byPos);
}

// ---------- 보기(화면에 보이는 항목과 순서) ----------

/** 색 정렬 키: 색조 띠(20°) 안에서 밝은 것 → 어두운 것, 무채색은 뒤, 색 정보 없는 항목은 맨 뒤 */
export function colorKey(it: Item): number {
  const hex = it.colors[0];
  if (!hex) return 2000;
  const [h, s, l] = hexToHsl(hex);
  if (s < 0.12) return 1000 + (1 - l) * 9.99;
  return Math.floor(h / 20) * 10 + (1 - l) * 9.99;
}

export interface ViewOpts {
  sort: SortMode;
  minRating: number;
  /** 검색어: 공백으로 나눈 낱말이 모두 (메모 글 · 제목 · 출처 · 카드 메모) 안에 있어야 함 */
  query?: string;
  /** 대표 색이 이 색과 비슷한 항목만 */
  color?: string | null;
  /** 섹션을 무시하고 순서대로 쭉 (시네마틱 모드) */
  flat?: boolean;
}

export const queryTokens = (q: string | undefined): string[] => (q ?? '').toLowerCase().split(/\s+/).filter(Boolean);

export function matchesQuery(it: Item, tokens: string[]): boolean {
  if (!tokens.length) return true;
  const hay = `${it.content}\n${it.title}\n${it.note}`.toLowerCase();
  return tokens.every((t) => hay.includes(t));
}

/** 별점 · 검색 · 색 중 하나라도 걸려 있는지 */
export function isFiltering(o: Pick<ViewOpts, 'minRating' | 'query' | 'color'>): boolean {
  return o.minRating > 0 || queryTokens(o.query).length > 0 || !!o.color;
}

/** 화면에 그릴 항목들 (표시 순서대로) */
export function buildView(items: Item[], opts: ViewOpts): Item[] {
  const { sort, minRating, color, flat } = opts;
  const tokens = queryTokens(opts.query);
  const ordered = liveSorted(items);
  const keep = (i: Item) => i.type !== 'divider' && i.rating >= minRating && matchesQuery(i, tokens) && (!color || itemMatchesColor(i, color));
  if (sort === 'manual') {
    // 필터가 걸렸거나 flat 이면 섹션 없이 순서대로 쭉 (끌어서 옮기는 것은 전체 목록 기준이라 안전)
    if (flat || isFiltering(opts)) return ordered.filter(keep);
    const out: Item[] = [];
    let collapsed = false;
    for (const it of ordered) {
      if (it.type === 'divider') {
        collapsed = it.collapsed;
        out.push(it);
      } else if (!collapsed) out.push(it);
    }
    return out;
  }
  const list = ordered.filter(keep);
  const cmp: Record<Exclude<SortMode, 'manual'>, (a: Item, b: Item) => number> = {
    newest: (a, b) => b.created_at.localeCompare(a.created_at),
    oldest: (a, b) => a.created_at.localeCompare(b.created_at),
    rating: (a, b) => b.rating - a.rating || b.created_at.localeCompare(a.created_at),
    color: (a, b) => colorKey(a) - colorKey(b),
  };
  list.sort(cmp[sort]);
  // 고정한 항목은 어떤 정렬에서도 맨 앞 (sort 는 안정 정렬이라 나머지 순서는 유지)
  return [...list.filter((i) => i.pinned), ...list.filter((i) => !i.pinned)];
}

// ---------- 섹션 ----------

export interface Section {
  /** 구분선 항목 (맨 위 '분류 없음' 묶음은 null) */
  divider: Item | null;
  items: Item[];
}

export function sectionsOf(ordered: Item[]): Section[] {
  const out: Section[] = [{ divider: null, items: [] }];
  for (const it of ordered) {
    if (it.type === 'divider') out.push({ divider: it, items: [] });
    else out[out.length - 1].items.push(it);
  }
  return out;
}

/** 항목이 속한 구분선 id (맨 위 묶음이면 null) */
export function sectionIdOf(ordered: Item[], itemId: string): string | null {
  let cur: string | null = null;
  for (const it of ordered) {
    if (it.id === itemId) return cur;
    if (it.type === 'divider') cur = it.id;
  }
  return cur;
}

// ---------- 위치 계산 ----------

const MIN_GAP = 1e-6;
const STEP = 1024;

/** 두 위치(없을 수 있음) 사이에 k개를 넣을 pos 목록. 틈이 너무 좁으면 null */
function slotsBetween(prev: number | undefined, next: number | undefined, k: number): number[] | null {
  const out: number[] = [];
  if (prev == null && next == null) {
    for (let i = 0; i < k; i++) out.push((i + 1) * STEP);
  } else if (prev == null) {
    for (let i = 0; i < k; i++) out.push((next as number) - (k - i) * STEP);
  } else if (next == null) {
    for (let i = 0; i < k; i++) out.push(prev + (i + 1) * STEP);
  } else {
    const step = (next - prev) / (k + 1);
    if (step < MIN_GAP) return null;
    for (let i = 0; i < k; i++) out.push(prev + step * (i + 1));
  }
  return out;
}

/** 순서 목록 전체를 STEP 간격으로 다시 번호 매김 (바뀐 것만 돌려줌) */
function renumber(seq: Item[]): Map<string, number> {
  const out = new Map<string, number>();
  seq.forEach((it, idx) => {
    const pos = (idx + 1) * STEP;
    if (it.pos !== pos) out.set(it.id, pos);
  });
  return out;
}

/** seq(이미 원하는 최종 순서) 중 insertAt 부터 k개가 새로 넣은 항목일 때, 그 항목들의 pos 계산 */
function placeRun(rest: Item[], run: Item[], insertAt: number): Map<string, number> {
  const prev = insertAt > 0 ? rest[insertAt - 1].pos : undefined;
  const next = insertAt < rest.length ? rest[insertAt].pos : undefined;
  const slots = slotsBetween(prev, next, run.length);
  if (slots) {
    const out = new Map<string, number>();
    run.forEach((it, i) => {
      if (it.pos !== slots[i]) out.set(it.id, slots[i]);
    });
    return out;
  }
  const seq = [...rest.slice(0, insertAt), ...run, ...rest.slice(insertAt)];
  return renumber(seq);
}

export type MoveDest =
  | { kind: 'before'; id: string }
  | { kind: 'after'; id: string }
  /** 구분선 바로 아래(섹션 맨 위). id 가 null 이면 보드 맨 위 */
  | { kind: 'sectionTop'; id: string | null }
  | { kind: 'end' };

/**
 * 여러 항목을 목적지로 옮길 때 바뀌어야 할 pos 들.
 * 구분선은 이 함수로 옮기지 않습니다(moveSection 사용). 움직일 게 없으면 빈 Map.
 */
export function planMove(all: Item[], movingIds: Iterable<string>, dest: MoveDest): Map<string, number> {
  const ordered = liveSorted(all);
  const set = new Set(movingIds);
  const moving = ordered.filter((i) => set.has(i.id) && i.type !== 'divider');
  if (!moving.length) return new Map();
  const movingSet = new Set(moving.map((m) => m.id));
  const rest = ordered.filter((i) => !movingSet.has(i.id));

  let at: number;
  if (dest.kind === 'end') at = rest.length;
  else if (dest.kind === 'sectionTop') {
    if (dest.id == null) at = 0;
    else {
      const d = rest.findIndex((i) => i.id === dest.id);
      if (d < 0) return new Map();
      at = d + 1;
    }
  } else {
    const t = rest.findIndex((i) => i.id === dest.id);
    if (t < 0) return new Map(); // 자기 자신 위에 놓음
    at = dest.kind === 'before' ? t : t + 1;
  }

  // 이미 그 자리면 아무것도 안 함
  const seq = [...rest.slice(0, at), ...moving, ...rest.slice(at)];
  if (seq.every((it, i) => it.id === ordered[i].id)) return new Map();
  return placeRun(rest, moving, at);
}

/** 새 항목을 넣을 위치: 보드에 섹션이 있으면 맨 위 묶음의 끝, 없으면 맨 끝 (예전 MoodGrid 와 같은 동작) */
export function posForNew(all: Item[], kind: 'item' | 'divider'): { pos: number; renumbered: Map<string, number> } {
  const ordered = liveSorted(all);
  const firstDivider = ordered.findIndex((i) => i.type === 'divider');
  const at = kind === 'item' && firstDivider >= 0 ? firstDivider : ordered.length;
  const prev = at > 0 ? ordered[at - 1].pos : undefined;
  const next = at < ordered.length ? ordered[at].pos : undefined;
  const slot = slotsBetween(prev, next, 1);
  if (slot) return { pos: slot[0], renumbered: new Map() };
  const placeholder = { id: '__new__', pos: 0 } as Item;
  const seq = [...ordered.slice(0, at), placeholder, ...ordered.slice(at)];
  const all2 = renumber(seq);
  const pos = all2.get('__new__') ?? (at + 1) * STEP;
  all2.delete('__new__');
  return { pos, renumbered: all2 };
}

/** 구분선(섹션 통째로)을 위(-1) / 아래(+1)로 한 칸. 맨 위 묶음(분류 없음)은 움직일 수 없음 */
export function moveSection(all: Item[], dividerId: string, dir: -1 | 1): Map<string, number> {
  const ordered = liveSorted(all);
  const secs = sectionsOf(ordered);
  const idx = secs.findIndex((s) => s.divider?.id === dividerId);
  const other = idx + dir;
  if (idx < 1 || other < 1 || other >= secs.length) return new Map();
  const a = Math.min(idx, other);
  const b = Math.max(idx, other);
  const blockA = [secs[a].divider as Item, ...secs[a].items];
  const blockB = [secs[b].divider as Item, ...secs[b].items];
  // 두 섹션이 쓰던 pos 값 자리를 그대로 재사용: 새 순서(B 다음 A)대로 작은 값부터 배정
  const pool = [...blockA, ...blockB].map((i) => i.pos).sort((x, y) => x - y);
  const next = [...blockB, ...blockA];
  const out = new Map<string, number>();
  next.forEach((it, i) => {
    if (it.pos !== pool[i]) out.set(it.id, pool[i]);
  });
  return out;
}

/** 화면 순서(view)에서 a~b 구간의 id (Shift 클릭 범위 선택용) */
export function rangeIds(view: Item[], a: string, b: string): string[] {
  const ia = view.findIndex((i) => i.id === a);
  const ib = view.findIndex((i) => i.id === b);
  if (ia < 0 || ib < 0) return [b];
  const [lo, hi] = ia < ib ? [ia, ib] : [ib, ia];
  return view.slice(lo, hi + 1).filter((i) => i.type !== 'divider').map((i) => i.id);
}
