// 출처(사이트) · 기간 · 검색창 문법
//
// 검색창에 이렇게 쓸 수 있습니다 (섞어 써도 됨)
//   네온 야간          → 두 낱말이 모두 들어간 것
//   "정확한 문구"       → 문구 그대로
//   -야간              → 이 낱말이 없는 것
//   #네온  -#야간       → 태그가 있는 것 / 없는 것
//   출처:youtube       → 가져온 사이트 (site: 도 됨)
//   종류:영상          → 이미지·영상·임베드·링크·메모·파일·페이지 (type: 도 됨)
//   기간:30일          → 7일 · 30일 · 1년 · 작년 (date: 도 됨)
//   색:빨강            → 대표 색 (color: 도 됨)
//   즐겨찾기            → 즐겨찾기만 (is:fav 도 됨)
import { FAMILIES } from './colors';
import type { Item, ItemType } from './types';

// ---------------- 출처 ----------------

export interface Source {
  id: string;
  label: string;
}

const KNOWN: [RegExp, string, string][] = [
  [/(^|\.)(youtube\.com|youtu\.be|youtube-nocookie\.com)$/, 'youtube', 'YouTube'],
  [/(^|\.)instagram\.com$/, 'instagram', 'Instagram'],
  [/(^|\.)(pinterest\.[a-z.]+|pin\.it)$/, 'pinterest', 'Pinterest'],
  [/(^|\.)vimeo\.com$/, 'vimeo', 'Vimeo'],
  [/(^|\.)tiktok\.com$/, 'tiktok', 'TikTok'],
  [/(^|\.)(x\.com|twitter\.com)$/, 'x', 'X'],
  [/(^|\.)behance\.net$/, 'behance', 'Behance'],
  [/(^|\.)dribbble\.com$/, 'dribbble', 'Dribbble'],
  [/(^|\.)(spotify\.com)$/, 'spotify', 'Spotify'],
  [/(^|\.)(naver\.com|naver\.me)$/, 'naver', '네이버'],
  [/(^|\.)(threads\.net|threads\.com)$/, 'threads', 'Threads'],
  [/(^|\.)artstation\.com$/, 'artstation', 'ArtStation'],
  [/(^|\.)are\.na$/, 'arena', 'Are.na'],
];

export const LOCAL_SOURCE: Source = { id: 'local', label: '직접 올림' };

/** 주소 → 출처 (모르는 사이트는 도메인 그대로) */
export function sourceOfUrl(url: string): Source {
  if (!url) return LOCAL_SOURCE;
  let host = '';
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^(www|m|mobile)\./, '');
  } catch {
    return LOCAL_SOURCE;
  }
  for (const [re, id, label] of KNOWN) if (re.test(host)) return { id, label };
  // 마지막 두 마디 (co.kr 처럼 짧은 2단 도메인은 세 마디)
  const parts = host.split('.');
  const n = parts.length >= 3 && /^(co|or|go|ac|ne|com|net|org)$/.test(parts[parts.length - 2]) ? 3 : 2;
  const d = parts.slice(-n).join('.');
  return { id: d, label: d };
}

export const sourceOf = (i: Item): Source => sourceOfUrl(i.url);

export function sourceLabel(id: string): string {
  if (id === LOCAL_SOURCE.id) return LOCAL_SOURCE.label;
  return KNOWN.find(([, k]) => k === id)?.[2] || id;
}

/** 검색창에 쓴 말 → 출처 id (유튜브 → youtube) */
export function sourceIdFrom(word: string): string {
  const w = word.toLowerCase().replace(/^www\./, '');
  const alias: Record<string, string> = {
    유튜브: 'youtube', yt: 'youtube', 인스타: 'instagram', 인스타그램: 'instagram', ig: 'instagram', 핀터레스트: 'pinterest', 핀터: 'pinterest',
    비메오: 'vimeo', 틱톡: 'tiktok', 트위터: 'x', twitter: 'x', 비핸스: 'behance', 드리블: 'dribbble', 네이버: 'naver', 스레드: 'threads',
    직접: 'local', 업로드: 'local', 직접올림: 'local',
  };
  if (alias[w]) return alias[w];
  if (w.includes('.')) return sourceOfUrl('https://' + w).id;
  return w;
}

// ---------------- 기간 ----------------

export type Period = 'week' | 'month' | 'year' | 'yearAgo';

export const PERIODS: { id: Period; label: string; hint: string }[] = [
  { id: 'week', label: '최근 7일', hint: '7일' },
  { id: 'month', label: '최근 30일', hint: '30일' },
  { id: 'year', label: '최근 1년', hint: '1년' },
  { id: 'yearAgo', label: '1년 전 이맘때', hint: '작년' },
];

const DAY = 86_400_000;

