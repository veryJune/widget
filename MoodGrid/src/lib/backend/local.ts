// 체험 모드 저장소: 이 브라우저(IndexedDB)에만 저장합니다. 로그인 없음, 동기화 없음.
import { openDB, type IDBPDatabase } from 'idb';
import type { Item, Project } from '../../types';
import type { Backend } from './types';

const LOCAL_USER = 'local';
let dbp: Promise<IDBPDatabase> | null = null;

function db() {
  if (!dbp) {
    dbp = openDB('moodgrid-v3', 1, {
      upgrade(d) {
        d.createObjectStore('projects', { keyPath: 'id' });
        const items = d.createObjectStore('items', { keyPath: 'id' });
        items.createIndex('project', 'project_id');
        d.createObjectStore('files');
      },
    });
  }
  return dbp;
}

const objectUrls = new Map<string, string>();

export function createLocalBackend(): Backend {
  return {
    mode: 'local',
    urlTtlMs: Number.POSITIVE_INFINITY,

    async session() {
      return { userId: LOCAL_USER };
    },
    async signIn() {
      return { userId: LOCAL_USER };
    },
    async signOut() {},
    async changePassword() {
      throw new Error('체험 모드에는 비밀번호가 없습니다.');
    },
    onAuth() {
      return () => {};
    },

    async fetchProjects() {
      return ((await (await db()).getAll('projects')) as Project[]).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    },
    async saveProject(p) {
      await (await db()).put('projects', { ...p, updated_at: new Date().toISOString() });
    },
    async deleteProject(id) {
      const d = await db();
      const tx = d.transaction(['projects', 'items'], 'readwrite');
      const keys = await tx.objectStore('items').index('project').getAllKeys(id);
      for (const k of keys) await tx.objectStore('items').delete(k);
      await tx.objectStore('projects').delete(id);
      await tx.done;
    },

    async fetchItems(projectId) {
      return (await (await db()).getAllFromIndex('items', 'project', projectId)) as Item[];
    },
    async saveItems(items) {
      const d = await db();
      const tx = d.transaction('items', 'readwrite');
      const now = new Date().toISOString();
      for (const i of items) await tx.store.put({ ...i, updated_at: now });
      await tx.done;
    },
    async deleteItems(ids) {
      const d = await db();
      const tx = d.transaction('items', 'readwrite');
      for (const id of ids) await tx.store.delete(id);
      await tx.done;
    },

    async upload(path, blob) {
      await (await db()).put('files', blob, path);
    },
    async remove(paths) {
      const d = await db();
      for (const p of paths) {
        await d.delete('files', p);
        const u = objectUrls.get(p);
        if (u) URL.revokeObjectURL(u);
        objectUrls.delete(p);
      }
    },
    async copy(from, to) {
      const d = await db();
      const blob = (await d.get('files', from)) as Blob | undefined;
      if (blob) await d.put('files', blob, to);
    },
    async signUrls(paths) {
      const d = await db();
      const out: Record<string, string> = {};
      for (const p of paths) {
        let u = objectUrls.get(p);
        if (!u) {
          const blob = (await d.get('files', p)) as Blob | undefined;
          if (!blob) continue;
          u = URL.createObjectURL(blob);
          objectUrls.set(p, u);
        }
        out[p] = u;
      }
      return out;
    },

    async accessToken() {
      return null;
    },
  };
}
