import type { Category, Collection, Item } from '../types';

export interface ChangeHandlers {
  onItem(item: Item): void;
  onItemDelete(id: string): void;
  onCategory(cat: Category): void;
  onCategoryDelete(id: string): void;
  onCollection(c: Collection): void;
  onCollectionDelete(id: string): void;
}

export interface Session {
  userId: string;
  email?: string;
}

/**
 * 저장소 교체 지점.
 *  - cloud: Supabase (여러 기기 동기화)
 *  - local: 이 기기 브라우저(IndexedDB)에만 저장하는 체험 모드
 * 나중에 파일 저장을 Cloudflare R2 등으로 옮길 때도 upload/remove/signUrls 만 바꾸면 됩니다.
 */
export interface Backend {
  mode: 'cloud' | 'local';
  session(): Promise<Session | null>;
  signIn(email: string, password: string): Promise<Session>;
  signOut(): Promise<void>;
  changePassword(password: string): Promise<void>;
  onAuth(cb: (s: Session | null) => void): () => void;

  fetchAll(): Promise<{ categories: Category[]; items: Item[]; collections: Collection[] }>;
  saveCategory(c: Category): Promise<void>;
  deleteCategory(id: string): Promise<void>;
  saveCollection(c: Collection): Promise<void>;
  deleteCollection(id: string): Promise<void>;
  saveItem(i: Item): Promise<void>;
  deleteItem(id: string): Promise<void>;

  /** 파일 경로 규칙: {userId}/{itemId}/{파일이름} */
  upload(path: string, blob: Blob, contentType: string, onProgress?: (fraction: number) => void): Promise<void>;
  remove(paths: string[]): Promise<void>;
  /** 경로 → 볼 수 있는 주소 (cloud: 서명된 주소, local: blob 주소) */
  signUrls(paths: string[]): Promise<Record<string, string>>;
  urlTtlMs: number;

  subscribe(h: ChangeHandlers): () => void;
  accessToken(): Promise<string | null>;
}
