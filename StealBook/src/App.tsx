import { useEffect, useState } from 'react';
import { useStore } from './store';
import { useVisibleItems } from './hooks/useVisible';
import { useCompact } from './hooks/useMedia';
import { draftFromText } from './lib/capture';
import { backend } from './lib/backend';
import { Sidebar } from './components/Sidebar';
import { Toolbar, useScopeLabel } from './components/Toolbar';
import { Fab, FilterSheet, MenuSheet, MobileHeader } from './components/MobileChrome';
import { Gallery } from './components/Gallery';
import { Composer } from './components/Composer';
import { Detail } from './components/Detail';
import { Theater } from './components/Theater';
import { CategoryManager } from './components/CategoryManager';
import { Settings } from './components/Settings';
import { Login } from './components/Login';
import { Toasts } from './components/Toasts';
import { Wordmark } from './components/Scribble';
import { useFilterActive } from './components/Controls';
import { SelectionBar, visibleOrder } from './components/Selection';
import { SaveCollectionDialog } from './components/Collections';
import { TagManager } from './components/Tags';
import { Moodboard } from './components/Moodboard';
import { readSteal, StealWindow } from './components/StealWindow';
import { resolveTheme, useApplyTheme } from './components/Theme';

const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (/INPUT|TEXTAREA|SELECT/.test(el.tagName) || el.isContentEditable);
};

/** 안드로이드 '공유 → Steal Book' 으로 들어온 내용 */
function readShare(): string | null {
  const p = new URLSearchParams(location.search);
  const parts = [p.get('title'), p.get('text'), p.get('url')].filter(Boolean) as string[];
  if (!parts.length) return null;
  history.replaceState(null, '', location.pathname);
  return [...new Set(parts)].join(' ');
}

function DropOverlay() {
  const label = useScopeLabel();
  const scope = useStore((s) => s.scope);
  const where = scope.kind === 'cat' ? label : 'Inbox';
  return (
    <div className="pointer-events-none fixed inset-3 z-[80] grid place-items-center rounded-2xl border-2 border-dashed border-mark bg-scrim fade-in">
      <p className="text-[20px] font-extrabold">놓으면 {where}에 담깁니다</p>
    </div>
  );
}

function Main() {
  const compact = useCompact();
  const items = useVisibleItems();
  const { scope, query, type, color, tags, source, period, sort, loaded } = useStore();
  const filtered = useFilterActive() || !!query.trim();
  const galleryKey = JSON.stringify([scope, query, type, color, tags, source, period, sort]);
  const scopeKey = JSON.stringify(scope);
  // 다른 곳으로 이동하면 선택은 풉니다
  useEffect(() => {
    const st = useStore.getState();
    if (st.selected.length || st.selectMode) st.clearSelection();
  }, [scopeKey]);

  const body = !loaded ? (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="shimmer rounded-md" style={{ aspectRatio: i % 3 ? '4 / 5' : '1 / 1' }} />
      ))}
    </div>
  ) : (
    <Gallery key={galleryKey} items={items} filtered={filtered} />
  );

  if (compact) {
    return (
      <div className="min-h-full">
        <MobileHeader />
        <main className="px-[6px] pb-28">{body}</main>
        <Fab />
        <FilterSheet />
        <MenuSheet />
      </div>
    );
  }
  return (
    <div className="flex h-full">
      <Sidebar />
      <div className="scroll-thin min-w-0 flex-1 overflow-y-auto" id="scroller">
        <Toolbar count={items.length} />
        <main className="px-6 pb-16 pt-4">{body}</main>
      </div>
    </div>
  );
}

export default function App() {
  const s = useStore();
  const { authChecked, session } = s;
  const [dragging, setDragging] = useState(false);
  const [steal] = useState(() => readSteal());
  const [shared, setShared] = useState<string | null>(() => (steal ? null : readShare()));

  useEffect(() => {
    useStore.getState().boot();
  }, []);

  useApplyTheme();

  // 공유로 들어온 내용은 로그인 확인 후 작성 창으로
  useEffect(() => {
    if (shared && session) {
      useStore.getState().openComposer(draftFromText(shared, null));
      setShared(null);
    }
  }, [shared, session]);

  // 어디서든 붙여넣기 · 끌어다 놓기 · 단축키
  useEffect(() => {
    const busy = () => {
      const st = useStore.getState();
      return !st.session || st.composer.open || st.theater.open || !!st.panel;
    };
    const onPaste = (e: ClipboardEvent) => {
      if (busy() || isTyping(e.target) || !e.clipboardData) return;
      const files = [...e.clipboardData.files];
      const text = e.clipboardData.getData('text');
      if (!files.length && !text.trim()) return;
      e.preventDefault();
      useStore.getState().set({ openId: null });
      useStore.getState().quickCapture(files.length ? { files } : { text });
    };
    let depth = 0;
    const hasPayload = (e: DragEvent) => {
      const t = e.dataTransfer?.types || [];
      return t.includes('Files') || t.includes('text/uri-list');
    };
    const onDragEnter = (e: DragEvent) => {
      if (busy() || !hasPayload(e) || e.dataTransfer?.types.includes('application/x-stealbook-item')) return;
      depth++;
      setDragging(true);
    };
    const onDragLeave = () => {
      depth = Math.max(0, depth - 1);
      if (!depth) setDragging(false);
    };
    const onDragOver = (e: DragEvent) => {
      if (!busy() && hasPayload(e)) e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      depth = 0;
      setDragging(false);
      if (busy() || !e.dataTransfer || e.dataTransfer.types.includes('application/x-stealbook-item')) return;
      const files = [...e.dataTransfer.files];
      const text = e.dataTransfer.getData('text/uri-list').split('\n').find((l) => l && !l.startsWith('#')) || e.dataTransfer.getData('text/plain');
      if (!files.length && !text) return;
      e.preventDefault();
      useStore.getState().quickCapture(files.length ? { files } : { text });
    };
    const onKey = (e: KeyboardEvent) => {
      const st = useStore.getState();
      if (isTyping(e.target) || busy() || st.openId) return;
      // 선택: Esc 로 끝내기, Ctrl+A 로 보이는 것 모두
      if (e.key === 'Escape' && (st.selectMode || st.selected.length)) {
        st.clearSelection();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        st.setSelected(visibleOrder.current);
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        st.openComposer();
      }
      if (e.key === '1') st.setPref('view', 'masonry');
      if (e.key === '2') st.setPref('view', 'grid');
      if (e.key === '3') st.setPref('view', 'list');
      if (e.key === 't' || e.key === 'T') st.set({ theater: { open: true, startId: null } });
      if (e.key === 'l' || e.key === 'L') st.setPref('theme', resolveTheme(st.theme) === 'dark' ? 'light' : 'dark');
    };
    window.addEventListener('paste', onPaste);
    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('paste', onPaste);
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  if (!authChecked) {
    return (
      <div className="grid h-full place-items-center">
        <Wordmark size={28} />
      </div>
    );
  }
  if (backend.mode === 'cloud' && !session) return <Login />;

  // 크롬 확장 '훔치기' 창: 목록 대신 담기 화면만
  if (steal) {
    return (
      <>
        <StealWindow req={steal} />
        <Composer />
        <Toasts />
      </>
    );
  }

  return (
    <>
      <Main />
      <Composer />
      <Detail />
      <Theater />
      <CategoryManager />
      <Settings />
      <SaveCollectionDialog />
      <TagManager />
      <Moodboard />
      <SelectionBar />
      <Toasts />
      {dragging && <DropOverlay />}
    </>
  );
}
