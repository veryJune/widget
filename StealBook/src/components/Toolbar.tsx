// PC 상단: 지금 보고 있는 범위 이름, 검색, 정렬·보기 방식, 시어터, 필터 줄
import { useEffect, useRef } from 'react';
import { Clapperboard, Search, X } from 'lucide-react';
import { useStore } from '../store';
import { AspectFilter, ActiveTag, ColorFilter, DensitySwitch, SortSelect, TypeFilter, ViewSwitch, useFilterActive } from './Controls';
import { IconButton } from './ui';

export function useScopeLabel() {
  const { scope, categories } = useStore();
  if (scope.kind === 'all') return '전체';
  if (scope.kind === 'inbox') return '인박스';
  if (scope.kind === 'fav') return '즐겨찾기';
  return categories.find((c) => c.id === scope.id)?.name || '카테고리';
}

export function Toolbar({ count }: { count: number }) {
  const { query, set, clearFilters } = useStore();
  const label = useScopeLabel();
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
        <h1 className="min-w-0 truncate text-[22px] font-extrabold tracking-tight">{label}</h1>
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
