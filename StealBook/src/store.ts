// 앱 전체 상태 (zustand). 데이터 + 화면 상태 + 동작을 한곳에 모았습니다.
import { create } from 'zustand';
import { backend, type Session } from './lib/backend';
import { draftFromText, emptyDraft, mediaPaths, saveDraft, type Draft } from './lib/capture';
import type { AspectBucket, Category, Item, ItemType, Scope, SortMode, ViewMode } from './lib/types';
import { nowIso, readLS, uid, writeLS } from './lib/util';

export interface Toast {
  id: string;
  text: string;
  kind?: 'error' | 'progress';
  action?: { label: string; run: () => void };
}

export interface Pending {
  id: string;
  label: string;
  preview?: string;
  ratio?: number;
}

interface Prefs {
  view: ViewMode;
  density: 0 | 1 | 2;
  sort: SortMode;
  theme: 'dark' | 'light';
}

const PREFS_KEY = 'stealbook.prefs.v1';
const SNAP_KEY = 'stealbook.snapshot.v1';
const prefs = readLS<Prefs>(PREFS_KEY, { view: 'masonry', density: 1, sort: 'new', theme: 'dark' });

interface State extends Prefs {
  // 데이터
  authChecked: boolean;
  session: Session | null;
  loaded: boolean;
  categories: Category[];
  items: Item[];
  pending: Pending[];
  toasts: Toast[];

  // 화면 상태
  scope: Scope;
  query: string;
  type: ItemType | null;
  aspect: AspectBucket | null;
  color: string | null;
  tag: string | null;
  shuffleSeed: number;
  openId: string | null;
  composer: { open: boolean; draft: Draft | null };
  theater: { open: boolean; startId: string | null };
  panel: null | 'settings' | 'categories' | 'filters' | 'menu';

  // 동작
  boot(): Promise<void>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  refresh(): Promise<void>;
  set(p: Partial<State>): void;
  setPref<K extends keyof Prefs>(k: K, v: Prefs[K]): void;
  clearFilters(): void;
  toast(text: string, opt?: Partial<Omit<Toast, 'id' | 'text'>> & { ms?: number }): string;
  dismiss(id: string): void;

  addCategory(name: string, color: string): Promise<Category>;
  updateCategory(id: string, patch: Partial<Category>): Promise<void>;
  deleteCategory(id: string, withItems: boolean): Promise<void>;
  reorderCategories(ids: string[]): Promise<void>;

  openComposer(draft?: Draft): void;
  submitDraft(d: Draft, opts?: { quiet?: boolean }): Promise<Item | null>;
  quickCapture(input: { files?: File[]; text?: string }): Promise<void>;
  updateItem(id: string, patch: Partial<Item>): Promise<void>;
  replaceItem(item: Item): Promise<void>;
  deleteItem(id: string): Promise<void>;
  currentCategoryId(): string | null;
}

let unsubscribeRealtime: (() => void) | null = null;
let lastFetch = 0;
let loading: Promise<void> | null = null;

function sortCats(c: Category[]) {
  return c.slice().sort((a, b) => a.sort - b.sort || a.created_at.localeCompare(b.created_at));
}

function upsertById<T extends { id: string }>(list: T[], x: T, prepend = false): T[] {
  const i = list.findIndex((y) => y.id === x.id);
  if (i === -1) return prepend ? [x, ...list] : [...list, x];
  const copy = list.slice();
  copy[i] = x;
  return copy;
}

