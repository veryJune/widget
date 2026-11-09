// 항목 거르기 규칙 한곳에: 화면 필터, 스마트 컬렉션, 개수 세기가 모두 이 함수를 씁니다.
import { familiesOf, FAMILIES } from './colors';
import { descendants } from './tree';
import type { Category, Criteria, Item, Scope } from './types';
import { ASPECTS, aspectBucket } from './util';

export function haystack(i: Item): string {
  return [i.title, i.body, i.why, i.url, i.tags.join(' '), i.link?.title, i.link?.site, i.link?.description, ...i.media.map((m) => m.name)]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/** 조건 하나를 미리 준비해 두고 여러 항목에 빠르게 적용 */
export function makeMatcher(c: Criteria, categories: Category[]): (i: Item) => boolean {
  const inCat = c.categoryId ? descendants(categories, c.categoryId) : null;
  const words = (c.query || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  return (i) => {
    if (i.deleted_at) return false;
    if (c.inbox && i.category_id) return false;
    if (c.favorite && !i.favorite) return false;
    if (inCat && !(i.category_id && inCat.has(i.category_id))) return false;
    if (c.type && i.type !== c.type) return false;
    if (c.aspect && aspectBucket(i.ratio) !== c.aspect) return false;
    if (c.color && !familiesOf(i.colors).has(c.color)) return false;
    if (c.tag && !i.tags.includes(c.tag)) return false;
    if (words.length) {
      const h = haystack(i);
      if (!words.every((w) => h.includes(w))) return false;
    }
    return true;
  };
}

/** 지금 화면의 범위 + 필터 → 조건 (스마트 컬렉션으로 저장할 때) */
export function criteriaFromView(scope: Scope, f: { query: string; type: Criteria['type']; aspect: Criteria['aspect']; color: string | null; tag: string | null }, base?: Criteria): Criteria {
  const c: Criteria = { ...(base || {}) };
  if (scope.kind === 'inbox') c.inbox = true;
  if (scope.kind === 'fav') c.favorite = true;
  if (scope.kind === 'cat') c.categoryId = scope.id;
  if (f.query.trim()) c.query = f.query.trim();
  if (f.type) c.type = f.type;
  if (f.aspect) c.aspect = f.aspect;
  if (f.color) c.color = f.color;
  if (f.tag) c.tag = f.tag;
  return c;
}

export function isEmptyCriteria(c: Criteria): boolean {
  return !c.categoryId && !c.inbox && !c.favorite && !c.query && !c.type && !c.aspect && !c.color && !c.tag;
}

const TYPE_LABEL: Record<string, string> = { image: '이미지', video: '영상', embed: '임베드', link: '링크', note: '메모', file: '파일' };

/** 조건을 사람이 읽는 짧은 이름으로 (컬렉션 기본 이름) */
export function describeCriteria(c: Criteria, categories: Category[]): string {
  const parts: string[] = [];
  if (c.inbox) parts.push('인박스');
  if (c.favorite) parts.push('즐겨찾기');
  if (c.categoryId) parts.push(categories.find((x) => x.id === c.categoryId)?.name || '카테고리');
  if (c.type) parts.push(TYPE_LABEL[c.type] || c.type);
  if (c.aspect) parts.push(ASPECTS.find((a) => a.id === c.aspect)?.label || c.aspect);
  if (c.color) parts.push(FAMILIES.find((f) => f.id === c.color)?.label || c.color);
  if (c.tag) parts.push('#' + c.tag);
  if (c.query) parts.push(`검색 ${c.query}`);
  return parts.join(' + ') || '새 모음';
}

/** 같은 링크인지 비교하기 위한 정리 (추적용 파라미터·www·끝 슬래시 제거) */
export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    u.hash = '';
    for (const k of [...u.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|igsh|igshid|si$|feature$|ref$|ref_src$|s$|t$)/i.test(k)) u.searchParams.delete(k);
    }
    const host = u.hostname.replace(/^(www|m)\./, '').toLowerCase();
    const path = u.pathname.replace(/\/+$/, '');
    const q = u.searchParams.toString();
    return `${host}${path}${q ? '?' + q : ''}`;
  } catch {
    return raw.trim().toLowerCase();
  }
}

export const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i;

/** 주소만 보고 이미지 파일인지 (…/poster.png?v=1 처럼 뒤에 붙은 것도 인정) */
export function looksLikeImageUrl(raw: string): boolean {
  try {
    return IMAGE_EXT.test(new URL(raw.trim()).pathname);
  } catch {
    return false;
  }
}
