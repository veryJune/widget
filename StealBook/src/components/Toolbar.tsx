// PC 상단: 지금 보고 있는 범위 이름, 검색, 정렬·보기 방식, 선택, 시어터, 필터 줄
import { useEffect, useRef, useState } from 'react';
import { BookmarkPlus, CheckSquare, Clapperboard, Search, Trash2, X } from 'lucide-react';
import { useStore } from '../store';
import { ActiveTags, ColorFilter, DensitySwitch, SortSelect, TypeFilter, ViewSwitch, useFilterActive } from './Controls';
import { Button, IconButton } from './ui';
import { ancestors } from '../lib/tree';
import { describeCriteria } from '../lib/filter';
import { useCounts } from '../hooks/useVisible';

export function useScopeLabel() {
  const { scope, categories, collections } = useStore();
  if (scope.kind === 'all') return '전체';
  if (scope.kind === 'inbox') return '미분류';
  if (scope.kind === 'fav') return '즐겨찾기';
  if (scope.kind === 'trash') return '휴지통';
  if (scope.kind === 'smart') return collections.find((c) => c.id === scope.id)?.name || '모음';
  return categories.find((c) => c.id === scope.id)?.name || '카테고리';
}

/** 상위 › 하위 경로 제목. 상위 이름을 누르면 그 카테고리로 이동 */
export function ScopeTitle({ className = '' }: { className?: string }) {
  const { scope, categories, collections, set } = useStore();
  const label = useScopeLabel();
  if (scope.kind === 'smart') {
    const col = collections.find((c) => c.id === scope.id);
    return (
      <h1 className={`flex min-w-0 items-baseline gap-2 font-extrabold tracking-tight ${className}`}>
        <span className="truncate">{label}</span>
        {col && <span className="truncate text-[13px] font-semibold text-faint">{describeCriteria(col.criteria, categories)}</span>}
      </h1>
    );
  }
  if (scope.kind !== 'cat') return <h1 className={`min-w-0 truncate font-extrabold tracking-tight ${className}`}>{label}</h1>;
  const path = ancestors(categories, scope.id);
  const parents = path.slice(0, -1);
  return (
    <h1 className={`flex min-w-0 items-baseline gap-1.5 font-extrabold tracking-tight ${className}`}>
      {parents.map((p) => (
        <span key={p.id} className="inline-flex shrink-0 items-baseline gap-1.5">
          <button type="button" onClick={() => set({ scope: { kind: 'cat', id: p.id } })} className="font-bold text-faint hover:text-ink">
            {p.name}
          </button>
          <span className="text-faint">›</span>
        </span>
      ))}
      <span className="truncate">{label}</span>
    </h1>
  );
}

/** 휴지통 안내 줄: 30일 보관, 비우기 */
export function TrashBar() {
  const { emptyTrash } = useStore();
  const counts = useCounts();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3 px-1 py-1 text-[13px] text-mute">
      <span>지운 항목은 30일 동안 보관된 뒤 자동으로 영구 삭제됩니다. 항목을 열거나 여러 개 골라 되돌릴 수 있습니다.</span>
      {counts.trash > 0 && (
        <Button variant="danger" className="h-8 px-3 text-[13px]" onClick={() => (confirm ? (emptyTrash(), setConfirm(false)) : setConfirm(true))} onBlur={() => setConfirm(false)}>
          <Trash2 size={14} /> {confirm ? `${counts.trash}개를 영구 삭제 (한 번 더 누르기)` : '휴지통 비우기'}
        </Button>
      )}
    </div>
  );
}

export function Toolbar({ count }: { count: number }) {
  const { query, set, clearFilters, scope, selectMode, clearSelection } = useStore();
  const active = useFilterActive();
  const searchRef = useRef<HTMLInputElement>(null);
  const canSave = scope.kind !== 'trash' && (active || !!query.trim());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(t.tagName) && !t.isContentEditable) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="sticky top-0 z-20 border-b border-line bg-bg/92 backdrop-blur-md">
      <div className="flex items-center gap-3 px-6 pb-2 pt-4">
        <ScopeTitle className="text-[22px]" />
        <span className="num pt-1 text-[13px] text-faint">{count}</span>
        <div className="flex-1" />
        <label className="relative flex h-9 w-[min(320px,28vw)] items-center">
          <Search size={15} className="pointer-events-none absolute left-3 text-faint" />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => set({ query: e.target.value })}
            onKeyDown={(e) => e.key === 'Escape' && (set({ query: '' }), e.currentTarget.blur())}
            placeholder="제목·메모·태그·사이트 검색"
            aria-label="검색"
            className="h-full w-full rounded-lg border border-transparent bg-panel pl-9 pr-8 text-[14px] outline-none placeholder:text-faint focus:border-line"
          />
          {query ? (
            <button type="button" className="absolute right-2 text-faint hover:text-ink" aria-label="검색어 지우기" onClick={() => set({ query: '' })}>
              <X size={14} />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute right-2.5 text-[11px] text-faint">/</kbd>
          )}
        </label>
        <SortSelect />
        <ViewSwitch />
        <DensitySwitch />
        <IconButton label={selectMode ? '선택 끝내기' : '여러 개 선택 (Ctrl+클릭)'} active={selectMode} onClick={() => (selectMode ? clearSelection() : set({ selectMode: true }))}>
          <CheckSquare size={17} />
        </IconButton>
        <IconButton label="시어터로 보기 (T)" onClick={() => set({ theater: { open: true, startId: null } })}>
          <Clapperboard size={17} />
        </IconButton>
      </div>
      <div className="no-scrollbar flex items-center gap-3 overflow-x-auto px-5 pb-2.5">
        {scope.kind === 'trash' ? (
          <TrashBar />
        ) : (
          <>
            <TypeFilter />
            <span className="h-5 w-px shrink-0 bg-line" />
            <ColorFilter size={15} />
            <ActiveTags />
            {canSave && (
              <button type="button" onClick={() => set({ panel: 'saveCollection' })} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-line px-3 text-[13px] font-semibold text-ink hover:bg-raise">
                <BookmarkPlus size={14} /> 이 조건을 모음으로 저장
              </button>
            )}
            {active && (
              <button type="button" onClick={clearFilters} className="shrink-0 text-[13px] font-semibold text-mute underline-offset-4 hover:text-ink hover:underline">
                필터 지우기
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