export const useStore = create<State>((set, get) => {
  const fail = (e: unknown, fallback: string) => {
    const msg = e instanceof Error && e.message ? e.message : fallback;
    get().toast(msg, { kind: 'error', ms: 6000 });
  };

  const snapshot = () => {
    if (backend.mode !== 'cloud') return;
    const { categories, items } = get();
    writeLS(SNAP_KEY, { categories, items: items.slice(0, 1500) });
  };

  function load(): Promise<void> {
    // 로그인 직후 두 군데서 동시에 불러도 한 번만 실행
    if (!loading) loading = doLoad().finally(() => (loading = null));
    return loading;
  }

  async function doLoad() {
    try {
      const data = await backend.fetchAll();
      lastFetch = Date.now();
      set({ categories: sortCats(data.categories), items: data.items, loaded: true });
      snapshot();
    } catch (e) {
      set({ loaded: true });
      fail(e, '데이터를 불러오지 못했습니다. 연결을 확인하세요.');
    }
    if (!unsubscribeRealtime) {
      unsubscribeRealtime = backend.subscribe({
        onItem: (it) => set((s) => ({ items: upsertById(s.items, it, true) })),
        onItemDelete: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
        onCategory: (c) => set((s) => ({ categories: sortCats(upsertById(s.categories, c)) })),
        onCategoryDelete: (id) =>
          set((s) => ({
            categories: s.categories.filter((x) => x.id !== id),
            items: s.items.map((x) => (x.category_id === id ? { ...x, category_id: null } : x)),
          })),
      });
    }
  }

  return {
    ...prefs,
    authChecked: false,
    session: null,
    loaded: false,
    categories: [],
    items: [],
    pending: [],
    toasts: [],
    scope: { kind: 'all' },
    query: '',
    type: null,
    aspect: null,
    color: null,
    tag: null,
    shuffleSeed: Date.now() % 100000,
    openId: null,
    composer: { open: false, draft: null },
    theater: { open: false, startId: null },
    panel: null,

    async boot() {
      const s = await backend.session();
      if (s && backend.mode === 'cloud') {
        const snap = readLS<{ categories: Category[]; items: Item[] } | null>(SNAP_KEY, null);
        if (snap) set({ categories: sortCats(snap.categories), items: snap.items, loaded: true });
      }
      set({ session: s, authChecked: true });
      if (s) await load();
      backend.onAuth((ns) => {
        const prev = get().session;
        set({ session: ns });
        if (ns && !prev) load();
        if (!ns && prev) {
          unsubscribeRealtime?.();
          unsubscribeRealtime = null;
          set({ categories: [], items: [], loaded: false });
        }
      });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && get().session && Date.now() - lastFetch > 60_000) get().refresh();
      });
    },

    async signIn(email, password) {
      const s = await backend.signIn(email, password);
      set({ session: s });
      await load();
    },

    async signOut() {
      await backend.signOut();
      localStorage.removeItem(SNAP_KEY);
      unsubscribeRealtime?.();
      unsubscribeRealtime = null;
      set({ session: null, categories: [], items: [], loaded: false, panel: null });
    },

    async refresh() {
      try {
        const data = await backend.fetchAll();
        lastFetch = Date.now();
        set({ categories: sortCats(data.categories), items: data.items });
        snapshot();
      } catch {
        /* 다음에 다시 */
      }
    },

    set: (p) => set(p),

    setPref(k, v) {
      set({ [k]: v } as Partial<State>);
      const { view, density, sort, theme } = get();
      writeLS(PREFS_KEY, { view, density, sort, theme });
      if (k === 'sort' && v === 'shuffle') set({ shuffleSeed: Date.now() % 100000 });
    },

    clearFilters: () => set({ query: '', type: null, aspect: null, color: null, tag: null }),

    toast(text, opt = {}) {
      const id = uid();
      const { ms, ...rest } = opt;
      set((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, ...rest }] }));
      if (rest.kind !== 'progress') setTimeout(() => get().dismiss(id), ms ?? 3500);
      return id;
    },

    dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

    // ---------- 카테고리 ----------
    async addCategory(name, color) {
      const cats = get().categories;
      const c: Category = { id: uid(), name: name.trim(), color, icon: '', sort: (cats[cats.length - 1]?.sort ?? 0) + 1, created_at: nowIso() };
      set({ categories: [...cats, c] });
      try {
        await backend.saveCategory(c);
      } catch (e) {
        set((s) => ({ categories: s.categories.filter((x) => x.id !== c.id) }));
        fail(e, '카테고리를 만들지 못했습니다.');
      }
      return c;
    },

    async updateCategory(id, patch) {
      const cur = get().categories.find((c) => c.id === id);
      if (!cur) return;
      const next = { ...cur, ...patch };
      set((s) => ({ categories: sortCats(upsertById(s.categories, next)) }));
      try {
        await backend.saveCategory(next);
      } catch (e) {
        fail(e, '카테고리를 바꾸지 못했습니다.');
        get().refresh();
      }
    },

    async deleteCategory(id, withItems) {
      const { items, scope } = get();
      const inCat = items.filter((i) => i.category_id === id);
      set((s) => ({
        categories: s.categories.filter((c) => c.id !== id),
        items: withItems ? s.items.filter((i) => i.category_id !== id) : s.items.map((i) => (i.category_id === id ? { ...i, category_id: null } : i)),
        scope: scope.kind === 'cat' && scope.id === id ? { kind: 'all' } : scope,
      }));
      try {
        if (withItems) {
          for (const it of inCat) {
            await backend.deleteItem(it.id);
            await backend.remove(it.media.flatMap(mediaPaths));
          }
        }
        await backend.deleteCategory(id);
      } catch (e) {
        fail(e, '카테고리를 지우지 못했습니다.');
        get().refresh();
      }
    },

    async reorderCategories(ids) {
      const map = new Map(get().categories.map((c) => [c.id, c]));
      const next = ids.map((id, i) => ({ ...map.get(id)!, sort: i + 1 }));
      const changed = next.filter((c) => map.get(c.id)!.sort !== c.sort);
      set({ categories: next });
      try {
        for (const c of changed) await backend.saveCategory(c);
      } catch (e) {
        fail(e, '순서를 저장하지 못했습니다.');
        get().refresh();
      }
    },

    // ---------- 항목 ----------
    currentCategoryId() {
      const sc = get().scope;
      return sc.kind === 'cat' ? sc.id : null;
    },

    openComposer(draft) {
      set({ composer: { open: true, draft: draft ?? emptyDraft(get().currentCategoryId()) } });
    },

    async submitDraft(d, opts = {}) {
      const tid = opts.quiet ? '' : get().toast(d.base ? '수정 저장 중' : '담는 중', { kind: 'progress' });
      const pid = uid();
      if (!d.base) {
        const first = d.files[0];
        const preview = first && first.type.startsWith('image/') ? URL.createObjectURL(first) : undefined;
        set((s) => ({ pending: [{ id: pid, label: '담는 중', preview }, ...s.pending] }));
      }
      try {
        const item = await saveDraft(d, (msg) => {
          set((s) => ({
            toasts: s.toasts.map((t) => (t.id === tid ? { ...t, text: msg } : t)),
            pending: s.pending.map((p) => (p.id === pid ? { ...p, label: msg } : p)),
          }));
        });
        set((s) => ({ items: upsertById(s.items, item, true), pending: s.pending.filter((p) => p.id !== pid) }));
        get().dismiss(tid);
        if (opts.quiet) {
          /* 묶음 담기는 마지막에 한 번만 알림 */
        } else if (!d.base) {
          const cat = get().categories.find((c) => c.id === item.category_id);
          get().toast(`${cat ? cat.name : '인박스'}에 담았습니다`, { action: { label: '열기', run: () => set({ openId: item.id }) } });
        } else get().toast('저장했습니다');
        snapshot();
        return item;
      } catch (e) {
        set((s) => ({ pending: s.pending.filter((p) => p.id !== pid) }));
        get().dismiss(tid);
        fail(e, '담지 못했습니다.');
        return null;
      }
    },

    async quickCapture({ files, text }) {
      const cat = get().currentCategoryId();
      if (files && files.length > 1) {
        // 파일마다 항목 하나씩, 알림은 한 번만
        const where = get().categories.find((c) => c.id === cat)?.name || '인박스';
        const tid = get().toast(`담는 중 1/${files.length}`, { kind: 'progress' });
        let ok = 0;
        for (let i = 0; i < files.length; i++) {
          set((s) => ({ toasts: s.toasts.map((t) => (t.id === tid ? { ...t, text: `담는 중 ${i + 1}/${files.length}` } : t)) }));
          const d = emptyDraft(cat);
          d.files = [files[i]];
          if (await get().submitDraft(d, { quiet: true })) ok++;
        }
        get().dismiss(tid);
        if (ok) get().toast(`${ok}개를 ${where}에 담았습니다`);
        return;
      }
      if (files && files.length === 1) {
        const d = emptyDraft(cat);
        d.files = files;
        await get().submitDraft(d);
        return;
      }
      if (text && text.trim()) await get().submitDraft(draftFromText(text, cat));
    },

    async updateItem(id, patch) {
      const cur = get().items.find((i) => i.id === id);
      if (!cur) return;
      await get().replaceItem({ ...cur, ...patch, updated_at: nowIso() });
    },

    async replaceItem(item) {
      set((s) => ({ items: upsertById(s.items, item) }));
      try {
        await backend.saveItem(item);
        snapshot();
      } catch (e) {
        fail(e, '저장하지 못했습니다.');
        get().refresh();
      }
    },

    async deleteItem(id) {
      const cur = get().items.find((i) => i.id === id);
      if (!cur) return;
      set((s) => ({ items: s.items.filter((i) => i.id !== id), openId: s.openId === id ? null : s.openId }));
      try {
        await backend.deleteItem(id);
        await backend.remove(cur.media.flatMap(mediaPaths));
        get().toast('삭제했습니다');
        snapshot();
      } catch (e) {
        fail(e, '삭제하지 못했습니다.');
        get().refresh();
      }
    },
  };
});
