// 검색창: 비어 있을 때 검색 요령, '#…' · '출처:…' 를 칠 때는 자동 완성
import { forwardRef, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useStore } from '../store';
import { useSourceCounts, useTagCounts } from '../hooks/useVisible';
import { SearchHelp } from './Controls';

// 예시를 누르면 넣을 앞부분 (자리표시 낱말은 빼고 넣음)
const PREFIX: Record<string, string> = { '#태그': '#', '-#태그': '-#', '-낱말': '-', '"정확한 문구"': '"' };

export const SearchBox = forwardRef<HTMLInputElement, { variant: 'desktop' | 'mobile'; autoFocus?: boolean }>(function SearchBox({ variant, autoFocus }, ref) {
  const { query, set } = useStore();
  const [focused, setFocused] = useState(false);
  const tags = useTagCounts();
  const sources = useSourceCounts();

  // 마지막 낱말이 '#…' 또는 '출처:…' 이면 후보 보여주기
  const last = query.match(/(\S*)$/)?.[1] || '';
  const suggest = useMemo(() => {
    const t = last.match(/^(-?#)(.*)$/);
    if (t) {
      const f = t[2].toLowerCase();
      return tags
        .filter(([x]) => x.toLowerCase().includes(f) && x !== t[2])
        .slice(0, 8)
        .map(([x, n]) => ({ insert: `${t[1]}${x}`, label: `${t[1]}${x}`, n }));
    }
    const s = last.match(/^(-?)(출처|site|사이트):(.*)$/i);
    if (s) {
      const f = s[3].toLowerCase();
      return sources
        .filter(([x]) => (x.id.includes(f) || x.label.toLowerCase().includes(f)) && x.id !== f)
        .slice(0, 8)
        .map(([x, n]) => ({ insert: `${s[1]}${s[2]}:${x.id}`, label: `${s[2]}:${x.label}`, n }));
    }
    return [];
  }, [last, tags, sources]);

  const replaceLast = (tok: string) => set({ query: query.slice(0, query.length - last.length) + tok + ' ' });
  const append = (tok: string) => {
    const pre = PREFIX[tok];
    set({ query: (query.trim() ? query.trimEnd() + ' ' : '') + (pre ?? tok + ' ') });
  };

  const showHelp = focused && !query.trim();
  const showSuggest = focused && suggest.length > 0;
  const mobile = variant === 'mobile';

  return (
    <div className={`relative ${mobile ? 'flex-1' : 'w-[min(340px,30vw)]'}`}>
      <label className={`relative flex items-center ${mobile ? 'h-10' : 'h-9'}`}>
        <Search size={mobile ? 16 : 15} className="pointer-events-none absolute left-3 text-faint" />
        <input
          ref={ref}
          autoFocus={autoFocus}
          type="search"
          value={query}
          onChange={(e) => set({ query: e.target.value })}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              set({ query: '' });
              e.currentTarget.blur();
            }
            if (e.key === 'Tab' && showSuggest) {
              e.preventDefault();
              replaceLast(suggest[0].insert);
            }
          }}
          placeholder={mobile ? '검색 · #태그 · 출처:youtube' : '검색 · #태그 · 출처: · 기간:'}
          aria-label="검색"
          className={`h-full w-full bg-panel pl-9 text-[14px] outline-none placeholder:text-faint [&::-webkit-search-cancel-button]:hidden ${
            mobile ? 'rounded-full pr-9 text-[15px]' : 'rounded-lg border border-transparent pr-8 focus:border-line'
          }`}
        />
        {query ? (
          <button type="button" className="absolute right-2.5 text-faint hover:text-ink" aria-label="검색어 지우기" onMouseDown={(e) => e.preventDefault()} onClick={() => set({ query: '' })}>
            <X size={14} />
          </button>
        ) : (
          !mobile && <kbd className="pointer-events-none absolute right-2.5 text-[11px] text-faint">/</kbd>
        )}
      </label>
      {showSuggest && (
        <div
          onMouseDown={(e) => e.preventDefault()}
          className={`absolute z-30 mt-1.5 w-full min-w-[240px] overflow-hidden rounded-xl border border-line bg-panel py-1 shadow-[0_16px_40px_rgba(0,0,0,0.28)] ${mobile ? 'left-0' : 'right-0'}`}
          role="listbox"
          aria-label="자동 완성"
        >
          {suggest.map((x, i) => (
            <button key={x.insert} type="button" role="option" aria-selected={i === 0} onClick={() => replaceLast(x.insert)} className="flex w-full items-center justify-between px-3 py-2 text-left text-[13.5px] hover:bg-raise">
              <span className="font-semibold">{x.label}</span>
              <span className="num text-[12px] text-faint">
                {x.n}
                {i === 0 && !mobile && <kbd className="ml-2 text-[10px]">Tab</kbd>}
              </span>
            </button>
          ))}
        </div>
      )}
      {showHelp && <SearchHelp onPick={append} className={`absolute z-30 mt-1.5 ${mobile ? 'left-0 w-full' : 'right-0 w-[420px]'}`} />}
    </div>
  );
});
