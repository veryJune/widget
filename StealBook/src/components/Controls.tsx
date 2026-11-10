// 필터 · 보기 방식 · 정렬 조작 (PC 툴바와 모바일 시트에서 같이 씀)
import { AppWindow, FileText, Image as ImageIcon, LayoutGrid, Link2, List, Play, Rows3, Video, X } from 'lucide-react';
import type { ItemType, SortMode, ViewMode } from '../lib/types';
import { FAMILIES } from '../lib/colors';
import { useStore } from '../store';
import { useSourceCounts, useTagCounts } from '../hooks/useVisible';
import { PERIODS, QUERY_EXAMPLES, type Period } from '../lib/query';

export const TYPES: { id: ItemType; label: string; Icon: typeof ImageIcon }[] = [
  { id: 'image', label: '이미지', Icon: ImageIcon },
  { id: 'video', label: '영상', Icon: Video },
  { id: 'embed', label: '임베드', Icon: Play },
  { id: 'link', label: '링크', Icon: Link2 },
  { id: 'note', label: '메모', Icon: FileText },
  { id: 'file', label: '파일', Icon: FileText },
  { id: 'page', label: '페이지', Icon: AppWindow },
];

export const SORTS: { id: SortMode; label: string }[] = [
  { id: 'new', label: '최근 담은 순' },
  { id: 'old', label: '오래된 순' },
  { id: 'title', label: '제목 순' },
  { id: 'shuffle', label: '무작위' },
];

export const VIEWS: { id: ViewMode; label: string; Icon: typeof LayoutGrid }[] = [
  { id: 'masonry', label: '벽돌 갤러리', Icon: Rows3 },
  { id: 'grid', label: '균일 그리드', Icon: LayoutGrid },
  { id: 'list', label: '목록', Icon: List },
];

const chip = (on: boolean) =>
  `inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[13px] font-semibold transition ${
    on ? 'bg-mark text-on-mark' : 'text-mute hover:bg-raise hover:text-ink'
  }`;

export function useFilterActive() {
  const { type, color, tags, source, period } = useStore();
  return !!(type || color || tags.length || source || period);
}

const selectCls = (on: boolean) =>
  `h-8 shrink-0 cursor-pointer rounded-full border-0 pl-3 pr-2 text-[13px] font-semibold outline-none transition ${on ? 'bg-mark text-on-mark' : 'bg-transparent text-mute hover:bg-raise hover:text-ink'}`;

/** 출처(가져온 사이트) — PC 는 펼침 목록, 휴대폰은 칩 */
export function SourceFilter({ chips = false }: { chips?: boolean }) {
  const { source, set } = useStore();
  const counts = useSourceCounts();
  if (chips) {
    if (!counts.length) return <p className="text-[13px] text-faint">아직 담은 것이 없습니다.</p>;
    return (
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="출처">
        {counts.slice(0, 12).map(([s, n]) => (
          <button key={s.id} type="button" aria-pressed={source === s.id} onClick={() => set({ source: source === s.id ? null : s.id })} className={`${chip(source === s.id)} ${source === s.id ? '' : 'bg-raise'}`}>
            {s.label} <span className="num text-[11px] font-normal opacity-70">{n}</span>
          </button>
        ))}
      </div>
    );
  }
  if (counts.length < 2 && !source) return null;
  return (
    <select aria-label="출처" value={source || ''} onChange={(e) => set({ source: e.target.value || null })} className={selectCls(!!source)}>
      <option value="">출처 전체</option>
      {counts.map(([s, n]) => (
        <option key={s.id} value={s.id}>
          {s.label} ({n})
        </option>
      ))}
    </select>
  );
}

/** 기간 */
export function PeriodFilter({ chips = false }: { chips?: boolean }) {
  const { period, set } = useStore();
  if (chips) {
    return (
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="기간">
        {PERIODS.map((p) => (
          <button key={p.id} type="button" aria-pressed={period === p.id} onClick={() => set({ period: period === p.id ? null : p.id })} className={`${chip(period === p.id)} ${period === p.id ? '' : 'bg-raise'}`}>
            {p.label}
          </button>
        ))}
      </div>
    );
  }
  return (
    <select aria-label="기간" value={period || ''} onChange={(e) => set({ period: (e.target.value || null) as Period | null })} className={selectCls(!!period)}>
      <option value="">기간 전체</option>
      {PERIODS.map((p) => (
        <option key={p.id} value={p.id}>
          {p.label}
        </option>
      ))}
    </select>
  );
}

export function TypeFilter({ wrap = false }: { wrap?: boolean }) {
  const { type, set } = useStore();
  return (
    <div className={`flex items-center gap-0.5 ${wrap ? 'flex-wrap' : 'shrink-0'}`} role="group" aria-label="종류">
      {TYPES.map(({ id, label, Icon }) => (
        <button key={id} type="button" aria-pressed={type === id} className={chip(type === id)} onClick={() => set({ type: type === id ? null : id })}>
          <Icon size={14} /> {label}
        </button>
      ))}
    </div>
  );
}

