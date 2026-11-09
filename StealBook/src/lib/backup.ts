// 백업 내보내기/불러오기, 체험 모드 데이터를 클라우드로 옮기기
import { backend } from './backend';
import { localDb } from './backend/local';
import type { Category, Item, MediaFile } from './types';

export interface BackupFile {
  app: 'stealbook';
  version: 1;
  exported_at: string;
  categories: Category[];
  items: Item[];
}

export function exportJson(categories: Category[], items: Item[]) {
  const data: BackupFile = { app: 'stealbook', version: 1, exported_at: new Date().toISOString(), categories, items };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `stealbook-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export async function importJson(file: File): Promise<{ categories: number; items: number }> {
  const data = JSON.parse(await file.text()) as BackupFile;
  if (data.app !== 'stealbook' || !Array.isArray(data.items)) throw new Error('Steal Book 백업 파일이 아닙니다.');
  for (const c of data.categories || []) await backend.saveCategory(c);
  for (const i of data.items) await backend.saveItem(i);
  return { categories: data.categories?.length || 0, items: data.items.length };
}

/** 체험 모드(이 기기)에 남아 있는 항목 수 */
export async function localLeftovers(): Promise<number> {
  if (backend.mode !== 'cloud') return 0;
  try {
    const db = await localDb();
    return await db.count('items');
  } catch {
    return 0;
  }
}

/** 체험 모드 데이터 → 클라우드 (파일 포함) */
export async function migrateLocalToCloud(onStep: (msg: string) => void): Promise<number> {
  const s = await backend.session();
  if (!s) throw new Error('로그인이 필요합니다.');
  const db = await localDb();
  const cats = (await db.getAll('categories')) as Category[];
  const items = (await db.getAll('items')) as Item[];
  for (const c of cats) await backend.saveCategory(c);

  const move = async (p: string | undefined, mime: string): Promise<string | undefined> => {
    if (!p) return p;
    const blob = (await db.get('files', p)) as Blob | undefined;
    if (!blob) return undefined;
    const next = p.replace(/^local\//, `${s.userId}/`);
    await backend.upload(next, blob, blob.type || mime);
    return next;
  };

  let n = 0;
  for (const it of items) {
    n++;
    onStep(`옮기는 중 ${n}/${items.length}`);
    const media: MediaFile[] = [];
    for (const m of it.media) {
      media.push({ ...m, path: (await move(m.path, m.mime)) || m.path, thumb: await move(m.thumb, 'image/webp'), strip: await move(m.strip, 'image/webp') });
    }
    const cover = it.cover && it.cover.startsWith('local/') ? it.cover.replace(/^local\//, `${s.userId}/`) : it.cover;
    await backend.saveItem({ ...it, media, cover });
  }
  // 옮긴 뒤 이 기기의 체험 데이터는 비웁니다
  const tx = db.transaction(['categories', 'items', 'files'], 'readwrite');
  await Promise.all([tx.objectStore('categories').clear(), tx.objectStore('items').clear(), tx.objectStore('files').clear()]);
  await tx.done;
  return items.length;
}
