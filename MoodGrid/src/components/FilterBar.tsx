// 필터 바: 검색 · 별점 · 보드의 대표 색. 헤더 아래에 필요할 때만 나타남 (`/` 키로 열기)
import { useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { useStore, viewOptsOf } from '../store';
import { buildPalette } from '../lib/colors';
import { buildView, isFiltering } from '../lib/order';

const RATINGS: { v: 0 | 1 | 2 | 3; label: string }[] = [
  { v: 0, label: '전체' },
  { v: 1, label: '★ 1+' },
  { v: 2, label: '★ 2+' },
  { v: 3, label: '★ 3' },
];

export function FilterBar() {
  const open = useStore((s) => s.filterOpen);
  const query = useStore((s) => s.query);
  const color = useStore((s) => s.colorFilter);
  const rating = useStore((s) => s.filter);
  const items = useStore((s) => s.items);
  const projects = useStore((s) => s.projects);
  const currentId = useStore((s) => s.currentId);
  const act = useStore.getState;

  const active = isFiltering({ minRating: rating, query, color });
  const palette = useMemo(() => buildPalette(items, 10), [items]);
  const counts = useMemo(() => {
    const total = items.filter((i) => !i.deleted_at && i.type !== 'divider').length;
    const shown = buildView(items, { ...viewOptsOf({ projects, currentId, filter: rating, query, colorFilter: color, cinema: false }), sort: 'manual' }).filter((i) => i.type !== 'divider').length;
    return { total, shown };
  }, [items, projects, currentId, rating, query, color]);

  if (!open && !active) return null;

  const close = () => {
    act().clearFilters();
    act().setFilterOpen(false);
  };

  return (
    <div className="fade-in flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-bg/85 px-3 py-2 backdrop-blur-md md:px-5" role="search" aria-label="필터">
      <label className="relative flex min-w-[180px] flex-1 items-center sm:max-w-[360px]">
        <Search size={15} className="pointer-events-none absolute left-3 text-faint" />
        <input
          id="filter-search"
          autoFocus={open}
          value={query}
          onChange={(e) => act().setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              if (query) act().setQuery('');
              else {
                (e.target as HTMLInputElement).blur();
                if (!active) act().setFilterOpen(false);
              }
            }
          }}
          placeholder="메모 · 제목 · 출처 검색   ( / )"
          aria-label="검색"
          className="h-9 w-full rounded-lg border border-line bg-bg pl-9 pr-8 text-[14px] placeholder:text-faint focus:border-mark focus:outline-none"
        />
        {query && (
          <button type="button" aria-label="검색어 지우기" onClick={() => act().setQuery('')} className="absolute right-2 flex h-5 w-5 items-center justify-center rounded-full text-faint hover:text-ink">
            <X size={13} />
          </button>
        )}
      </label>

      <div className="flex items-center rounded-lg bg-raise p-0.5" role="group" aria-label="별점 필터">
        {RATINGS.map((r) => (
          <button key={r.v} type="button" aria-pressed={rating === r.v} onClick={() => act().setFilter(r.v)} className={`h-8 rounded-md px-2.5 text-[12.5px] font-semibold transition ${rating === r.v ? 'bg-panel text-ink shadow-sm' : 'text-mute hover:text-ink'}`}>
            {r.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2" role="group" aria-label="대표 색으로 찾기">
        <span className="text-[12px] font-semibold text-mute">색</span>
        {palette.length === 0 ? (
          <span className="text-[12px] text-faint">이미지를 추가하면 색이 나와요</span>
        ) : (
          palette.map((hex) => (
            <button
              key={hex}
              type="button"
              title={`${hex.toUpperCase()} 와 비슷한 색`}
              aria-label={`색 ${hex} 로 찾기`}
              aria-pressed={color === hex}
              onClick={() => act().setColorFilter(hex)}
              className={`h-6 w-6 rounded-full border border-line transition hover:scale-110 ${color === hex ? 'ring-2 ring-mark ring-offset-2 ring-offset-bg' : ''}`}
              style={{ background: hex }}
            />
          ))
        )}
      </div>

      <div className="ml-auto flex items-center gap-3">
        <span className="num text-[12.5px] text-mute" aria-live="polite">
          {active ? (
            <>
              <b className="text-ink">{counts.shown}</b> / {counts.total}
            </>
          ) : (
            `${counts.total}개`
          )}
        </span>
        {active && (
          <button type="button" onClick={() => act().clearFilters()} className="h-8 rounded-lg px-2.5 text-[12.5px] font-semibold text-mute hover:bg-raise hover:text-ink">
            필터 해제
          </button>
        )}
        <button type="button" aria-label="필터 닫기" title="필터 닫기" onClick={close} className="flex h-8 w-8 items-center justify-center rounded-lg text-mute hover:bg-raise hover:text-ink">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