export function ColorFilter({ size = 18, wrap = false }: { size?: number; wrap?: boolean }) {
  const { color, set } = useStore();
  return (
    <div className={`flex items-center gap-1 ${wrap ? 'flex-wrap' : 'shrink-0'}`} role="group" aria-label="색으로 찾기">
      {FAMILIES.map((f) => (
        <button
          key={f.id}
          type="button"
          title={f.label}
          aria-label={f.label}
          aria-pressed={color === f.id}
          onClick={() => set({ color: color === f.id ? null : f.id })}
          className="grid place-items-center rounded-full p-1 transition hover:scale-110"
        >
          <span
            className="block rounded-full"
            style={{
              width: size,
              height: size,
              background: f.hex,
              boxShadow: color === f.id ? '0 0 0 2px var(--bg), 0 0 0 4px var(--mark)' : 'inset 0 0 0 1px rgba(127,127,127,0.4)',
            }}
          />
        </button>
      ))}
    </div>
  );
}

/** 지금 걸린 태그 필터들 — 하나씩 × 로 빼기 */
export function ActiveTags() {
  const { tags, pickTag } = useStore();
  if (!tags.length) return null;
  return (
    <div className="flex shrink-0 items-center gap-1" role="group" aria-label="걸린 태그">
      {tags.map((t, i) => (
        <span key={t} className="flex items-center gap-1">
          {i > 0 && <span className="text-[12px] font-bold text-faint">+</span>}
          <button type="button" className={chip(true)} onClick={() => pickTag(t, 'toggle')} aria-label={`#${t} 태그 필터 빼기`}>
            #{t} <X size={13} />
          </button>
        </span>
      ))}
    </div>
  );
}

export function ViewSwitch() {
  const { view, setPref } = useStore();
  return (
    <div className="flex items-center rounded-lg bg-panel p-0.5" role="group" aria-label="보기 방식">
      {VIEWS.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          title={label}
          aria-label={label}
          aria-pressed={view === id}
          onClick={() => setPref('view', id)}
          className={`grid h-8 w-9 place-items-center rounded-md transition ${view === id ? 'bg-raise text-ink' : 'text-mute hover:text-ink'}`}
        >
          <Icon size={16} />
        </button>
      ))}
    </div>
  );
}

export function DensitySwitch({ labels = ['작게', '보통', '크게'] }: { labels?: string[] }) {
  const { density, setPref, view } = useStore();
  if (view === 'list') return null;
  return (
    <div className="flex items-center rounded-lg bg-panel p-0.5" role="group" aria-label="썸네일 크기">
      {([0, 1, 2] as const).map((d) => (
        <button
          key={d}
          type="button"
          aria-pressed={density === d}
          title={`썸네일 ${labels[d]}`}
          onClick={() => setPref('density', d)}
          className={`grid h-8 w-8 place-items-center rounded-md transition ${density === d ? 'bg-raise text-ink' : 'text-mute hover:text-ink'}`}
        >
          <span className="block rounded-[2px] bg-current" style={{ width: 6 + d * 3, height: 6 + d * 3 }} />
        </button>
      ))}
    </div>
  );
}

export function SortSelect() {
  const { sort, setPref } = useStore();
  return (
    <select
      aria-label="정렬"
      value={sort}
      onChange={(e) => setPref('sort', e.target.value as SortMode)}
      className="h-9 cursor-pointer rounded-lg border-0 bg-panel px-2.5 text-[13px] font-semibold text-ink outline-none"
    >
      {SORTS.map((s) => (
        <option key={s.id} value={s.id}>
          {s.label}
        </option>
      ))}
    </select>
  );
}

/** 검색창 아래 도움말: 문법 예시 + 자주 쓴 태그·출처 (눌러서 넣기) */
export function SearchHelp({ onPick, className = '' }: { onPick: (token: string) => void; className?: string }) {
  const tags = useTagCounts().slice(0, 8);
  const sources = useSourceCounts().slice(0, 6);
  const keep = (e: React.MouseEvent) => e.preventDefault(); // 입력칸 포커스 유지
  return (
    <div onMouseDown={keep} className={`rounded-xl border border-line bg-panel p-3 text-[13px] shadow-[0_16px_40px_rgba(0,0,0,0.28)] ${className}`}>
      <p className="mb-2 px-1 text-[12px] font-semibold text-faint">검색 요령 · 눌러서 넣기, 섞어 써도 됩니다</p>
      <div className="grid grid-cols-1 gap-x-2 gap-y-0.5 sm:grid-cols-2">
        {QUERY_EXAMPLES.map((x) => (
          <button key={x.token} type="button" onClick={() => onPick(x.token)} className="flex items-baseline gap-2 rounded-md px-1.5 py-1 text-left hover:bg-raise">
            <code className="shrink-0 font-sans font-bold text-ink">{x.token}</code>
            <span className="truncate text-[12px] text-faint">{x.note}</span>
          </button>
        ))}
      </div>
      {tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1 border-t border-line pt-2">
          {tags.map(([t]) => (
            <button key={t} type="button" onClick={() => onPick('#' + t)} className="h-7 rounded-full bg-raise px-2.5 text-[12px] font-semibold text-mute hover:text-ink">
              #{t}
            </button>
          ))}
        </div>
      )}
      {sources.length > 1 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {sources.map(([src]) => (
            <button key={src.id} type="button" onClick={() => onPick('출처:' + src.id)} className="h-7 rounded-full bg-raise px-2.5 text-[12px] font-semibold text-mute hover:text-ink">
              출처:{src.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
