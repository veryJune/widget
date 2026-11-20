// 예전 MoodGrid(HTML 버전) 데이터 가져오기
//  - 이 브라우저에 남아 있는 예전 보드 (IndexedDB 'MoodGridDB_v12')
//  - 예전 .json 파일
// 불러오는 데이터는 믿지 않고 항목마다 검사해서 쓸 수 있는 것만 남깁니다.
import { openDB } from 'idb';
import type { ItemType, Rating, TextColor } from '../types';
import { TEXT_COLORS } from '../types';
import { safeHttpUrl } from './util';

export interface LegacyItem {
  type: ItemType;
  content: string; // image: data:/http 주소, bookmark: 주소, text: 글, divider: 이름
  note: string;
  rating: Rating;
  pinned: boolean;
  color: TextColor;
  collapsed: boolean;
  w: number | null;
  h: number | null;
  order: number;
  timestamp: number;
}

export interface LegacyBoard {
  title: string;
  items: LegacyItem[];
  skipped: number;
}

const TYPES: ItemType[] = ['image', 'text', 'bookmark', 'divider'];
const DB_NAME = 'MoodGridDB_v12';

export function sanitizeLegacyItem(raw: unknown, index: number): LegacyItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!TYPES.includes(r.type as ItemType) || typeof r.content !== 'string') return null;
  const m = (r.meta && typeof r.meta === 'object' ? r.meta : {}) as Record<string, unknown>;
  const type = r.type as ItemType;
  let content = r.content;
  let w: number | null = null;
  let h: number | null = null;
  let color: TextColor = 'white';

  if (type === 'image') {
    if (!(content.startsWith('data:image/') || safeHttpUrl(content))) return null;
    if (typeof m.width === 'number' && typeof m.height === 'number' && m.width > 0 && m.height > 0) {
      w = m.width;
      h = m.height;
    }
  } else if (type === 'bookmark') {
    const u = safeHttpUrl(content);
    if (!u) return null;
    content = u;
  } else if (type === 'text') {
    content = content.slice(0, 20000);
    color = TEXT_COLORS.includes(m.color as TextColor) ? (m.color as TextColor) : 'white';
  } else {
    content = content.slice(0, 200);
  }
  const rating = Number(m.rating);
  return {
    type,
    content,
    note: type !== 'divider' && typeof m.note === 'string' ? m.note.slice(0, 20000) : '',
    rating: (type !== 'divider' && Number.isInteger(rating) && rating >= 1 && rating <= 3 ? rating : 0) as Rating,
    pinned: type !== 'divider' && m.pinned === true,
    color,
    collapsed: type === 'divider' && m.collapsed === true,
    w,
    h,
    order: typeof r.order === 'number' && Number.isFinite(r.order) ? r.order : index,
    timestamp: typeof r.timestamp === 'number' && Number.isFinite(r.timestamp) ? r.timestamp : Date.now(),
  };
}

function toBoard(title: unknown, rawItems: unknown[]): LegacyBoard {
  const items = rawItems.map(sanitizeLegacyItem).filter((x): x is LegacyItem => !!x).sort((a, b) => a.order - b.order);
  return {
    title: typeof title === 'string' && title.trim() ? title.trim().slice(0, 100) : '가져온 보드',
    items,
    skipped: rawItems.length - items.length,
  };
}

/** 예전 .json 파일 내용 → 보드. 형식이 맞지 않으면 오류 */
export function parseLegacyJson(text: string): LegacyBoard {
  const data = JSON.parse(text) as unknown;
  const rawItems = Array.isArray(data) ? data : (data as { items?: unknown })?.items;
  if (!Array.isArray(rawItems)) throw new Error('항목 목록이 없는 파일입니다.');
  const board = toBoard((data as { title?: unknown })?.title, rawItems);
  if (rawItems.length > 0 && board.items.length === 0) throw new Error('읽을 수 있는 항목이 없습니다.');
  return board;
}

async function legacyDbExists(): Promise<boolean> {
  try {
    const dbs = await indexedDB.databases?.();
    return !!dbs?.some((d) => d.name === DB_NAME);
  } catch {
    return false;
  }
}

async function readRaw(): Promise<unknown[]> {
  if (!(await legacyDbExists())) return [];
  const db = await openDB(DB_NAME);
  try {
    if (!db.objectStoreNames.contains('items')) return [];
    return (await db.getAll('items')) as unknown[];
  } finally {
    db.close();
  }
}

function legacyTitle(): string {
  try {
    return localStorage.getItem('projectTitle') || '';
  } catch {
    return '';
  }
}

/** 이 브라우저에 예전 보드가 있으면 개수와 제목 (없으면 null). 이미지 데이터는 읽지 않도록 개수만 */
export async function detectLegacyBoard(): Promise<{ count: number; title: string } | null> {
  try {
    if (!(await legacyDbExists())) return null;
    const db = await openDB(DB_NAME);
    try {
      if (!db.objectStoreNames.contains('items')) return null;
      const count = await db.count('items');
      return count > 0 ? { count, title: legacyTitle() || '예전 보드' } : null;
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

export async function readLegacyBoard(): Promise<LegacyBoard> {
  return toBoard(legacyTitle(), await readRaw());
}
