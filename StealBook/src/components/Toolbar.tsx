// PC 상단: 지금 보고 있는 범위 이름, 검색, 정렬·보기 방식, 시어터, 필터 줄
import { useEffect, useRef } from 'react';
import { Clapperboard, Search, X } from 'lucide-react';
import { useStore } from '../store';
import { AspectFilter, ActiveTag, ColorFilter, DensitySwitch, SortSelect, TypeFilter, ViewSwitch, useFilterActive } from './Controls';
import { IconButton } from './ui';
import { ancestors } from '../lib/tree';

export function useScopeLabel() {
  const { scope, categories } = useStore();
  if (scope.kind === 'all') return '전체';
  if (scope.kind === 'inbox') return '인박스';
  if (scope.kind === 'fav') return '즐겨찾기';
  return categories.find((c) => c.id === scope.id)?.name || '카테고리';
}

/** 상위 › 하위 경로 제목. 상위 이름을 누르면 그 카테고리로 이동 */
export function ScopeTitle({ className = '' }: { className?: string }) {
  const { scope, categories, set } = useStore();
  const label = useScopeLabel();
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

export function Toolbar({ count }: { count: number }) {
  const { query, set, clearFilters } = useStore();
  const active = useFilterActive();
  const searchRef = useRef<HTMLInputElement>(null);

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
        <label className="relative flex h-9 w-[min(340px,32vw)] items-center">
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
        <IconButton label="시어터로 보기 (T)" onClick={() => set({ theater: { open: true, startId: null } })}>
          <Clapperboard size={17} />
        </IconButton>
      </div>
      <div className="no-scrollbar flex items-center gap-3 overflow-x-auto px-5 pb-2.5">
        <TypeFilter />
        <span className="h-5 w-px shrink-0 bg-line" />
        <AspectFilter />
        <span className="h-5 w-px shrink-0 bg-line" />
        <ColorFilter size={15} />
        <ActiveTag />
        {active && (
          <button type="button" onClick={clearFilters} className="shrink-0 text-[13px] font-semibold text-mute underline-offset-4 hover:text-ink hover:underline">
            필터 지우기
          </button>
        )}
      </div>
    </div>
  );
}
