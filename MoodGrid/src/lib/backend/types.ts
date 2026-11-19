import type { Item, Project } from '../../types';

export interface Session {
  userId: string;
  email?: string;
}

/**
 * 저장소 교체 지점.
 *  - cloud: Supabase (로그인 · 여러 기기 동기화)
 *  - local: 이 브라우저(IndexedDB)에만 저장하는 체험 모드 (Supabase 환경변수가 없을 때)
 * 파일 경로 규칙: {userId}/{projectId}/{파일이름}
 */
export interface Backend {
  mode: 'cloud' | 'local';
  session(): Promise<Session | null>;
  signIn(email: string, password: string): Promise<Session>;
  signOut(): Promise<void>;
  changePassword(password: string): Promise<void>;
  onAuth(cb: (s: Session | null) => void): () => void;

  fetchProjects(): Promise<Project[]>;
  saveProject(p: Project): Promise<void>;
  /** 프로젝트와 그 안의 항목을 영구 삭제 (파일은 remove 로 따로) */
  deleteProject(id: string): Promise<void>;

  /** 삭제 표시된 항목까지 모두 */
  fetchItems(projectId: string): Promise<Item[]>;
  saveItems(items: Item[]): Promise<void>;
  deleteItems(ids: string[]): Promise<void>;

  upload(path: string, blob: Blob, contentType: string): Promise<void>;
  remove(paths: string[]): Promise<void>;
  copy(from: string, to: string): Promise<void>;
  /** 경로 → 볼 수 있는 주소 (cloud: 서명된 주소, local: blob 주소) */
  signUrls(paths: string[]): Promise<Record<string, string>>;
  urlTtlMs: number;

  accessToken(): Promise<string | null>;
}
