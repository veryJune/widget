// 앱의 모든 상태와 동작. 화면 조각(components)은 여기서 읽고 여기로 요청만 보냅니다.
//
// 저장 흐름
//   화면 수정 → 즉시 화면에 반영(낙관적) → 바뀐 항목 표시(dirty) → 0.7초 모아서 한 번에 저장 → 상태 칩 갱신
//   실패하면 표시를 유지한 채 다시 시도(오프라인이면 연결될 때까지). 되돌리기는 항목 사본(스냅샷)으로 합니다.
import { create } from 'zustand';
import { backend, type Session } from './lib/backend';
import { buildBackup, parseBackup } from './lib/backup';
import { detectLegacyBoard, parseLegacyJson, readLegacyBoard, type LegacyBoard } from './lib/legacy';
import { fetchImageFile, processImage } from './lib/media';
import { outbox } from './lib/outbox';
import { buildView, liveSorted, moveSection as planMoveSection, planMove, posForNew, sectionIdOf, type MoveDest, type ViewOpts } from './lib/order';
import { parseVideo, withStart } from './lib/video';
import { httpsOnly, type ParsedEmbedCode } from './lib/embed';
import { clamp, domainOf, fileExt, nowIso, safeHttpUrl, shuffled, uid } from './lib/util';
import type { Item, ItemType, Project, Rating, SortMode, TextColor } from './types';

const TRASH_MS = 30 * 24 * 60 * 60 * 1000;
const FLUSH_DELAY = 700;
const PREFS_KEY = 'moodgrid.prefs.v1';

export type SaveState = 'saved' | 'saving' | 'error' | 'offline';
export type Theme = 'dark' | 'light' | 'system';

export interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'error';
  action?: { label: string; run: () => void };
}

export interface AskState {
  title: string;
  body?: string;
  confirm: string;
  danger?: boolean;
  resolve: (ok: boolean) => void;
}

export interface Busy {
  label: string;
  done: number;
  total: number;
}

interface Prefs {
  theme?: Theme;
  lastProject?: string;
  legacyDismissed?: boolean;
}

function readPrefs(): Prefs {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') as Prefs;
  } catch {
    return {};
  }
}
function writePrefs(p: Partial<Prefs>) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...readPrefs(), ...p }));
  } catch {
    /* 저장 공간을 못 쓰는 환경 */
  }
}
export function applyTheme(t: Theme) {
  const eff = t === 'system' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : t;
  document.documentElement.dataset.theme = eff;
}

// ---------- 화면 밖에서 관리하는 값 (바뀌어도 화면을 다시 그릴 필요가 없는 것들) ----------
interface HistoryEntry {
  before: (Item | null)[];
  after: Item[];
}
const undoStack: HistoryEntry[] = [];
const redoStack: HistoryEntry[] = [];
const dirtyItems = new Set<string>();
let dirtyProject = false;
let flushTimer: ReturnType<typeof setTimeout> | undefined;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let flushing = false;
let flushAgain = false;
let retryCount = 0;
let toastSeq = 0;
let lastLoadAt = 0;
const requestedUrls = new Set<string>();
let persistTimer: ReturnType<typeof setTimeout> | undefined;
/** 시작할 때 서버에 못 올린 저장 대기 변경 (열리는 프로젝트에 겹쳐서 다시 저장 시도) */
let pendingRecovery: { items: Item[]; projects: Project[] } = { items: [], projects: [] };

/** 지금 화면 상태(정렬 · 필터 · 검색 · 색 · 시네마틱)에서 보드에 보일 항목을 고르는 옵션 */
export function viewOptsOf(s: { projects: Project[]; currentId: string | null; filter: number; query: string; colorFilter: string | null; cinema: boolean }): ViewOpts {
  const p = s.projects.find((x) => x.id === s.currentId);
  return { sort: p?.sort_mode ?? 'manual', minRating: s.filter, query: s.query, color: s.colorFilter, flat: s.cinema };
}

export function hasUnsavedWork(): boolean {
  const s = useStore.getState();
  return dirtyItems.size > 0 || dirtyProject || Object.keys(s.uploading).length > 0;
}

/** 올린 파일의 이름을 출처로 저장 (검색 · 정보 패널용). 붙여넣은 스크린샷처럼 뜻 없는 이름은 제외 */
function sourceNameOf(file: File): string {
  const name = (file.name || '').trim();
  return !name || /^(image|blob|untitled|screenshot)\.(png|jpe?g|webp|gif)$/i.test(name) ? '' : name;
}

function newItemBase(projectId: string, type: ItemType): Item {
  const now = nowIso();
  return {
    id: uid(), project_id: projectId, type, content: '', title: '', path: null, thumb: null, w: null, h: null,
    color: 'white', note: '', rating: 0, pinned: false, collapsed: false, pos: 0, colors: [], embed: null,
    created_at: now, updated_at: now, deleted_at: null,
  };
}

interface Store {
  booting: boolean;
  session: Session | null;
  projects: Project[];
  currentId: string | null;
  loadingItems: boolean;
  items: Item[];
  urls: Record<string, string>;
  previews: Record<string, string>;
  uploading: Record<string, true>;
  filter: 0 | 1 | 2 | 3;
  selection: Set<string>;
  anchor: string | null;
  selectMode: boolean;
  viewerId: string | null;
  editor: { mode: 'new' | 'text' | 'note'; id?: string } | null;
  helpOpen: boolean;
  switcherOpen: boolean;
  trashOpen: boolean;
  videoView: { kind: 'item'; id: string } | { kind: 'file'; file: File } | null;
  query: string;
  colorFilter: string | null;
  filterOpen: boolean;
  cinema: boolean;
  slideshow: boolean;
  menu: { x: number; y: number; id: string } | null;
  compareIds: string[] | null;
  focusId: string | null;
  save: { state: SaveState; at: number; error?: string };
  undoCount: number;
  redoCount: number;
  theme: Theme;
  toasts: Toast[];
  ask: AskState | null;
  busy: Busy | null;
  legacy: { count: number; title: string } | null;

  boot(): Promise<void>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  changePassword(pw: string): Promise<void>;
  setTheme(t: Theme): void;

  toast(text: string, opts?: { kind?: 'info' | 'error'; action?: Toast['action']; ms?: number }): void;
  dismissToast(id: number): void;
  confirm(o: Omit<AskState, 'resolve'>): Promise<boolean>;

