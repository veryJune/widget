// Supabase 저장소 (로그인 · 데이터베이스 · 파일). StealBook 과 같은 프로젝트의 mg_ 표와 moodgrid 버킷을 씁니다.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Item, Project } from '../../types';
import type { Backend, Session } from './types';

const BUCKET = 'moodgrid';
const URL_TTL_SEC = 60 * 60 * 24 * 7; // 서명 주소 7일 → 같은 주소를 재사용해 브라우저 캐시가 살아 있게

function rowToProject(r: Record<string, unknown>): Project {
  return {
    id: r.id as string,
    title: (r.title as string) || '',
    cols: (r.cols as number) ?? 5,
    gap: (r.gap as number) ?? 24,
    sort_mode: ((r.sort_mode as Project['sort_mode']) || 'manual'),
    item_count: (r.item_count as number) ?? 0,
    covers: (r.covers as string[]) || [],
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
    deleted_at: (r.deleted_at as string) ?? null,
  };
}

function rowToItem(r: Record<string, unknown>): Item {
  return {
    id: r.id as string,
    project_id: r.project_id as string,
    type: r.type as Item['type'],
    content: (r.content as string) || '',
    title: (r.title as string) || '',
    path: (r.path as string) ?? null,
    thumb: (r.thumb as string) ?? null,
    w: (r.w as number) ?? null,
    h: (r.h as number) ?? null,
    color: ((r.color as Item['color']) || 'white'),
    note: (r.note as string) || '',
    rating: ((r.rating as Item['rating']) || 0),
    pinned: !!r.pinned,
    collapsed: !!r.collapsed,
    pos: (r.pos as number) ?? 0,
    colors: (r.colors as string[]) || [],
    embed: typeof r.embed === 'string' && r.embed.startsWith('https://') ? r.embed : null,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
    deleted_at: (r.deleted_at as string) ?? null,
  };
}

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export function createSupabaseBackend(url: string, key: string): Backend {
  const sb: SupabaseClient = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'moodgrid-auth' },
  });

  const toSession = (s: { user: { id: string; email?: string } } | null): Session | null => (s ? { userId: s.user.id, email: s.user.email } : null);

  return {
    mode: 'cloud',
    urlTtlMs: URL_TTL_SEC * 1000,

    async session() {
      const { data } = await sb.auth.getSession();
      return toSession(data.session);
    },
    async signIn(email, password) {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) {
        if (/invalid login/i.test(error.message)) throw new Error('이메일 또는 비밀번호가 맞지 않습니다.');
        if (/email not confirmed/i.test(error.message)) throw new Error('이메일 인증이 끝나지 않은 계정입니다.');
        throw new Error(error.message);
      }
      return toSession(data.session)!;
    },
    async signOut() {
      await sb.auth.signOut();
    },
    async changePassword(password) {
      const { error } = await sb.auth.updateUser({ password });
      if (error) {
        if (/should be different/i.test(error.message)) throw new Error('지금 비밀번호와 다른 비밀번호를 입력하세요.');
        if (/at least/i.test(error.message)) throw new Error('비밀번호가 너무 짧습니다. 8자 이상으로 해 주세요.');
        throw new Error(error.message);
      }
    },
    onAuth(cb) {
      const { data } = sb.auth.onAuthStateChange((_e, s) => cb(toSession(s)));
      return () => data.subscription.unsubscribe();
    },

    async fetchProjects() {
      const rows = check(await sb.from('mg_projects').select('*').order('updated_at', { ascending: false })) as Record<string, unknown>[];
      return rows.map(rowToProject);
    },
    async saveProject(p) {
      const { updated_at: _u, ...row } = p; // updated_at 은 DB가 채움
      void _u;
      check(await sb.from('mg_projects').upsert(row));
    },
    async deleteProject(id) {
      check(await sb.from('mg_projects').delete().eq('id', id)); // 항목은 cascade 로 함께 삭제
    },

    async fetchItems(projectId) {
      const items: Item[] = [];
      for (let from = 0; ; from += 1000) {
        const page = check(
          await sb.from('mg_items').select('*').eq('project_id', projectId).order('pos', { ascending: true }).range(from, from + 999),
        ) as Record<string, unknown>[];
        items.push(...page.map(rowToItem));
        if (page.length < 1000) break;
      }
      return items;
    },
    async saveItems(items) {
      for (let i = 0; i < items.length; i += 200) {
        const rows = items.slice(i, i + 200).map((it) => {
          const { updated_at: _u, embed, ...row } = it;
          void _u;
          // embed 열이 없는 예전 DB 에서도 저장되도록, 값이 있을 때만 보냄
          return embed ? { ...row, embed } : row;
        });
        check(await sb.from('mg_items').upsert(rows));
      }
    },
    async deleteItems(ids) {
      for (let i = 0; i < ids.length; i += 200) check(await sb.from('mg_items').delete().in('id', ids.slice(i, i + 200)));
    },

    async upload(path, blob, contentType) {
      const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: contentType || 'application/octet-stream', upsert: true, cacheControl: '31536000' });
      if (error) {
        if (/exceeded|too large|maximum allowed size/i.test(error.message)) throw new Error('파일이 너무 큽니다. 한 장은 20MB 이하만 올릴 수 있습니다.');
        if (/mime/i.test(error.message)) throw new Error('지원하지 않는 이미지 형식입니다.');
        throw new Error(error.message);
      }
    },
    async remove(paths) {
      for (let i = 0; i < paths.length; i += 100) await sb.storage.from(BUCKET).remove(paths.slice(i, i + 100));
    },
    async copy(from, to) {
      const { error } = await sb.storage.from(BUCKET).copy(from, to);
      if (error) throw new Error(error.message);
    },
    async signUrls(paths) {
      const out: Record<string, string> = {};
      for (let i = 0; i < paths.length; i += 100) {
        const { data, error } = await sb.storage.from(BUCKET).createSignedUrls(paths.slice(i, i + 100), URL_TTL_SEC);
        if (error) throw new Error(error.message);
        for (const d of data || []) if (d.signedUrl && d.path) out[d.path] = d.signedUrl;
      }
      return out;
    },

    async accessToken() {
      const { data } = await sb.auth.getSession();
      return data.session?.access_token ?? null;
    },
  };
}
