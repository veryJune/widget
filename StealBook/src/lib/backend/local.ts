// 체험 모드 저장소: 이 기기 브라우저(IndexedDB)에만 저장합니다. 로그인 없음, 동기화 없음.
import { openDB, type IDBPDatabase } from 'idb';
import type { Category, Collection, Item } from '../types';
import type { Backend } from './types';

const LOCAL_USER = 'local';
let dbp: Promise<IDBPDatabase> | null = null;

export function localDb() {
  if (!dbp) {
    dbp = openDB('stealbook', 2, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('categories', { keyPath: 'id' });
          db.createObjectStore('items', { keyPath: 'id' });
          db.createObjectStore('files');
        }
        if (oldVersion < 2) db.createObjectStore('collections', { keyPath: 'id' });
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

    async fetchAll() {
      const db = await localDb();
      const categories = ((await db.getAll('categories')) as Category[]).sort((a, b) => a.sort - b.sort);
      const items = ((await db.getAll('items')) as Item[]).sort((a, b) => b.created_at.localeCompare(a.created_at));
      const collections = ((await db.getAll('collections')) as Collection[]).sort((a, b) => a.sort - b.sort);
      return { categories, items, collections };
    },

    async saveCollection(c) {
      await (await localDb()).put('collections', c);
    },

    async deleteCollection(id) {
      await (await localDb()).delete('collections', id);
    },

    async saveCategory(c) {
      await (await localDb()).put('categories', c);
    },

    async deleteCategory(id) {
      const db = await localDb();
      const tx = db.transaction(['categories', 'items'], 'readwrite');
      await tx.objectStore('categories').delete(id);
      // 서버의 'on delete set null' 과 똑같이: 그 카테고리 항목은 미분류로
      const items = (await tx.objectStore('items').getAll()) as Item[];
      for (const it of items) if (it.category_id === id) await tx.objectStore('items').put({ ...it, category_id: null });
      await tx.done;
    },

    async saveItem(i) {
      await (await localDb()).put('items', { ...i, updated_at: new Date().toISOString() });
    },

    async deleteItem(id) {
      await (await localDb()).delete('items', id);
    },

    async upload(path, blob, _type, onProgress) {
      await (await localDb()).put('files', blob, path);
      onProgress?.(1);
    },

    async remove(paths) {
      const db = await localDb();
      for (const p of paths) {
        await db.delete('files', p);
        const u = objectUrls.get(p);
        if (u) URL.revokeObjectURL(u);
        objectUrls.delete(p);
      }
    },

    async signUrls(paths) {
      const db = await localDb();
      const out: Record<string, string> = {};
      for (const p of paths) {
        let u = objectUrls.get(p);
        if (!u) {
          const blob = (await db.get('files', p)) as Blob | undefined;
          if (!blob) continue;
          u = URL.createObjectURL(blob);
          objectUrls.set(p, u);
        }
        out[p] = u;
      }
      return out;
    },

    subscribe() {
      return () => {};
    },

    async accessToken() {
      return null;
    },
  };
}