  createProject(title?: string): Promise<string>;
  openProject(id: string): Promise<void>;
  renameProject(id: string, title: string): Promise<void>;
  duplicateProject(id: string): Promise<void>;
  trashProject(id: string): Promise<void>;
  restoreProject(id: string): Promise<void>;
  purgeProject(id: string): Promise<void>;
  setView(v: Partial<Pick<Project, 'cols' | 'gap' | 'sort_mode'>>): void;
  setFilter(f: 0 | 1 | 2 | 3): void;

  select(ids: string[], mode?: 'replace' | 'add' | 'toggle'): void;
  clearSelection(): void;
  setSelectMode(on: boolean): void;
  setViewer(id: string | null): void;
  setEditor(e: Store['editor']): void;
  setHelp(on: boolean): void;
  setSwitcher(on: boolean): void;
  setTrash(on: boolean): void;
  restoreItems(ids: string[]): void;
  purgeItems(ids: string[]): Promise<void>;

  addFiles(files: File[], meta?: { title?: string; content?: string }): Promise<void>;
  setVideoView(v: Store['videoView']): void;
  setQuery(q: string): void;
  setColorFilter(hex: string | null): void;
  setFilterOpen(on: boolean): void;
  clearFilters(): void;
  setCinema(on: boolean): void;
  setSlideshow(on: boolean): void;
  startSlideshow(): void;
  setMenu(m: Store['menu']): void;
  openCompare(ids: string[]): void;
  closeCompare(): void;
  setVideoStart(id: string, seconds: number): void;
  addImageUrl(url: string): Promise<void>;
  addText(text: string, color: TextColor): void;
  addBookmark(url: string, extra?: { embed?: string | null; title?: string; w?: number | null; h?: number | null }): void;
  addEmbedCode(code: ParsedEmbedCode): void;
  addDivider(title?: string): void;
  editText(id: string, content: string, color: TextColor): void;
  setNote(id: string, note: string): void;
  setRating(ids: string[], rating: Rating): void;
  togglePin(ids: string[]): void;
  deleteItems(ids: string[]): void;
  moveItems(ids: string[], dest: MoveDest): void;
  moveToSection(ids: string[], dividerId: string | null): void;
  moveSection(dividerId: string, dir: -1 | 1): void;
  toggleCollapsed(id: string): void;
  renameDivider(id: string, title: string): void;
  shuffleTop(): void;
  undo(): void;
  redo(): void;

  retrySave(): void;
  ensureUrls(paths: (string | null | undefined)[]): Promise<void>;
  refreshIfIdle(): Promise<void>;

  exportBackup(): Promise<void>;
  importFile(file: File): Promise<void>;
  importLegacyLocal(): Promise<void>;
  dismissLegacy(): void;
}

