// PC 왼쪽 사이드바: 범위(전체·미분류·즐겨찾기·모음·카테고리 트리·태그), 담기 버튼, 설정
// 카드를 끌어다 카테고리에 놓으면 그 카테고리로 옮겨집니다. 카테고리 이름 옆 + 로 하위 카테고리를 만듭니다.
import { useRef, useState, type ReactNode } from 'react';
import { ChevronRight, Cloud, HardDrive, Inbox, Layers, Pencil, Plus, Settings, SlidersHorizontal, Sparkles, Trash2, X } from 'lucide-react';
import { useStore } from '../store';
import { useCounts } from '../hooks/useVisible';
import type { Category, Collection, Scope } from '../lib/types';
import { CATEGORY_COLORS } from '../lib/colors';
import { flatten } from '../lib/tree';
import { backend } from '../lib/backend';
import { readLS, writeLS } from '../lib/util';
import { Button, Swatch, inputCls } from './ui';
import { Wordmark } from './Scribble';
import { TagSection } from './Tags';
import { ThemeToggle } from './Theme';

const DRAG_MIME = 'application/x-stealbook-item';
const COLLAPSED_KEY = 'stealbook.collapsed.v1';

function sameScope(a: Scope, b: Scope) {
  return a.kind === b.kind && (!('id' in a) || ('id' in b && a.id === b.id));
}

function NavRow({
  scope,
  icon,
  label,
  count,
  depth = 0,
  expandable,
  expanded,
  onToggle,
  onAddChild,
  onDropItem,
}: {
  scope: Scope;
  icon: ReactNode;
  label: string;
  count: number;
  depth?: number;
  expandable?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  onAddChild?: () => void;
  onDropItem?: (id: string) => void;
}) {
  const { scope: cur, set } = useStore();
  const [over, setOver] = useState(false);
  const active = sameScope(cur, scope);
  return (
    <div
      onDragOver={(e) => {
        if (onDropItem && e.dataTransfer.types.includes(DRAG_MIME)) {
          e.preventDefault();
          setOver(true);
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false);
        const id = e.dataTransfer.getData(DRAG_MIME);
        if (id && onDropItem) {
          e.preventDefault();
          onDropItem(id);
        }
      }}
      className={`group flex h-9 items-center rounded-lg transition ${over ? 'bg-mark text-on-mark' : active ? 'bg-raise text-ink' : 'text-mute hover:bg-panel hover:text-ink'}`}
      style={{ paddingLeft: depth * 14 }}
    >
      {onToggle !== undefined || expandable !== undefined ? (
        <button
          type="button"
          tabIndex={expandable ? 0 : -1}
          aria-label={expanded ? `${label} 접기` : `${label} 펼치기`}
          onClick={onToggle}
          className={`grid h-9 w-5 shrink-0 place-items-center ${expandable ? 'opacity-70 hover:opacity-100' : 'pointer-events-none opacity-0'}`}
        >
          <ChevronRight size={13} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </button>
      ) : (
        <span className="w-2 shrink-0" />
      )}
      <button
        type="button"
        onClick={() => set({ scope, openId: null })}
        aria-current={active ? 'page' : undefined}
        className={`flex h-9 min-w-0 flex-1 items-center gap-2.5 pr-2 text-left text-[14px] ${active ? 'font-bold' : ''}`}
      >
        <span className="grid w-4 shrink-0 place-items-center">{icon}</span>
        <span className="min-w-0 flex-1 truncate">{label}</span>
      </button>
      {onAddChild && (
        <button
          type="button"
          onClick={onAddChild}
          aria-label={`${label} 안에 하위 카테고리 만들기`}
          title="하위 카테고리 만들기"
          className="grid h-7 w-6 shrink-0 place-items-center rounded text-faint opacity-0 transition hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Plus size={13} />
        </button>
      )}
      <span className={`num w-8 shrink-0 pr-3 text-right text-[12px] ${over ? '' : 'text-faint'}`}>{count || ''}</span>
    </div>
  );
}

