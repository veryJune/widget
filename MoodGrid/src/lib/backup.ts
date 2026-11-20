// 프로젝트 백업(.zip): project.json + images/ 폴더. 이 파일 하나로 다른 계정·다른 환경에서도 복원할 수 있습니다.
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import type { Item, Project, Rating, SortMode, TextColor } from '../types';
import { TEXT_COLORS } from '../types';
import { clamp, fileExt, safeHttpUrl } from './util';

export interface BackupItem {
  id: string;
  type: Item['type'];
  content: string;
  title: string;
  color: TextColor;
  note: string;
  rating: Rating;
  pinned: boolean;
  collapsed: boolean;
  pos: number;
  colors: string[];
  created_at: string;
  w: number | null;
  h: number | null;
  file: string | null; // zip 안의 이미지 경로
}

export interface BackupData {
  app: 'moodgrid';
  version: 3;
  project: { title: string; cols: number; gap: number; sort_mode: SortMode };
  items: BackupItem[];
}

const MIME: Record<string, string> = { webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', avif: 'image/avif' };

/** 프로젝트 → zip. getBlob 은 항목의 원본 이미지 경로를 받아 파일 내용을 돌려줌 */
export async function buildBackup(project: Project, items: Item[], getBlob: (path: string) => Promise<Blob | null>, onProgress?: (done: number, total: number) => void): Promise<Uint8Array> {
  const files: Record<string, Uint8Array> = {};
  const out: BackupItem[] = [];
  const live = items.filter((i) => !i.deleted_at).sort((a, b) => a.pos - b.pos);
  let done = 0;
  for (const it of live) {
    let file: string | null = null;
    if (it.type === 'image' && it.path) {
      const blob = await getBlob(it.path);
      if (blob) {
        file = `images/${it.id}.${fileExt(it.path, blob.type)}`;
        files[file] = new Uint8Array(await blob.arrayBuffer());
      }
    }
    out.push({
      id: it.id, type: it.type, content: it.content, title: it.title, color: it.color, note: it.note, rating: it.rating,
      pinned: it.pinned, collapsed: it.collapsed, pos: it.pos, colors: it.colors, created_at: it.created_at, w: it.w, h: it.h, file,
    });
    onProgress?.(++done, live.length);
  }
  const data: BackupData = { app: 'moodgrid', version: 3, project: { title: project.title, cols: project.cols, gap: project.gap, sort_mode: project.sort_mode }, items: out };
  files['project.json'] = strToU8(JSON.stringify(data));
  // 이미지는 이미 압축돼 있으므로 zip 은 묶기만 (level 0)
  return zipSync(files, { level: 0 });
}

export interface ParsedBackup {
  data: BackupData;
  fileOf(item: BackupItem): File | null;
}

/** zip → 검증된 백업. 형식이 맞지 않으면 오류 */
export function parseBackup(bytes: Uint8Array): ParsedBackup {
  const files = unzipSync(bytes);
  const raw = files['project.json'];
  if (!raw) throw new Error('MoodGrid 백업 파일이 아닙니다.');
  const j = JSON.parse(strFromU8(raw)) as Partial<BackupData>;
  if (j.app !== 'moodgrid' || !Array.isArray(j.items) || !j.project) throw new Error('MoodGrid 백업 파일이 아닙니다.');
  const items: BackupItem[] = [];
  for (const r of j.items as unknown as Record<string, unknown>[]) {
    if (!r || typeof r !== 'object') continue;
    const type = r.type;
    if (type !== 'image' && type !== 'text' && type !== 'bookmark' && type !== 'divider') continue;
    let content = typeof r.content === 'string' ? r.content : '';
    if (type === 'bookmark') {
      const u = safeHttpUrl(content);
      if (!u) continue;
      content = u;
    }
    const file = typeof r.file === 'string' && /^images\/[\w.-]+$/.test(r.file) && files[r.file] ? r.file : null;
    if (type === 'image' && !file) continue;
    const rating = Number(r.rating);
    items.push({
      id: typeof r.id === 'string' ? r.id : '',
      type,
      content: content.slice(0, type === 'image' ? 2000 : 20000),
      title: typeof r.title === 'string' ? r.title.slice(0, 300) : '',
      color: TEXT_COLORS.includes(r.color as TextColor) ? (r.color as TextColor) : 'white',
      note: typeof r.note === 'string' ? r.note.slice(0, 20000) : '',
      rating: (Number.isInteger(rating) && rating >= 1 && rating <= 3 ? rating : 0) as Rating,
      pinned: r.pinned === true,
      collapsed: r.collapsed === true,
      pos: typeof r.pos === 'number' && Number.isFinite(r.pos) ? r.pos : items.length,
      colors: Array.isArray(r.colors) ? (r.colors as unknown[]).filter((c): c is string => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c)).slice(0, 5) : [],
      created_at: typeof r.created_at === 'string' && !isNaN(Date.parse(r.created_at)) ? r.created_at : new Date().toISOString(),
      w: typeof r.w === 'number' && r.w > 0 ? r.w : null,
      h: typeof r.h === 'number' && r.h > 0 ? r.h : null,
      file,
    });
  }
  const p = j.project as Partial<BackupData['project']>;
  const data: BackupData = {
    app: 'moodgrid',
    version: 3,
    project: {
      title: typeof p.title === 'string' && p.title.trim() ? p.title.trim().slice(0, 100) : '가져온 보드',
      cols: clamp(Number(p.cols) || 5, 2, 8),
      gap: clamp(Number.isFinite(Number(p.gap)) && p.gap !== undefined ? Number(p.gap) : 24, 0, 64),
      sort_mode: (['manual', 'newest', 'oldest', 'rating', 'color'] as SortMode[]).includes(p.sort_mode as SortMode) ? (p.sort_mode as SortMode) : 'manual',
    },
    items,
  };
  return {
    data,
    fileOf(item) {
      if (!item.file) return null;
      const ext = item.file.split('.').pop() || 'jpg';
      const type = MIME[ext];
      if (!type) return null;
      return new File([files[item.file] as BlobPart], `${item.id || 'image'}.${ext}`, { type });
    },
  };
}
