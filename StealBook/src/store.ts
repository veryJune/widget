// 앱 전체 상태 (zustand). 데이터 + 화면 상태 + 동작을 한곳에 모았습니다.
import { create } from 'zustand';
import { backend, type Session } from './lib/backend';
import { draftFromText, emptyDraft, mediaPaths, saveDraft, type Draft } from './lib/capture';
import type { Category, Collection, Criteria, Item, ItemType, Scope, SortMode, ViewMode } from './lib/types';
import { normalizeUrl } from './lib/filter';
import { parseEmbed } from './lib/embed';
import { nowIso, readLS, uid, writeLS } from './lib/util';
import { canMoveUnder, siblingsOf } from './lib/tree';

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
  theme: 'dark' | 'light' | 'system';
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
  collections: Collection[];
  pending: Pending[];
  toasts: Toast[];

  // 화면 상태
  scope: Scope;
  query: string;
  type: ItemType | null;
  color: string | null;
  /** 태그 필터 (여러 개면 모두 가진 항목만) */
  tags: string[];
  shuffleSeed: number;
  openId: string | null;
  composer: { open: boolean; draft: Draft | null };
  theater: { open: boolean; startId: string | null };
  panel: null | 'settings' | 'categories' | 'filters' | 'menu' | 'saveCollection' | 'tags';
  /** 여러 개 선택 */
  selected: string[];
  selectMode: boolean;
  lastSelected: string | null;

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

  addCategory(name: string, color: string, parentId?: string | null): Promise<Category>;
  updateCategory(id: string, patch: Partial<Category>): Promise<void>;
  moveCategory(id: string, parentId: string | null): Promise<void>;
  deleteCategory(id: string, withItems: boolean): Promise<void>;
  reorderCategories(ids: string[]): Promise<void>;

  openComposer(draft?: Draft): void;
  submitDraft(d: Draft, opts?: { quiet?: boolean }): Promise<Item | null>;
  quickCapture(input: { files?: File[]; text?: string }): Promise<void>;
  updateItem(id: string, patch: Partial<Item>): Promise<void>;
  replaceItem(item: Item): Promise<void>;
  /** 휴지통으로 (30일 뒤 자동 삭제) */
  deleteItem(id: string): Promise<void>;
  trashItems(ids: string[]): Promise<void>;
  restoreItems(ids: string[]): Promise<void>;
  purgeItems(ids: string[], quiet?: boolean): Promise<void>;
  emptyTrash(): Promise<void>;
  bulkUpdate(ids: string[], fn: (it: Item) => Partial<Item>, done?: string): Promise<void>;
  toggleSelect(id: string): void;
  setSelected(ids: string[], anchor?: string | null): void;
  clearSelection(): void;
  findDuplicate(url: string): Item | undefined;

  /** 태그 이름 바꾸기 (이미 있는 이름이면 합치기) */
  renameTag(from: string, to: string): Promise<void>;
  /** 모든 항목에서 태그 빼기 */
  deleteTag(tag: string): Promise<void>;
  /** 태그 필터: only=그 태그만 / add=더하기·빼기 */
  pickTag(tag: string, mode: 'only' | 'toggle'): void;

  addCollection(name: string, criteria: Criteria): Promise<Collection>;
  updateCollection(id: string, patch: Partial<Collection>): Promise<void>;
  deleteCollection(id: string): Promise<void>;
  currentCategoryId(): string | null;
}

const TRASH_DAYS = 30;

let unsubscribeRealtime: (() => void) | null = null;
let lastFetch = 0;
let loading: Promise<void> | null = null;