function CollectionRow({ c, count }: { c: Collection; count: number }) {
  const { updateCollection, deleteCollection } = useStore();
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  if (editing) {
    return (
      <div className="py-1 pl-2 pr-1">
        <input
          autoFocus
          defaultValue={c.name}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') setEditing(false);
          }}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== c.name) updateCollection(c.id, { name: v });
            setEditing(false);
          }}
          className={`${inputCls} h-9 py-1.5 text-[14px]`}
        />
      </div>
    );
  }
  return (
    <div className="group relative">
      <NavRow scope={{ kind: 'smart', id: c.id }} icon={<Sparkles size={13} />} label={c.name} count={count} />
      <div className="absolute right-9 top-1 hidden items-center gap-0.5 rounded-md bg-panel group-focus-within:flex group-hover:flex">
        <button type="button" onClick={() => setEditing(true)} aria-label={`${c.name} 이름 바꾸기`} title="이름 바꾸기" className="grid h-7 w-6 place-items-center text-faint hover:text-ink">
          <Pencil size={12} />
        </button>
        <button
          type="button"
          onClick={() => (confirm ? deleteCollection(c.id) : setConfirm(true))}
          onBlur={() => setConfirm(false)}
          aria-label={confirm ? `${c.name} 모음 삭제 확인` : `${c.name} 모음 삭제`}
          title={confirm ? '한 번 더 누르면 삭제 (항목은 그대로)' : '모음 삭제'}
          className={`grid h-7 w-6 place-items-center ${confirm ? 'text-[#e5534b]' : 'text-faint hover:text-ink'}`}
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}

function AddInput({ depth, onDone: done }: { depth: number; onDone: (name: string | null) => void }) {
  const [name, setName] = useState('');
  const finished = useRef(false);
  const onDone = (v: string | null) => {
    if (finished.current) return; // Enter 뒤 blur 로 두 번 만들어지지 않게
    finished.current = true;
    done(v);
  };
  return (
    <div className="py-1 pr-1" style={{ paddingLeft: depth * 14 + 8 }}>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onDone(name.trim() || null);
          if (e.key === 'Escape') onDone(null);
        }}
        onBlur={() => onDone(name.trim() || null)}
        placeholder={depth ? '하위 카테고리 이름' : '카테고리 이름'}
        className={`${inputCls} h-9 py-1.5 text-[14px]`}
      />
    </div>
  );
}