export const useStore = create<Store>()((set, get) => {
  // ----- 공통 도우미 -----
  const userId = () => get().session?.userId ?? 'local';
  const currentProject = () => get().projects.find((p) => p.id === get().currentId) ?? null;

  function toast(text: string, opts: { kind?: 'info' | 'error'; action?: Toast['action']; ms?: number } = {}) {
    const id = ++toastSeq;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, kind: opts.kind ?? 'info', action: opts.action }] }));
    setTimeout(() => get().dismissToast(id), opts.ms ?? (opts.action ? 7000 : opts.kind === 'error' ? 6000 : 3200));
  }

  function setSave(state: SaveState, error?: string) {
    set({ save: { state, at: Date.now(), error } });
  }

  function markDirty(ids: Iterable<string>) {
    for (const id of ids) dirtyItems.add(id);
    scheduleFlush();
  }

  /** 저장 대기 중인 변경을 이 브라우저에 먼저 적어 둠 (탭이 닫히거나 오프라인이어도 보존) */
  function persistSoon() {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(async () => {
      const s = get();
      const uidv = s.session?.userId;
      if (!uidv) return;
      const byId = new Map(s.items.map((i) => [i.id, i]));
      const list = [...dirtyItems].filter((id) => !s.uploading[id]).map((id) => byId.get(id)).filter((i): i is Item => !!i);
      await outbox.putItems(uidv, list);
      const cur = currentProject();
      if (dirtyProject && cur) await outbox.putProject(uidv, cur);
    }, 250);
  }

  function scheduleFlush(delay = FLUSH_DELAY) {
    persistSoon();
    clearTimeout(flushTimer);
    flushTimer = setTimeout(() => void flush(), delay);
    if (get().save.state === 'saved') setSave('saving');
  }

  function projectMeta(items: Item[]): Pick<Project, 'item_count' | 'covers'> {
    const ordered = liveSorted(items).filter((i) => !get().uploading[i.id]);
    return {
      item_count: ordered.filter((i) => i.type !== 'divider').length,
      covers: ordered.filter((i) => i.type === 'image' && i.thumb).slice(0, 4).map((i) => i.thumb as string),
    };
  }

  function hasWork() {
    const s = get();
    return [...dirtyItems].some((id) => !s.uploading[id]) || dirtyProject;
  }

  async function flush(): Promise<void> {
    if (flushing) {
      flushAgain = true;
      return;
    }
    flushing = true;
    try {
      do {
        flushAgain = false;
        const s = get();
        const ids = [...dirtyItems].filter((id) => !s.uploading[id]);
        if (!ids.length && !dirtyProject) break;
        const byId = new Map(s.items.map((i) => [i.id, i]));
        const toSave = ids.map((id) => byId.get(id)).filter((i): i is Item => !!i);
        const cur = currentProject();
        const hadProject = dirtyProject || ids.length > 0;
        ids.forEach((id) => dirtyItems.delete(id));
        dirtyProject = false;
        setSave('saving');
        try {
          if (toSave.length) await backend.saveItems(toSave);
          if (cur && hadProject) {
            const meta = projectMeta(get().items);
            const next: Project = { ...(get().projects.find((p) => p.id === cur.id) ?? cur), ...meta };
            await backend.saveProject(next);
            set((st) => ({ projects: st.projects.map((p) => (p.id === next.id ? { ...next, updated_at: nowIso() } : p)) }));
          }
          retryCount = 0;
          // 저장에 성공한 것은 대기함에서 지움 (저장하는 사이 또 바뀐 항목은 남김)
          void outbox.removeItems(ids.filter((id) => !dirtyItems.has(id)));
          if (cur && hadProject && !dirtyProject) void outbox.removeProjects([cur.id]);
        } catch (e) {
          ids.forEach((id) => dirtyItems.add(id));
          dirtyProject = true;
          retryCount++;
          const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
          setSave(offline ? 'offline' : 'error', (e as Error).message);
          clearTimeout(retryTimer);
          retryTimer = setTimeout(() => void flush(), Math.min(30000, 3000 * retryCount));
          return;
        }
      } while (flushAgain || hasWork());
      if (!hasWork()) setSave('saved');
    } finally {
      flushing = false;
    }
  }

  async function flushNow() {
    clearTimeout(flushTimer);
    await flush();
  }

  /** 항목 사본들을 반영하고(새 항목 포함) 저장 대상으로 표시. history 가 true 면 되돌리기 기록 */
  function mutate(next: Item[], history = true) {
    if (!next.length) return;
    const cur = get().items;
    const byId = new Map(cur.map((i) => [i.id, i]));
    const before = next.map((n) => byId.get(n.id) ?? null);
    const ids = new Set(next.map((n) => n.id));
    set({ items: [...cur.filter((i) => !ids.has(i.id)), ...next] });
    markDirty(ids);
    if (history) {
      undoStack.push({ before, after: next });
      if (undoStack.length > 100) undoStack.shift();
      redoStack.length = 0;
      set({ undoCount: undoStack.length, redoCount: 0 });
    }
  }

  function patchMany(ids: string[], fn: (i: Item) => Partial<Item>): Item[] {
    const set_ = new Set(ids);
    return get().items.filter((i) => set_.has(i.id) && !i.deleted_at).map((i) => ({ ...i, ...fn(i) }));
  }

  /** planMove 결과(pos 변경 목록)를 항목 사본으로 바꿔 반영 */
  function applyPlan(plan: Map<string, number>, extra?: (i: Item) => Partial<Item>, extraIds: string[] = []) {
    if (!plan.size && !extraIds.length) return;
    const wanted = new Set([...plan.keys(), ...extraIds]);
    const next = get().items
      .filter((i) => wanted.has(i.id) && !i.deleted_at)
      .map((i) => ({ ...i, ...(extra && extraIds.includes(i.id) ? extra(i) : {}), pos: plan.get(i.id) ?? i.pos }));
    mutate(next);
  }

  /** 새 항목 하나를 맨 위 묶음 끝(섹션이 없으면 맨 끝)에 추가 */
  function addNew(item: Item): Item {
    const { pos, renumbered } = posForNew(get().items, item.type === 'divider' ? 'divider' : 'item');
    const placed = { ...item, pos };
    const moved = get().items.filter((i) => renumbered.has(i.id)).map((i) => ({ ...i, pos: renumbered.get(i.id) as number }));
    mutate([placed, ...moved]);
    set({ focusId: placed.id });
    return placed;
  }

  function forget(id: string) {
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
    dirtyItems.delete(id);
    void outbox.removeItems([id]);
    for (const stack of [undoStack, redoStack]) {
      for (let k = stack.length - 1; k >= 0; k--) {
        const e = stack[k];
        const idx = e.after.findIndex((a) => a.id === id);
        if (idx >= 0) {
          e.after.splice(idx, 1);
          e.before.splice(idx, 1);
          if (!e.after.length) stack.splice(k, 1);
        }
      }
    }
    set({ undoCount: undoStack.length, redoCount: redoStack.length });
  }

  async function uploadPair(base: string, res: Awaited<ReturnType<typeof processImage>>) {
    const path = `${base}.${res.main.ext}`;
    const thumb = `${base}_t.${res.thumb.ext}`;
    await backend.upload(path, res.main.blob, res.main.mime);
    await backend.upload(thumb, res.thumb.blob, res.thumb.mime);
    return { path, thumb };
  }

  async function purgeItemFiles(items: Item[]) {
    const paths = items.flatMap((i) => [i.path, i.thumb]).filter((p): p is string => !!p);
    try {
      await backend.remove(paths);
    } catch {
      /* 파일 정리 실패는 다음 기회에 */
    }
  }

  function setProjectsMeta(id: string, patch: Partial<Project>) {
    set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
  }

  async function saveProjectNow(p: Project) {
    setSave('saving');
    try {
      await backend.saveProject(p);
      if (!hasWork()) setSave('saved');
    } catch (e) {
      setSave('error', (e as Error).message);
      throw e;
    }
  }

  // ----- 가져오기 공통: 항목 목록을 새 프로젝트로 -----
  interface ImportEntry {
    item: Partial<Item> & { type: ItemType };
    getFile?: () => Promise<File | null>;
  }
  async function importEntries(title: string, entries: ImportEntry[], settings?: Partial<Pick<Project, 'cols' | 'gap' | 'sort_mode'>>) {
    const now = nowIso();
    const project: Project = { id: uid(), title, cols: settings?.cols ?? 5, gap: settings?.gap ?? 24, sort_mode: settings?.sort_mode ?? 'manual', item_count: 0, covers: [], created_at: now, updated_at: now, deleted_at: null };
    await saveProjectNow(project);
    const uid_ = userId();
    const items: Item[] = [];
    let skipped = 0;
    set({ busy: { label: '가져오는 중', done: 0, total: entries.length } });
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const base: Item = { ...newItemBase(project.id, e.item.type), ...e.item, project_id: project.id, id: uid(), pos: (i + 1) * 1024 };
      try {
        if (e.getFile) {
          const file = await e.getFile();
          if (!file) throw new Error('image');
          const res = await processImage(file);
          const { path, thumb } = await uploadPair(`${uid_}/${project.id}/${base.id}`, res);
          Object.assign(base, { path, thumb, w: res.w, h: res.h, colors: res.colors });
        }
        items.push(base);
      } catch {
        skipped++;
      }
      set({ busy: { label: '가져오는 중', done: i + 1, total: entries.length } });
    }
    try {
      if (items.length) await backend.saveItems(items);
      const meta: Pick<Project, 'item_count' | 'covers'> = {
        item_count: items.filter((i) => i.type !== 'divider').length,
        covers: items.filter((i) => i.type === 'image' && i.thumb).slice(0, 4).map((i) => i.thumb as string),
      };
      const final = { ...project, ...meta };
      await backend.saveProject(final);
      set((s) => ({ projects: [{ ...final }, ...s.projects], busy: null }));
    } catch (e) {
      set({ busy: null });
      throw e;
    }
    await get().openProject(project.id);
    toast(skipped ? `'${title}' 가져오기 완료 · ${skipped}개는 건너뜀` : `'${title}' 가져오기 완료`);
  }

  function legacyEntries(board: LegacyBoard): ImportEntry[] {
    return board.items.map((l) => ({
      item: {
        type: l.type, content: l.type === 'image' ? '' : l.content, title: '', note: l.note, rating: l.rating, pinned: l.pinned,
        color: l.color, collapsed: l.collapsed, w: l.w, h: l.h, created_at: new Date(l.timestamp).toISOString(),
      },
      getFile: l.type === 'image' ? async () => fetchImageFile(l.content, await backend.accessToken()) : undefined,
    }));
  }

  function mutateRaw(next: Item[]) {
    const cur = get().items;
    const ids = new Set(next.map((n) => n.id));
    set({ items: [...cur.filter((i) => !ids.has(i.id)), ...next] });
    markDirty(ids);
  }

  /** 지난번에 저장하지 못한 변경(탭을 닫았거나 오프라인이었던)을 서버에 올림. 실패하면 보관하고 프로젝트를 열 때 다시 시도 */
  async function recoverOutbox(projects: Project[]): Promise<Project[]> {
    const uidv = get().session?.userId;
    if (!uidv) return projects;
    const ob = await outbox.loadAll(uidv);
    if (!ob.items.length && !ob.projects.length) return projects;
    const known = new Set(projects.map((p) => p.id));
    const items = ob.items.filter((i) => known.has(i.project_id));
    const projs = ob.projects.filter((p) => known.has(p.id));
    try {
      if (items.length) await backend.saveItems(items);
      for (const p of projs) await backend.saveProject(p);
      await outbox.removeItems(ob.items.map((i) => i.id));
      await outbox.removeProjects(ob.projects.map((p) => p.id));
      if (items.length || projs.length) toast(`저장되지 못했던 변경 ${items.length || projs.length}건을 복구해 저장했습니다.`);
      return projs.length ? projects.map((p) => projs.find((x) => x.id === p.id) ?? p) : projects;
    } catch {
      pendingRecovery = { items, projects: projs };
      toast('이전에 저장하지 못한 변경이 있습니다. 연결되면 자동으로 저장합니다.', { kind: 'error' });
      return projects.map((p) => projs.find((x) => x.id === p.id) ?? p);
    }
  }

  async function loadAll() {
    let projects = await backend.fetchProjects();
    // 휴지통에 30일 넘게 있던 프로젝트는 영구 삭제
    const old = projects.filter((p) => p.deleted_at && Date.now() - Date.parse(p.deleted_at) > TRASH_MS);
    for (const p of old) await get().purgeProject(p.id).catch(() => {});
    projects = projects.filter((p) => !old.includes(p));
    projects = await recoverOutbox(projects);
    set({ projects });
    const prefs = readPrefs();
    const live = projects.filter((p) => !p.deleted_at);
    const target = live.find((p) => p.id === prefs.lastProject) ?? live[0];
    if (target) await get().openProject(target.id);
    else await get().createProject('내 첫 보드');
    if (!prefs.legacyDismissed) set({ legacy: await detectLegacyBoard() });
  }

  // ----- 상태 + 동작 -----
  return {
    booting: true,
    session: null,
    projects: [],
    currentId: null,
    loadingItems: false,
    items: [],
    urls: {},
    previews: {},
    uploading: {},
    filter: 0,
    selection: new Set(),
    anchor: null,
    selectMode: false,
    viewerId: null,
    editor: null,
    helpOpen: false,
    switcherOpen: false,
    trashOpen: false,
    videoView: null,
    query: '',
    colorFilter: null,
    filterOpen: false,
    cinema: false,
    slideshow: false,
    menu: null,
    compareIds: null,
    focusId: null,
    save: { state: 'saved', at: Date.now() },
    undoCount: 0,
    redoCount: 0,
    theme: readPrefs().theme ?? 'system',
    toasts: [],
    ask: null,
    busy: null,
    legacy: null,

    // ---------- 시작 · 로그인 ----------
    async boot() {
      applyTheme(get().theme);
      backend.onAuth((s) => {
        if (!s && get().session) set({ session: null, projects: [], items: [], currentId: null });
      });
      window.addEventListener('online', () => {
        if (hasWork()) void flush();
      });
      window.addEventListener('offline', () => {
        if (hasWork()) setSave('offline');
      });
      window.addEventListener('beforeunload', (e) => {
        if (hasUnsavedWork()) {
          e.preventDefault();
          e.returnValue = '';
        }
      });
      // 브라우저 전체 화면에서 Esc 등으로 나오면 시네마틱 모드도 끝냄
      document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement && get().cinema) set({ cinema: false, slideshow: false });
      });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void get().refreshIfIdle();
        else if (hasWork()) void flushNow();
      });
      try {
        const s = await backend.session();
        set({ session: s });
        if (s) await loadAll();
      } finally {
        set({ booting: false });
      }
    },

    async signIn(email, password) {
      const s = await backend.signIn(email, password);
      set({ session: s });
      await loadAll();
    },

    async signOut() {
      await flushNow();
      await backend.signOut();
      undoStack.length = 0;
      redoStack.length = 0;
      set({ session: null, projects: [], items: [], currentId: null, urls: {}, undoCount: 0, redoCount: 0 });
      requestedUrls.clear();
    },

    async changePassword(pw) {
      await backend.changePassword(pw);
    },

    setTheme(t) {
      writePrefs({ theme: t });
      applyTheme(t);
      set({ theme: t });
    },

    // ---------- 알림 · 확인 ----------
    toast,
    dismissToast(id) {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    },
    confirm(o) {
      return new Promise<boolean>((resolve) => set({ ask: { ...o, resolve: (ok) => { set({ ask: null }); resolve(ok); } } }));
    },

    // ---------- 프로젝트 ----------
    async createProject(title = '새 프로젝트') {
      await flushNow();
      const now = nowIso();
      const p: Project = { id: uid(), title, cols: 5, gap: 24, sort_mode: 'manual', item_count: 0, covers: [], created_at: now, updated_at: now, deleted_at: null };
      await saveProjectNow(p);
      set((s) => ({ projects: [p, ...s.projects] }));
      await get().openProject(p.id);
      return p.id;
    },

    async openProject(id) {
      if (id === get().currentId && !get().loadingItems) return;
      await flushNow();
      undoStack.length = 0;
      redoStack.length = 0;
      set({ currentId: id, items: [], loadingItems: true, selection: new Set(), anchor: null, selectMode: false, viewerId: null, filter: 0, query: '', colorFilter: null, filterOpen: false, cinema: false, slideshow: false, menu: null, compareIds: null, undoCount: 0, redoCount: 0, switcherOpen: false });
      writePrefs({ lastProject: id });
      try {
        const all = await backend.fetchItems(id);
        if (get().currentId !== id) return;
        // 휴지통에 30일 넘게 있던 항목은 영구 삭제
        const old = all.filter((i) => i.deleted_at && Date.now() - Date.parse(i.deleted_at) > TRASH_MS);
        if (old.length) {
          void backend.deleteItems(old.map((i) => i.id)).then(() => purgeItemFiles(old)).catch(() => {});
        }
        const oldIds = new Set(old.map((i) => i.id));
        let loaded = all.filter((i) => !oldIds.has(i.id));
        // 이전에 서버에 올리지 못한 변경이 있으면 겹쳐서 다시 저장 시도
        const mine = pendingRecovery.items.filter((i) => i.project_id === id);
        if (mine.length) {
          const ids = new Set(mine.map((i) => i.id));
          loaded = [...loaded.filter((i) => !ids.has(i.id)), ...mine];
          pendingRecovery.items = pendingRecovery.items.filter((i) => i.project_id !== id);
        }
        set({ items: loaded, loadingItems: false });
        if (mine.length) markDirty(mine.map((i) => i.id));
        lastLoadAt = Date.now();
      } catch (e) {
        if (get().currentId === id) set({ loadingItems: false });
        toast(`프로젝트를 불러오지 못했습니다: ${(e as Error).message}`, { kind: 'error' });
      }
    },

    async renameProject(id, title) {
      const t = title.trim().slice(0, 100) || '이름 없는 프로젝트';
      const p = get().projects.find((x) => x.id === id);
      if (!p || p.title === t) return;
      setProjectsMeta(id, { title: t });
      try {
        await saveProjectNow({ ...p, title: t });
      } catch {
        setProjectsMeta(id, { title: p.title });
        toast('이름을 바꾸지 못했습니다.', { kind: 'error' });
      }
    },

    async duplicateProject(id) {
      const src = get().projects.find((p) => p.id === id);
      if (!src) return;
      await flushNow();
      set({ busy: { label: '복제하는 중', done: 0, total: 1 } });
      try {
        const srcItems = (id === get().currentId ? get().items : await backend.fetchItems(id)).filter((i) => !i.deleted_at);
        const now = nowIso();
        const np: Project = { ...src, id: uid(), title: `${src.title} 복사본`, created_at: now, updated_at: now, deleted_at: null };
        await saveProjectNow(np);
        const uid_ = userId();
        const copies: Item[] = [];
        for (let i = 0; i < srcItems.length; i++) {
          const it = srcItems[i];
          const nid = uid();
          const c: Item = { ...it, id: nid, project_id: np.id, created_at: it.created_at, updated_at: now };
          if (it.path) {
            c.path = `${uid_}/${np.id}/${nid}.${fileExt(it.path, '')}`;
            await backend.copy(it.path, c.path);
          }
          if (it.thumb) {
            c.thumb = `${uid_}/${np.id}/${nid}_t.${fileExt(it.thumb, '')}`;
            await backend.copy(it.thumb, c.thumb);
          }
          copies.push(c);
          set({ busy: { label: '복제하는 중', done: i + 1, total: srcItems.length } });
        }
        if (copies.length) await backend.saveItems(copies);
        set((s) => ({ projects: [np, ...s.projects], busy: null }));
        toast(`'${np.title}' 을(를) 만들었습니다.`);
      } catch (e) {
        set({ busy: null });
        toast(`복제하지 못했습니다: ${(e as Error).message}`, { kind: 'error' });
      }
    },

    async trashProject(id) {
      const p = get().projects.find((x) => x.id === id);
      if (!p) return;
      await flushNow();
      const deleted = { ...p, deleted_at: nowIso() };
      setProjectsMeta(id, { deleted_at: deleted.deleted_at });
      try {
        await saveProjectNow(deleted);
      } catch {
        setProjectsMeta(id, { deleted_at: null });
        toast('삭제하지 못했습니다.', { kind: 'error' });
        return;
      }
      if (get().currentId === id) {
        const next = get().projects.find((x) => !x.deleted_at);
        if (next) await get().openProject(next.id);
        else await get().createProject('내 첫 보드');
      }
      toast(`'${p.title}' 을(를) 휴지통으로 옮겼습니다.`, { action: { label: '되돌리기', run: () => void get().restoreProject(id) } });
    },

    async restoreProject(id) {
      const p = get().projects.find((x) => x.id === id);
      if (!p) return;
      setProjectsMeta(id, { deleted_at: null });
      try {
        await saveProjectNow({ ...p, deleted_at: null });
        toast(`'${p.title}' 을(를) 복구했습니다.`);
      } catch {
        setProjectsMeta(id, { deleted_at: p.deleted_at });
        toast('복구하지 못했습니다.', { kind: 'error' });
      }
    },

    async purgeProject(id) {
      const p = get().projects.find((x) => x.id === id);
      if (!p) return;
      try {
        const items = await backend.fetchItems(id);
        await backend.deleteProject(id);
        await purgeItemFiles(items);
        set((s) => ({ projects: s.projects.filter((x) => x.id !== id) }));
      } catch (e) {
        toast(`영구 삭제하지 못했습니다: ${(e as Error).message}`, { kind: 'error' });
      }
    },

    setView(v) {
      const id = get().currentId;
      if (!id) return;
      const patch: Partial<Project> = {};
      if (v.cols != null) patch.cols = clamp(Math.round(v.cols), 2, 8);
      if (v.gap != null) patch.gap = clamp(Math.round(v.gap), 0, 64);
      if (v.sort_mode) patch.sort_mode = v.sort_mode as SortMode;
      setProjectsMeta(id, patch);
      dirtyProject = true;
      scheduleFlush(1000);
    },

    setFilter(f) {
      set({ filter: f });
    },

    // ---------- 선택 · 화면 상태 ----------
    select(ids, mode = 'replace') {
      set((s) => {
        const next = mode === 'replace' ? new Set<string>() : new Set(s.selection);
        for (const id of ids) {
          if (mode === 'toggle' && next.has(id)) next.delete(id);
          else next.add(id);
        }
        return { selection: next, anchor: ids.length ? ids[ids.length - 1] : s.anchor };
      });
    },
    clearSelection() {
      set({ selection: new Set(), anchor: null });
    },
    setSelectMode(on) {
      set({ selectMode: on, ...(on ? {} : { selection: new Set<string>(), anchor: null }) });
    },
    setViewer(id) {
      set({ viewerId: id });
    },
    setEditor(e) {
      set({ editor: e });
    },
    setHelp(on) {
      set({ helpOpen: on });
    },
    setSwitcher(on) {
      set({ switcherOpen: on });
    },
    setTrash(on) {
      set({ trashOpen: on });
    },
    setVideoView(v) {
      set({ videoView: v });
    },
    setQuery(q) {
      set({ query: q.slice(0, 200) });
    },
    setColorFilter(hex) {
      set((s) => ({ colorFilter: s.colorFilter === hex ? null : hex }));
    },
    setFilterOpen(on) {
      set({ filterOpen: on });
    },
    clearFilters() {
      set({ filter: 0, query: '', colorFilter: null });
    },
    setCinema(on) {
      set({ cinema: on, slideshow: false, selection: new Set(), anchor: null, selectMode: false, menu: null, viewerId: null });
      try {
        if (on) void document.documentElement.requestFullscreen?.().catch(() => {});
        else if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => {});
      } catch {
        /* 전체 화면을 못 쓰는 환경에서는 UI 숨김만 */
      }
      if (on) toast('시네마틱 모드 · 이미지를 누르면 크게 · Space 슬라이드쇼 · Esc 로 나가기', { ms: 4500 });
    },
    setSlideshow(on) {
      set({ slideshow: on });
    },
    startSlideshow() {
      const s = get();
      const first = buildView(s.items, viewOptsOf(s)).find((i) => i.type === 'image' && i.path);
      if (!first) return toast('슬라이드쇼로 보여 줄 이미지가 없습니다.');
      set({ viewerId: first.id, slideshow: true });
    },
    setMenu(m) {
      set({ menu: m });
    },
    openCompare(ids) {
      const live = new Map(get().items.filter((i) => !i.deleted_at && i.type === 'image' && i.path).map((i) => [i.id, i]));
      const picked = ids.filter((id) => live.has(id)).slice(0, 4);
      if (picked.length < 2) return toast('비교하려면 이미지를 2~4장 선택하세요.');
      set({ compareIds: picked, menu: null });
    },
    closeCompare() {
      set({ compareIds: null });
    },

    setVideoStart(id, seconds) {
      const it = get().items.find((i) => i.id === id);
      const v = it ? parseVideo(it.content) : null;
      if (!it || !v) return;
      mutate([{ ...it, content: withStart(v, seconds) }]);
    },

    // ---------- 항목 휴지통 ----------
    restoreItems(ids) {
      const want = new Set(ids);
      const next = get().items.filter((i) => want.has(i.id) && i.deleted_at).map((i) => ({ ...i, deleted_at: null }));
      if (!next.length) return;
      mutate(next);
      toast(next.length === 1 ? '복구했습니다.' : `${next.length}개를 복구했습니다.`);
    },

    async purgeItems(ids) {
      const want = new Set(ids);
      const targets = get().items.filter((i) => want.has(i.id) && i.deleted_at);
      if (!targets.length) return;
      try {
        await backend.deleteItems(targets.map((i) => i.id));
      } catch (e) {
        toast(`영구 삭제하지 못했습니다: ${(e as Error).message}`, { kind: 'error' });
        return;
      }
      targets.forEach((i) => forget(i.id));
      await purgeItemFiles(targets);
      dirtyProject = true;
      scheduleFlush();
      toast(targets.length === 1 ? '영구 삭제했습니다.' : `${targets.length}개를 영구 삭제했습니다.`);
    },

    // ---------- 항목 추가 ----------
    async addFiles(files, meta) {
      const pid = get().currentId;
      const imgs = files.filter((f) => f.type.startsWith('image/'));
      if (!pid || !imgs.length) {
        if (files.length) toast('이미지 파일만 추가할 수 있습니다.', { kind: 'error' });
        return;
      }
      const uid_ = userId();
      let added = 0;
      const errors: string[] = [];
      let next = 0;
      let finished = 0;
      if (imgs.length > 1) set({ busy: { label: '이미지 올리는 중', done: 0, total: imgs.length } });
      const run = async () => {
        while (next < imgs.length) {
          const file = imgs[next++];
          try {
            const res = await processImage(file);
            if (get().currentId !== pid) throw new Error('다른 프로젝트로 이동해서 취소되었습니다.');
            const id = uid();
            const base = `${uid_}/${pid}/${id}`;
            const item: Item = { ...newItemBase(pid, 'image'), id, title: (meta?.title ?? '').slice(0, 300), content: (meta?.content ?? sourceNameOf(file)).slice(0, 2000), w: res.w, h: res.h, colors: res.colors, path: `${base}.${res.main.ext}`, thumb: `${base}_t.${res.thumb.ext}` };
            const preview = URL.createObjectURL(res.thumb.blob);
            set((s) => ({ uploading: { ...s.uploading, [id]: true }, previews: { ...s.previews, [id]: preview } }));
            addNew(item);
            try {
              await backend.upload(item.path as string, res.main.blob, res.main.mime);
              await backend.upload(item.thumb as string, res.thumb.blob, res.thumb.mime);
            } catch (e) {
              forget(id);
              set((s) => {
                const { [id]: _u, ...u } = s.uploading;
                const { [id]: _p, ...p } = s.previews;
                void _u;
                void _p;
                return { uploading: u, previews: p };
              });
              URL.revokeObjectURL(preview);
              throw e;
            }
            set((s) => {
              const { [id]: _u, ...u } = s.uploading;
              void _u;
              return { uploading: u };
            });
            markDirty([id]);
            void get().ensureUrls([item.thumb, item.path]).then(() => {
              URL.revokeObjectURL(preview);
              set((s) => {
                const { [id]: _p, ...p } = s.previews;
                void _p;
                return { previews: p };
              });
            });
            added++;
          } catch (e) {
            errors.push(`${file.name || '이미지'}: ${(e as Error).message || '실패'}`);
          }
          finished++;
          if (imgs.length > 1) set({ busy: { label: '이미지 올리는 중', done: finished, total: imgs.length } });
        }
      };
      await Promise.all(Array.from({ length: Math.min(3, imgs.length) }, run));
      set({ busy: null });
      if (errors.length) toast(errors.length === 1 ? errors[0] : `${errors.length}장을 추가하지 못했습니다. (${errors[0]})`, { kind: 'error' });
      if (added) toast(added === 1 ? '이미지를 추가했습니다.' : `이미지 ${added}장을 추가했습니다.`);
    },

    async addImageUrl(url) {
      toast('이미지를 가져오는 중…');
      const file = await fetchImageFile(url, await backend.accessToken());
      if (file) return get().addFiles([file]);
      get().addBookmark(url);
      toast('이미지를 가져오지 못해 링크로 추가했습니다.');
    },

    addText(text, color) {
      const pid = get().currentId;
      const t = text.trim();
      if (!pid || !t) return;
      addNew({ ...newItemBase(pid, 'text'), content: t.slice(0, 20000), color });
    },

    addBookmark(url, extra) {
      const pid = get().currentId;
      const safe = safeHttpUrl(url);
      if (!pid || !safe) return;
      const item = addNew({
        ...newItemBase(pid, 'bookmark'),
        content: safe,
        title: (extra?.title || domainOf(safe)).slice(0, 300),
        embed: httpsOnly(extra?.embed ?? undefined),
        w: extra?.w ?? null,
        h: extra?.h ?? null,
      });
      // 제목과 대표 이미지를 서버가 가져오면 조용히 채움 (실패해도 링크 카드는 그대로)
      void (async () => {
        try {
          const token = await backend.accessToken();
          const r = await fetch(`/api/unfurl?url=${encodeURIComponent(safe)}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
          if (!r.ok) return;
          const j = (await r.json()) as { title?: string; image?: string; embed?: { url?: string; width?: number; height?: number } };
          const cur = get().items.find((i) => i.id === item.id);
          if (!cur || cur.deleted_at) return;
          const patch: Partial<Item> = {};
          // 사용자가 직접 지은 제목(임베드 코드의 title)은 덮어쓰지 않음
          if (j.title && !extra?.title) patch.title = j.title.slice(0, 300);
          // 사이트가 알려 준 플레이어 주소(oEmbed · twitter:player · og:video)가 있으면 바로 재생되는 카드로
          const found = httpsOnly(j.embed?.url);
          if (found && !cur.embed && !parseVideo(cur.content)) {
            patch.embed = found;
            if (j.embed?.width && j.embed?.height) Object.assign(patch, { w: j.embed.width, h: j.embed.height });
          }
          if (Object.keys(patch).length) mutate([{ ...cur, ...patch }], false);
          if (j.image) {
            const file = await fetchImageFile(j.image, token);
            if (!file) return;
            const res = await processImage(file);
            const { path, thumb } = await uploadPair(`${userId()}/${pid}/${item.id}`, res);
            const cur2 = get().items.find((i) => i.id === item.id);
            // 임베드 카드는 플레이어의 가로세로 비율을 유지 (썸네일 크기로 덮어쓰지 않음)
            if (cur2 && !cur2.deleted_at) mutate([{ ...cur2, path, thumb, colors: res.colors, ...(cur2.embed ? {} : { w: res.w, h: res.h }) }], false);
          }
        } catch {
          /* 미리보기는 있으면 좋은 정도 */
        }
      })();
    },

    addEmbedCode(code) {
      if (code.kind === 'video-link') return get().addBookmark(code.url);
      // 임베드 코드의 주소를 링크로도 저장(원본 열기용), 재생은 embed 로
      get().addBookmark(code.embed.src, { embed: code.embed.src, title: code.embed.title, w: code.embed.w, h: code.embed.h });
    },

    addDivider(title = '새 섹션') {
      const pid = get().currentId;
      if (!pid) return;
      addNew({ ...newItemBase(pid, 'divider'), content: title });
    },

    // ---------- 항목 수정 ----------
    editText(id, content, color) {
      const t = content.trim();
      if (!t) return;
      mutate(patchMany([id], () => ({ content: t.slice(0, 20000), color })));
    },
    setNote(id, note) {
      mutate(patchMany([id], () => ({ note: note.slice(0, 20000) })));
    },
    setRating(ids, rating) {
      const targets = patchMany(ids, () => ({})).filter((i) => i.type !== 'divider');
      if (!targets.length) return;
      // 모두 이미 그 점수면 해제
      const all = targets.every((i) => i.rating === rating);
      mutate(targets.map((i) => ({ ...i, rating: (all ? 0 : rating) as Rating })));
    },
    togglePin(ids) {
      const targets = patchMany(ids, () => ({})).filter((i) => i.type !== 'divider');
      if (!targets.length) return;
      const pin = !targets.every((i) => i.pinned);
      if (!pin) return mutate(targets.map((i) => ({ ...i, pinned: false })));
      // 고정하면 자기 섹션의 맨 위로
      const ordered = liveSorted(get().items);
      const sec = sectionIdOf(ordered, targets[0].id);
      const plan = planMove(get().items, targets.map((t) => t.id), { kind: 'sectionTop', id: sec });
      applyPlan(plan, () => ({ pinned: true }), targets.map((t) => t.id));
    },
    deleteItems(ids) {
      const targets = patchMany(ids, () => ({ deleted_at: nowIso() }));
      if (!targets.length) return;
      mutate(targets);
      set((s) => ({ selection: new Set([...s.selection].filter((id) => !ids.includes(id))), viewerId: ids.includes(s.viewerId ?? '') ? null : s.viewerId }));
      toast(targets.length === 1 ? '삭제했습니다.' : `${targets.length}개를 삭제했습니다.`, { action: { label: '되돌리기', run: () => get().undo() } });
    },
    moveItems(ids, dest) {
      applyPlan(planMove(get().items, ids, dest));
    },
    moveToSection(ids, dividerId) {
      applyPlan(planMove(get().items, ids, { kind: 'sectionTop', id: dividerId }));
      toast(`${ids.length}개를 옮겼습니다.`);
    },
    moveSection(dividerId, dir) {
      applyPlan(planMoveSection(get().items, dividerId, dir));
    },
    toggleCollapsed(id) {
      mutate(patchMany([id], (i) => ({ collapsed: !i.collapsed })), false);
    },
    renameDivider(id, title) {
      const t = title.trim().slice(0, 200) || '섹션';
      const cur = get().items.find((i) => i.id === id);
      if (!cur || cur.content === t) return;
      mutate([{ ...cur, content: t }]);
    },
    shuffleTop() {
      const ordered = liveSorted(get().items);
      const firstDiv = ordered.findIndex((i) => i.type === 'divider');
      const top = firstDiv < 0 ? ordered : ordered.slice(0, firstDiv);
      const movable = top.filter((i) => !i.pinned);
      if (movable.length < 2) return toast('섞을 항목이 부족합니다.');
      const slots = movable.map((i) => i.pos);
      const order = shuffled(movable);
      mutate(order.map((it, i) => ({ ...it, pos: slots[i] })));
      toast('맨 위 묶음을 섞었습니다. (고정한 항목은 그대로)');
    },

    // ---------- 되돌리기 ----------
    undo() {
      const e = undoStack.pop();
      if (!e) return toast('되돌릴 작업이 없습니다.');
      const cur = new Map(get().items.map((i) => [i.id, i]));
      const restored = e.after.map((a, i) => e.before[i] ?? { ...(cur.get(a.id) ?? a), deleted_at: nowIso() });
      mutateRaw(restored);
      redoStack.push(e);
      set({ undoCount: undoStack.length, redoCount: redoStack.length });
    },
    redo() {
      const e = redoStack.pop();
      if (!e) return toast('다시 실행할 작업이 없습니다.');
      mutateRaw(e.after);
      undoStack.push(e);
      set({ undoCount: undoStack.length, redoCount: redoStack.length });
    },

    // ---------- 저장 · 주소 ----------
    retrySave() {
      clearTimeout(retryTimer);
      void flush();
    },

    async ensureUrls(paths) {
      const need = [...new Set(paths.filter((p): p is string => !!p))].filter((p) => !get().urls[p] && !requestedUrls.has(p));
      if (!need.length) return;
      need.forEach((p) => requestedUrls.add(p));
      try {
        const map = await backend.signUrls(need);
        set((s) => ({ urls: { ...s.urls, ...map } }));
        // 아직 파일이 없어 주소를 못 받은 것은 '요청함' 기록을 지워 나중에 다시 요청할 수 있게
        need.forEach((p) => {
          if (!map[p]) requestedUrls.delete(p);
        });
      } catch {
        need.forEach((p) => requestedUrls.delete(p));
      }
    },

    /** 다른 기기에서 고친 내용을 가져오기: 저장할 게 없고 마지막으로 불러온 지 30초 넘었을 때만 */
    async refreshIfIdle() {
      const id = get().currentId;
      if (!id || backend.mode === 'local' || hasWork() || get().loadingItems || Date.now() - lastLoadAt < 30000) return;
      try {
        const [projects, all] = await Promise.all([backend.fetchProjects(), backend.fetchItems(id)]);
        if (get().currentId !== id || hasWork()) return;
        const mine = get().projects.find((p) => p.id === id);
        const fresh = projects.find((p) => p.id === id);
        set({ projects: mine && fresh ? projects.map((p) => (p.id === id ? { ...p, cols: mine.cols, gap: mine.gap, sort_mode: mine.sort_mode } : p)) : projects, items: all });
        lastLoadAt = Date.now();
      } catch {
        /* 조용히 무시 */
      }
    },

    // ---------- 내보내기 · 가져오기 ----------
    async exportBackup() {
      const p = currentProject();
      if (!p) return;
      await flushNow();
      set({ busy: { label: '백업 만드는 중', done: 0, total: 1 } });
      try {
        const items = get().items;
        const zip = await buildBackup(
          p,
          items,
          async (path) => {
            const url = (await backend.signUrls([path]))[path];
            if (!url) return null;
            const r = await fetch(url);
            return r.ok ? r.blob() : null;
          },
          (done, total) => set({ busy: { label: '백업 만드는 중', done, total } }),
        );
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([zip as BlobPart], { type: 'application/zip' }));
        a.download = `${p.title.replace(/[\\/:*?"<>|]+/g, '_') || 'moodgrid'}.moodgrid.zip`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        toast('백업 파일을 내려받았습니다.');
      } catch (e) {
        toast(`백업하지 못했습니다: ${(e as Error).message}`, { kind: 'error' });
      } finally {
        set({ busy: null });
      }
    },

    async importFile(file) {
      try {
        if (/\.zip$/i.test(file.name)) {
          const parsed = parseBackup(new Uint8Array(await file.arrayBuffer()));
          const entries: ImportEntry[] = parsed.data.items.map((b) => ({
            item: { type: b.type, content: b.content, title: b.title, embed: b.embed, color: b.color, note: b.note, rating: b.rating, pinned: b.pinned, collapsed: b.collapsed, colors: b.colors, created_at: b.created_at, w: b.w, h: b.h },
            getFile: b.type === 'image' ? async () => parsed.fileOf(b) : undefined,
          }));
          // 백업의 순서(pos)를 그대로 쓰기 위해 정렬해서 넘김
          const order = parsed.data.items.map((b, i) => ({ i, pos: b.pos })).sort((a, b) => a.pos - b.pos).map((x) => entries[x.i]);
          await importEntries(parsed.data.project.title, order, parsed.data.project);
        } else {
          const board = parseLegacyJson(await file.text());
          const ok = await get().confirm({ title: `'${board.title}' 가져오기`, body: `항목 ${board.items.length}개를 새 프로젝트로 가져옵니다.` + (board.skipped ? ` (읽을 수 없는 ${board.skipped}개는 제외)` : ''), confirm: '가져오기' });
          if (!ok) return;
          await importEntries(board.title, legacyEntries(board));
        }
      } catch (e) {
        set({ busy: null });
        toast(`가져오지 못했습니다: ${(e as Error).message}`, { kind: 'error' });
      }
    },

    async importLegacyLocal() {
      try {
        const board = await readLegacyBoard();
        if (!board.items.length) return toast('가져올 항목이 없습니다.');
        await importEntries(board.title, legacyEntries(board));
        writePrefs({ legacyDismissed: true });
        set({ legacy: null });
      } catch (e) {
        set({ busy: null });
        toast(`가져오지 못했습니다: ${(e as Error).message}`, { kind: 'error' });
      }
    },

    dismissLegacy() {
      writePrefs({ legacyDismissed: true });
      set({ legacy: null });
    },
  };
});
