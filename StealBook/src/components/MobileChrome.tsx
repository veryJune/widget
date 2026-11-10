// 모바일 화면: 상단 바(검색·필터·메뉴) + 범위 칩 + 오른쪽 아래 담기 버튼 + 시트들
import { useState } from 'react';
import { Bookmark, CheckSquare, Hash, Clapperboard, ListFilter, Menu, Plus, Search, Settings, SlidersHorizontal, Trash2 } from 'lucide-react';
import { useStore } from '../store';
import { useCounts } from '../hooks/useVisible';
import type { Scope } from '../lib/types';
import { Wordmark } from './Scribble';
import { ColorFilter, DensitySwitch, SORTS, TypeFilter, ViewSwitch, useFilterActive } from './Controls';
import { Button, IconButton, Modal, Swatch } from './ui';
import { ancestors, descendants, flatten, siblingsOf } from '../lib/tree';
import { useSelecting } from './Selection';
import { TrashBar } from './Toolbar';
import { TagChips } from './Tags';
import { ThemePicker } from './Theme';

function Chip({ scope, label, count, dot, partial, small }: { scope: Scope; label: string; count: number; dot?: string; partial?: boolean; small?: boolean }) {
  const { scope: cur, set } = useStore();
  const active = cur.kind === scope.kind && (!('id' in cur) || ('id' in scope && cur.id === scope.id));
  return (
    <button
      type="button"
      onClick={() => set({ scope })}
      aria-current={active ? 'page' : undefined}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full font-semibold transition ${small ? 'h-8 px-3 text-[13px]' : 'h-9 px-3.5 text-[14px]'} ${
        active ? 'bg-ink text-bg' : partial ? 'bg-raise text-ink ring-1 ring-ink/40' : 'bg-panel text-mute'
      }`}
    >
      {dot && <Swatch color={dot} size={8} />}
      {label}
      {count > 0 && <span className={`num text-[12px] ${active ? 'opacity-60' : 'text-faint'}`}>{count}</span>}
    </button>
  );
}

export function MobileHeader() {
  const { query, set, categories, scope, collections } = useStore();
  const root = scope.kind === 'cat' ? ancestors(categories, scope.id)[0] : undefined;
  const inRoot = root ? descendants(categories, root.id) : null;
  const sub = root && inRoot ? flatten(categories).filter((f) => inRoot.has(f.cat.id) && f.cat.id !== root.id) : [];
  const counts = useCounts();
  const [searching, setSearching] = useState(!!query);
  const filterOn = useFilterActive();

  return (
    <header className="sticky top-0 z-20 bg-bg/94 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      {searching ? (
        <div className="flex h-14 items-center gap-2 px-3">
          <label className="relative flex h-10 flex-1 items-center">
            <Search size={16} className="pointer-events-none absolute left-3 text-faint" />
            <input
              autoFocus
              type="search"
              value={query}
              onChange={(e) => set({ query: e.target.value })}
              placeholder="제목·메모·태그 검색"
              aria-label="검색"
              className="h-full w-full rounded-full bg-panel pl-9 pr-4 outline-none placeholder:text-faint"
            />
          </label>
          <IconButton label="필터" onClick={() => set({ panel: 'filters' })} className="relative h-10 w-10">
            <ListFilter size={19} />
            {filterOn && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-mark" />}
          </IconButton>
          <button
            type="button"
            className="px-2 text-[15px] font-semibold text-mute"
            onClick={() => {
              set({ query: '' });
              setSearching(false);
            }}
          >
            취소
          </button>
        </div>
      ) : (
        <div className="flex h-14 items-center gap-1 pl-4 pr-2">
          <Wordmark size={19} />
          <div className="flex-1" />
          <IconButton label="검색" onClick={() => setSearching(true)} className="h-10 w-10">
            <Search size={19} />
          </IconButton>
          <IconButton label="필터" onClick={() => set({ panel: 'filters' })} className="relative h-10 w-10">
            <ListFilter size={19} />
            {filterOn && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-mark" />}
          </IconButton>
          <IconButton label="메뉴" onClick={() => set({ panel: 'menu' })} className="h-10 w-10">
            <Menu size={19} />
          </IconButton>
        </div>
      )}
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-3 pb-2.5">
        <Chip scope={{ kind: 'all' }} label="전체" count={counts.all} />
        <Chip scope={{ kind: 'inbox' }} label="미분류" count={counts.inbox} />
        <Chip scope={{ kind: 'fav' }} label="즐겨찾기" count={counts.fav} />
        {collections.map((c) => (
          <Chip key={c.id} scope={{ kind: 'smart', id: c.id }} label={`◇ ${c.name}`} count={counts.byCollection.get(c.id) || 0} />
        ))}
        {siblingsOf(categories, null).map((c) => (
          <Chip key={c.id} scope={{ kind: 'cat', id: c.id }} label={c.name} count={counts.byCat.get(c.id) || 0} dot={c.color} partial={root?.id === c.id && scope.kind === 'cat' && scope.id !== c.id} />
        ))}
        <button
          type="button"
          onClick={() => set({ panel: 'categories' })}
          className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full border border-dashed border-line px-3.5 text-[14px] font-semibold text-faint"
        >
          <Plus size={14} /> 카테고리
        </button>
      </div>
      {scope.kind === 'trash' && (
        <div className="border-t border-line/60 px-3 py-2">
          <p className="px-1 text-[15px] font-bold">휴지통</p>
          <TrashBar />
        </div>
      )}
      {root && sub.length > 0 && (
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto border-t border-line/60 px-3 py-2">
          {sub.map(({ cat, depth }) => (
            <Chip key={cat.id} small scope={{ kind: 'cat', id: cat.id }} label={`${depth > 1 ? '›'.repeat(depth - 1) + ' ' : ''}${cat.name}`} count={counts.byCat.get(cat.id) || 0} />
          ))}
        </div>
      )}
    </header>
  );
}

export function Fab() {
  const openComposer = useStore((s) => s.openComposer);
  const selecting = useSelecting();
  if (selecting) return null;
  return (
    <button
      type="button"
      aria-label="담기"
      onClick={() => openComposer()}
      className="fixed bottom-[calc(18px+env(safe-area-inset-bottom))] right-[18px] z-30 grid h-14 w-14 place-items-center rounded-full bg-ink text-bg shadow-[0_10px_30px_rgba(0,0,0,0.45)] active:scale-95"
    >
      <Plus size={26} strokeWidth={2.4} />
    </button>
  );
}

export function FilterSheet() {
  const { panel, set, clearFilters, query, scope } = useStore();
  const active = useFilterActive();
  const canSave = active || !!query.trim() || scope.kind === 'cat';
  return (
    <Modal
      open={panel === 'filters'}
      onClose={() => set({ panel: null })}
      title="필터"
      footer={
        <div className="flex gap-2">
          <Button className="flex-1" disabled={!active} onClick={clearFilters}>
            지우기
          </Button>
          <Button variant="primary" className="flex-1" onClick={() => set({ panel: null })}>
            보기
          </Button>
        </div>
      }
    >
      <div className="space-y-6 px-5 py-5">
        <section>
          <h3 className="mb-2 text-[13px] font-semibold text-mute">종류</h3>
          <TypeFilter wrap />
        </section>
        <section>
          <h3 className="mb-2 text-[13px] font-semibold text-mute">색</h3>
          <ColorFilter size={24} wrap />
        </section>
        <section>
          <h3 className="mb-2 flex items-center justify-between text-[13px] font-semibold text-mute">
            태그 <span className="text-[12px] font-normal text-faint">여러 개 고르면 모두 가진 것만</span>
          </h3>
          <TagChips />
        </section>
        {canSave && scope.kind !== 'trash' && (
          <button
            type="button"
            onClick={() => set({ panel: 'saveCollection' })}
            className="flex w-full items-start gap-2.5 rounded-lg border border-dashed border-line px-3 py-3 text-left text-[14px] font-semibold text-mute"
          >
            <Bookmark size={16} className="mt-0.5 shrink-0" />
            <span>
              지금 조건을 ‘모음’으로 저장
              <span className="mt-0.5 block text-[12px] font-normal text-faint">조건에 맞는 새 항목이 자동으로 모입니다</span>
            </span>
          </button>
        )}
      </div>
    </Modal>
  );
}

export function MenuSheet() {
  const { panel, set, sort, setPref } = useStore();
  const counts = useCounts();
  return (
    <Modal open={panel === 'menu'} onClose={() => set({ panel: null })} title="보기">
      <div className="space-y-6 px-5 py-5">
        <section className="flex items-center justify-between gap-3">
          <h3 className="text-[14px] font-semibold">보기 방식</h3>
          <ViewSwitch />
        </section>
        <section className="flex items-center justify-between gap-3">
          <h3 className="text-[14px] font-semibold">한 줄 개수</h3>
          <DensitySwitch labels={['적게', '보통', '많이']} />
        </section>
        <section>
          <h3 className="mb-2 text-[14px] font-semibold">정렬</h3>
          <div className="flex flex-wrap gap-1.5">
            {SORTS.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={sort === s.id}
                onClick={() => setPref('sort', s.id)}
                className={`h-9 rounded-full px-3.5 text-[14px] font-semibold ${sort === s.id ? 'bg-ink text-bg' : 'bg-raise text-mute'}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </section>
        <section className="flex items-center justify-between gap-3">
          <h3 className="text-[14px] font-semibold">화면</h3>
          <ThemePicker />
        </section>
        <div className="grid gap-2 border-t border-line pt-5">
          <Button className="justify-start" onClick={() => set({ panel: null, selectMode: true })}>
            <CheckSquare size={16} /> 여러 개 선택 <span className="ml-auto text-[12px] font-normal text-faint">카드를 길게 눌러도 됩니다</span>
          </Button>
          <Button className="justify-start" onClick={() => set({ panel: 'tags' })}>
            <Hash size={16} /> 태그 정리
          </Button>
          <Button className="justify-start" onClick={() => set({ panel: null, scope: { kind: 'trash' } })}>
            <Trash2 size={16} /> 휴지통 {counts.trash > 0 && <span className="num ml-auto text-[12px] text-faint">{counts.trash}</span>}
          </Button>
          <Button className="justify-start" onClick={() => set({ panel: null, theater: { open: true, startId: null } })}>
            <Clapperboard size={16} /> 시어터로 보기
          </Button>
          <Button className="justify-start" onClick={() => set({ panel: 'categories' })}>
            <SlidersHorizontal size={16} /> 카테고리 관리
          </Button>
          <Button className="justify-start" onClick={() => set({ panel: 'settings' })}>
            <Settings size={16} /> 설정 · 백업
          </Button>
        </div>
      </div>
    </Modal>
  );
}