export function inPeriod(createdAt: string, p: Period, now = Date.now()): boolean {
  const age = (now - Date.parse(createdAt)) / DAY;
  if (p === 'week') return age <= 7;
  if (p === 'month') return age <= 30;
  if (p === 'year') return age <= 365;
  // 1년 전 이맘때: 1년, 2년, 3년 … 전 오늘 앞뒤 7일
  if (age < 358) return false;
  const r = age % 365.25;
  return r <= 7 || r >= 358.25;
}

function periodFrom(word: string): Period | null {
  const w = word.toLowerCase();
  if (/^(7일|1주|일주일|week|7d|이번주)$/.test(w)) return 'week';
  if (/^(30일|1달|한달|month|30d|이번달)$/.test(w)) return 'month';
  if (/^(1년|일년|year|365일|1y|올해)$/.test(w)) return 'year';
  if (/^(작년|1년전|yearago|이맘때)$/.test(w)) return 'yearAgo';
  return null;
}

// ---------------- 검색창 문법 ----------------

const TYPE_WORDS: Record<string, ItemType> = {
  이미지: 'image', 사진: 'image', image: 'image', img: 'image',
  영상: 'video', 비디오: 'video', video: 'video',
  임베드: 'embed', embed: 'embed',
  링크: 'link', link: 'link',
  메모: 'note', 글: 'note', note: 'note',
  파일: 'file', file: 'file',
  페이지: 'page', page: 'page', html: 'page',
};

export interface ParsedQuery {
  words: string[];
  notWords: string[];
  tags: string[];
  notTags: string[];
  sources: string[];
  type: ItemType | null;
  period: Period | null;
  color: string | null;
  fav: boolean;
  /** 문법을 하나라도 썼는지 (도움말 표시용) */
  structured: boolean;
}

const cache = new Map<string, ParsedQuery>();

export function parseQuery(raw: string): ParsedQuery {
  const hit = cache.get(raw);
  if (hit) return hit;
  const q: ParsedQuery = { words: [], notWords: [], tags: [], notTags: [], sources: [], type: null, period: null, color: null, fav: false, structured: false };
  const tokens = raw.match(/-?"[^"]*"?|\S+/g) || [];
  for (let t of tokens) {
    let neg = false;
    if (t.length > 1 && t.startsWith('-')) {
      neg = true;
      t = t.slice(1);
    }
    if (t.startsWith('"')) {
      const phrase = t.replace(/^"|"$/g, '').trim().toLowerCase();
      if (phrase) (neg ? q.notWords : q.words).push(phrase);
      continue;
    }
    if (t.startsWith('#') && t.length > 1) {
      (neg ? q.notTags : q.tags).push(t.slice(1));
      q.structured = true;
      continue;
    }
    const kv = t.match(/^([^:]+):(.+)$/);
    if (kv && !/^https?$/i.test(kv[1])) {
      const key = kv[1].toLowerCase();
      const val = kv[2];
      if (['출처', 'site', 'source', '사이트'].includes(key)) {
        q.sources.push(sourceIdFrom(val));
        q.structured = true;
        continue;
      }
      if (['종류', 'type', '타입'].includes(key) && TYPE_WORDS[val.toLowerCase()]) {
        q.type = TYPE_WORDS[val.toLowerCase()];
        q.structured = true;
        continue;
      }
      if (['기간', 'date', '날짜', '언제'].includes(key) && periodFrom(val)) {
        q.period = periodFrom(val);
        q.structured = true;
        continue;
      }
      if (['색', 'color', '컬러'].includes(key)) {
        const f = FAMILIES.find((x) => x.label === val || x.id === val.toLowerCase());
        if (f) {
          q.color = f.id;
          q.structured = true;
          continue;
        }
      }
      if (key === 'is' && /^(fav|favorite|즐겨찾기)$/i.test(val)) {
        q.fav = true;
        q.structured = true;
        continue;
      }
    }
    if (!neg && /^(즐겨찾기|★)$/.test(t)) {
      q.fav = true;
      q.structured = true;
      continue;
    }
    (neg ? q.notWords : q.words).push(t.toLowerCase());
  }
  if (cache.size > 200) cache.clear();
  cache.set(raw, q);
  return q;
}

/** 검색 도움말에 보여줄 예시 */
export const QUERY_EXAMPLES: { token: string; note: string }[] = [
  { token: '#태그', note: '태그가 있는 것' },
  { token: '-#태그', note: '태그가 없는 것' },
  { token: '출처:youtube', note: '가져온 사이트' },
  { token: '종류:영상', note: '이미지·영상·링크·메모…' },
  { token: '기간:30일', note: '7일 · 30일 · 1년 · 작년' },
  { token: '색:빨강', note: '대표 색' },
  { token: '즐겨찾기', note: '즐겨찾기만' },
  { token: '-낱말', note: '이 낱말 빼고' },
  { token: '"정확한 문구"', note: '문구 그대로' },
];