function sortCats(c: Category[]) {
  // 예전 데이터(parent_id 없음)도 맨 위 카테고리로 다룹니다
  return c.map((x) => (x.parent_id === undefined ? { ...x, parent_id: null } : x)).sort((a, b) => a.sort - b.sort || a.created_at.localeCompare(b.created_at));
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
    const { categories, items, collections } = get();
    writeLS(SNAP_KEY, { categories, collections, items: items.slice(0, 1500) });
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
      set({ categories: sortCats(data.categories), items: data.items, collections: data.collections, loaded: true });
      snapshot();
      // 휴지통에서 30일 지난 항목은 조용히 영구 삭제
      const old = data.items.filter((i) => i.deleted_at && Date.now() - Date.parse(i.deleted_at) > TRASH_DAYS * 86_400_000).map((i) => i.id);
      if (old.length) get().purgeItems(old, true);
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
            categories: s.categories.filter((x) => x.id !== id).map((x) => (x.parent_id === id ? { ...x, parent_id: null } : x)),
            items: s.items.map((x) => (x.category_id === id ? { ...x, category_id: null } : x)),
          })),
        onCollection: (c) => set((s) => ({ collections: upsertById(s.collections, c).sort((a, b) => a.sort - b.sort) })),
        onCollectionDelete: (id) => set((s) => ({ collections: s.collections.filter((x) => x.id !== id) })),
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
    collections: [],
    pending: [],
    toasts: [],
    scope: { kind: 'all' },
    query: '',
    type: null,
    color: null,
    tags: [],
    shuffleSeed: Date.now() % 100000,
    openId: null,
    composer: { open: false, draft: null },
    theater: { open: false, startId: null },
    panel: null,
    selected: [],
    selectMode: false,
    lastSelected: null,

    async boot() {
      const s = await backend.session();
      if (s && backend.mode === 'cloud') {
        const snap = readLS<{ categories: Category[]; items: Item[]; collections?: Collection[] } | null>(SNAP_KEY, null);
        if (snap) set({ categories: sortCats(snap.categories), items: snap.items, collections: snap.collections || [], loaded: true });
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
          set({ categories: [], items: [], collections: [], loaded: false });
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
      set({ session: null, categories: [], items: [], collections: [], loaded: false, panel: null, selected: [] });
    },

    async refresh() {
      try {
        const data = await backend.fetchAll();
        lastFetch = Date.now();
        set({ categories: sortCats(data.categories), items: data.items, collections: data.collections });
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

    clearFilters: () => set({ query: '', type: null, color: null, tags: [] }),

    toast(text, opt = {}) {
      const id = uid();
      const { ms, ...rest } = opt;
      set((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, ...rest }] }));
      if (rest.kind !== 'progress') setTimeout(() => get().dismiss(id), ms ?? 3500);
      return id;
    },

    dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

    // ---------- 카테고리 ----------
    async addCategory(name, color, parentId = null) {
      const cats = get().categories;
      const sibs = siblingsOf(cats, parentId);
      const c: Category = {
        id: uid(),
        parent_id: parentId,
        name: name.trim(),
        color,
        icon: '',
        sort: (sibs[sibs.length - 1]?.sort ?? 0) + 1,
        created_at: nowIso(),
      };
      set({ categories: sortCats([...cats, c]) });
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

    async moveCategory(id, parentId) {
      const cats = get().categories;
      const cur = cats.find((c) => c.id === id);
      if (!cur || cur.parent_id === parentId) return;
      if (!canMoveUnder(cats, id, parentId)) {
        get().toast('자기 자신이나 자기 하위 카테고리 안으로는 옮길 수 없습니다.', { kind: 'error' });
        return;
      }
      const sibs = siblingsOf(cats, parentId);
      await get().updateCategory(id, { parent_id: parentId, sort: (sibs[sibs.length - 1]?.sort ?? 0) + 1 });
    },

    async deleteCategory(id, withItems) {
      const { items, scope, categories } = get();
      const cat = categories.find((c) => c.id === id);
      if (!cat) return;
      const inCat = items.filter((i) => i.category_id === id);
      // 하위 카테고리는 지우지 않고 한 단계 위로 올립니다
      const kids = categories.filter((c) => c.parent_id === id).map((c) => ({ ...c, parent_id: cat.parent_id }));
      set((s) => ({
        categories: sortCats(s.categories.filter((c) => c.id !== id).map((c) => kids.find((k) => k.id === c.id) || c)),
        items: s.items.map((i) => (i.category_id === id ? { ...i, category_id: null, deleted_at: withItems ? nowIso() : i.deleted_at } : i)),
        scope: scope.kind === 'cat' && scope.id === id ? (cat.parent_id ? { kind: 'cat', id: cat.parent_id } : { kind: 'all' }) : scope,
      }));
      try {
        for (const k of kids) await backend.saveCategory(k);
        // 항목까지 지우기를 골라도 바로 없애지 않고 휴지통으로 (30일 안에 복구 가능)
        for (const it of inCat) await backend.saveItem({ ...it, category_id: null, deleted_at: withItems ? nowIso() : it.deleted_at ?? null });
        await backend.deleteCategory(id);
      } catch (e) {
        fail(e, '카테고리를 지우지 못했습니다.');
        get().refresh();
      }
    },

    /** 같은 상위 아래 형제들의 순서만 바꿉니다 */
    async reorderCategories(ids) {
      const order = new Map(ids.map((id, i) => [id, i + 1]));
      const before = new Map(get().categories.map((c) => [c.id, c.sort]));
      const next = get().categories.map((c) => (order.has(c.id) ? { ...c, sort: order.get(c.id)! } : c));
      const changed = next.filter((c) => order.has(c.id) && before.get(c.id) !== c.sort);
      set({ categories: sortCats(next) });
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
          get().toast(`${cat ? cat.name : '미분류'}에 담았습니다`, { action: { label: '열기', run: () => set({ openId: item.id }) } });
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
        const where = get().categories.find((c) => c.id === cat)?.name || '미분류';
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
      if (text && text.trim()) {
        const d = draftFromText(text, cat);
        const dup = d.url ? get().findDuplicate(d.url) : undefined;
        if (dup) {
          get().toast('이미 담아 둔 링크입니다', { ms: 5000, action: { label: '열기', run: () => set({ openId: dup.id }) } });
          return;
        }
        await get().submitDraft(d);
      }
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
      await get().trashItems([id]);
    },

    async trashItems(ids) {
      const now = nowIso();
      const set_ = new Set(ids);
      const targets = get().items.filter((i) => set_.has(i.id) && !i.deleted_at);
      if (!targets.length) return;
      set((s) => ({
        items: s.items.map((i) => (set_.has(i.id) ? { ...i, deleted_at: now } : i)),
        openId: s.openId && set_.has(s.openId) && s.scope.kind !== 'trash' ? null : s.openId,
        selected: s.selected.filter((x) => !set_.has(x)),
      }));
      try {
        for (const it of targets) await backend.saveItem({ ...it, deleted_at: now });
        get().toast(targets.length > 1 ? `${targets.length}개를 휴지통으로 옮겼습니다` : '휴지통으로 옮겼습니다', {
          ms: 6000,
          action: { label: '되돌리기', run: () => get().restoreItems(targets.map((t) => t.id)) },
        });
        snapshot();
      } catch (e) {
        fail(e, '삭제하지 못했습니다.');
        get().refresh();
      }
    },

    async restoreItems(ids) {
      const set_ = new Set(ids);
      const targets = get().items.filter((i) => set_.has(i.id) && i.deleted_at);
      if (!targets.length) return;
      set((s) => ({ items: s.items.map((i) => (set_.has(i.id) ? { ...i, deleted_at: null } : i)), selected: s.selected.filter((x) => !set_.has(x)) }));
      try {
        for (const it of targets) await backend.saveItem({ ...it, deleted_at: null });
        get().toast(targets.length > 1 ? `${targets.length}개를 되돌렸습니다` : '되돌렸습니다');
        snapshot();
      } catch (e) {
        fail(e, '되돌리지 못했습니다.');
        get().refresh();
      }
    },

    async purgeItems(ids, quiet = false) {
      const set_ = new Set(ids);
      const targets = get().items.filter((i) => set_.has(i.id));
      set((s) => ({ items: s.items.filter((i) => !set_.has(i.id)), openId: s.openId && set_.has(s.openId) ? null : s.openId, selected: s.selected.filter((x) => !set_.has(x)) }));
      try {
        for (const it of targets) {
          await backend.deleteItem(it.id);
          await backend.remove(it.media.flatMap(mediaPaths));
        }
        if (!quiet) get().toast(targets.length > 1 ? `${targets.length}개를 영구 삭제했습니다` : '영구 삭제했습니다');
        snapshot();
      } catch (e) {
        if (!quiet) fail(e, '삭제하지 못했습니다.');
        get().refresh();
      }
    },

    async emptyTrash() {
      await get().purgeItems(get().items.filter((i) => i.deleted_at).map((i) => i.id));
    },

    async bulkUpdate(ids, fn, done) {
      const set_ = new Set(ids);
      const now = nowIso();
      const next = get()
        .items.filter((i) => set_.has(i.id))
        .map((i) => ({ ...i, ...fn(i), updated_at: now }));
      const byId = new Map(next.map((i) => [i.id, i]));
      set((s) => ({ items: s.items.map((i) => byId.get(i.id) || i) }));
      try {
        for (let i = 0; i < next.length; i += 6) await Promise.all(next.slice(i, i + 6).map((it) => backend.saveItem(it)));
        if (done) get().toast(done);
        snapshot();
      } catch (e) {
        fail(e, '저장하지 못했습니다.');
        get().refresh();
      }
    },

    toggleSelect(id) {
      set((s) => {
        const has = s.selected.includes(id);
        const selected = has ? s.selected.filter((x) => x !== id) : [...s.selected, id];
        return { selected, lastSelected: id, selectMode: selected.length > 0 || s.selectMode };
      });
    },

    setSelected(ids, anchor = null) {
      set((s) => ({ selected: ids, lastSelected: anchor ?? s.lastSelected, selectMode: ids.length > 0 || s.selectMode }));
    },

    clearSelection: () => set({ selected: [], selectMode: false, lastSelected: null }),

    findDuplicate(url) {
      if (!url) return undefined;
      const keys = new Set([normalizeUrl(url)]);
      const canon = parseEmbed(url)?.url;
      if (canon) keys.add(normalizeUrl(canon));
      return get().items.find((i) => !i.deleted_at && i.url && keys.has(normalizeUrl(i.url)));
    },

    // ---------- 태그 ----------
    async renameTag(from, raw) {
      const to = raw.replace(/^#+/, '').trim().replace(/[\s,]+/g, '_');
      if (!to || to === from) return;
      const { items, collections, tags } = get();
      const ids = items.filter((i) => i.tags.includes(from)).map((i) => i.id);
      const merge = items.some((i) => !i.deleted_at && i.tags.includes(to));
      set({ tags: [...new Set(tags.map((t) => (t === from ? to : t)))] });
      await get().bulkUpdate(ids, (it) => ({ tags: [...new Set(it.tags.map((t) => (t === from ? to : t)))] }), merge ? `태그 합침: #${from} → #${to}` : `태그 이름 바꿈: #${from} → #${to}`);
      // 이 태그를 쓰는 모음 조건도 같이 고칩니다
      for (const c of collections) {
        const cr = c.criteria;
        if (cr.tag !== from && !cr.tags?.includes(from)) continue;
        await get().updateCollection(c.id, {
          criteria: { ...cr, tag: cr.tag === from ? to : cr.tag, tags: cr.tags ? [...new Set(cr.tags.map((t) => (t === from ? to : t)))] : cr.tags },
        });
      }
    },

    async deleteTag(tag) {
      const items = get().items.filter((i) => i.tags.includes(tag));
      const before = new Map(items.map((i) => [i.id, i.tags]));
      const ids = items.map((i) => i.id);
      set((s) => ({ tags: s.tags.filter((t) => t !== tag) }));
      await get().bulkUpdate(ids, (it) => ({ tags: it.tags.filter((t) => t !== tag) }));
      get().toast(`#${tag} 태그를 ${ids.length}개 항목에서 뺐습니다`, {
        ms: 7000,
        action: { label: '되돌리기', run: () => get().bulkUpdate(ids, (it) => ({ tags: before.get(it.id) ?? it.tags }), `#${tag} 태그를 되돌렸습니다`) },
      });
    },

    pickTag(tag, mode) {
      const { tags, scope } = get();
      let next: string[];
      if (mode === 'toggle') next = tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag];
      else next = tags.length === 1 && tags[0] === tag ? [] : [tag];
      set({ tags: next, ...(scope.kind === 'trash' ? { scope: { kind: 'all' } as Scope } : {}) });
    },

    // ---------- 스마트 컬렉션 ----------
    async addCollection(name, criteria) {
      const list = get().collections;
      const c: Collection = { id: uid(), name: name.trim() || '새 모음', icon: '', criteria, sort: (list[list.length - 1]?.sort ?? 0) + 1, created_at: nowIso() };
      set({ collections: [...list, c], scope: { kind: 'smart', id: c.id }, query: '', type: null, color: null, tags: [] });
      try {
        await backend.saveCollection(c);
        get().toast(`모음 ‘${c.name}’을 만들었습니다`);
      } catch (e) {
        set((s) => ({ collections: s.collections.filter((x) => x.id !== c.id), scope: { kind: 'all' } }));
        fail(e, '모음을 만들지 못했습니다.');
      }
      return c;
    },

    async updateCollection(id, patch) {
      const cur = get().collections.find((c) => c.id === id);
      if (!cur) return;
      const next = { ...cur, ...patch };
      set((s) => ({ collections: upsertById(s.collections, next) }));
      try {
        await backend.saveCollection(next);
      } catch (e) {
        fail(e, '모음을 바꾸지 못했습니다.');
        get().refresh();
      }
    },

    async deleteCollection(id) {
      set((s) => ({ collections: s.collections.filter((c) => c.id !== id), scope: s.scope.kind === 'smart' && s.scope.id === id ? { kind: 'all' } : s.scope }));
      try {
        await backend.deleteCollection(id);
      } catch (e) {
        fail(e, '모음을 지우지 못했습니다.');
        get().refresh();
      }
    },
  };
});
