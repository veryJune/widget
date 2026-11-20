// 저장 대기함(outbox): 아직 서버에 저장하지 못한 변경을 이 브라우저(IndexedDB)에 먼저 적어 둡니다.
// 오프라인이거나 저장 도중 탭이 닫혀도 다음에 열 때 이어서 저장할 수 있게 하기 위함.
// 서버 저장이 성공하면 지웁니다. (IndexedDB 를 못 쓰는 환경에서는 조용히 건너뜀)
import { openDB, type IDBPDatabase } from 'idb';
import type { Item, Project } from '../types';

let dbp: Promise<IDBPDatabase> | null = null;
function db() {
  if (!dbp) {
    dbp = openDB('moodgrid-outbox', 1, {
      upgrade(d) {
        d.createObjectStore('items', { keyPath: 'id' });
        d.createObjectStore('projects', { keyPath: 'id' });
      },
    });
  }
  return dbp;
}

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

export const outbox = {
  putItems: (userId: string, items: Item[]) =>
    safe(async () => {
      if (!items.length) return;
      const tx = (await db()).transaction('items', 'readwrite');
      for (const item of items) await tx.store.put({ id: item.id, user_id: userId, item });
      await tx.done;
    }, undefined),

  putProject: (userId: string, project: Project) => safe(async () => void (await (await db()).put('projects', { id: project.id, user_id: userId, project })), undefined),

  removeItems: (ids: string[]) =>
    safe(async () => {
      if (!ids.length) return;
      const tx = (await db()).transaction('items', 'readwrite');
      for (const id of ids) await tx.store.delete(id);
      await tx.done;
    }, undefined),

  removeProjects: (ids: string[]) =>
    safe(async () => {
      if (!ids.length) return;
      const tx = (await db()).transaction('projects', 'readwrite');
      for (const id of ids) await tx.store.delete(id);
      await tx.done;
    }, undefined),

  loadAll: (userId: string) =>
    safe(async () => {
      const d = await db();
      const items = ((await d.getAll('items')) as { user_id: string; item: Item }[]).filter((e) => e.user_id === userId).map((e) => e.item);
      const projects = ((await d.getAll('projects')) as { user_id: string; project: Project }[]).filter((e) => e.user_id === userId).map((e) => e.project);
      return { items, projects };
    }, { items: [] as Item[], projects: [] as Project[] }),
};
