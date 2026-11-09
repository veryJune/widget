// Supabase 저장소 (로그인 · 데이터베이스 · 파일 · 실시간 동기화)
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Category, Item } from '../types';
import type { Backend, ChangeHandlers, Session } from './types';

const BUCKET = 'media';
const URL_TTL_SEC = 60 * 60 * 24 * 7; // 서명 주소 7일 유효 → 같은 주소를 재사용해 브라우저 캐시가 살아 있게

function rowToItem(r: Record<string, unknown>): Item {
  return {
    id: r.id as string,
    category_id: (r.category_id as string) ?? null,
    type: (r.type as Item['type']) || 'note',
    title: (r.title as string) || '',
    body: (r.body as string) || '',
    url: (r.url as string) || '',
    why: (r.why as string) || '',
    tags: (r.tags as string[]) || [],
    media: (r.media as Item['media']) || [],
    embed: (r.embed as Item['embed']) ?? null,
    link: (r.link as Item['link']) ?? null,
    cover: (r.cover as string) ?? null,
    ratio: (r.ratio as number) ?? null,
    colors: (r.colors as string[]) || [],
    favorite: !!r.favorite,
    status: (r.status as Item['status']) || 'new',
    markers: (r.markers as Item['markers']) || [],
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
  };
}

function rowToCategory(r: Record<string, unknown>): Category {
  return {
    id: r.id as string,
    parent_id: (r.parent_id as string) ?? null,
    name: (r.name as string) || '',
    color: (r.color as string) || '#A0A0A0',
    icon: (r.icon as string) || '',
    sort: (r.sort as number) ?? 0,
    created_at: r.created_at as string,
  };
}

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export function createSupabaseBackend(url: string, key: string): Backend {
  const sb: SupabaseClient = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'stealbook-auth' },
  });

  const toSession = (s: { user: { id: string; email?: string } } | null): Session | null =>
    s ? { userId: s.user.id, email: s.user.email } : null;

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
        if (/email not confirmed/i.test(error.message)) throw new Error('이메일 인증이 끝나지 않은 계정입니다. Supabase에서 사용자를 확인(Confirm)해 주세요.');
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

    async fetchAll() {
      const categories = check(await sb.from('categories').select('*').order('sort', { ascending: true })) as Record<string, unknown>[];
      // 한 번에 1000개씩 끝까지 받아옵니다
      const items: Item[] = [];
      for (let from = 0; ; from += 1000) {
        const page = check(
          await sb.from('items').select('*').order('created_at', { ascending: false }).range(from, from + 999),
        ) as Record<string, unknown>[];
        items.push(...page.map(rowToItem));
        if (page.length < 1000) break;
      }
      return { categories: categories.map(rowToCategory), items };
    },

    async saveCategory(c) {
      check(await sb.from('categories').upsert({ id: c.id, parent_id: c.parent_id ?? null, name: c.name, color: c.color, icon: c.icon, sort: c.sort, created_at: c.created_at }));
    },

    async deleteCategory(id) {
      check(await sb.from('categories').delete().eq('id', id));
    },

    async saveItem(i) {
      const { updated_at: _u, ...row } = i; // updated_at 은 DB가 채움
      void _u;
      check(await sb.from('items').upsert(row));
    },

    async deleteItem(id) {
      check(await sb.from('items').delete().eq('id', id));
    },

    async upload(path, blob, contentType) {
      const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType, upsert: true, cacheControl: '31536000' });
      if (error) {
        if (/exceeded|too large|maximum allowed size/i.test(error.message)) throw new Error('파일이 너무 큽니다. 파일 하나는 50MB 이하만 올릴 수 있습니다.');
        throw new Error(error.message);
      }
    },

    async remove(paths) {
      if (!paths.length) return;
      await sb.storage.from(BUCKET).remove(paths);
    },

    async signUrls(paths) {
      const out: Record<string, string> = {};
      for (let i = 0; i < paths.length; i += 100) {
        const chunk = paths.slice(i, i + 100);
        const { data, error } = await sb.storage.from(BUCKET).createSignedUrls(chunk, URL_TTL_SEC);
        if (error) throw new Error(error.message);
        for (const d of data || []) if (d.signedUrl && d.path) out[d.path] = d.signedUrl;
      }
      return out;
    },

    subscribe(h: ChangeHandlers) {
      const ch = sb
        .channel('stealbook-sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, (p) => {
          if (p.eventType === 'DELETE') h.onItemDelete((p.old as { id: string }).id);
          else h.onItem(rowToItem(p.new as Record<string, unknown>));
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, (p) => {
          if (p.eventType === 'DELETE') h.onCategoryDelete((p.old as { id: string }).id);
          else h.onCategory(rowToCategory(p.new as Record<string, unknown>));
        })
        .subscribe();
      return () => {
        sb.removeChannel(ch);
      };
    },

    async accessToken() {
      const { data } = await sb.auth.getSession();
      return data.session?.access_token ?? null;
    },
  };
}