export function Sidebar() {
  const { categories, collections, openComposer, updateItem, bulkUpdate, addCategory, set, toast } = useStore();
  const counts = useCounts();
  const [adding, setAdding] = useState<{ parent: string | null } | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(readLS<string[]>(COLLAPSED_KEY, [])));

  const toggle = (id: string) => {
    const next = new Set(collapsed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setCollapsed(next);
    writeLS(COLLAPSED_KEY, [...next]);
  };

  // 선택된 카드를 끌면 선택된 것 모두를 옮깁니다
  const dragged = (id: string) => {
    const sel = useStore.getState().selected;
    return sel.includes(id) ? sel : [id];
  };
  const move = (cat: Category | null) => (id: string) => {
    const ids = dragged(id);
    const where = cat ? `'${cat.name}' 카테고리로` : '미분류로';
    if (ids.length > 1) bulkUpdate(ids, () => ({ category_id: cat?.id ?? null }), `${ids.length}개를 ${where} 옮겼습니다`);
    else {
      updateItem(id, { category_id: cat?.id ?? null });
      toast(`${where} 옮겼습니다`);
    }
  };

  const finishAdd = async (name: string | null) => {
    const parent = adding?.parent ?? null;
    setAdding(null);
    if (!name) return;
    const parentCat = categories.find((c) => c.id === parent);
    const color = parentCat ? parentCat.color : CATEGORY_COLORS[categories.filter((c) => !c.parent_id).length % CATEGORY_COLORS.length];
    const c = await addCategory(name, color, parent);
    set({ scope: { kind: 'cat', id: c.id } });
  };

  const startAddChild = (id: string) => {
    if (collapsed.has(id)) toggle(id);
    setAdding({ parent: id });
  };

  const flat = flatten(categories, collapsed);

  return (
    <aside className="flex h-full w-[256px] shrink-0 flex-col border-r border-line bg-bg">
      <div className="px-5 pb-5 pt-6">
        <Wordmark size={22} />
      </div>
      <div className="px-3">
        <Button variant="primary" className="w-full justify-between" onClick={() => openComposer()}>
          <span className="inline-flex items-center gap-2">
            <Plus size={16} strokeWidth={2.5} /> 담기
          </span>
          <kbd className="rounded bg-bg/15 px-1.5 text-[11px] font-semibold opacity-70">N</kbd>
        </Button>
      </div>

      <nav className="scroll-thin mt-4 min-h-0 flex-1 overflow-y-auto px-3 pb-4" aria-label="범위">
        <NavRow scope={{ kind: 'all' }} icon={<Layers size={15} />} label="전체" count={counts.all} />
        <NavRow scope={{ kind: 'inbox' }} icon={<Inbox size={15} />} label="미분류" count={counts.inbox} onDropItem={move(null)} />
        <NavRow
          scope={{ kind: 'fav' }}
          icon={<span className="block h-3 w-3 rounded-full border-[1.5px] border-current" />}
          label="즐겨찾기"
          count={counts.fav}
          onDropItem={(id) => bulkUpdate(dragged(id), () => ({ favorite: true }), '즐겨찾기에 넣었습니다')}
        />

        {collections.length > 0 && (
          <>
            <div className="mb-1 mt-6 px-3">
              <span className="text-[12px] font-semibold text-faint">모음</span>
            </div>
            {collections.map((c) => (
              <CollectionRow key={c.id} c={c} count={counts.byCollection.get(c.id) || 0} />
            ))}
          </>
        )}

        <div className="mb-1 mt-6 flex items-center justify-between px-3">
          <span className="text-[12px] font-semibold text-faint">카테고리</span>
          <button type="button" onClick={() => set({ panel: 'categories' })} className="rounded p-1 text-faint hover:text-ink" title="카테고리 관리" aria-label="카테고리 관리">
            <SlidersHorizontal size={13} />
          </button>
        </div>
        {flat.map(({ cat, depth, hasChildren }) => (
          <div key={cat.id}>
            <NavRow
              scope={{ kind: 'cat', id: cat.id }}
              icon={cat.icon ? <span className="text-[13px] leading-none">{cat.icon}</span> : <Swatch color={cat.color} size={depth ? 7 : 9} />}
              label={cat.name}
              count={counts.byCat.get(cat.id) || 0}
              depth={depth}
              expandable={hasChildren}
              expanded={hasChildren && !collapsed.has(cat.id)}
              onToggle={() => hasChildren && toggle(cat.id)}
              onAddChild={() => startAddChild(cat.id)}
              onDropItem={move(cat)}
            />
            {adding?.parent === cat.id && <AddInput depth={depth + 1} onDone={finishAdd} />}
          </div>
        ))}
        {adding?.parent === null ? (
          <AddInput depth={0} onDone={finishAdd} />
        ) : (
          <button type="button" onClick={() => setAdding({ parent: null })} className="flex h-9 w-full items-center gap-2.5 rounded-lg px-3 text-[14px] text-faint transition hover:bg-panel hover:text-ink">
            <Plus size={15} /> 카테고리 추가
          </button>
        )}

        <TagSection />

        <div className="mt-6">
          <NavRow
            scope={{ kind: 'trash' }}
            icon={<Trash2 size={14} />}
            label="휴지통"
            count={counts.trash}
            onDropItem={(id) => useStore.getState().trashItems(dragged(id))}
          />
        </div>
      </nav>

      <div className="flex items-center gap-2 border-t border-line px-4 py-3">
        <span className="inline-flex flex-1 items-center gap-2 text-[12px] text-faint" title={backend.mode === 'cloud' ? '여러 기기와 동기화됩니다' : '이 브라우저에만 저장됩니다'}>
          {backend.mode === 'cloud' ? <Cloud size={14} /> : <HardDrive size={14} />}
          {backend.mode === 'cloud' ? '동기화 켜짐' : '체험 모드'}
        </span>
        <ThemeToggle />
        <button type="button" onClick={() => set({ panel: 'settings' })} className="rounded-lg p-2 text-mute hover:bg-panel hover:text-ink" aria-label="설정" title="설정">
          <Settings size={16} />
        </button>
      </div>
    </aside>
  );
}
